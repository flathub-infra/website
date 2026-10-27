import json
import os
import runpy
import sys
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, event, func, select, text, update
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import sessionmaker

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import models
from app.db_session import DBSession
from app.moderation import ostree_permissions
from app.moderation import permission_assessment as assessment
from app.moderation import permission_publication as publication

with patch("meilisearch.Client"):
    from app.moderation import permission_reviews as reviews
    from app.moderation import permission_rules_api as rules_api

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
    models.GithubAccount,
    models.PermissionBaseline,
    models.PermissionDecision,
    models.PermissionRule,
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

    for module in (reviews, rules_api):
        monkeypatch.setattr(module, "audit_log", MagicMock())
        monkeypatch.setattr(module, "worker", MagicMock())
    for module in (assessment, publication, reviews, rules_api, moderation_review):
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


@pytest.mark.parametrize(
    "rationale",
    [{}, {"rationale": None}, {"rationale": ""}, {"rationale": " \t\n "}],
)
def test_ignore_requires_nonblank_rationale(rationale):
    with pytest.raises(ValidationError):
        reviews.PermissionDecisionRequest(
            decision="ignored", fingerprint=FP, **rationale
        )


def test_ignore_keeps_rationale_internal_and_never_resurfaces(db, notified):
    with db() as session:
        session.add(models.GithubAccount(user=1, github_userid=7, login="mod"))
    first = persist(1)
    ignored = decide(first.assessment_id, "ignored", rationale="Tracked internally")
    assert (ignored.outcome, ignored.acceptance_basis) == ("ignored", None)
    (entry,) = ignored.decisions
    assert (
        entry.id,
        entry.decision,
        entry.rationale,
        entry.reviewer_id,
        entry.applies,
    ) == (ignored.decision_id, "ignored", "Tracked internally", 1, True)
    external = assessment.get_assessment(first.assessment_id)
    assert (
        external.outcome,
        external.acceptance_basis,
        external.decision_id,
        external.decision_rationale,
    ) == ("pending", None, None, None)

    def listed(outcome):
        result = reviews.list_permission_reviews(None, outcome, False, 50, 0)
        return [item.assessment_id for item in result["items"]]

    assert (listed("pending"), listed("ignored")) == ([], [first.assessment_id])
    with db() as session:
        session.execute(
            update(models.PermissionDecision).values(
                created_at=func.now() - timedelta(days=30)
            )
        )
    detail = reviews.read_permission_review(first.assessment_id, None)
    assert detail.outcome == "ignored"
    assert detail.decisions[0].rationale == "Tracked internally"
    assert (listed("pending"), listed("ignored")) == ([], [first.assessment_id])
    assert notified == []
    reviews.worker.notify_permission_decision.send.assert_not_called()


def test_ignore_is_inherited_only_for_same_scope_and_fingerprint(db, notified):
    first = persist(1)
    ignored = decide(first.assessment_id, "ignored", rationale="Tracked internally")
    inherited = persist(2, pull_request_head_revision="4" * 40, built_revision="5" * 40)
    assert (
        inherited.outcome,
        inherited.decision_id,
        inherited.decision_rationale,
    ) == ("pending", None, None)
    detail = reviews.read_permission_review(inherited.assessment_id, None)
    assert (detail.outcome, detail.decision_id) == ("ignored", ignored.decision_id)
    assert detail.decisions[0].rationale == "Tracked internally"
    assert detail.decisions[0].applies is True

    for n, changes in enumerate(
        (
            {"fingerprint": OLD_FP, "candidate_snapshot": OLD_SNAP},
            {"flatpak_branch": "beta"},
            {"pull_request_number": 18},
        ),
        3,
    ):
        changed = persist(n, **changes)
        assert changed.outcome == "pending"
        detail = reviews.read_permission_review(changed.assessment_id, None)
        assert (detail.outcome, detail.decision_id) == ("pending", None)
        pending = reviews.list_permission_reviews(None, "pending", False, 50, 0)
        assert changed.assessment_id in {
            item.assessment_id for item in pending["items"]
        }
    assert notified == []
    reviews.worker.notify_permission_decision.send.assert_not_called()


