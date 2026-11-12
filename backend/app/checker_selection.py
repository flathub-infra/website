"""Selection evidence is independent of checker source results."""

import hashlib
import io
import json
import re
import zipfile
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue

REPOSITORY = r"[A-Za-z0-9._-]+"
SELECTION_NAME = re.compile(r"checker-selection-(\d+)-(\d+)-(\d+)$")


class Evidence(BaseModel):
    model_config = ConfigDict(strict=True)


class Invocation(Evidence):
    started: bool
    exit_code: int | None = Field(ge=0, le=255)
    report: Literal[
        "not_expected", "pending", "missing", "invalid_json_object", "valid_json_object"
    ]


def invocation_outcome(invocation: Invocation) -> str:
    if not invocation.started:
        return "not_started"
    if invocation.exit_code is None:
        return "unknown"
    if invocation.exit_code == 0:
        return "succeeded"
    if invocation.exit_code == 2:
        return "outdated_only"
    return "failed"


class Decision(Evidence):
    repository: str = Field(pattern=f"^{REPOSITORY}$", max_length=255)
    selection: Literal["selected", "excluded", "error", "pending"]
    reason: str | None
    error: str | None
    branch: str | None
    commit: str | None
    checkout_unknown_reason: str | None
    invocation: Invocation
    manifest: str | None = None


class ListingEntry(Evidence):
    name: str = Field(pattern=f"^{REPOSITORY}$", max_length=255)
    archived: bool | None


class Listing(Evidence):
    file: Literal["listing.json"]
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    started_at: str
    finished_at: str
    shared_between_shards: Literal[False]
    source: Literal["github_api", "inactive_target_input"]


class Inventory(Evidence):
    schema_version: Literal[1]
    selection_rule_version: Literal[1]
    run_id: str = Field(pattern=r"^[1-9][0-9]*$")
    run_attempt: str = Field(pattern=r"^[1-9][0-9]*$")
    workflow_ref: str
    workflow_sha: str = Field(pattern=r"^[0-9a-f]{40}$")
    selection_repository: Literal["flathub/flathub"]
    selection_sha: str = Field(pattern=r"^[0-9a-f]{40}$")
    scope: Literal["public_organization", "target_request"]
    target: str | None
    shard_index: int = Field(ge=0, lt=100)
    shard_count: int = Field(ge=1, le=100)
    listing_complete: bool
    processing_complete: bool
    exit_code: int | None = Field(ge=0, le=255)
    listing: Listing | None = None


