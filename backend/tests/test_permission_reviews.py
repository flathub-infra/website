import json
import os
import sys
from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.orm import sessionmaker

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import config, models
from app.db_session import DBSession
from app.moderation import ostree_permissions
from app.moderation import permission_assessment as assessment
from app.moderation import permission_publication as publication

with patch("meilisearch.Client"):
    from app.moderation import permission_reviews as reviews

from app.moderation import review as moderation_review
from app.moderation.permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionSnapshot,
    fingerprint_snapshot,
)
from app.types import ModerationRequestType

APP = "org.example.App"
REF = f"app/{APP}/x86_64/stable"
TABLES = (
    models.FlathubUser,
    models.PermissionBaseline,
    models.PermissionDecision,
    models.PermissionAssessmentObservation,
    models.ModerationRequest,
    models.DirectUploadApp,
)


def snapshot(shared):
    arch = {"x86_64": {"Context": {"shared": shared}}}
    return {"canonicalization_version": CANONICALIZATION_VERSION, "architectures": arch}


SNAP, OLD_SNAP = snapshot(["ipc"]), snapshot(["network"])
FP, OLD_FP = (fingerprint_snapshot(PermissionSnapshot(**s)) for s in (SNAP, OLD_SNAP))


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
    monkeypatch.setattr(reviews, "worker", MagicMock())
    for module in (assessment, publication, reviews, moderation_review):
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


@pytest.fixture
def notified(db):
    sent = []

    def send(repository, number):
        with db() as session:
            decision = session.execute(
                select(models.PermissionDecision.decision).order_by(
                    models.PermissionDecision.id.desc()
                )
            ).scalar()
        sent.append((repository, number, decision))

    reviews.worker.notify_permission_decision.send.side_effect = send
    return sent


def test_decisions_notify_after_commit(db, notified):
    decide(persist(1).assessment_id, "rejected", rationale="Too broad")
    assert notified == [(f"flathub/{APP}", 17, "rejected")]


def test_repeated_decision_does_not_notify_again(db, notified):
    first = persist(1)
    decide(first.assessment_id, "rejected", rationale="Too broad")
    approved = decide(first.assessment_id)
    inherited = persist(2, pull_request_head_revision="4" * 40)
    assert decide(inherited.assessment_id).decision_id == approved.decision_id
    assert notified == [
        (f"flathub/{APP}", 17, "rejected"),
        (f"flathub/{APP}", 17, "approved"),
    ]


def test_failed_or_refused_decisions_do_not_notify(db, notified, monkeypatch):
    old, new = persist(1), persist(2)
    for assessment_id, fingerprint in (
        (old.assessment_id, FP),
        (new.assessment_id, OLD_FP),
    ):
        with pytest.raises(HTTPException):
            decide(assessment_id, fingerprint=fingerprint)

    @contextmanager
    def failing_commit(db_type="writer"):
        with db(db_type) as session:
            yield session
            raise RuntimeError("commit failed")

    monkeypatch.setattr(reviews, "get_db", failing_commit)
    with pytest.raises(RuntimeError):
        decide(new.assessment_id)
    monkeypatch.setattr(reviews, "get_db", db)
    decide(persist(3, forge_instance="gitlab.com").assessment_id)
    assert notified == []
    with db() as session:
        decisions = session.execute(select(models.PermissionDecision.id)).all()
    assert len(decisions) == 1


def test_skip_leaves_pull_request_pending_without_notifying(db, notified):
    beta = {"intended_channel": "beta", "flatpak_branch": "beta"}
    first = persist(1, **beta)
    decide(first.assessment_id)
    skipped = decide(first.assessment_id, "skipped", rationale="Not now")
    assert (skipped.outcome, skipped.acceptance_basis) == ("skipped", None)
    inherited = persist(2, pull_request_head_revision="4" * 40, **beta)
    assert (
        inherited.outcome,
        inherited.decision_id,
        inherited.decision_rationale,
    ) == ("pending", None, None)
    assert reviews.read_permission_review(inherited.assessment_id, None).outcome == (
        "skipped"
    )
    assert notified == [(f"flathub/{APP}", 17, "approved")]
    assert assessment.cross_channel_basis(APP, "stable", FP) == "beta_approval"


def test_responses_expose_active_decision_rationale(db):
    first = persist(1)
    assert first.decision_rationale is None
    decide(first.assessment_id, rationale="Fine for now.")
    inherited = persist(2, pull_request_head_revision="4" * 40)
    assert inherited.decision_rationale == "Fine for now."
    decide(inherited.assessment_id, "rejected", rationale="Too broad")
    assert assessment.get_assessment(first.assessment_id).decision_rationale == (
        "Too broad"
    )
    assert persist(3, fingerprint="e" * 64).decision_rationale is None


def test_review_listing_filters_stored_outcome_and_superseded(db):
    superseded = persist(1)
    other_pr = persist(2, pull_request_number=18)
    rejected = persist(3, pull_request_number=19)
    decide(rejected.assessment_id, "rejected", rationale="No")
    newest = persist(4)
    persist(5, candidate_kind="push")

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