def test_snooze_leaves_pull_request_pending_without_notifying(db, notified):
    beta = {"intended_channel": "beta", "flatpak_branch": "beta"}
    first = persist(1, **beta)
    decide(first.assessment_id)
    snoozed = decide(first.assessment_id, "snoozed", rationale="Not now")
    assert (snoozed.outcome, snoozed.acceptance_basis) == ("snoozed", None)
    inherited = persist(2, pull_request_head_revision="4" * 40, **beta)
    assert (
        inherited.outcome,
        inherited.decision_id,
        inherited.decision_rationale,
    ) == ("pending", None, None)
    assert reviews.read_permission_review(inherited.assessment_id, None).outcome == (
        "snoozed"
    )
    assert notified == [(f"flathub/{APP}", 17, "approved")]
    assert assessment.cross_channel_basis(APP, "stable", FP) == "beta_approval"


def test_snoozed_review_resurfaces_after_twelve_hours(db, notified):
    review = persist(1)

    def listed(outcome):
        result = reviews.list_permission_reviews(None, outcome, False, 50, 0)
        return [item.assessment_id for item in result["items"]]

    def age(hours):
        with db() as session:
            session.execute(
                update(models.PermissionDecision).values(
                    created_at=func.now() - timedelta(hours=hours)
                )
            )

    decide(review.assessment_id, "snoozed")
    age(11)
    assert (listed("pending"), listed("snoozed")) == ([], [review.assessment_id])
    age(12)
    assert (listed("pending"), listed("snoozed")) == ([review.assessment_id], [])
    assert reviews.read_permission_review(review.assessment_id, None).outcome == (
        "pending"
    )
    assert decide(review.assessment_id, "snoozed").outcome == "snoozed"
    assert listed("pending") == []
    assert notified == []


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


TRAY = "org.kde.StatusNotifierWatcher"
TRAY_CHANGE = {
    "published_snapshot": OLD_SNAP,
    "published_fingerprint": OLD_FP,
    "differences": [
        {
            "path": ["x86_64", "Session Bus Policy", TRAY],
            "before": None,
            "after": "talk",
        }
    ],
}


def add_rule(db, decision="approved", key=TRAY, rationale="Tray icons are fine."):
    with db() as session:
        session.add(
            models.PermissionRule(
                created_by=1,
                updated_by=1,
                decision=decision,
                permission_group="Session Bus Policy",
                key=key,
                value="talk",
                rationale=rationale,
            )
        )


def test_rules_decide_new_assessments_until_a_moderator_overrides(db):
    add_rule(db)
    first = persist(1, **TRAY_CHANGE)
    assert (
        first.outcome,
        first.acceptance_basis,
        first.decision_rationale,
        first.decision_automatic,
    ) == ("accepted", "permission_decision", "Tray icons are fine.", True)
    assert persist(1, **TRAY_CHANGE).decision_id == first.decision_id

    decide(first.assessment_id, "rejected", rationale="Not this app")
    rebuilt = persist(2, pull_request_head_revision="4" * 40, **TRAY_CHANGE)
    assert (rebuilt.outcome, rebuilt.decision_automatic) == ("rejected", False)
    history = reviews.read_permission_review(rebuilt.assessment_id, None).decisions
    assert [(d.decision, d.reviewer_id, d.rules is None) for d in history] == [
        ("rejected", 1, True),
        ("approved", None, False),
    ]


NOTIFICATIONS = "org.freedesktop.Notifications"


def rule_input(name, decision="approved", **changes):
    values = {
        "decision": decision,
        "permission_group": "Session Bus Policy",
        "key": name,
        "value": "talk",
        "rationale": f"{decision} {name}",
        **changes,
    }
    return rules_api.PermissionRuleInput(**values)


@pytest.mark.parametrize(
    "changes",
    [
        {"value": "all"},
        {"rationale": "  "},
        {"key": ""},
        {"value": None},
        {"before": "see"},
        {"match_type": "transition", "before": None, "value": None},
        {"match_type": "transition", "before": "talk", "value": "talk"},
        {"match_type": "transition", "before": "all"},
        {"match_type": "transition", "before": ""},
        {"match_type": "transition", "before": "talk", "value": ""},
    ],
)
def test_rule_input_validation(changes):
    with pytest.raises(ValueError):
        rule_input(TRAY, **changes)