def parse_selection(
    content: bytes, name: str
) -> tuple[dict[str, JsonValue], list[JsonValue], dict[str, JsonValue]]:
    from .checker_health_ingestion import (
        MAX_ARCHIVE_SIZE,
        MAX_EXPANDED_SIZE,
        MAX_REPORT_SIZE,
    )

    if len(content) > MAX_ARCHIVE_SIZE:
        raise ValueError("Selection archive exceeds download limit")
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if (
            len(entries) > 20000
            or sum(e.file_size for e in entries) > MAX_EXPANDED_SIZE
        ):
            raise ValueError("Selection archive exceeds expanded limits")
        names = [e.filename for e in entries]
        if len(names) != len(set(names)):
            raise ValueError("Duplicate selection archive entry")
        for entry in entries:
            if entry.filename == "repositories/" and entry.is_dir():
                continue
            if entry.flag_bits & 1 or entry.compress_type not in (
                zipfile.ZIP_STORED,
                zipfile.ZIP_DEFLATED,
            ):
                raise ValueError("Unsupported selection ZIP entry")
            if entry.file_size > MAX_REPORT_SIZE or not (
                entry.filename
                in ("inventory.json", "listing.json", "inactive-repos.txt")
                or re.fullmatch(
                    rf"repositories/repo-{REPOSITORY}\.json", entry.filename
                )
            ):
                raise ValueError("Invalid selection archive entry")
        raw = json.loads(archive.read("inventory.json"))
        if (
            not isinstance(raw, dict)
            or type(raw.get("schema_version")) is not int
            or type(raw.get("selection_rule_version")) is not int
        ):
            raise ValueError("Invalid selection schema version")
        inventory = Inventory.model_validate(raw)
        if "inactive-repos.txt" in names:
            inactive = archive.read("inactive-repos.txt").decode("utf-8").split("\n")
            if inactive[-1] == "":
                inactive.pop()
            if any(
                not re.fullmatch(REPOSITORY, repo) or repo in (".", "..")
                for repo in inactive
            ):
                raise ValueError("Invalid inactive repository snapshot")
        elif inventory.listing_complete:
            raise ValueError("Missing inactive repository snapshot")
        if inventory.listing is not None:
            started = datetime.fromisoformat(inventory.listing.started_at)
            finished = datetime.fromisoformat(inventory.listing.finished_at)
            if started.tzinfo is None or finished.tzinfo is None or finished < started:
                raise ValueError("Invalid listing timestamps")
        match = SELECTION_NAME.fullmatch(name)
        if not match or (
            int(inventory.run_id),
            int(inventory.run_attempt),
            inventory.shard_index,
        ) != tuple(map(int, match.groups())):
            raise ValueError("Selection artifact identity mismatch")
        if inventory.shard_index >= inventory.shard_count:
            raise ValueError("Invalid shard index")
        if inventory.scope == "target_request":
            if (
                not inventory.target
                or inventory.target in (".", "..")
                or not re.fullmatch(REPOSITORY, inventory.target)
                or inventory.shard_count != 1
            ):
                raise ValueError("Invalid targeted inventory")
        elif inventory.target is not None:
            raise ValueError("Unexpected inventory target")
        listing = []
        if inventory.listing_complete:
            if inventory.listing is None:
                raise ValueError("Missing listing provenance")
            data = archive.read("listing.json")
            if hashlib.sha256(data).hexdigest() != inventory.listing.sha256:
                raise ValueError("Listing digest mismatch")
            listing = json.loads(data)
            if not isinstance(listing, list):
                raise ValueError("Invalid listing")
            parsed = [ListingEntry.model_validate(item) for item in listing]
            if any(item.name in (".", "..") for item in parsed):
                raise ValueError("Invalid listing repository")
            if len({item.name.lower() for item in parsed}) != len(parsed):
                raise ValueError("Duplicate listing repository")
            if inventory.scope == "target_request" and [
                item.name.lower() for item in parsed
            ] != [(inventory.target or "").lower()]:
                raise ValueError("Target listing mismatch")
            if (
                any(item.archived is None for item in parsed)
                and inventory.listing.source != "inactive_target_input"
            ):
                raise ValueError("Unknown archived status in public listing")
        decisions = {}
        listed = {item["name"] for item in listing}
        for filename in names:
            if not filename.startswith("repositories/") or not filename.endswith(
                ".json"
            ):
                continue
            row = json.loads(archive.read(filename))
            decision = Decision.model_validate(row)
            if (
                filename != f"repositories/repo-{decision.repository}.json"
                or decision.repository not in listed
            ):
                raise ValueError("Decision repository mismatch")
            if decision.selection == "excluded" and (
                not decision.reason or decision.invocation.started
            ):
                raise ValueError("Invalid excluded decision")
            if decision.selection == "error" and not decision.error:
                raise ValueError("Missing selection error")
            if decision.selection == "selected" and not decision.invocation.started:
                raise ValueError("Selected checker was not started")
            if not decision.invocation.started and (
                decision.invocation.exit_code is not None
                or decision.invocation.report != "not_expected"
            ):
                raise ValueError("Invocation evidence without execution")
            decisions[decision.repository] = row
        return raw, listing, decisions


class SelectionCoverage(BaseModel):
    state: str = "unknown"
    issues: list[str] = Field(default_factory=list)
    run_url: str | None = None
    artifact_ids: list[int] = Field(default_factory=list)
    scope: str | None = None
    observed_at: str | None = None
    stale: bool = False
    expected_shards: int | None = None
    received_shards: int = 0
    repository_count: int | None = None
    counts: dict[str, int] = Field(default_factory=dict)
    invocation_counts: dict[str, int] = Field(default_factory=dict)
    decision: Decision | None = None
    report_state: str = "unknown"
    report_status: str | None = None
    invocation_outcome: str = "unknown"
    provenance: dict[str, JsonValue] = Field(default_factory=dict)


