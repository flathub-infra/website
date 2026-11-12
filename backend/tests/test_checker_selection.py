import hashlib
import io
import json
import zipfile
from datetime import UTC, datetime

import httpx
import pytest
import test_checker_health as health_tests
from test_checker_health import archive, observation

from app import checker_health_ingestion as ingestion
from app import models
from app.checker_selection import load_selection, parse_selection, selection_coverage

health_db = health_tests.health_db


def decision(repository="org.example.App", selection="selected", **changes):
    return {
        "repository": repository,
        "selection": selection,
        "reason": "selected" if selection == "selected" else "no_checker_marker",
        "error": None,
        "branch": "master",
        "commit": "a" * 40,
        "checkout_unknown_reason": None,
        "invocation": {
            "started": selection == "selected",
            "exit_code": 0 if selection == "selected" else None,
            "report": "valid_json_object"
            if selection == "selected"
            else "not_expected",
        },
    } | changes


def selection_archive(
    shard=0, count=1, rows=None, listing=None, listing_source="github_api", **changes
):
    rows = rows if rows is not None else [decision()]
    listing = (
        listing
        if listing is not None
        else [{"name": r["repository"], "archived": False} for r in rows]
    )
    listing_bytes = json.dumps(listing).encode()
    inventory = {
        "schema_version": 1,
        "selection_rule_version": 1,
        "run_id": "42",
        "run_attempt": "1",
        "workflow_ref": "flathub/flathub/.github/workflows/external-data-checker.yml@refs/heads/master",
        "workflow_sha": "b" * 40,
        "selection_repository": "flathub/flathub",
        "selection_sha": "b" * 40,
        "scope": "public_organization",
        "target": None,
        "shard_index": shard,
        "shard_count": count,
        "listing_complete": True,
        "processing_complete": True,
        "exit_code": 0,
        "listing": {
            "file": "listing.json",
            "sha256": hashlib.sha256(listing_bytes).hexdigest(),
            "started_at": "2026-11-12T01:00:00Z",
            "finished_at": "2026-11-12T01:01:00Z",
            "shared_between_shards": False,
            "source": listing_source,
        },
    } | changes
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("inventory.json", json.dumps(inventory))
        z.writestr("listing.json", listing_bytes)
        z.writestr("inactive-repos.txt", "")
        for row in rows:
            z.writestr(f"repositories/repo-{row['repository']}.json", json.dumps(row))
    return buf.getvalue()


def artifact(shard=0, **kwargs):
    raw, listing, rows = parse_selection(
        selection_archive(shard=shard, **kwargs), f"checker-selection-42-1-{shard}"
    )
    return models.CheckerSelectionArtifact(
        artifact_id=100 + shard,
        run_id=42,
        run_attempt=1,
        shard_index=shard,
        state="available",
        run_completed=True,
        inventory=raw,
        listing=listing,
        decisions=rows,
    )


def health(shard=0, attempt=1):
    return models.CheckerHealthArtifact(
        artifact_id=200 + shard, run_id=42, run_attempt=attempt, shard_index=shard
    )


def report(shard=0):
    row = observation(
        1,
        status="failed",
        checkout={"commit": "a" * 40, "branch": "master", "dirty": False},
    )
    row.app_id = "org.example.App"
    row.artifact_id = 200 + shard
    row.run_id = 42
    return row


def coverage(artifacts, health_artifacts=(), reports=(), app="org.example.App"):
    return selection_coverage(
        app,
        artifacts,
        health_artifacts,
        reports,
        now=datetime(2026, 11, 12, tzinfo=UTC),
    )