@pytest.mark.parametrize(
    ("before", "value"),
    [(None, "none"), ("none", None), ("none", "talk"), ("own", "talk")],
)
def test_transition_rule_input_accepts_absence_and_literal_none(before, value):
    rule = rule_input(TRAY, match_type="transition", before=before, value=value)
    assert (rule.before, rule.value) == (before, value)
    destination = rule_input(TRAY, value="none")
    assert (destination.match_type, destination.before) == ("destination", None)


def test_rule_value_is_required():
    values = rule_input(TRAY).model_dump()
    values.pop("value")
    with pytest.raises(ValidationError):
        rules_api.PermissionRuleInput(**values)


@pytest.mark.parametrize(
    ("before", "value"), [(None, "talk"), ("talk", None), ("own", "talk")]
)
def test_rule_uniqueness_covers_nullable_endpoints_and_both_kinds(db, before, value):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    destination = rules_api.create_permission_rule(rule_input(TRAY), MagicMock(), login)
    transition = rule_input(TRAY, match_type="transition", before=before, value=value)
    entry = rules_api.create_permission_rule(transition, MagicMock(), login)
    assert (entry.match_type, entry.before, entry.value) == (
        "transition",
        before,
        value,
    )
    with pytest.raises(HTTPException) as exc:
        rules_api.create_permission_rule(transition, MagicMock(), login)
    assert exc.value.detail == "rule_exists"
    assert {rule.id for rule in rules_api.list_permission_rules(None)} == {
        destination.id,
        entry.id,
    }
    with pytest.raises(HTTPException) as exc:
        rules_api.update_permission_rule(entry.id, rule_input(TRAY), MagicMock(), login)
    assert exc.value.detail == "rule_exists"


def test_transition_preview_apply_and_history_preserve_filesystem_reduction(db):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    change = TRAY_CHANGE | {
        "differences": [
            {
                "path": ["x86_64", "Context", "filesystems"],
                "before": ["home"],
                "after": ["home:ro"],
            }
        ]
    }
    pending = persist(1, **change)
    destination = rule_input("filesystems", permission_group="Context", value="home:ro")
    destination_entry = rules_api.create_permission_rule(
        destination, MagicMock(), login
    )
    assert rules_api.preview_permission_rules(None).pending == []
    rules_api.update_permission_rule(
        destination_entry.id,
        destination.model_copy(update={"enabled": False}),
        MagicMock(),
        login,
    )
    transition = rule_input(
        "filesystems",
        permission_group="Context",
        match_type="transition",
        before="home",
        value="home:ro",
        rationale="Allow only this exact reduction.",
    )
    draft = rules_api.PermissionRuleDraft(**transition.model_dump())
    preview = rules_api.preview_permission_rules(None, draft)
    assert [item.assessment_id for item in preview.pending] == [pending.assessment_id]
    entry = rules_api.create_permission_rule(transition, MagicMock(), login)
    applied = rules_api.apply_permission_rules(MagicMock(), login)
    assert [item.assessment_id for item in applied] == [pending.assessment_id]
    detail = reviews.read_permission_review(pending.assessment_id, None)
    decision = detail.decisions[0]
    assert decision.decision == "approved"
    assert decision.rationale == "Allow only this exact reduction."
    assert len(decision.rules) == 1
    matched = decision.rules[0]
    assert matched.id == entry.id
    assert matched.match_type == "transition"
    assert (matched.before, matched.value) == ("home", "home:ro")
    rules_api.update_permission_rule(
        entry.id,
        transition.model_copy(update={"before": "host", "rationale": "Another rule."}),
        MagicMock(),
        login,
    )
    history = reviews.read_permission_review(pending.assessment_id, None).decisions[0]
    assert history.rules == decision.rules
    assert history.rationale == decision.rationale


def test_destination_decision_history_keeps_snapshot_after_rule_update(db):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    rule = rules_api.create_permission_rule(rule_input(TRAY), MagicMock(), login)
    result = persist(1, **TRAY_CHANGE)
    decision = reviews.read_permission_review(result.assessment_id, None).decisions[0]
    assert decision.rules[0].id == rule.id
    assert decision.rules[0].decision == "approved"
    assert decision.rules[0].value == "talk"
    rules_api.update_permission_rule(
        rule.id,
        rule_input(TRAY, "rejected", rationale="Changed policy."),
        MagicMock(),
        login,
    )
    history = reviews.read_permission_review(result.assessment_id, None).decisions[0]
    assert history.rules == decision.rules
    assert history.decision == decision.decision
    assert history.rationale == decision.rationale