def selection_coverage(app_id, artifacts, health_artifacts, observations, *, now=None):
    result = SelectionCoverage()
    relevant = [
        a
        for a in artifacts
        if not a.inventory
        or a.inventory.get("scope") != "target_request"
        or a.inventory.get("target") == app_id
    ]
    identities = [(a.run_id, a.run_attempt) for a in relevant]
    identities += [(a.run_id, a.run_attempt) for a in health_artifacts]
    if not identities:
        return result
    identity = max(identities)
    result.run_url = f"https://github.com/flathub/flathub/actions/runs/{identity[0]}/attempts/{identity[1]}"
    shards = [a for a in relevant if (a.run_id, a.run_attempt) == identity]
    if not shards:
        result.issues = ["selection_unavailable"]
        return result
    result.artifact_ids = sorted(a.artifact_id for a in shards)
    result.provenance = {
        "artifacts": [
            {
                "artifact_id": a.artifact_id,
                "shard_index": a.shard_index,
                "state": a.state,
                "run_completed": a.run_completed,
                "inventory": a.inventory,
            }
            for a in shards
        ]
    }
    valid = [a for a in shards if a.state == "available"]
    result.received_shards = len({a.shard_index for a in valid})
    if len({a.shard_index for a in shards}) != len(shards):
        result.issues.append("duplicate_shards")
    result.issues.extend(sorted({a.state for a in shards if a.state != "available"}))
    if not valid:
        return result
    inv = valid[0].inventory
    result.expected_shards = inv["shard_count"]
    result.scope = inv["scope"]
    result.observed_at = (inv.get("listing") or {}).get("finished_at")
    if result.observed_at:
        result.stale = (now or datetime.now(UTC)) - datetime.fromisoformat(
            result.observed_at
        ) > timedelta(days=2)
    for field in (
        "shard_count",
        "scope",
        "target",
        "workflow_sha",
        "selection_sha",
        "selection_rule_version",
    ):
        if any(a.inventory.get(field) != inv.get(field) for a in valid):
            result.issues.append("inconsistent_provenance")
            break
    if {a.shard_index for a in valid} != set(range(inv["shard_count"])):
        result.issues.append("missing_shards")
    snapshots = [{(r["name"], r["archived"]) for r in a.listing} for a in valid]
    if any(snapshot != snapshots[0] for snapshot in snapshots):
        result.issues.append("listing_drift")
    if any(
        not a.inventory["listing_complete"]
        or not a.inventory["processing_complete"]
        or a.inventory["exit_code"] is None
        for a in valid
    ):
        result.issues.append("processing_incomplete")
    if any(not a.run_completed for a in shards):
        result.issues.append("run_in_progress")
    decisions = [row for a in valid for row in a.decisions.values()]
    if any(row["selection"] == "pending" for row in decisions):
        result.issues.append("pending_decisions")
    if any(
        row["selection"] == "selected"
        and (
            row["invocation"]["exit_code"] is None
            or row["invocation"]["report"] == "pending"
        )
        for row in decisions
    ):
        result.issues.append("invocation_incomplete")
    if any(a.inventory["exit_code"] not in (None, 0) for a in valid):
        result.issues.append("inventory_error")
    repos = [row["repository"] for row in decisions]
    if len(repos) != len(set(repos)):
        result.issues.append("duplicate_repositories")
    if set(repos) != {name for name, archived in snapshots[0]}:
        result.issues.append("missing_decisions")
    if "listing_drift" not in result.issues and all(
        a.inventory["listing_complete"] for a in valid
    ):
        result.repository_count = len(snapshots[0])
    if not result.issues:
        result.state = "complete"
        result.counts = dict(
            Counter(
                row["reason"] if row["selection"] == "excluded" else row["selection"]
                for row in decisions
            )
        )
        result.invocation_counts = dict(
            Counter(
                invocation_outcome(Invocation.model_validate(row["invocation"]))
                for row in decisions
                if row["invocation"]["started"]
            )
        )
    else:
        result.state = "incomplete"
    matches = [(a, a.decisions[app_id]) for a in valid if app_id in a.decisions]
    if (
        len(matches) != 1
        or "duplicate_shards" in result.issues
        or "inconsistent_provenance" in result.issues
    ):
        return result
    artifact, raw = matches[0]
    result.provenance["decision_artifact_id"] = artifact.artifact_id
    result.decision = decision = Decision.model_validate(raw)
    invocation = decision.invocation
    result.invocation_outcome = invocation_outcome(invocation)
    if decision.selection == "error" and result.invocation_outcome in (
        "unknown",
        "not_started",
    ):
        result.invocation_outcome = "selection_error"
    result.report_state = (
        "not_expected" if decision.selection in ("excluded", "error") else "pending"
    )
    health = [
        a
        for a in health_artifacts
        if (a.run_id, a.run_attempt, a.shard_index) == (*identity, artifact.shard_index)
    ]
    reports = [
        o
        for o in observations
        if o.artifact_id in {a.artifact_id for a in health} and o.app_id == app_id
    ]
    result.provenance["health_artifact_ids"] = [a.artifact_id for a in health]
    if len(reports) > 1 or len(health) > 1:
        result.report_state = "ambiguous"
    elif len(reports) == 1:
        checkout = reports[0].report.get("checkout") or {}
        if decision.selection != "selected" or invocation.report != "valid_json_object":
            result.report_state = "conflicting_inventory"
        elif (
            not decision.commit
            or checkout.get("commit") != decision.commit
            or checkout.get("branch") != decision.branch
            or checkout.get("dirty") is not False
        ):
            result.report_state = "checkout_unverified"
        else:
            result.report_state = "available"
            result.report_status = reports[0].report["status"]
    elif any(app_id in (a.rejected_reports or []) for a in health):
        result.report_state = "invalid_or_unsupported"
    elif decision.selection == "selected" and artifact.run_completed:
        if invocation.report == "invalid_json_object":
            result.report_state = "invalid"
        elif invocation.report == "missing":
            result.report_state = "missing"
        elif artifact.inventory["processing_complete"]:
            result.report_state = "missing" if health else "artifact_unavailable"
        else:
            result.report_state = "incomplete"
    elif decision.selection in ("selected", "pending") and artifact.run_completed:
        result.report_state = "incomplete"
    return result