def test_six_independent_listings_have_one_denominator_and_separate_outcomes():
    rows = [
        decision(f"org.example.App{i}", "excluded", reason=reason)
        for i, reason in enumerate(
            [
                "no_checker_marker",
                "archived",
                "checker_disabled",
                "inactive",
                "end_of_life",
                "manifest_not_found",
            ]
        )
    ]
    rows += [
        decision(),
        decision("org.example.Clone", "error", reason=None, error="clone_failed"),
    ]
    listing = [{"name": r["repository"], "archived": False} for r in rows]
    artifacts = [
        artifact(i, count=6, rows=rows[i::6], listing=listing) for i in range(6)
    ]
    result = coverage(artifacts, [health(0)], [report(0)])
    assert result.state == "complete"
    assert result.repository_count == 8
    assert result.received_shards == 6
    assert sum(result.counts.values()) == 8
    assert result.counts["selected"] == 1
    assert result.counts["error"] == 1
    assert result.report_status == "failed"
    assert result.invocation_outcome == "succeeded"
    assert result.invocation_counts == {"succeeded": 1}
    clone = coverage(artifacts, app="org.example.Clone")
    assert clone.decision.error == "clone_failed"
    assert clone.invocation_outcome == "selection_error"


@pytest.mark.parametrize(
    "change,issue",
    [
        ("missing", "missing_shards"),
        ("duplicate", "duplicate_shards"),
        ("drift", "listing_drift"),
        ("processing", "processing_incomplete"),
        ("running", "run_in_progress"),
        ("expired", "expired"),
        ("unsupported", "invalid_or_unsupported"),
    ],
)
def test_incomplete_inventory_never_claims_complete_coverage(change, issue):
    rows = [decision(), decision("org.example.Other", "excluded")]
    listing = [{"name": r["repository"], "archived": False} for r in rows]
    artifacts = [
        artifact(i, count=2, rows=[rows[i]], listing=listing) for i in range(2)
    ]
    if change == "missing":
        artifacts.pop()
    if change == "duplicate":
        artifacts.append(artifacts[0])
    if change == "drift":
        artifacts[1].listing[0]["archived"] = True
    if change == "processing":
        artifacts[1].inventory["processing_complete"] = False
    if change == "running":
        artifacts[1].run_completed = False
    if change == "expired":
        artifacts[1].state = "expired"
    if change == "unsupported":
        artifacts[1].state = "invalid_or_unsupported"
    result = coverage(artifacts)
    assert result.state != "complete"
    assert issue in result.issues
    assert result.counts == {}
    if change == "drift":
        assert result.repository_count is None


@pytest.mark.parametrize(
    "state,completed,processing,expected",
    [
        ("missing", True, True, "missing"),
        ("invalid_json_object", True, True, "invalid"),
        ("valid_json_object", True, True, "artifact_unavailable"),
        ("missing", False, True, "pending"),
        ("missing", True, False, "missing"),
        ("invalid_json_object", True, False, "invalid"),
        ("missing", False, False, "pending"),
        ("invalid_json_object", False, False, "pending"),
        ("pending", True, False, "incomplete"),
        ("pending", False, False, "pending"),
    ],
)
def test_expected_report_is_completion_aware(state, completed, processing, expected):
    row = decision(invocation={"started": True, "exit_code": 1, "report": state})
    item = artifact(rows=[row], processing_complete=processing)
    item.run_completed = completed
    result = coverage([item])
    assert result.report_state == expected
    assert result.invocation_outcome == "failed"
    if not processing:
        assert result.state == "incomplete"
        assert "processing_incomplete" in result.issues


@pytest.mark.parametrize(
    "exit_code,outcome",
    [(0, "succeeded"), (2, "outdated_only"), (1, "failed"), (143, "failed")],
)
def test_aggregate_and_app_invocation_outcomes_agree(exit_code, outcome):
    item = artifact(
        rows=[
            decision(
                invocation={
                    "started": True,
                    "exit_code": exit_code,
                    "report": "valid_json_object",
                }
            )
        ]
    )
    result = coverage([item])
    assert result.invocation_outcome == outcome
    assert result.invocation_counts == {outcome: 1}