def test_rules_preview_conflicts_and_apply_to_pending_reviews(db):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    notify = rules_api.worker.notify_permission_decision.send
    superseded = persist(1, **TRAY_CHANGE)
    pending = persist(2, pull_request_head_revision="4" * 40, **TRAY_CHANGE)
    approved = persist(
        3,
        pull_request_number=18,
        **TRAY_CHANGE
        | {
            "differences": [
                {
                    "path": ["x86_64", "Session Bus Policy"],
                    "before": None,
                    "after": {NOTIFICATIONS: "talk"},
                }
            ]
        },
    )
    approval = decide(approved.assessment_id)

    rule = rules_api.create_permission_rule(rule_input(TRAY), MagicMock(), login)
    assert rule.updated_by_name == "Moderator"
    assert (rule.match_type, rule.before) == ("destination", None)
    with pytest.raises(HTTPException) as exc:
        rules_api.create_permission_rule(rule_input(TRAY), MagicMock(), login)
    assert exc.value.detail == "rule_exists"

    preview = rules_api.preview_permission_rules(
        None,
        rules_api.PermissionRuleDraft(
            **rule_input(NOTIFICATIONS, "rejected").model_dump()
        ),
    )
    assert [(m.assessment_id, m.decision) for m in preview.pending] == [
        (pending.assessment_id, "approved")
    ]
    assert [(c.decision_id, c.decision) for c in preview.conflicts] == [
        (approval.decision_id, "rejected")
    ]

    disabled = rule_input(TRAY, enabled=False)
    rules_api.update_permission_rule(rule.id, disabled, MagicMock(), login)
    assert rules_api.apply_permission_rules(MagicMock(), login) == []
    rules_api.update_permission_rule(rule.id, rule_input(TRAY), MagicMock(), login)

    applied = rules_api.apply_permission_rules(MagicMock(), login)
    assert [m.assessment_id for m in applied] == [pending.assessment_id]
    notify.assert_called_once_with(f"flathub/{APP}", 17)
    assert rules_api.apply_permission_rules(MagicMock(), login) == []
    assert assessment.get_assessment(superseded.assessment_id).outcome == "accepted"


def test_review_listing_filters_stored_outcome_and_superseded(db):
    superseded = persist(1)
    other_pr = persist(2, pull_request_number=18)
    rejected = persist(3, pull_request_number=19)
    decide(rejected.assessment_id, "rejected", rationale="No")
    newest = persist(4)
    persist(5, candidate_kind="push")
    set_baseline(db, SNAP, FP)
    persist(
        6,
        pull_request_number=20,
        outcome="accepted",
        acceptance_basis="baseline",
        baseline_id=1,
        published_snapshot=SNAP,
        published_fingerprint=FP,
        differences=[],
    )

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


@pytest.mark.parametrize(
    ("decisions", "handled"),
    [(["approved"], {APP}), (["approved", "rejected"], set())],
)
def test_publication_applies_decision_before_push_assessment(
    db, publish, decisions, handled
):
    set_baseline(db, OLD_SNAP, OLD_FP)
    for n, decision in enumerate(decisions, 1):
        decide(persist(n).assessment_id, decision, rationale="No")
    assert publish() == ([], handled, False)


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


@pytest.mark.parametrize(
    ("channel", "linked", "direct_upload", "expected"),
    [
        ("stable", False, False, ("approved", FP)),
        ("stable", False, True, ("initialized", OLD_FP)),
        ("beta", False, False, None),
        ("beta", True, False, ("approved", FP)),
    ],
)
def test_publication_advances_baseline(
    db, publish, channel, linked, direct_upload, expected
):
    set_baseline(db, OLD_SNAP, OLD_FP)
    if linked:
        persist(1, candidate_kind="push", intended_channel=channel)
    if direct_upload:
        with db() as session:
            session.add(models.DirectUploadApp(app_id=APP))
    publication.advance_published(9, channel, {APP})
    assert baseline(db, channel) == expected