def load_selection(db, app_id, observations=None):
    from sqlalchemy import or_, tuple_

    from . import models

    selection = models.CheckerSelectionArtifact
    health = models.CheckerHealthArtifact
    other_targets = db.session.query(selection.run_id, selection.run_attempt).filter(
        selection.inventory["scope"].astext == "target_request",
        selection.inventory["target"].astext != app_id,
    )
    latest_selection = (
        db.session.query(selection.run_id, selection.run_attempt)
        .filter(
            or_(
                selection.inventory.is_(None),
                selection.inventory["scope"].astext != "target_request",
                selection.inventory["target"].astext == app_id,
            )
        )
        .order_by(selection.run_id.desc(), selection.run_attempt.desc())
        .first()
    )
    latest_health = (
        db.session.query(health.run_id, health.run_attempt)
        .filter(tuple_(health.run_id, health.run_attempt).not_in(other_targets))
        .order_by(health.run_id.desc(), health.run_attempt.desc())
        .first()
    )
    identities = [
        tuple(row) for row in (latest_selection, latest_health) if row is not None
    ]
    if not identities:
        return SelectionCoverage()
    run_id, attempt = max(identities)
    artifacts = (
        db.session.query(selection).filter_by(run_id=run_id, run_attempt=attempt).all()
    )
    health_artifacts = (
        db.session.query(health).filter_by(run_id=run_id, run_attempt=attempt).all()
    )
    if observations is None:
        observations = (
            db.session.query(models.CheckerHealthObservation)
            .filter_by(
                app_id=app_id,
                run_id=run_id,
                run_attempt=attempt,
            )
            .all()
        )
    return selection_coverage(app_id, artifacts, health_artifacts, observations)
