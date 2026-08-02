import base64
import json
import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import config, models, moderation
from app.types import ModerationRequestType


class FakeResponse:
    def __init__(self, payload=None, content=b"summary"):
        self._payload = payload
        self.content = content

    def json(self):
        return self._payload

    def raise_for_status(self):
        pass


class FakeQuery:
    def __init__(self, session, model):
        self.session = session
        self.model = model
        self.filtered = False

    def filter(self, *args):
        self.filtered = True
        return self

    def filter_by(self, **kwargs):
        return self

    def all(self):
        if self.model is models.ModerationRequest and self.filtered:
            return list(self.session.persisted)
        return []

    def update(self, values):
        self.session.invalidation_updates += 1
        return 0


class FakeSession:
    def __init__(self):
        self.persisted = []
        self.pending = []
        self.add_calls = 0
        self.commit_calls = 0
        self.invalidation_updates = 0

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, request):
        self.add_calls += 1
        self.pending.append(request)

    def commit(self):
        self.commit_calls += 1
        self.persisted.extend(self.pending)
        self.pending.clear()


class FakeDb:
    def __init__(self):
        self.session = FakeSession()


class CallbackHarness:
    def __init__(
        self,
        monkeypatch,
        app_ids=("org.example.App",),
        skipped=(),
        current_values=None,
        enabled=True,
        rate=0.5,
        secret="test-random-review-secret",
    ):
        self.db = FakeDb()
        self.emails = []
        self.app_ids = list(app_ids)
        self.skipped = set(skipped)
        self.current_values = current_values
        self.build_id = 42
        self.job_id = 7

        monkeypatch.setattr(config.settings, "random_review_enabled", enabled)
        monkeypatch.setattr(config.settings, "random_review_rate", rate)
        monkeypatch.setattr(config.settings, "random_review_secret", secret)
        monkeypatch.setattr(
            config.settings,
            "flat_manager_build_secret",
            base64.b64encode(b"build-secret").decode(),
        )
        monkeypatch.setattr(
            config.settings, "flat_manager_api", "https://flat-manager.example"
        )
        monkeypatch.setattr(config.settings, "moderation_observe_only", False)
        monkeypatch.setattr(
            moderation.jwt,
            "decode",
            lambda *args, **kwargs: {"scope": ["reviewcheck"]},
        )
        monkeypatch.setattr(
            moderation.utils,
            "create_flat_manager_token",
            lambda *args, **kwargs: "flat-manager-token",
        )
        monkeypatch.setattr(moderation.utils, "appstream2dict", self.appstream)
        monkeypatch.setattr(
            moderation.summary,
            "parse_summary",
            lambda content, db: ({}, None, None),
        )
        monkeypatch.setattr(moderation, "get_db", self.get_db)
        monkeypatch.setattr(
            moderation.worker.send_email_new, "send", self.emails.append
        )
        monkeypatch.setattr(
            moderation, "should_skip_review", lambda app_id: app_id in self.skipped
        )
        monkeypatch.setattr(moderation, "get_json_key", self.get_json_key)
        monkeypatch.setattr(moderation.http_client, "get", self.http_get)

    def appstream(self, url):
        return {
            app_id: {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
            for app_id in self.app_ids
        }

    def get_json_key(self, key):
        if not key.startswith("apps:"):
            return None
        app_id = key.removeprefix("apps:")
        if self.current_values is None or app_id not in self.current_values:
            return None
        return self.current_values[app_id]

    def http_get(self, url, **kwargs):
        if url.endswith("/extended"):
            return FakeResponse(
                {
                    "build": {
                        "repo": "stable",
                        "build_log_url": "https://logs.example/build",
                        "token_name": "builder",
                    },
                    "build_refs": [
                        {
                            "ref_name": "app/org.example/x86_64/stable",
                            "commit": "abc123",
                        }
                    ],
                }
            )
        return FakeResponse(content=b"summary")

    @contextmanager
    def get_db(self, db_type="replica"):
        yield self.db

    def call(self):
        return moderation.submit_review_request(
            moderation.ReviewRequest(build_id=self.build_id, job_id=self.job_id),
            authorization=SimpleNamespace(credentials="review-token"),
        )


def test_settings_default_rate_and_disabled_by_default(monkeypatch):
    for name in (
        "RANDOM_REVIEW_ENABLED",
        "RANDOM_REVIEW_RATE",
        "RANDOM_REVIEW_SECRET",
        "random_review_enabled",
        "random_review_rate",
        "random_review_secret",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = config.Settings(_env_file=None)

    assert settings.random_review_enabled is False
    assert settings.random_review_rate == 0.01
    assert settings.random_review_secret is None


@pytest.mark.parametrize("rate", [-0.001, 1.001])
def test_settings_reject_rates_outside_unit_interval(rate):
    with pytest.raises(ValidationError):
        config.Settings(random_review_rate=rate)


@pytest.mark.parametrize("secret", [None, "", "   "])
def test_settings_require_secret_when_enabled(secret):
    with pytest.raises(ValidationError):
        config.Settings(random_review_enabled=True, random_review_secret=secret)


def test_canonical_identity_is_independent_of_reference_order():
    metadata = {"repo": "stable"}
    refs = [
        {"ref_name": "app/org.example/aarch64/stable", "commit": "def456"},
        {"ref_name": "app/org.example/x86_64/stable", "commit": "abc123"},
    ]

    assert moderation._canonical_random_review_identity(
        metadata, refs
    ) == moderation._canonical_random_review_identity(metadata, list(reversed(refs)))


def test_canonical_identity_keeps_duplicate_references():
    metadata = {"repo": "stable"}
    ref = {"ref_name": "app/org.example/x86_64/stable", "commit": "abc123"}

    assert moderation._canonical_random_review_identity(metadata, [ref, ref]) != (
        moderation._canonical_random_review_identity(metadata, [ref])
    )


def test_random_review_sample_is_deterministic_and_bounded():
    identity = moderation._canonical_random_review_identity(
        {"repo": "stable"},
        [{"ref_name": "app/org.example/x86_64/stable", "commit": "abc123"}],
    )

    first = moderation._random_review_sample_value(identity, "secret")
    second = moderation._random_review_sample_value(identity, "secret")

    assert first == second
    assert 0 <= first < 1


def test_random_review_sample_value_stays_below_one(monkeypatch):
    monkeypatch.setattr(
        moderation.hmac,
        "new",
        lambda *args, **kwargs: SimpleNamespace(digest=lambda: b"\xff" * 32),
    )

    assert moderation._random_review_sample_value(b"identity", "secret") < 1


def test_disabled_feature_produces_no_random_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )
    monkeypatch.setattr(
        moderation, "_random_review_sample_value", lambda *args: pytest.fail("sampled")
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.add_calls == 0
    assert harness.db.session.persisted == []


def test_enabled_selected_creates_random_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )
    monkeypatch.setattr(moderation, "_random_review_sample_value", lambda *args: 0.0)

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    request = harness.db.session.persisted[0]
    assert request.appid == "org.example.App"
    assert json.loads(request.request_data) == moderation._random_review_request_data()
    assert harness.emails
    assert harness.emails[0]["subject"] == "Build #42 selected for human review"


def test_enabled_unselected_creates_no_random_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )
    monkeypatch.setattr(moderation, "_random_review_sample_value", lambda *args: 1.0)

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.persisted == []
    assert harness.emails == []