def grouped_rule(**changes):
    return rule_input(
        "filesystems",
        **{
            "permission_group": "Context",
            "match_type": "grouped-delta",
            "value": None,
            "removed": ["home", "host"],
            "added": ["home:ro", "host:ro"],
            **changes,
        },
    )


INVALID_GROUPED_RULES = [
    {"before": "home"},
    {"value": "home:ro"},
    {"removed": None},
    {"added": None},
    {"removed": [], "added": []},
    {"removed": [""]},
    {"added": [" "]},
    {"removed": ["home", "home"]},
    {"added": ["home:ro", "home:ro"]},
    {"removed": ["home:ro"]},
    {"removed": [1]},
    {"added": {"home:ro": True}},
    {"permission_group": "Session Bus Policy"},
    {"permission_group": "System Bus Policy"},
    {"key": "unknown"},
]


@pytest.mark.parametrize("changes", INVALID_GROUPED_RULES)
def test_grouped_rule_input_rejects_invalid_deltas(changes):
    with pytest.raises(ValueError):
        grouped_rule(**changes)


@pytest.mark.parametrize("match_type", ["destination", "transition"])
@pytest.mark.parametrize("arrays", [{"removed": []}, {"added": []}])
def test_scalar_rules_reject_grouped_arrays(match_type, arrays):
    with pytest.raises(ValueError):
        rule_input(TRAY, match_type=match_type, **arrays)


@pytest.mark.parametrize("changes", INVALID_GROUPED_RULES)
def test_database_rejects_invalid_grouped_deltas(db, changes):
    values = grouped_rule().model_dump() | changes
    with pytest.raises(IntegrityError), db() as session:
        session.add(models.PermissionRule(**values, created_by=1, updated_by=1))
        session.flush()


@pytest.mark.parametrize("match_type", ["destination", "transition"])
def test_database_rejects_scalar_grouped_arrays(db, match_type):
    values = rule_input(TRAY, match_type=match_type).model_dump() | {"removed": []}
    with pytest.raises(IntegrityError), db() as session:
        session.add(models.PermissionRule(**values, created_by=1, updated_by=1))
        session.flush()


def test_grouped_rule_uniqueness_preserves_order_and_scalar_rules(db):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    body = grouped_rule()
    entry = rules_api.create_permission_rule(body, MagicMock(), login)
    assert (entry.removed, entry.added) == (body.removed, body.added)
    with pytest.raises(HTTPException) as exc:
        rules_api.create_permission_rule(
            body.model_copy(update={"decision": "rejected", "enabled": False}),
            MagicMock(),
            login,
        )
    assert exc.value.detail == "rule_exists"
    reordered = grouped_rule(removed=list(reversed(body.removed)))
    other = rules_api.create_permission_rule(reordered, MagicMock(), login)
    assert other.id != entry.id
    changed_additions = grouped_rule(added=list(reversed(body.added)))
    third = rules_api.create_permission_rule(changed_additions, MagicMock(), login)
    assert third.id not in (entry.id, other.id)
    scalar = rule_input("filesystems", permission_group="Context", value="home:ro")
    scalar_entry = rules_api.create_permission_rule(scalar, MagicMock(), login)
    assert scalar_entry.id not in (entry.id, other.id, third.id)
    with pytest.raises(HTTPException) as exc:
        rules_api.update_permission_rule(other.id, body, MagicMock(), login)
    assert exc.value.detail == "rule_exists"
    assert {item.id for item in rules_api.list_permission_rules(None)} == {
        entry.id,
        other.id,
        third.id,
        scalar_entry.id,
    }


