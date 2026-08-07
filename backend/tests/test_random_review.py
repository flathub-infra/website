import base64
import json
import logging
import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

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
        if self.model is models.DirectUploadApp:
            return [
                SimpleNamespace(app_id=app_id, first_seen_at=True)
                for app_id in self.session.direct_upload_app_ids
            ]
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
        self.direct_upload_app_ids = set()

    def query(self, model):
        return FakeQuery(self, model)

    def merge(self, value):
        return value

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
        current_summaries=None,
        build_summary=None,
        enabled=True,
        rate=0.5,
        secret="test-random-review-secret",
        target_repo="stable",
        build_refs=None,
        manifest_enabled=False,
        manifest_gating_enabled=False,
        complexity_gating_enabled=False,
        complexity_threshold_units=14,
        manifest_timeout=60.0,
        published_repo_url="https://published.example/repo",
        direct_upload_app_ids=(),
    ):
        self.db = FakeDb()
        self.db.session.direct_upload_app_ids = set(direct_upload_app_ids)
        self.emails = []
        self.app_ids = list(app_ids)
        self.skipped = set(skipped)
        self.current_values = current_values
        self.current_summaries = current_summaries or {}
        self.build_summary = build_summary or {}
        self.build_id = 42
        self.job_id = 7
        self.target_repo = target_repo
        self.build_refs = (
            build_refs
            if build_refs is not None
            else [
                {
                    "ref_name": "app/org.example.App/x86_64/stable",
                    "commit": "a" * 64,
                }
            ]
        )

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
            config.settings,
            "ostree_manifest_comparison_enabled",
            manifest_enabled,
        )
        monkeypatch.setattr(
            config.settings,
            "ostree_manifest_source_origin_gating_enabled",
            manifest_gating_enabled,
        )
        monkeypatch.setattr(
            config.settings,
            "ostree_manifest_complexity_gating_enabled",
            complexity_gating_enabled,
        )
        monkeypatch.setattr(
            config.settings,
            "ostree_manifest_complexity_threshold_units",
            complexity_threshold_units,
        )
        monkeypatch.setattr(
            config.settings,
            "ostree_manifest_timeout_seconds",
            manifest_timeout,
        )
        monkeypatch.setattr(config.settings, "repo_url", published_repo_url)
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
            lambda content, db: (self.build_summary, None, None),
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
        if key.startswith("summary:") and key.endswith(":stable"):
            app_id = key.removeprefix("summary:").removesuffix(":stable")
            return self.current_summaries.get(app_id)

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
                        "repo": self.target_repo,
                        "build_log_url": "https://logs.example/build",
                        "token_name": "builder",
                    },
                    "build_refs": self.build_refs,
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
        "OSTREE_MANIFEST_COMPARISON_ENABLED",
        "OSTREE_MANIFEST_SOURCE_ORIGIN_GATING_ENABLED",
        "OSTREE_MANIFEST_COMPLEXITY_GATING_ENABLED",
        "OSTREE_MANIFEST_COMPLEXITY_THRESHOLD_UNITS",
        "OSTREE_MANIFEST_TIMEOUT_SECONDS",
        "random_review_enabled",
        "random_review_rate",
        "random_review_secret",
        "ostree_manifest_comparison_enabled",
        "ostree_manifest_source_origin_gating_enabled",
        "ostree_manifest_complexity_gating_enabled",
        "ostree_manifest_complexity_threshold_units",
        "ostree_manifest_timeout_seconds",
    ):
        monkeypatch.delenv(name, raising=False)

    settings = config.Settings(_env_file=None)

    assert settings.random_review_enabled is False
    assert settings.random_review_rate == 0.01
    assert settings.random_review_secret is None
    assert settings.ostree_manifest_comparison_enabled is False
    assert settings.ostree_manifest_source_origin_gating_enabled is False
    assert settings.ostree_manifest_complexity_gating_enabled is False
    assert settings.ostree_manifest_complexity_threshold_units == 14
    assert settings.ostree_manifest_timeout_seconds == 60.0


@pytest.mark.parametrize("rate", [-0.001, 1.001])
def test_settings_reject_rates_outside_unit_interval(rate):
    with pytest.raises(ValidationError):
        config.Settings(random_review_rate=rate)


@pytest.mark.parametrize("timeout_seconds", [0, -0.001])
def test_settings_reject_non_positive_ostree_manifest_timeout(timeout_seconds):
    with pytest.raises(ValidationError):
        config.Settings(ostree_manifest_timeout_seconds=timeout_seconds)


