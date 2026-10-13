import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import models
from app.db_session import DBSession
from app.moderation import permission_assessment as assessment
from app.moderation import permission_reviews as reviews
from app.moderation.permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionSnapshot,
    PermissionSnapshotError,
    fingerprint_snapshot,
)

APP = "org.example.App"
REF = f"app/{APP}/x86_64/stable"
TABLES = (
    models.FlathubUser,
    models.PermissionBaseline,
    models.PermissionDecision,
    models.PermissionAssessmentObservation,
)


def snapshot(shared):
    arch = {"x86_64": {"Context": {"shared": shared}}}
    return {"canonicalization_version": CANONICALIZATION_VERSION, "architectures": arch}


SNAP, OLD_SNAP = snapshot(["ipc"]), snapshot(["network"])
FP, OLD_FP = (fingerprint_snapshot(PermissionSnapshot(**s)) for s in (SNAP, OLD_SNAP))
REQUEST = {
    "pipeline_id": "p",
    "build_id": 9,
    "forge_instance": "github.com",
    "source_repository": f"flathub/{APP}",
    "pull_request_number": 17,
    "pull_request_url": f"https://github.com/flathub/{APP}/pull/17",
    "pull_request_head_revision": "1" * 40,
    "built_revision": "2" * 40,
    "target_git_branch": "master",
    "candidate_kind": "head",
    "app_id": APP,
    "destination_repo": "test",
    "destination_channel": "stable",
    "flatpak_branch": "stable",
    "expected_arches": ["x86_64"],
    "matrix_succeeded": True,
}


def report(**changes):
    return {
        "schema_version": 1,
        "linter_version": "1",
        "kind": "repo",
        "app_id": APP,
        "artifacts": [{"ref": REF, "commit": "a" * 64}],
        "review_findings": [],
        **changes,
    }


def linter_request(*entries, **changes):
    reports = [{"kind": k, "arch": a, "report": r} for k, a, r in entries]
    return assessment.CandidateAssessmentRequest(
        **{**REQUEST, **changes, "linter_reports": reports}
    )


@pytest.mark.parametrize(
    ("entry", "code"),
    [
        (("repo", "x86_64", report(schema_version=2)), "unsupported_linter_report"),
        (
            ("repo", "x86_64", report(review_findings=[{"rule_code": 1}])),
            "unsupported_linter_report",
        ),
        (("manifest", None, report(kind="repo")), "unsupported_linter_report"),
        (("repo", "x86_64", report(app_id="org.other.App")), "linter_report_mismatch"),
    ],
)
def test_invalid_linter_reports_are_rejected(entry, code):
    with pytest.raises(PermissionSnapshotError) as exc:
        assessment._parse_linter_reports(linter_request(entry))
    assert exc.value.code == code


@pytest.mark.parametrize(
    ("arches", "refs", "valid"),
    [
        (["x86_64"], [REF], True),
        (["x86_64"], ["app/org.example.App/x86_64/beta"], False),
        (["x86_64", "aarch64"], [REF], False),
    ],
)
def test_repo_linter_reports_must_match_upload(arches, refs, valid):
    request = linter_request(("repo", "x86_64", report()), expected_arches=arches)
    parsed = assessment._parse_linter_reports(request)
    uploaded = [{"ref_name": ref, "commit": "a" * 64} for ref in refs]
    if valid:
        assessment._check_linter_report_bindings(request, parsed, uploaded)
        return
    with pytest.raises(PermissionSnapshotError) as exc:
        assessment._check_linter_report_bindings(request, parsed, uploaded)
    assert exc.value.code == "linter_report_mismatch"