def test_grouped_preview_apply_and_history_keep_atomic_delta(db):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    differences = [
        {
            "path": ["x86_64", "Context", "filesystems"],
            "before": ["unchanged", "home", "host"],
            "after": ["unchanged", "home:ro", "host:ro"],
        }
    ]
    pending = persist(1, **(TRAY_CHANGE | {"differences": differences}))
    partial = persist(
        2,
        pull_request_number=18,
        **(
            TRAY_CHANGE
            | {
                "differences": [
                    {
                        "path": ["x86_64", "Context", "filesystems"],
                        "before": ["home"],
                        "after": ["home:ro"],
                    }
                ]
            }
        ),
    )
    body = grouped_rule(rationale="Permit only the complete reduction.")
    draft = rules_api.PermissionRuleDraft(**body.model_dump())
    preview = rules_api.preview_permission_rules(None, draft)
    assert [item.assessment_id for item in preview.pending] == [pending.assessment_id]
    assert rules_api.preview_permission_rules(None).pending == []
    entry = rules_api.create_permission_rule(body, MagicMock(), login)
    applied = rules_api.apply_permission_rules(MagicMock(), login)
    assert [item.assessment_id for item in applied] == [pending.assessment_id]
    assert assessment.get_assessment(partial.assessment_id).outcome == "pending"
    detail = reviews.read_permission_review(pending.assessment_id, None)
    assert detail.outcome == "accepted"
    decision = detail.decisions[0]
    assert decision.rationale == body.rationale
    assert len(decision.rules) == 1
    matched = decision.rules[0]
    assert matched.id == entry.id
    assert matched.match_type == "grouped-delta"
    assert matched.before is None and matched.value is None
    assert matched.removed == body.removed
    assert matched.added == body.added
    rules_api.update_permission_rule(
        entry.id,
        grouped_rule(removed=["host"], added=["host:ro"]),
        MagicMock(),
        login,
    )
    history = reviews.read_permission_review(pending.assessment_id, None).decisions[0]
    assert history.rules == decision.rules
    assert history.rationale == decision.rationale
    with db() as session:
        session.delete(session.get(models.PermissionRule, entry.id))
    assert (
        reviews.read_permission_review(pending.assessment_id, None).decisions[0].rules
        == decision.rules
    )


def test_old_rule_history_defaults_grouped_arrays_to_none():
    history = reviews.PermissionDecisionRule(
        id=1,
        decision="approved",
        permission_group="Session Bus Policy",
        key=TRAY,
        value="talk",
    )
    assert history.match_type == "destination"
    assert history.before is None
    assert history.removed is None
    assert history.added is None


def grouped_migration(session):
    migration = runpy.run_path(
        os.path.join(
            ROOT_DIR,
            "alembic",
            "versions",
            "28a6ec6f07d9_add_grouped_permission_deltas.py",
        )
    )
    migration["upgrade"].__globals__["op"] = Operations(
        MigrationContext.configure(session.connection())
    )
    return migration


def test_grouped_migration_preserves_scalar_rules_and_history(db):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    entry = rules_api.create_permission_rule(rule_input(TRAY), MagicMock(), login)
    result = persist(1, **TRAY_CHANGE)
    with db() as session:
        history = session.scalar(select(models.PermissionDecision.rules))
        migration = grouped_migration(session)
        migration["downgrade"]()
        migration["upgrade"]()
        assert session.scalar(select(models.PermissionDecision.rules)) == history
    rule = next(
        item for item in rules_api.list_permission_rules(None) if item.id == entry.id
    )
    assert rule.value == "talk"
    assert rule.removed is None and rule.added is None
    assert (
        reviews.read_permission_review(result.assessment_id, None)
        .decisions[0]
        .rules[0]
        .id
        == entry.id
    )


def test_grouped_migration_refuses_rule_and_history_loss(db):
    login = SimpleNamespace(user=SimpleNamespace(id=1))
    entry = rules_api.create_permission_rule(grouped_rule(), MagicMock(), login)
    with (
        pytest.raises(
            DBAPIError, match="Cannot downgrade grouped permission rules or history"
        ),
        db() as session,
    ):
        grouped_migration(session)["downgrade"]()
    result = persist(
        1,
        **(
            TRAY_CHANGE
            | {
                "differences": [
                    {
                        "path": ["x86_64", "Context", "filesystems"],
                        "before": ["home", "host"],
                        "after": ["home:ro", "host:ro"],
                    }
                ]
            }
        ),
    )
    assert result.outcome == "accepted"
    with db() as session:
        session.delete(session.get(models.PermissionRule, entry.id))
    with (
        pytest.raises(
            DBAPIError, match="Cannot downgrade grouped permission rules or history"
        ),
        db() as session,
    ):
        grouped_migration(session)["downgrade"]()
