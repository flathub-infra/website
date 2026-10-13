import argparse
import json
import sys
from collections import Counter
from collections.abc import Iterable
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app import config, models
from app.database import get_db
from app.moderation.ostree_permissions import (
    CollectedPermissions,
    PublishedPermissions,
    collect_published_permissions,
)
from app.moderation.permission_snapshot import (
    PermissionSnapshotError,
    fingerprint_snapshot,
)

CHANNEL = "stable"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=config.settings.repo_url)
    parser.add_argument("--app-id", action="append")
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--timeout-seconds", type=float, default=600.0)
    parser.add_argument("--report")
    parser.add_argument("--write", action="store_true")
    return parser


def baseline_values(item: CollectedPermissions) -> dict[str, Any]:
    return {
        "app_id": item.app_id,
        "channel": CHANNEL,
        "flatpak_branch": item.flatpak_branch,
        "source": "initialized",
        "repository_url": item.repository_url,
        "captured_at": datetime.fromisoformat(item.captured_at)
        .astimezone(UTC)
        .replace(tzinfo=None),
        "canonicalization_version": item.snapshot.canonicalization_version,
        "artifacts": [asdict(artifact) for artifact in item.artifacts],
        "snapshot": asdict(item.snapshot),
        "fingerprint": fingerprint_snapshot(item.snapshot),
    }


def plan_baselines(
    collection: PublishedPermissions, existing: dict[tuple[str, str], str]
) -> dict[str, Any]:
    entries = []
    for item in collection.collected:
        values = baseline_values(item)
        stored = existing.get((item.app_id, item.flatpak_branch))
        if stored is None:
            status = "new"
        elif stored == values["fingerprint"]:
            status = "existing_same"
        else:
            status = "existing_different"
        entries.append(
            {
                "status": status,
                "app_id": item.app_id,
                "flatpak_branch": item.flatpak_branch,
                "arches": sorted(item.snapshot.architectures),
                "fingerprint": values["fingerprint"],
                "values": values,
            }
        )
    failures = [asdict(failure) for failure in collection.failures]
    counts = Counter(entry["status"] for entry in entries)
    return {
        "channel": CHANNEL,
        "repository_url": collection.repository_url,
        "captured_at": collection.captured_at,
        "counts": {
            "collected": len(entries),
            "new": counts["new"],
            "existing_same": counts["existing_same"],
            "existing_different": counts["existing_different"],
            "failures": len(failures),
        },
        "failure_codes": dict(Counter(failure["code"] for failure in failures)),
        "entries": entries,
        "failures": failures,
    }


def existing_baselines() -> dict[tuple[str, str], str]:
    baseline = models.PermissionBaseline
    with get_db("writer") as db:
        rows = db.session.execute(
            select(
                baseline.app_id, baseline.flatpak_branch, baseline.fingerprint
            ).where(baseline.channel == CHANNEL)
        ).all()
    return {(row.app_id, row.flatpak_branch): row.fingerprint for row in rows}


def write_baselines(values: Iterable[dict[str, Any]], batch_size: int = 500) -> int:
    pending = list(values)
    inserted = 0
    with get_db("writer") as db:
        for start in range(0, len(pending), batch_size):
            result = db.session.execute(
                insert(models.PermissionBaseline)
                .values(pending[start : start + batch_size])
                .on_conflict_do_nothing(
                    index_elements=["app_id", "channel", "flatpak_branch"]
                )
                .returning(models.PermissionBaseline.id)
            )
            inserted += len(result.all())
    return inserted


def report_json(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        **plan,
        "entries": [
            {key: value for key, value in entry.items() if key != "values"}
            for entry in plan["entries"]
        ],
    }


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    try:
        collection = collect_published_permissions(
            args.repo,
            app_ids=set(args.app_id) if args.app_id else None,
            batch_size=args.batch_size,
            timeout_seconds=args.timeout_seconds,
        )
    except PermissionSnapshotError as exc:
        print(
            json.dumps(
                {
                    "status": "error",
                    "error": {"code": exc.code, "message": exc.message},
                },
                sort_keys=True,
                indent=2,
            )
        )
        sys.exit(1)

    plan = plan_baselines(collection, existing_baselines())
    summary: dict[str, Any] = {
        "mode": "write" if args.write else "preview",
        "channel": plan["channel"],
        "repository_url": plan["repository_url"],
        "captured_at": plan["captured_at"],
        "counts": plan["counts"],
        "failure_codes": plan["failure_codes"],
    }
    if args.write:
        summary["inserted"] = write_baselines(
            entry["values"] for entry in plan["entries"] if entry["status"] == "new"
        )
    if args.report:
        with open(args.report, "w", encoding="utf-8") as report:
            json.dump(
                {**summary, **report_json(plan)},
                report,
                default=str,
                sort_keys=True,
                indent=2,
            )
    print(json.dumps(summary, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