@pytest.mark.parametrize("secret", [None, "", "   "])
def test_settings_require_secret_when_enabled(secret):
    with pytest.raises(ValidationError):
        config.Settings(random_review_enabled=True, random_review_secret=secret)


def test_manifest_origin_gate_requires_manifest_comparison():
    with pytest.raises(
        ValidationError,
        match="OSTREE_MANIFEST_SOURCE_ORIGIN_GATING_ENABLED requires OSTREE_MANIFEST_COMPARISON_ENABLED",
    ):
        config.Settings(
            ostree_manifest_comparison_enabled=False,
            ostree_manifest_source_origin_gating_enabled=True,
        )


def test_manifest_complexity_gate_requires_manifest_comparison():
    with pytest.raises(
        ValidationError,
        match="OSTREE_MANIFEST_COMPLEXITY_GATING_ENABLED requires OSTREE_MANIFEST_COMPARISON_ENABLED",
    ):
        config.Settings(
            ostree_manifest_comparison_enabled=False,
            ostree_manifest_complexity_gating_enabled=True,
        )


@pytest.mark.parametrize("threshold", [0, 41])
def test_manifest_complexity_threshold_bounds(threshold):
    with pytest.raises(ValidationError):
        config.Settings(ostree_manifest_complexity_threshold_units=threshold)


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
    assert harness.emails[0]["subject"] == "Build #42 held for review"


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