@pytest.fixture
def db(monkeypatch):
    url = os.getenv("PERMISSION_ASSESSMENT_TEST_DATABASE_URL")
    if not url:
        pytest.skip("PERMISSION_ASSESSMENT_TEST_DATABASE_URL is not configured")
    schema = f"permission_review_test_{uuid4().hex}"
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url)

    def set_search_path(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute(f'SET search_path TO "{schema}"')
        cursor.close()

    event.listen(engine, "connect", set_search_path)
    models.Base.metadata.create_all(engine, tables=[t.__table__ for t in TABLES])
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    @contextmanager
    def real_db(db_type="writer"):
        session = Session()
        try:
            yield DBSession(session)
            session.commit()
        finally:
            session.close()

    monkeypatch.setattr(reviews, "audit_log", MagicMock())
    for module in (assessment, reviews):
        monkeypatch.setattr(module, "get_db", real_db)
    with real_db() as session:
        session.add(models.FlathubUser(id=1, display_name="Moderator"))
    yield real_db
    engine.dispose()
    with admin.begin() as connection:
        connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    admin.dispose()


def persist(n, **changes):
    values = {
        "assessment_identity": f"assessment-{n}",
        "outcome": "pending",
        "app_id": APP,
        "pipeline_id": f"pipeline-{n}",
        "forge_instance": "github.com",
        "source_repository": f"flathub/{APP}",
        "pull_request_head_revision": "1" * 40,
        "built_revision": "2" * 40,
        "target_git_branch": "master",
        "base_revision": "3" * 40,
        "candidate_kind": "head",
        "intended_repo": "test",
        "intended_channel": "stable",
        "flatpak_branch": "stable",
        "build_id": 9,
        "pull_request_number": 17,
        "pull_request_url": f"https://github.com/flathub/{APP}/pull/17",
        "expected_arches": ["x86_64"],
        "canonicalization_version": CANONICALIZATION_VERSION,
        "candidate_artifacts": [],
        "published_artifacts": [],
        "uploaded_refs": [],
        "candidate_snapshot": SNAP,
        "fingerprint": FP,
        **changes,
    }
    return assessment._persist_observation(values)


def decide(assessment_id, decision="approved", fingerprint=FP, rationale=None):
    body = reviews.PermissionDecisionRequest(
        decision=decision, fingerprint=fingerprint, rationale=rationale
    )
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    return reviews.decide_permission_review(assessment_id, body, MagicMock(), login)


def test_decisions_apply_to_lineage_scope_and_fingerprint(db):
    first = persist(1)
    assert first.outcome == "pending"
    approved = decide(first.assessment_id)
    assert (approved.outcome, approved.acceptance_basis) == (
        "accepted",
        "permission_decision",
    )

    update = persist(2, pull_request_head_revision="4" * 40, built_revision="5" * 40)
    assert (update.outcome, update.acceptance_basis, update.decision_id) == (
        "accepted",
        "permission_decision",
        approved.decision_id,
    )

    rejected = decide(update.assessment_id, "rejected", rationale="Too broad")
    assert assessment.get_assessment(first.assessment_id).outcome == "rejected"
    latest = persist(3)
    assert (latest.outcome, latest.decision_id) == ("rejected", rejected.decision_id)

    assert persist(4, flatpak_branch="beta").outcome == "pending"
    assert persist(5, fingerprint="e" * 64).outcome == "pending"
    assert persist(6, pull_request_number=18).outcome == "pending"


def test_decisions_are_refused_for_stale_or_mismatched_assessments(db):
    old, new = persist(1), persist(2)
    assert assessment.get_assessment(old.assessment_id).superseded_by == (
        new.assessment_id
    )
    with pytest.raises(HTTPException) as exc:
        decide(old.assessment_id)
    assert exc.value.detail == "assessment_superseded"
    with pytest.raises(HTTPException) as exc:
        decide(new.assessment_id, fingerprint=OLD_FP)
    assert exc.value.detail == "snapshot_mismatch"


def test_review_listing_filters_stored_outcome_and_superseded(db):
    superseded = persist(1)
    other_pr = persist(2, pull_request_number=18)
    rejected = persist(3, pull_request_number=19)
    decide(rejected.assessment_id, "rejected", rationale="No")
    newest = persist(4)

    def listed(outcome, include_superseded=False):
        result = reviews.list_permission_reviews(
            None, outcome, include_superseded, 50, 0
        )
        return {item.assessment_id: item for item in result["items"]}

    pending = {other_pr.assessment_id, newest.assessment_id}
    assert listed("pending").keys() == pending
    assert listed("rejected").keys() == {rejected.assessment_id}
    assert listed("accepted").keys() == set()
    assert listed("all").keys() == pending | {rejected.assessment_id}
    everything = listed("pending", True)
    assert everything.keys() == pending | {superseded.assessment_id}
    assert everything[superseded.assessment_id].superseded_by == newest.assessment_id