def test_old_runs_reruns_checkouts_and_targeted_scope():
    assert coverage([], [health()]).state == "unknown"
    assert coverage([artifact()], [health(attempt=2)], [report()]).state == "unknown"
    assert coverage([artifact()], [health()], []).report_state == "missing"
    row = report()
    row.report["checkout"]["commit"] = "c" * 40
    assert (
        coverage([artifact()], [health()], [row]).report_state == "checkout_unverified"
    )
    target = artifact(scope="target_request", target="org.example.App")
    assert coverage([target]).scope == "target_request"
    assert coverage([target], app="org.example.Other").state == "unknown"
    result = selection_coverage(
        "org.example.App", [artifact()], [], [], now=datetime(2026, 11, 20, tzinfo=UTC)
    )
    assert result.stale


@pytest.mark.parametrize(
    "changes",
    [
        {"schema_version": 2},
        {"selection_rule_version": 2},
        {"run_id": "43"},
        {"run_attempt": "2"},
        {"shard_count": 0},
        {"shard_index": 1},
        {"scope": "target_request", "target": "org.example.Other"},
        {"workflow_sha": "invalid"},
        {"selection_repository": "other/repo"},
    ],
)
def test_invalid_schema_and_identity_are_rejected(changes):
    with pytest.raises(ValueError):
        parse_selection(selection_archive(**changes), "checker-selection-42-1-0")


@pytest.mark.parametrize(
    "filename",
    [
        "../evil.json",
        "repositories/../../evil.json",
        "/inventory.json",
        "unrecognized.json",
    ],
)
def test_unsafe_or_unrecognized_entries_are_not_silently_dropped(filename):
    buf = io.BytesIO(selection_archive())
    with zipfile.ZipFile(buf, "a") as z:
        z.writestr(filename, "{}")
    with pytest.raises(ValueError):
        parse_selection(buf.getvalue(), "checker-selection-42-1-0")


def test_listing_digest_duplicates_and_file_count_limits(monkeypatch):
    buf = io.BytesIO(selection_archive())
    with zipfile.ZipFile(buf, "a") as z:
        z.writestr("listing.json", "[]")
    with pytest.raises(ValueError, match="Duplicate"):
        parse_selection(buf.getvalue(), "checker-selection-42-1-0")
    monkeypatch.setattr(ingestion, "MAX_REPORT_SIZE", 1)
    with pytest.raises(ValueError):
        parse_selection(selection_archive(), "checker-selection-42-1-0")


def test_targeted_inactive_inventory_and_partial_initial_inventory():
    target = artifact(
        scope="target_request",
        target="org.example.App",
        rows=[decision(selection="excluded", reason="inactive")],
        listing=[{"name": "org.example.App", "archived": None}],
        listing_source="inactive_target_input",
    )
    assert coverage([target]).repository_count == 1
    partial = artifact(rows=[], listing_complete=False, processing_complete=False)
    result = coverage([partial])
    assert result.state == "incomplete"
    assert result.repository_count is None
    assert result.decision is None


def test_missing_selection_decision_is_not_an_exclusion():
    item = artifact(rows=[], listing=[{"name": "org.example.App", "archived": False}])
    result = coverage([item])
    assert result.state == "incomplete"
    assert "missing_decisions" in result.issues
    assert result.decision is None


def test_dot_prefixed_repositories_match_the_producer_name_rules():
    item = artifact(rows=[decision(".github", "excluded", reason="manifest_not_found")])
    assert coverage([item], app=".github").decision.reason == "manifest_not_found"
    for name in (".", ".."):
        with pytest.raises(ValueError):
            artifact(rows=[decision(name)])


def test_pending_invocation_is_not_complete_even_if_processing_claims_completion():
    item = artifact(
        rows=[
            decision(
                invocation={"started": True, "exit_code": None, "report": "pending"}
            )
        ]
    )
    result = coverage([item])
    assert result.state == "incomplete"
    assert "invocation_incomplete" in result.issues