def test_extra_data_origin_request_suppresses_random_selection(monkeypatch):
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
        current_summaries={
            "org.example.App": {
                "metadata": {
                    "extra-data": {
                        "uri": "https://downloads.example/old.bin",
                    }
                }
            }
        },
        build_summary={
            "org.example.App": {
                "metadata": {
                    "extra-data": {
                        "uri": "https://cdn.example/new.bin",
                    },
                    "runtime": "org.freedesktop.Platform/x86_64/24.08",
                }
            }
        },
    )
    monkeypatch.setattr(
        moderation, "_random_review_sample_value", lambda *args: pytest.fail("sampled")
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    request = harness.db.session.persisted[0]
    request_data = json.loads(request.request_data)
    assert request_data["keys"] == {
        "extra-data": ["https://cdn.example"],
    }
    assert request_data["current_values"]["extra-data"] == ["https://downloads.example"]
    assert request.is_new_submission is False


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


def test_manifest_rejection_issue_formats_source_data(monkeypatch):
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
    complexity = {
        "score_units": 15,
        "raw_score_units": 15,
        "threshold_units": 14,
        "score_band": "large",
        "score_breakdown": {
            "structural_units": 5,
            "recipe_units": 6,
            "breadth_units": 2,
            "ambiguity_units": 2,
        },
        "affected_arches": ["aarch64", "x86_64"],
        "touched_modules": ["modules/main"],
        "touched_modules_truncated": True,
        "total_touched_module_count": 51,
        "events": [
            {
                "kind": "module_match_ambiguous",
                "location": "modules/main",
                "arches": ["aarch64", "x86_64"],
            }
        ],
        "events_truncated": True,
        "total_event_count": 26,
    }
    request = SimpleNamespace(
        appid="org.example.App",
        build_id=123,
        build_log_url="https://flathub.org/builds/123",
        comment="Not acceptable",
        request_type=ModerationRequestType.MANIFEST,
        request_data=json.dumps(
            {
                "findings": [
                    {
                        "origins_added": ["https://github.com/foo/bar"],
                        "origins_removed": ["https://github.com/foo/old"],
                        "locations_by_origin": {
                            "https://github.com/foo/bar": [
                                'modules["app"].sources[0].url'
                            ]
                        },
                        "arches": ["aarch64", "x86_64"],
                    }
                ],
                "complexity": complexity,
            }
        ),
    )

    moderation.create_github_build_rejection_issue(request)

    assert "New source: `https://github.com/foo/bar`" in created["body"]
    assert 'modules["app"].sources[0].url' in created["body"]
    assert (
        "Previous source no longer used: `https://github.com/foo/old`"
        in created["body"]
    )
    assert "aarch64, x86_64" in created["body"]
    assert "| Field |" not in created["body"]
    assert "New value" not in created["body"]
    assert "## Manifest packaging complexity" in created["body"]
    assert "not a security-risk or malicious-change assessment" in created["body"]
    assert "module_match_ambiguous" in created["body"]
    assert "Showing 1 of 26 events" in created["body"]
    assert "Showing 1 of 51 modules" in created["body"]

    request.request_data = json.dumps({"findings": [], "complexity": complexity})
    moderation.create_github_build_rejection_issue(request)
    assert "## Manifest packaging complexity" in created["body"]
    assert "## Manifest source origin changes" not in created["body"]


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


def _unchanged_values():
    return {
        "org.example.App": {
            "name": "Example App",
            "summary": "An example",
            "developer_name": "Example",
            "project_license": "MIT",
        }
    }


def _manifest_pair(
    arch,
    *,
    changed,
    status=moderation.ostree_manifest.PublishedManifestStatus.PRESENT,
):
    published_manifest = None if status.value != "present" else {"value": 1}
    candidate_manifest = {"value": 2 if changed else 1}
    return moderation.ostree_manifest.ManifestPair(
        app_id="org.example.App",
        ref_name=f"app/org.example.App/{arch}/stable",
        arch=arch,
        branch="stable",
        candidate_commit=("a" if arch == "x86_64" else "b") * 64,
        published_commit=None if published_manifest is None else "c" * 64,
        candidate_manifest=candidate_manifest,
        published_manifest=published_manifest,
        published_status=status,
    )


def _source_manifest_pair(arch="x86_64", *, app_id="org.example.App"):
    pair = _manifest_pair(arch, changed=True)
    pair.app_id = app_id
    pair.ref_name = f"app/{app_id}/{arch}/stable"
    pair.published_manifest = {"modules": []}
    pair.candidate_manifest = {
        "modules": [
            {
                "name": "app",
                "sources": [
                    {
                        "type": "archive",
                        "url": "https://github.com/foo/bar/archive/v1.tar",
                    }
                ],
            }
        ]
    }
    return pair


def _complexity_pair():
    pair = _manifest_pair("x86_64", changed=True)
    pair.published_manifest = {
        "modules": [
            {"name": "main", "buildsystem": "simple"},
            {"name": "commands", "build-commands": ["echo old"]},
        ]
    }
    pair.candidate_manifest = {
        "modules": [
            {"name": "main", "buildsystem": "meson"},
            {"name": "commands", "build-commands": ["echo new"]},
        ]
    }
    return pair


def test_disabled_manifest_comparison_preserves_callback(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=False,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda *args, **kwargs: pytest.fail("manifest collector called"),
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.add_calls == 0
    assert harness.db.session.commit_calls == 0
    assert harness.db.session.persisted == []
    assert harness.emails == []


def test_enabled_manifest_comparison_uses_all_refs_and_logs_counts(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger=moderation.__name__)
    build_refs = [
        {
            "ref_name": "app/org.example.App/x86_64/stable",
            "commit": "a" * 64,
        },
        {
            "ref_name": "app/org.example.App/aarch64/stable",
            "commit": "b" * 64,
        },
    ]
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        build_refs=build_refs,
        manifest_enabled=True,
        manifest_timeout=12.5,
    )
    captured = {}
    pairs = (
        _manifest_pair("x86_64", changed=True),
        _manifest_pair(
            "aarch64",
            changed=False,
            status=moderation.ostree_manifest.PublishedManifestStatus.REF_MISSING,
        ),
    )

    def collect_manifest_pairs(**kwargs):
        captured.update(kwargs)
        return pairs

    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        collect_manifest_pairs,
    )

    result = harness.call()

    assert result.requires_review is False
    assert captured == {
        "candidate_repo_url": "https://dl.flathub.org/build-repo/42",
        "published_repo_url": "https://published.example/repo",
        "refs": (
            moderation.ostree_manifest.CandidateManifestRef(
                app_id="org.example.App",
                ref_name="app/org.example.App/x86_64/stable",
                arch="x86_64",
                branch="stable",
                candidate_commit="a" * 64,
            ),
            moderation.ostree_manifest.CandidateManifestRef(
                app_id="org.example.App",
                ref_name="app/org.example.App/aarch64/stable",
                arch="aarch64",
                branch="stable",
                candidate_commit="b" * 64,
            ),
        ),
        "timeout_seconds": 12.5,
        "skip_missing_candidate_app_ids": set(),
    }
    record = next(
        record
        for record in caplog.records
        if record.getMessage() == "Compared embedded manifests"
    )
    assert record.ref_count == 2
    assert record.comparison_group_count == 2
    assert record.changed_group_count == 1
    assert record.missing_baseline_count == 1
    assert harness.db.session.persisted == []
    assert harness.emails == []