def collected(snap):
    return ostree_permissions.CollectedPermissions(
        app_id=APP,
        flatpak_branch="stable",
        repository_url="https://dl.flathub.org/build-repo/9",
        captured_at="2026-10-04T00:00:00+00:00",
        artifacts=(
            ostree_permissions.PermissionArtifact(
                ref_name=REF, arch="x86_64", commit="a" * 64
            ),
        ),
        snapshot=PermissionSnapshot(**snap),
    )


@pytest.fixture
def publish(db, monkeypatch):
    monkeypatch.setattr(config.settings, "permission_publication_mode", "enforce")
    monkeypatch.setattr(
        assessment, "collect_final_candidate", lambda *args: collected(SNAP)
    )
    return lambda: publication.check_build(
        build_id=9,
        job_id=5,
        repo="stable",
        build_extended={"build_refs": [{"ref_name": REF}]},
        build_log_url=None,
    )


def set_baseline(db, snap, fingerprint, runtime=None):
    with db() as session:
        session.add(
            models.PermissionBaseline(
                app_id=APP,
                channel="stable",
                flatpak_branch="stable",
                source="initialized",
                repository_url="https://dl.flathub.org/repo",
                captured_at=datetime.now(UTC).replace(tzinfo=None),
                canonicalization_version=CANONICALIZATION_VERSION,
                artifacts=[{"ref_name": REF, "arch": "x86_64", "commit": "c"}],
                snapshot=snap,
                fingerprint=fingerprint,
                runtime=runtime,
            )
        )


def baseline(db, channel="stable"):
    with db() as session:
        row = session.execute(
            select(models.PermissionBaseline).filter_by(channel=channel)
        ).scalar_one_or_none()
        return row and (row.source, row.fingerprint)


def test_publication_leaves_builds_without_pull_request_to_build_moderation(
    db, publish
):
    set_baseline(db, OLD_SNAP, OLD_FP)
    assert publish() == ([], set(), False)
    persist(1, candidate_kind="push", pull_request_number=None, pull_request_url=None)
    assert publish() == ([], set(), False)


def test_publication_accepts_matching_baseline(db, publish):
    set_baseline(db, SNAP, FP)
    persist(1, candidate_kind="push")
    assert publish() == ([], {APP}, False)
    assert baseline(db) == ("initialized", FP)


def test_publication_accepts_runtime_inherited_permissions(db, publish, monkeypatch):
    set_baseline(db, SNAP, FP)
    persist(1, candidate_kind="push")
    monkeypatch.setattr(
        assessment,
        "collect_final_candidate",
        lambda *args: collected(snapshot(["ipc", "network"])),
    )
    monkeypatch.setattr(
        publication,
        "runtime_permissions",
        lambda *runtimes: ({"Context": {"shared": ["network"]}},),
    )
    assert publish() == ([], {APP}, False)


def test_publication_accepts_permissions_dropped_from_baseline_runtime(
    db, publish, monkeypatch
):
    old = snapshot(["ipc", "network"])
    runtime = "org.kde.Platform/x86_64/6.9"
    set_baseline(db, old, fingerprint_snapshot(PermissionSnapshot(**old)), runtime)
    persist(1, candidate_kind="push")
    monkeypatch.setattr(
        publication,
        "runtime_permissions",
        lambda *runtimes: (
            ({"Context": {"shared": ["network"]}},) if runtime in runtimes else ()
        ),
    )
    assert publish() == ([], {APP}, False)


def test_publication_reuses_push_assessment_decision(db, publish):
    set_baseline(db, OLD_SNAP, OLD_FP)
    decide(persist(1).assessment_id)
    assert persist(2, candidate_kind="push").acceptance_basis == "permission_decision"
    assert publish() == ([], {APP}, False)
    assert baseline(db) == ("initialized", OLD_FP)


def test_publication_request_names_originating_pull_request(db, publish):
    set_baseline(db, OLD_SNAP, OLD_FP)
    persist(1, candidate_kind="push")
    (request,), _, _ = publish()
    pull_request_url = json.loads(request.request_data)["pull_request_url"]
    assert pull_request_url == f"https://github.com/flathub/{APP}/pull/17"


def test_publication_retry_reuses_permissions_request(db, publish):
    set_baseline(db, OLD_SNAP, OLD_FP)
    persist(1, candidate_kind="push")
    (request,), _, _ = publish()
    with db() as session:
        session.add(request)
    assert publish() == ([], {APP}, True)
    with db() as session:
        session.get(models.ModerationRequest, request.id).is_approved = True
    assert publish() == ([], {APP}, False)


def test_beta_accepts_stable_baseline_permissions(db):
    set_baseline(db, SNAP, FP)
    assert assessment.cross_channel_basis(APP, "beta", FP) == "stable_baseline"
    assert assessment.cross_channel_basis(APP, "beta", OLD_FP) is None
    assert assessment.cross_channel_basis(APP, "stable", FP) is None