def test_selection_archive_file_count_is_bounded():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for index in range(20001):
            z.writestr(f"repositories/repo-app{index}.json", "")
    with pytest.raises(ValueError, match="expanded limits"):
        parse_selection(buf.getvalue(), "checker-selection-42-1-0")


def test_health_shard_and_dirty_checkout_never_join_unrelated_reports():
    assert (
        coverage([artifact()], [health(1)], [report(1)]).report_state
        == "artifact_unavailable"
    )
    row = report()
    row.report["checkout"]["dirty"] = True
    assert (
        coverage([artifact()], [health()], [row]).report_state == "checkout_unverified"
    )
    assert (
        coverage([artifact()], [health(), health()], [report()]).report_state
        == "ambiguous"
    )
    item = artifact(
        rows=[
            decision(invocation={"started": True, "exit_code": 1, "report": "missing"})
        ]
    )
    assert (
        coverage([item], [health()], [report()]).report_state == "conflicting_inventory"
    )


def test_pagination_discovers_expired_selection_and_keeps_identity_checks():
    def handler(request):
        page = int(request.url.params["page"])
        rows = (
            [{"name": "unrelated"}] * 100
            if page == 1
            else [
                {
                    "id": 100,
                    "name": "checker-selection-42-1-0",
                    "expired": True,
                    "workflow_run": {"id": 42, "head_repository_id": 88860262},
                },
                {
                    "id": 101,
                    "name": "checker-selection-42-1-1",
                    "expired": False,
                    "workflow_run": {"id": 43, "head_repository_id": 88860262},
                },
            ]
        )
        return httpx.Response(200, json={"total_count": 102, "artifacts": rows})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert [a["id"] for a in ingestion.list_artifacts(client)] == [100]


def test_selection_migration_preserves_existing_health(health_db):
    from pathlib import Path

    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from alembic.script import ScriptDirectory
    from sqlalchemy import text

    migration = (
        ScriptDirectory(str(Path(__file__).parents[1] / "alembic"))
        .get_revision("91d3a62f804b")
        .module
    )
    with health_db() as db:
        db.session.add(health())
    with health_db() as db:
        with Operations.context(MigrationContext.configure(db.session.connection())):
            migration.downgrade()
            migration.upgrade()
        assert db.session.execute(
            text("SELECT artifact_id, shard_index FROM checkerhealthartifact")
        ).one() == (200, None)
        assert db.session.query(models.CheckerSelectionArtifact).count() == 0


@pytest.mark.parametrize("invalid", [b'{"schema_version":2}', b"{", b"[]", b"\xff"])
def test_mixed_health_archive_preserves_valid_reports_and_rejections(
    health_db, invalid
):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive_file:
        archive_file.writestr("org.example.App.json", json.dumps(report().report))
        archive_file.writestr("org.example.Invalid.json", invalid)
    parsed = ingestion.parse_archive(buf.getvalue())
    assert parsed["org.example.App"] is not None
    assert parsed["org.example.Invalid"] is None
    metadata = {
        "id": 200,
        "name": "checker-health-42-1-0",
        "expired": False,
        "workflow_run": {"id": 42, "head_repository_id": 88860262},
    }
    with health_db() as db:
        db.session.add(artifact(rows=[decision(), decision("org.example.Invalid")]))
        ingestion.store_artifact(db, metadata, parsed)
    with health_db() as db:
        ingestion.store_artifact(db, metadata, parsed)
        assert db.session.query(models.CheckerHealthObservation).count() == 1
        assert db.session.get(models.CheckerHealthArtifact, 200).rejected_reports == [
            "org.example.Invalid"
        ]
        assert load_selection(db, "org.example.App").report_state == "available"
        rejected = load_selection(db, "org.example.Invalid")
        assert rejected.report_state == "invalid_or_unsupported"
        assert rejected.report_status is None
        assert rejected.provenance["health_artifact_ids"] == [200]
        assert rejected.invocation_outcome == "succeeded"