@pytest.mark.parametrize("target_repo", ["beta", "test"])
def test_non_stable_build_skips_manifest_comparison(monkeypatch, target_repo):
    harness = CallbackHarness(
        monkeypatch,
        target_repo=target_repo,
        manifest_enabled=True,
        build_refs=None,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "normalize_candidate_refs",
        lambda *args: pytest.fail("manifest refs normalized"),
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.add_calls == 0
    assert harness.emails == []


def test_missing_published_manifest_ref_keeps_initial_submission(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        current_values=None,
        manifest_enabled=True,
        build_refs=[
            {
                "ref_name": "app/org.example.App/x86_64/stable",
                "commit": "a" * 64,
            }
        ],
    )
    pair = _manifest_pair(
        "x86_64",
        changed=False,
        status=moderation.ostree_manifest.PublishedManifestStatus.REF_MISSING,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    assert harness.db.session.persisted[0].is_new_submission is True


def test_manifest_only_change_creates_no_request_on_repeated_callback(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        build_refs=[
            {
                "ref_name": "app/org.example.App/x86_64/stable",
                "commit": "a" * 64,
            }
        ],
    )
    pair = _manifest_pair("x86_64", changed=True)
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    first = harness.call()
    second = harness.call()

    assert first.requires_review is False
    assert second.requires_review is False
    assert harness.db.session.add_calls == 0
    assert harness.db.session.commit_calls == 0
    assert harness.db.session.persisted == []
    assert harness.emails == []


def test_direct_upload_app_allows_missing_candidate_manifest(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        direct_upload_app_ids=("org.example.App",),
        build_refs=[
            {
                "ref_name": "app/org.example.App/x86_64/stable",
                "commit": "a" * 64,
            }
        ],
    )

    def collect_manifest_pairs(**kwargs):
        assert kwargs["skip_missing_candidate_app_ids"] == {"org.example.App"}
        return ()

    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        collect_manifest_pairs,
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.add_calls == 0
    assert harness.db.session.persisted == []
    assert harness.emails == []


@pytest.mark.parametrize(
    "error",
    [
        moderation.ostree_manifest.ManifestTransportError("ostree_io"),
        moderation.ostree_manifest.ManifestTimeoutError("timeout"),
    ],
)
def test_manifest_retrieval_failure_has_no_side_effects(monkeypatch, error):
    harness = CallbackHarness(
        monkeypatch,
        manifest_enabled=True,
        build_refs=[
            {
                "ref_name": "app/org.example.App/x86_64/stable",
                "commit": "a" * 64,
            }
        ],
    )

    def fail_collection(**kwargs):
        raise error

    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        fail_collection,
    )

    with pytest.raises(HTTPException) as raised:
        harness.call()

    assert raised.value.status_code == 500
    assert raised.value.detail == "manifest_retrieval_failed"
    assert harness.db.session.add_calls == 0
    assert harness.db.session.commit_calls == 0
    assert harness.db.session.invalidation_updates == 0
    assert harness.db.session.persisted == []
    assert harness.emails == []


def test_invalid_manifest_build_refs_translate_to_invalid_build(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        manifest_enabled=True,
        build_refs=[
            {
                "ref_name": "app/org.example.App/x86_64/stable",
                "commit": "invalid",
            }
        ],
    )

    with pytest.raises(HTTPException) as raised:
        harness.call()

    assert raised.value.status_code == 500
    assert raised.value.detail == "invalid_build"
    assert harness.db.session.add_calls == 0
    assert harness.emails == []


def test_initial_submission_does_not_create_manifest_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=None,
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is True
    assert [request.request_type for request in harness.db.session.persisted] == [
        ModerationRequestType.APPDATA
    ]


def test_skip_list_does_not_create_manifest_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        skipped=("org.example.App",),
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.persisted == []


def test_disabled_manifest_gate_logs_would_require_review(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger=moderation.__name__)
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=False,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    record = next(
        record
        for record in caplog.records
        if record.getMessage() == "Evaluated manifest source gate for app"
    )
    assert record.would_require_review is True
    assert record.introduced_sources == ["https://github.com/foo/bar"]
    assert result.requires_review is False
    assert harness.db.session.persisted == []
    assert harness.emails == []


def test_manifest_gate_creates_exact_stable_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    request = harness.db.session.persisted[0]
    assert request.request_type == ModerationRequestType.MANIFEST
    request_body = json.loads(request.request_data)
    assert request_body["findings"] == [
        {
            "arches": ["x86_64"],
            "locations_by_origin": {
                "https://github.com/foo/bar": ['modules["app"].sources[0].url']
            },
            "origins_added": ["https://github.com/foo/bar"],
            "origins_removed": [],
        }
    ]
    assert request_body["complexity"]["algorithm_version"] == 2
    assert request_body["complexity"]["score_units"] == 5
    assert request_body["complexity"]["threshold_units"] == 14
    assert request_body["complexity"]["analysis_fingerprint"].startswith("sha256:")
    assert request.request_data == json.dumps(
        json.loads(request.request_data),
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )
    assert request.build_id == 42
    assert request.job_id == 7
    assert request.build_log_url == "https://logs.example/build"
    assert request.is_new_submission is False
    assert len(harness.emails) == 1


def test_complexity_disabled_logs_without_request(monkeypatch, caplog):
    caplog.set_level(logging.INFO, logger=moderation.__name__)
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        complexity_gating_enabled=False,
        complexity_threshold_units=12,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_complexity_pair(),),
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.persisted == []
    record = next(
        record
        for record in caplog.records
        if record.getMessage() == "Evaluated manifest packaging complexity for app"
    )
    assert record.score_units == 12
    assert record.would_gate is True
    assert record.gating_enabled is False
    assert record.gate_suppressed_reason == "gating-disabled"