def test_stable_accepts_latest_beta_approval(db):
    beta = {"intended_channel": "beta", "flatpak_branch": "beta"}
    first = persist(1, **beta)
    assert assessment.cross_channel_basis(APP, "stable", FP) is None
    decide(first.assessment_id)
    assert assessment.cross_channel_basis(APP, "stable", FP) == "beta_approval"
    decide(persist(2, **beta).assessment_id, "rejected", rationale="No")
    assert assessment.cross_channel_basis(APP, "stable", FP) is None

    with db() as session:
        session.add(
            models.ModerationRequest(
                appid=APP,
                build_id=8,
                job_id=4,
                request_type=ModerationRequestType.PERMISSIONS,
                request_data=json.dumps(
                    {"channel": "beta", "candidate_fingerprint": OLD_FP}
                ),
                is_approved=True,
            )
        )
    assert assessment.cross_channel_basis(APP, "stable", OLD_FP) == "beta_approval"


def test_pull_request_rejection_overrides_cross_channel_approval(db):
    accepted = {"outcome": "accepted", "acceptance_basis": "beta_approval"}
    first = persist(1, **accepted)
    assert first.acceptance_basis == "beta_approval"
    decide(first.assessment_id, "rejected", rationale="No")
    assert persist(2, **accepted).outcome == "rejected"


def test_publication_accepts_beta_approved_permissions(db, publish):
    set_baseline(db, OLD_SNAP, OLD_FP)
    decide(persist(1, intended_channel="beta", flatpak_branch="beta").assessment_id)
    persist(2, candidate_kind="push")
    assert publish() == ([], {APP}, False)


@pytest.fixture
def held(db, publish, monkeypatch):
    set_baseline(db, OLD_SNAP, OLD_FP)
    persist(1, candidate_kind="push")
    (permissions,), _, _ = publish()
    appdata = models.ModerationRequest(
        appid=APP,
        build_id=9,
        job_id=5,
        request_type=ModerationRequestType.APPDATA,
        request_data="{}",
    )
    with db() as session:
        session.add_all([permissions, appdata])
    for name in ("audit_log", "worker"):
        monkeypatch.setattr(moderation_review, name, MagicMock())
    monkeypatch.setattr(moderation_review, "get_json_key", lambda key: None)
    monkeypatch.setattr(
        moderation_review, "create_github_build_issue", lambda *args, **kwargs: None
    )

    def review(request, approve):
        moderation_review.submit_review(
            request.id,
            moderation_review.Review(approve=approve, comment="No"),
            SimpleNamespace(user=SimpleNamespace(id=1)),
            MagicMock(),
            None,
        )

    return permissions, appdata, review


def test_baseline_advances_only_when_held_build_publishes(db, held):
    permissions, appdata, review = held
    review(permissions, True)
    assert baseline(db) == ("initialized", OLD_FP)
    moderation_review.worker.review_check.send.assert_not_called()
    review(appdata, True)
    moderation_review.worker.review_check.send.assert_called_once_with(
        5, "Passed", None, 9
    )
    assert baseline(db) == ("approved", FP)


def test_rejection_rejects_pending_permissions_request(db, held):
    permissions, appdata, review = held
    review(appdata, False)
    with pytest.raises(HTTPException) as exc:
        review(permissions, True)
    assert exc.value.detail == "already_handled"
    with db() as session:
        rows = session.execute(select(models.ModerationRequest)).scalars()
        assert {row.request_type: row.is_approved for row in rows} == {
            "permissions": False,
            "appdata": False,
        }
    assert baseline(db) == ("initialized", OLD_FP)


@pytest.mark.parametrize("mode", ["off", "observe"])
def test_publication_without_enforcement_changes_nothing(
    db, publish, monkeypatch, mode
):
    monkeypatch.setattr(config.settings, "permission_publication_mode", mode)
    set_baseline(db, OLD_SNAP, OLD_FP)
    persist(1, candidate_kind="push")
    assert publish() == ([], set(), False)
    assert baseline(db) == ("initialized", OLD_FP)


@pytest.mark.parametrize(
    ("mode", "channel", "linked", "direct_upload", "expected"),
    [
        ("enforce", "stable", False, False, ("approved", FP)),
        ("observe", "stable", True, False, ("approved", FP)),
        ("enforce", "stable", False, True, ("initialized", OLD_FP)),
        ("off", "stable", False, False, ("initialized", OLD_FP)),
        ("enforce", "beta", False, False, None),
        ("observe", "beta", True, False, ("approved", FP)),
    ],
)
def test_publication_advances_baseline(
    db, publish, monkeypatch, mode, channel, linked, direct_upload, expected
):
    monkeypatch.setattr(config.settings, "permission_publication_mode", mode)
    set_baseline(db, OLD_SNAP, OLD_FP)
    if linked:
        persist(1, candidate_kind="push", intended_channel=channel)
    if direct_upload:
        with db() as session:
            session.add(models.DirectUploadApp(app_id=APP))
    publication.advance_published(9, channel, {APP})
    assert baseline(db, channel) == expected