@pytest.mark.parametrize(
    ("rate", "sampled", "selected"),
    [(0.0, 0.0, False), (1.0, 1.0, False), (1.0, 0.0, True)],
)
def test_random_review_rate_boundaries(monkeypatch, rate, sampled, selected):
    harness = CallbackHarness(
        monkeypatch,
        rate=rate,
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )
    monkeypatch.setattr(
        moderation, "_random_review_sample_value", lambda *args: sampled
    )

    result = harness.call()

    assert bool(harness.db.session.persisted) is selected
    assert result.requires_review is selected


def test_deterministic_request_suppresses_random_selection(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        current_values={
            "org.example.App": {
                "name": "Changed App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )
    monkeypatch.setattr(
        moderation, "_random_review_sample_value", lambda *args: pytest.fail("sampled")
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    assert (
        json.loads(harness.db.session.persisted[0].request_data)["keys"]["name"]
        == "Example App"
    )
    assert harness.db.session.persisted[0].is_new_submission is False


def test_initial_submission_suppresses_random_selection(monkeypatch):
    harness = CallbackHarness(monkeypatch, current_values=None)
    monkeypatch.setattr(
        moderation, "_random_review_sample_value", lambda *args: pytest.fail("sampled")
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    assert harness.db.session.persisted[0].is_new_submission is True


def test_all_skipped_apps_suppress_selection(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        app_ids=("org.example.App", "org.example.Other"),
        skipped=("org.example.App", "org.example.Other"),
    )
    monkeypatch.setattr(
        moderation, "_random_review_sample_value", lambda *args: pytest.fail("sampled")
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.persisted == []


def test_mixed_skipped_apps_only_create_eligible_random_requests(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        app_ids=("org.example.App", "org.example.Skipped"),
        skipped=("org.example.Skipped",),
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            },
            "org.example.Skipped": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            },
        },
    )
    monkeypatch.setattr(moderation, "_random_review_sample_value", lambda *args: 0.0)

    harness.call()

    assert [request.appid for request in harness.db.session.persisted] == [
        "org.example.App"
    ]


def test_repeated_callback_reuses_marker_without_side_effects(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )
    monkeypatch.setattr(moderation, "_random_review_sample_value", lambda *args: 0.0)

    first = harness.call()
    add_calls = harness.db.session.add_calls
    commit_calls = harness.db.session.commit_calls
    invalidation_updates = harness.db.session.invalidation_updates
    email_count = len(harness.emails)

    monkeypatch.setattr(config.settings, "random_review_rate", 0.0)
    monkeypatch.setattr(config.settings, "random_review_secret", "changed-secret")
    monkeypatch.setattr(
        moderation,
        "_random_review_sample_value",
        lambda *args: pytest.fail("resampled"),
    )

    second = harness.call()

    assert first.requires_review is True
    assert second.requires_review is True
    assert len(harness.db.session.persisted) == 1
    assert harness.db.session.add_calls == add_calls
    assert harness.db.session.commit_calls == commit_calls
    assert harness.db.session.invalidation_updates == invalidation_updates
    assert len(harness.emails) == email_count
    assert _is_marker(harness.db.session.persisted[0])


@pytest.mark.parametrize("is_approved", [True, False])
def test_repeated_callback_preserves_terminal_review_state(monkeypatch, is_approved):
    harness = CallbackHarness(
        monkeypatch,
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )
    monkeypatch.setattr(moderation, "_random_review_sample_value", lambda *args: 0.0)
    first = harness.call()
    request = harness.db.session.persisted[0]
    request.handled_at = True
    request.is_approved = is_approved

    monkeypatch.setattr(
        moderation,
        "_random_review_sample_value",
        lambda *args: pytest.fail("resampled"),
    )
    second = harness.call()

    assert first.requires_review is True
    assert second.requires_review is False
    assert len(harness.db.session.persisted) == 1


def _is_marker(request):
    return (
        request.request_type == ModerationRequestType.APPDATA
        and moderation._is_random_review_request(request)
    )


def test_random_request_marker_parser_rejects_malformed_data():
    request = SimpleNamespace(request_data="not-json")

    assert moderation._is_random_review_request(request) is False
    assert (
        moderation._is_random_review_request(
            SimpleNamespace(request_data=json.dumps({"keys": {}, "current_values": {}}))
        )
        is False
    )


def test_random_rejection_issue_uses_review_reason(monkeypatch):
    created = {}

    class FakeRepo:
        def get_pulls(self, **kwargs):
            return []

        def create_issue(self, title, body):
            created["title"] = title
            created["body"] = body
            return SimpleNamespace()

    class FakeGithub:
        def __init__(self, token):
            pass

        def get_repo(self, name):
            return FakeRepo()

    monkeypatch.setattr(config.settings, "github_bot_token", "token")
    monkeypatch.setattr(moderation, "Github", FakeGithub)

    request = SimpleNamespace(
        appid="org.example.App",
        build_id=123,
        build_log_url="https://flathub.org/builds/123",
        comment="Not acceptable",
        request_data=json.dumps(moderation._random_review_request_data()),
    )

    moderation.create_github_build_rejection_issue(request)

    assert created["title"] == "Random human review for build 123 rejected"
    assert "Randomly selected for human review" in created["body"]
    assert "Old value" not in created["body"]
    assert "New value" not in created["body"]


def test_random_review_missing_secret_fails_only_when_selection_needed(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        secret=None,
        current_values={
            "org.example.App": {
                "name": "Example App",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            }
        },
    )

    with pytest.raises(HTTPException) as exc_info:
        harness.call()

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "random_review_not_configured"
