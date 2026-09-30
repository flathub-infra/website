import argparse
import json
import sys
from dataclasses import asdict

from app.moderation.ostree_permissions import CollectedPermissions, collect_permissions
from app.moderation.permission_snapshot import (
    PermissionSnapshotError,
    compare_snapshots,
    fingerprint_snapshot,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--published-repo", required=True)
    parser.add_argument("--app-id", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--candidate-repo")
    parser.add_argument("--candidate-ref", action="append")
    parser.add_argument("--expected-arch", action="append")
    parser.add_argument("--timeout-seconds", type=float, default=60.0)
    return parser


def _collection_json(collection: CollectedPermissions) -> dict:
    return {
        "repository_url": collection.repository_url,
        "captured_at": collection.captured_at,
        "artifacts": [asdict(artifact) for artifact in collection.artifacts],
        "snapshot": asdict(collection.snapshot),
        "fingerprint": fingerprint_snapshot(collection.snapshot),
    }


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    candidate_args = (args.candidate_repo, args.candidate_ref, args.expected_arch)
    if any(value is not None for value in candidate_args) and not all(candidate_args):
        parser.error(
            "Candidate repository, refs, and expected architectures must all be supplied"
        )
    commits = {}
    arches = set()
    if args.candidate_repo:
        for item in args.candidate_ref:
            ref, separator, checksum = item.partition("=")
            if not separator or not ref or not checksum or "=" in checksum:
                parser.error(f"Invalid candidate ref binding: {item}")
            if ref in commits:
                parser.error(f"Duplicate candidate ref: {ref}")
            commits[ref] = checksum
        for arch in args.expected_arch:
            if arch in arches:
                parser.error(f"Duplicate expected architecture: {arch}")
            arches.add(arch)

    try:
        published = collect_permissions(
            args.published_repo,
            app_id=args.app_id,
            flatpak_branch=args.branch,
            timeout_seconds=args.timeout_seconds,
        )
        result = {
            "mode": "comparison_preview" if args.candidate_repo else "baseline_preview",
            "status": "complete",
            "app_id": args.app_id,
            "flatpak_branch": args.branch,
            "published": _collection_json(published),
        }
        if args.candidate_repo:
            candidate = collect_permissions(
                args.candidate_repo,
                app_id=args.app_id,
                flatpak_branch=args.branch,
                expected_commits=commits,
                expected_arches=arches,
                timeout_seconds=args.timeout_seconds,
            )
            differences = compare_snapshots(published.snapshot, candidate.snapshot)
            result.update(
                candidate=_collection_json(candidate),
                equal=not differences,
                differences=[asdict(difference) for difference in differences],
            )
        print(json.dumps(result, ensure_ascii=True, sort_keys=True, indent=2))
    except PermissionSnapshotError as exc:
        error = {"code": exc.code, "message": exc.message}
        if exc.ref_name is not None:
            error["ref_name"] = exc.ref_name
        print(
            json.dumps(
                {"status": "error", "error": error},
                ensure_ascii=True,
                sort_keys=True,
                indent=2,
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