def test_rejected_report_requires_matching_shard_and_attempt():
    rejected = health(1)
    rejected.rejected_reports = ["org.example.App"]
    assert coverage([artifact()], [rejected]).report_state == "artifact_unavailable"
    rejected.shard_index = 0
    rejected.run_attempt = 2
    assert coverage([artifact()], [rejected]).report_state == "unknown"
    rejected.run_attempt = 1
    assert coverage([artifact()], [rejected]).report_state == "invalid_or_unsupported"


def test_duplicate_rejected_report_names_still_reject_archive():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive_file:
        archive_file.writestr("org.example.App.json", '{"schema_version":2}')
        archive_file.writestr("org.example.App.json", json.dumps(report().report))
    with pytest.raises(ValueError, match="Duplicate app report"):
        ingestion.parse_archive(buf.getvalue())


def test_latest_targeted_run_does_not_replace_other_apps_inventory(health_db):
    with health_db() as db:
        db.session.add(artifact())
        target = artifact(
            scope="target_request",
            target="org.example.Other",
            rows=[decision("org.example.Other")],
        )
        target.artifact_id = 101
        target.run_id = 43
        db.session.add(target)
        target_health = health()
        target_health.run_id = 43
        db.session.add(target_health)
    with health_db() as db:
        assert load_selection(db, "org.example.App", []).run_url.endswith(
            "/42/attempts/1"
        )
        assert load_selection(db, "org.example.Other", []).run_url.endswith(
            "/43/attempts/1"
        )


@pytest.mark.parametrize("selection_first", [True, False])
def test_import_order_retries_reruns_and_all_shards(
    health_db,
    monkeypatch,
    selection_first,
):
    rows = [decision(f"org.example.App{i}") for i in range(6)]
    listing = [{"name": r["repository"], "archived": False} for r in rows]
    artifacts = []
    archives = {}
    downloads = []
    for i in range(6):
        for kind, offset in [("selection", 100), ("health", 200)]:
            id = offset + i
            artifacts.append(
                {
                    "id": id,
                    "name": f"checker-{kind}-42-1-{i}",
                    "expired": False,
                    "workflow_run": {"id": 42, "head_repository_id": 88860262},
                }
            )
            archives[id] = (
                selection_archive(i, 6, [rows[i]], listing)
                if kind == "selection"
                else archive(report(i).report, f"org.example.App{i}.json")
            )
    visible = [a for a in artifacts if (a["id"] < 200) == selection_first]
    broken = True

    def handler(request):
        if request.url.path.endswith("/artifacts"):
            return httpx.Response(
                200, json={"total_count": len(visible), "artifacts": visible}
            )
        if "/attempts/" in request.url.path:
            return httpx.Response(
                200, json={"id": 42, "run_attempt": 1, "status": "completed"}
            )
        id = int(request.url.path.split("/")[-2])
        downloads.append(id)
        return httpx.Response(
            200, content=b"invalid" if broken and id == 100 else archives[id]
        )

    client = httpx.Client
    monkeypatch.setattr(
        ingestion.httpx,
        "Client",
        lambda **kw: client(transport=httpx.MockTransport(handler), **kw),
    )
    monkeypatch.setattr(ingestion, "get_db", health_db)
    monkeypatch.setattr(ingestion.settings, "github_bot_token", "test-token")
    ingestion.refresh_checker_health()
    visible = artifacts
    ingestion.refresh_checker_health()
    broken = False
    ingestion.refresh_checker_health()
    before = len(downloads)
    ingestion.refresh_checker_health()
    assert len(downloads) == before
    with health_db() as db:
        assert db.session.query(models.CheckerSelectionArtifact).count() == 6
        assert db.session.query(models.CheckerHealthObservation).count() == 6
        result = load_selection(
            db,
            "org.example.App0",
            db.session.query(models.CheckerHealthObservation).all(),
        )
        assert result.state == "complete"
        assert result.report_state == "available"
        assert result.report_status == "failed"
        assert result.invocation_outcome == "succeeded"