def test_complexity_at_threshold_creates_one_manifest_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=True,
        rate=1,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        complexity_gating_enabled=True,
        complexity_threshold_units=12,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_complexity_pair(),),
    )

    first = harness.call()
    second = harness.call()

    assert first.requires_review is True
    assert second.requires_review is True
    assert len(harness.db.session.persisted) == 1
    assert len(harness.emails) == 1
    request = harness.db.session.persisted[0]
    assert request.request_type == ModerationRequestType.MANIFEST
    body = json.loads(request.request_data)
    assert body["findings"] == []
    assert body["complexity"]["score_units"] == 12
    assert body["complexity"]["raw_score_units"] == 12
    assert body["complexity"]["score_breakdown"] == {
        "ambiguity_units": 0,
        "breadth_units": 2,
        "recipe_units": 10,
        "structural_units": 0,
    }


def test_complexity_only_is_suppressed_by_appdata_request(monkeypatch):
    current_values = _unchanged_values()
    current_values["org.example.App"]["name"] = "Old name"
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=current_values,
        manifest_enabled=True,
        complexity_gating_enabled=True,
        complexity_threshold_units=12,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_complexity_pair(),),
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    assert harness.db.session.persisted[0].request_type == ModerationRequestType.APPDATA


@pytest.mark.parametrize(
    ("handled_at", "is_approved", "expected"),
    [
        (None, None, True),
        ("handled", True, False),
        ("handled", False, False),
    ],
)
def test_identical_manifest_callback_reuses_request(
    monkeypatch, handled_at, is_approved, expected
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )
    first = harness.call()
    request = harness.db.session.persisted[0]
    request.handled_at = handled_at
    request.is_approved = is_approved

    second = harness.call()

    assert first.requires_review is True
    assert second.requires_review is expected
    assert len(harness.db.session.persisted) == 1
    assert harness.db.session.add_calls == 1
    assert harness.db.session.commit_calls == 1
    assert harness.db.session.invalidation_updates == 1
    assert len(harness.emails) == 1


def test_manifest_request_suppresses_random_sampling(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=True,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )
    monkeypatch.setattr(
        moderation,
        "_random_review_sample_value",
        lambda *args: pytest.fail("random review sampled"),
    )

    assert harness.call().requires_review is True
    assert (
        harness.db.session.persisted[0].request_type == ModerationRequestType.MANIFEST
    )


def test_manifest_request_is_persisted_in_observe_only_mode(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(config.settings, "moderation_observe_only", True)
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is False
    assert (
        harness.db.session.persisted[0].request_type == ModerationRequestType.MANIFEST
    )
    assert harness.emails == []


def test_manifest_finding_without_appstream_is_logged_not_persisted(
    monkeypatch, caplog
):
    caplog.set_level(logging.INFO, logger=moderation.__name__)
    harness = CallbackHarness(
        monkeypatch,
        app_ids=(),
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.persisted == []
    assert any(
        record.getMessage() == "Evaluated manifest source gate for app"
        and record.reason == "missing-appstream"
        for record in caplog.records
    )


@pytest.mark.parametrize("conflict", ["job", "data", "multiple"])
def test_conflicting_manifest_request_fails(monkeypatch, conflict):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )
    harness.call()
    request = harness.db.session.persisted[0]
    if conflict == "job":
        request.job_id += 1
    elif conflict == "data":
        request.request_data = "{}"
    else:
        harness.db.session.persisted.append(request)

    with pytest.raises(HTTPException) as raised:
        harness.call()

    assert raised.value.status_code == 500
    assert raised.value.detail == "conflicting_manifest_review_request"
