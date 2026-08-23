import base64
import json
import logging
import os
import sys
from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import inspect

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
        self.criteria = []
        self.filter_by_criteria = {}

    def filter(self, *args):
        self.filtered = True
        self.criteria.extend(args)
        return self

    def filter_by(self, **kwargs):
        self.filtered = True
        self.filter_by_criteria.update(kwargs)
        return self

    def _matches(self, request):
        for key, value in self.filter_by_criteria.items():
            if getattr(request, key, None) != value:
                return False
        for criterion in self.criteria:
            left = getattr(criterion, "left", None)
            key = getattr(left, "key", None)
            value = getattr(getattr(criterion, "right", None), "value", None)
            right_name = type(getattr(criterion, "right", None)).__name__
            if right_name == "False_":
                value = False
            elif right_name == "True_":
                value = True
            operator = getattr(criterion, "operator", None)
            current = getattr(request, key, None)
            operator_name = getattr(operator, "__name__", "")
            if operator_name in {"eq", "is_"} and current != value:
                return False
            if operator_name in {"ne", "is_not"} and current == value:
                return False
            if operator_name == "in_op" and current not in (value or []):
                return False
        return True

    def _requests(self):
        if self.model is not models.ModerationRequest:
            return []
        requests = [
            request for request in self.session.persisted if self._matches(request)
        ]
        self.session.loaded_requests.extend(requests)
        return requests

    def all(self):
        if self.model is models.ModerationRequest and self.filtered:
            return self._requests()
        if self.model is models.DirectUploadApp:
            return [
                SimpleNamespace(app_id=app_id, first_seen_at=True)
                for app_id in self.session.direct_upload_app_ids
            ]
        return []

    def first(self):
        results = self.all()
        return results[0] if results else None

    def count(self):
        return len(self.all())

    def with_for_update(self):
        return self

    def update(self, values):
        requests = self._requests()
        self.session.invalidation_updates += 1
        self.session.update_calls.append(
            {
                "filter_by": dict(self.filter_by_criteria),
                "criteria": list(self.criteria),
                "values": dict(values),
                "requests": requests,
            }
        )
        for request in requests:
            for key, value in values.items():
                setattr(request, key, value)
        return len(requests)


class FakeSession:
    def __init__(self):
        self.persisted = []
        self.pending = []
        self.add_calls = 0
        self.commit_calls = 0
        self.invalidation_updates = 0
        self.update_calls = []
        self.direct_upload_app_ids = set()
        self.expire_loaded_on_context_exit = False
        self.expire_on_commit = True
        self.loaded_requests = []

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
        token_name="builder",
        build_refs=None,
        manifest_enabled=False,
        manifest_gating_enabled=False,
        manifest_source_origin_observe_only=False,
        complexity_gating_enabled=False,
        complexity_gating_observe_only=False,
        complexity_threshold_units=14,
        manifest_timeout=60.0,
        published_repo_url="https://published.example/repo",
        direct_upload_app_ids=(),
    ):
        self.db = FakeDb()
        self.db.session.direct_upload_app_ids = set(direct_upload_app_ids)
        self.observations = {}
        self.emails = []
        self.app_ids = list(app_ids)
        self.skipped = set(skipped)
        self.current_values = current_values
        self.current_summaries = current_summaries or {}
        self.build_summary = build_summary or {}
        self.build_id = 42
        self.job_id = 7
        self.target_repo = target_repo
        self.token_name = token_name
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
            "ostree_manifest_source_origin_observe_only",
            manifest_source_origin_observe_only,
        )
        monkeypatch.setattr(
            config.settings,
            "ostree_manifest_complexity_gating_enabled",
            complexity_gating_enabled,
        )
        monkeypatch.setattr(
            config.settings,
            "ostree_manifest_complexity_gating_observe_only",
            complexity_gating_observe_only,
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
        monkeypatch.setattr(
            moderation,
            "_upsert_manifest_analysis_observations",
            self.upsert_manifest_analysis_observations,
        )

    def upsert_manifest_analysis_observations(self, session, observations):
        assert session is self.db.session
        for observation in observations:
            key = (observation["build_id"], observation["app_id"])
            self.observations[key] = {
                **self.observations.get(key, {}),
                **observation,
            }

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
                        "token_name": self.token_name,
                    },
                    "build_refs": self.build_refs,
                }
            )
        return FakeResponse(content=b"summary")

    @contextmanager
    def get_db(self, db_type="replica"):
        try:
            yield self.db
        finally:
            if (
                db_type == "writer"
                and self.db.session.expire_loaded_on_context_exit
                and self.db.session.expire_on_commit
            ):
                for request in self.db.session.loaded_requests:
                    state = inspect(request)
                    state._expire(request.__dict__, set())
            self.db.session.loaded_requests.clear()

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
        "OSTREE_MANIFEST_SOURCE_ORIGIN_OBSERVE_ONLY",
        "OSTREE_MANIFEST_COMPLEXITY_GATING_ENABLED",
        "OSTREE_MANIFEST_COMPLEXITY_GATING_OBSERVE_ONLY",
        "OSTREE_MANIFEST_COMPLEXITY_THRESHOLD_UNITS",
        "OSTREE_MANIFEST_TIMEOUT_SECONDS",
        "random_review_enabled",
        "random_review_rate",
        "random_review_secret",
        "ostree_manifest_comparison_enabled",
        "ostree_manifest_source_origin_gating_enabled",
        "ostree_manifest_source_origin_observe_only",
        "ostree_manifest_complexity_gating_enabled",
        "ostree_manifest_complexity_gating_observe_only",
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
    assert settings.ostree_manifest_source_origin_observe_only is False
    assert settings.ostree_manifest_complexity_gating_enabled is False
    assert settings.ostree_manifest_complexity_gating_observe_only is False
    assert settings.ostree_manifest_complexity_threshold_units == 14
    assert settings.ostree_manifest_timeout_seconds == 60.0


def test_settings_read_canonical_manifest_observe_only_environment(monkeypatch):
    monkeypatch.setenv("OSTREE_MANIFEST_SOURCE_ORIGIN_OBSERVE_ONLY", "true")
    monkeypatch.setenv("OSTREE_MANIFEST_COMPLEXITY_GATING_OBSERVE_ONLY", "true")
    settings = config.Settings(
        ostree_manifest_comparison_enabled=True,
        _env_file=None,
    )

    assert settings.ostree_manifest_source_origin_observe_only is True
    assert settings.ostree_manifest_complexity_gating_observe_only is True


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


def test_manifest_origin_observe_only_requires_manifest_comparison():
    with pytest.raises(
        ValidationError,
        match="OSTREE_MANIFEST_SOURCE_ORIGIN_OBSERVE_ONLY requires OSTREE_MANIFEST_COMPARISON_ENABLED",
    ):
        config.Settings(
            ostree_manifest_comparison_enabled=False,
            ostree_manifest_source_origin_observe_only=True,
        )


def test_manifest_complexity_observe_only_requires_manifest_comparison():
    with pytest.raises(
        ValidationError,
        match="OSTREE_MANIFEST_COMPLEXITY_GATING_OBSERVE_ONLY requires OSTREE_MANIFEST_COMPARISON_ENABLED",
    ):
        config.Settings(
            ostree_manifest_comparison_enabled=False,
            ostree_manifest_complexity_gating_observe_only=True,
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


def test_email_uses_request_data_after_committed_objects_expire(monkeypatch):
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
    original_commit = harness.db.session.commit

    def expire_committed_requests():
        original_commit()
        for request in harness.db.session.persisted:
            state = inspect(request)
            state._expire(request.__dict__, set())

    monkeypatch.setattr(harness.db.session, "commit", expire_committed_requests)

    result = harness.call()

    assert result.requires_review is True
    assert harness.emails[0]["messageInfo"]["appId"] == "org.example.App"
    assert harness.emails[0]["messageInfo"]["requests"] == [
        {
            "requestType": ModerationRequestType.APPDATA,
            "requestData": moderation._random_review_request_data(),
            "isNewSubmission": False,
        }
    ]


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
    assert request.request_type == ModerationRequestType.SUMMARY
    assert request.is_new_submission is False


def test_permission_only_request_is_summary(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        current_summaries={
            "org.example.App": {
                "metadata": {
                    "permissions": {
                        "shared": ["network"],
                    }
                }
            }
        },
        build_summary={
            "org.example.App": {
                "metadata": {
                    "permissions": {
                        "shared": ["network", "ipc"],
                    }
                }
            }
        },
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    request = harness.db.session.persisted[0]
    assert request.request_type == ModerationRequestType.SUMMARY
    assert json.loads(request.request_data) == {
        "keys": {"shared": ["ipc", "network"]},
        "current_values": {"shared": ["network"]},
    }


def test_architecture_only_request_is_summary(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        current_summaries={"org.example.App": {"arches": ["x86_64"]}},
        build_summary={"org.example.App": {"arches": ["aarch64", "x86_64"]}},
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 1
    request = harness.db.session.persisted[0]
    assert request.request_type == ModerationRequestType.SUMMARY
    assert json.loads(request.request_data) == {
        "keys": {"arches": ["aarch64", "x86_64"]},
        "current_values": {"arches": ["x86_64"]},
    }


def test_appstream_and_summary_changes_create_disjoint_requests(monkeypatch):
    current_values = _unchanged_values()
    current_values["org.example.App"]["name"] = "Old name"
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=current_values,
        current_summaries={
            "org.example.App": {
                "metadata": {
                    "permissions": {
                        "shared": ["network"],
                    }
                }
            }
        },
        build_summary={
            "org.example.App": {
                "metadata": {
                    "permissions": {
                        "shared": ["network", "ipc"],
                    }
                }
            }
        },
    )

    result = harness.call()

    assert result.requires_review is True
    assert len(harness.db.session.persisted) == 2
    requests = {
        request.request_type: json.loads(request.request_data)
        for request in harness.db.session.persisted
    }
    assert requests == {
        ModerationRequestType.APPDATA: {
            "keys": {"name": "Example App"},
            "current_values": {
                "name": "Old name",
                "summary": "An example",
                "developer_name": "Example",
                "project_license": "MIT",
            },
        },
        ModerationRequestType.SUMMARY: {
            "keys": {"shared": ["ipc", "network"]},
            "current_values": {"shared": ["network"]},
        },
    }


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


def _source_transition_manifest_pair(
    published_urls,
    candidate_urls,
    *,
    arch="x86_64",
    app_id="org.example.App",
):
    pair = _manifest_pair(arch, changed=True)
    pair.app_id = app_id
    pair.ref_name = f"app/{app_id}/{arch}/stable"

    def manifest(urls):
        return (
            {
                "modules": [
                    {
                        "name": "app",
                        "sources": [{"type": "archive", "url": url} for url in urls],
                    }
                ]
            }
            if urls
            else {"modules": []}
        )

    pair.published_manifest = manifest(published_urls)
    pair.candidate_manifest = manifest(candidate_urls)
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


def test_manifest_complexity_request_data_accepts_truncated_events():
    events = [
        moderation.ManifestComplexityEventData(
            kind=moderation.manifest_complexity.ManifestChangeKind.MODULE_ADDED,
            location=f"modules/{index:02d}",
            arches=[],
        )
        for index in range(25)
    ]

    data = moderation.ManifestComplexityRequestData(
        algorithm_version=1,
        analysis_fingerprint="sha256:" + "0" * 64,
        score_units=1,
        raw_score_units=1,
        display_score=0.5,
        threshold_units=14,
        score_band=moderation.manifest_complexity.ManifestComplexityScoreBand.SMALL,
        score_breakdown={
            "structural_units": 1,
            "recipe_units": 0,
            "breadth_units": 0,
            "ambiguity_units": 0,
        },
        affected_arches=[],
        touched_modules=[],
        touched_modules_truncated=False,
        total_touched_module_count=0,
        events=events,
        events_truncated=True,
        total_event_count=26,
    )

    assert data.events_truncated is True


@pytest.mark.parametrize(
    ("pair_factory", "expected_score", "expected_source_status"),
    [
        (lambda: _manifest_pair("x86_64", changed=False), 0, "clean"),
        (_source_manifest_pair, 5, "findings"),
    ],
)
def test_scored_manifest_observations_include_zero_and_below_threshold(
    monkeypatch,
    pair_factory,
    expected_score,
    expected_source_status,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
    )
    pair = pair_factory()
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    result = harness.call()

    observation = harness.observations[(42, "org.example.App")]
    groups = moderation.ostree_manifest.group_identical_manifest_pairs((pair,))
    analysis = moderation.manifest_complexity.analyze_manifest_complexity(groups)
    expected_data = moderation._manifest_complexity_request_data(
        moderation.ReviewRequest(build_id=42, job_id=7),
        "org.example.App",
        analysis,
        14,
        include_calibration_telemetry=True,
    ).model_dump(mode="json", exclude_none=True)
    assert result.requires_review is False
    assert harness.db.session.persisted == []
    assert observation["complexity_status"] == "scored"
    assert observation["complexity_score_units"] == expected_score
    assert observation["complexity_raw_score_units"] == analysis.raw_score_units
    assert observation["complexity_would_gate"] is False
    assert observation["complexity_not_scored_reason"] is None
    assert observation["complexity_data"] == expected_data
    assert observation["source_status"] == expected_source_status


def test_scored_manifest_observation_persists_command_telemetry_without_raw_text(
    monkeypatch,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
    )
    pair = _complexity_pair()
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    harness.call()

    observation = harness.observations[(42, "org.example.App")]
    assert observation["build_command_event_count"] == 1
    assert observation["build_command_distinct_fingerprint_count"] == 1
    assert observation["build_command_fingerprint_group_sizes"] == [1]
    assert observation["complexity_data"]["score_by_kind"] == {
        "build_commands_changed": 4,
        "buildsystem_changed": 6,
    }
    assert observation["complexity_data"]["event_count_by_kind"] == {
        "build_commands_changed": 1,
        "buildsystem_changed": 1,
    }
    serialized = json.dumps(observation, sort_keys=True)
    assert "echo old" not in serialized
    assert "echo new" not in serialized


def test_scored_manifest_observation_persists_complete_event_telemetry_when_details_truncated(
    monkeypatch,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
    )
    pair = _manifest_pair("x86_64", changed=True)
    pair.published_manifest = {
        "modules": [
            {"name": f"module-{index}", "build-commands": [f"echo old {index}"]}
            for index in range(30)
        ]
    }
    pair.candidate_manifest = {
        "modules": [
            {"name": f"module-{index}", "build-commands": [f"echo new {index}"]}
            for index in range(30)
        ]
    }
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    harness.call()

    observation = harness.observations[(42, "org.example.App")]
    complexity_data = observation["complexity_data"]
    assert len(complexity_data["events"]) == 25
    assert complexity_data["events_truncated"] is True
    assert complexity_data["total_event_count"] == 30
    assert complexity_data["event_count_by_kind"] == {
        "build_commands_changed": 30,
    }
    assert complexity_data["score_by_kind"] == {
        "build_commands_changed": 12,
    }
    assert complexity_data["score_breakdown"] == {
        "structural_units": 0,
        "recipe_units": 12,
        "breadth_units": 4,
        "ambiguity_units": 0,
    }
    assert complexity_data["raw_score_units"] == 16
    assert complexity_data["score_units"] == 16


@pytest.mark.parametrize(
    ("published_status", "expected_reason"),
    [
        (
            moderation.ostree_manifest.PublishedManifestStatus.REF_MISSING,
            "published_ref_missing",
        ),
        (
            moderation.ostree_manifest.PublishedManifestStatus.MANIFEST_MISSING,
            "published_manifest_missing",
        ),
        (
            moderation.ostree_manifest.PublishedManifestStatus.MANIFEST_INVALID,
            "published_manifest_invalid",
        ),
    ],
)
def test_published_baseline_failures_persist_not_scored_reason(
    monkeypatch,
    published_status,
    expected_reason,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (
            _manifest_pair(
                "x86_64",
                changed=False,
                status=published_status,
            ),
        ),
    )

    harness.call()

    observation = harness.observations[(42, "org.example.App")]
    assert observation["collection_status"] == "complete"
    assert observation["source_status"] == "unavailable"
    assert observation["complexity_status"] == "not_scored"
    assert observation["complexity_not_scored_reason"] == expected_reason
    assert observation["complexity_score_units"] is None
    assert observation["complexity_raw_score_units"] is None
    assert observation["complexity_score_band"] is None
    assert observation["complexity_analysis_fingerprint"] is None
    assert observation["complexity_data"] is None


def test_initial_vorarbeiter_observation_preserves_policy_context(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        token_name="vorarbeiter",
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

    observation = harness.observations[(42, "org.example.App")]
    assert result.requires_review is False
    assert harness.db.session.persisted == []
    assert observation["policy_context"] == "initial_vorarbeiter"
    assert observation["is_new_submission"] is True
    assert observation["source_status"] == "findings"
    assert observation["source_would_gate"] is False
    assert observation["complexity_not_scored_reason"] == "initial_submission"


def test_analysis_observation_upsert_identity_uses_build_and_app(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_manifest_pair("x86_64", changed=False),),
    )

    harness.call()
    harness.job_id = 8
    harness.call()

    assert len(harness.observations) == 1
    assert harness.observations[(42, "org.example.App")]["job_id"] == 8

    harness.build_id = 43
    harness.call()

    assert set(harness.observations) == {
        (42, "org.example.App"),
        (43, "org.example.App"),
    }
    index = next(
        index
        for index in models.ManifestAnalysisObservation.__table__.indexes
        if index.name == "manifestanalysisobservation_build_app_unique"
    )
    assert index.unique is True
    assert [column.name for column in index.columns] == ["build_id", "app_id"]


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
    assert harness.observations == {}
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
        _complexity_pair(),
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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["collection_status"] == "complete"
    assert observation["source_status"] == "unavailable"
    assert observation["comparable_ref_count"] == 1
    assert observation["complexity_status"] == "scored"
    assert observation["complexity_score_units"] == 12
    assert observation["complexity_not_scored_reason"] is None
    assert observation["complexity_data"]["affected_arches"] == ["x86_64"]
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
    assert harness.observations == {}
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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["policy_context"] == "initial_submission"
    assert observation["complexity_status"] == "not_scored"
    assert observation["complexity_not_scored_reason"] == "initial_submission"
    assert observation["complexity_score_units"] is None


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
    assert harness.db.session.commit_calls == 2
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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["policy_context"] == "normal"
    assert observation["collection_status"] == "partial"
    assert observation["source_status"] == "unavailable"
    assert (
        observation["complexity_not_scored_reason"] == "candidate_manifest_unavailable"
    )
    assert harness.emails == []


def test_runtime_generated_app_allows_missing_candidate_manifest(monkeypatch):
    app_id = "org.freedesktop.Platform.ClInfo"
    assert moderation.is_appid_runtime(app_id)
    assert moderation.should_skip_review(app_id)
    harness = CallbackHarness(
        monkeypatch,
        app_ids=(app_id,),
        skipped=(app_id,),
        enabled=False,
        manifest_enabled=True,
        build_refs=[
            {
                "ref_name": f"app/{app_id}/x86_64/24.08",
                "commit": "a" * 64,
            }
        ],
    )
    captured = {}

    def collect_manifest_pairs(**kwargs):
        captured.update(kwargs)
        return ()

    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        collect_manifest_pairs,
    )

    result = harness.call()

    assert result.requires_review is False
    assert captured["skip_missing_candidate_app_ids"] == {app_id}
    assert harness.db.session.persisted == []
    assert harness.emails == []


@pytest.mark.parametrize(
    "error",
    [
        moderation.ostree_manifest.ManifestTransportError("ostree_io"),
        moderation.ostree_manifest.ManifestTimeoutError("timeout"),
        moderation.ostree_manifest.CandidateRefMissingError(
            "missing_candidate_ref", "app/org.example.App/x86_64/stable"
        ),
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
    assert harness.observations == {}
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
    assert harness.observations == {}
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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["policy_context"] == "initial_submission"
    assert observation["source_would_gate"] is False


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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["policy_context"] == "skip_list"
    assert observation["source_status"] == "findings"
    assert observation["source_would_gate"] is False


@pytest.mark.parametrize(
    ("published_urls", "candidate_urls", "expected_gate"),
    [
        ((), (), False),
        (
            ("https://example.com/old.tar",),
            ("https://example.com/new.tar",),
            False,
        ),
        ((), ("https://new.example/source",), True),
        (
            (),
            ("https://one.example/source", "https://two.example/source"),
            True,
        ),
        (("https://old.example/source",), (), False),
        (
            ("https://one.example/source", "https://two.example/source"),
            (),
            False,
        ),
        (
            ("https://old.example/source",),
            ("https://new.example/source",),
            True,
        ),
        (
            ("https://one.example/source", "https://two.example/source"),
            ("https://new.example/source",),
            True,
        ),
    ],
)
def test_manifest_source_gate_requires_added_origin(
    monkeypatch, published_urls, candidate_urls, expected_gate
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    pair = _source_transition_manifest_pair(published_urls, candidate_urls)
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    result = harness.call()

    manifest_requests = [
        request
        for request in harness.db.session.persisted
        if request.request_type == ModerationRequestType.MANIFEST
    ]
    observation = harness.observations[(42, "org.example.App")]
    assert result.requires_review is expected_gate
    assert bool(manifest_requests) is expected_gate
    assert observation["source_would_gate"] is expected_gate
    if not candidate_urls and published_urls:
        assert observation["source_findings"][0]["origins_added"] == []
        assert observation["source_findings"][0]["origins_removed"] == sorted(
            {url.removesuffix("/source") for url in published_urls}
        )
    if expected_gate:
        request_body = json.loads(manifest_requests[0].request_data)
        assert request_body["findings"][0]["origins_added"] == sorted(
            {url.removesuffix("/source") for url in candidate_urls}
        )
        assert request_body["findings"][0]["origins_removed"] == sorted(
            {url.removesuffix("/source") for url in published_urls}
        )


def test_removal_only_source_observe_only_does_not_create_hypothetical_gate(
    monkeypatch,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    pair = _source_transition_manifest_pair(
        ("https://old.example/source",),
        (),
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    result = harness.call()

    assert result.requires_review is False
    assert harness.db.session.persisted == []
    observation = harness.observations[(42, "org.example.App")]
    assert observation["source_status"] == "findings"
    assert observation["source_would_gate"] is False
    assert observation["source_findings"][0]["origins_added"] == []
    assert observation["source_findings"][0]["origins_removed"] == [
        "https://old.example"
    ]


def test_disabled_manifest_gate_logs_only_added_origins_as_actionable(
    monkeypatch, caplog
):
    caplog.set_level(logging.INFO, logger=moderation.__name__)
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=False,
    )
    pair = _source_transition_manifest_pair(
        ("https://old.example/source",),
        (),
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    harness.call()

    record = next(
        record
        for record in caplog.records
        if record.getMessage() == "Evaluated manifest source gate for app"
    )
    assert record.would_require_review is False
    assert record.introduced_sources == []
    assert record.removed_sources == ["https://old.example"]


def test_manifest_gate_request_retains_removed_origin_context(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    pair = _source_transition_manifest_pair(
        ("https://old.example/source",),
        ("https://new.example/source",),
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    result = harness.call()

    assert result.requires_review is True
    request = next(
        request
        for request in harness.db.session.persisted
        if request.request_type == ModerationRequestType.MANIFEST
    )
    finding = json.loads(request.request_data)["findings"][0]
    assert finding["origins_added"] == ["https://new.example"]
    assert finding["origins_removed"] == ["https://old.example"]


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
    assert request_body["complexity"]["algorithm_version"] == 4
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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["source_findings"] == request_body["findings"]
    assert observation["source_status"] == "findings"
    assert observation["source_would_gate"] is True


@pytest.mark.parametrize(
    ("published_url", "candidate_url", "published_origin", "candidate_origin"),
    [
        (
            "https://raw.githubusercontent.com/foo/bar/v1/archive.tar",
            "https://raw.githubusercontent.com/fork/bar/v2/archive.tar",
            "https://raw.githubusercontent.com/foo/bar",
            "https://raw.githubusercontent.com/fork/bar",
        ),
        (
            "https://git.sr.ht/~foo/bar/blob/v1/archive.tar",
            "https://git.sr.ht/~fork/bar/blob/v2/archive.tar",
            "https://git.sr.ht/~foo/bar",
            "https://git.sr.ht/~fork/bar",
        ),
        (
            "https://hg.sr.ht/~foo/bar/blob/v1/archive.tar",
            "https://hg.sr.ht/~fork/bar/blob/v2/archive.tar",
            "https://hg.sr.ht/~foo/bar",
            "https://hg.sr.ht/~fork/bar",
        ),
        (
            "https://sr.ht/~foo/bar",
            "https://sr.ht/~fork/bar",
            "https://sr.ht/~foo/bar",
            "https://sr.ht/~fork/bar",
        ),
        (
            "https://codeberg.org/foo/bar/raw/branch/v1/archive.tar",
            "https://codeberg.org/fork/bar/raw/branch/v2/archive.tar",
            "https://codeberg.org/foo/bar",
            "https://codeberg.org/fork/bar",
        ),
    ],
)
def test_manifest_gate_records_repository_origin(
    monkeypatch, published_url, candidate_url, published_origin, candidate_origin
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
    )
    pair = _source_transition_manifest_pair(
        (published_url,),
        (candidate_url,),
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
    )

    result = harness.call()

    assert result.requires_review is True
    request = next(
        request
        for request in harness.db.session.persisted
        if request.request_type == ModerationRequestType.MANIFEST
    )
    assert json.loads(request.request_data)["findings"][0] == {
        "arches": ["x86_64"],
        "locations_by_origin": {
            candidate_origin: ['modules["app"].sources[0].url'],
            published_origin: ['modules["app"].sources[0].url'],
        },
        "origins_added": [candidate_origin],
        "origins_removed": [published_origin],
    }


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


@pytest.mark.parametrize("complexity_threshold_units", [11, 12])
def test_complexity_at_or_above_threshold_creates_one_manifest_request(
    monkeypatch,
    complexity_threshold_units,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=True,
        rate=1,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        complexity_gating_enabled=True,
        complexity_threshold_units=complexity_threshold_units,
    )
    pair = _complexity_pair()
    pair.candidate_commit = "d" * 64
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (pair,),
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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["complexity_status"] == "scored"
    assert observation["complexity_score_units"] == 12
    assert observation["complexity_would_gate"] is True
    assert body["complexity"]["raw_score_units"] == 12
    assert body["complexity"]["score_breakdown"] == {
        "ambiguity_units": 0,
        "breadth_units": 2,
        "recipe_units": 10,
        "structural_units": 0,
    }
    assert "score_by_kind" not in body["complexity"]
    assert "event_count_by_kind" not in body["complexity"]


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


def test_complexity_only_is_suppressed_by_summary_request(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        current_summaries={
            "org.example.App": {
                "metadata": {
                    "permissions": {
                        "shared": ["network"],
                    }
                }
            }
        },
        build_summary={
            "org.example.App": {
                "metadata": {
                    "permissions": {
                        "shared": ["network", "ipc"],
                    }
                }
            }
        },
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
    assert harness.db.session.persisted[0].request_type == ModerationRequestType.SUMMARY


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
    assert harness.db.session.commit_calls == 2
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
    observation = harness.observations[(42, "org.example.App")]
    assert observation["appstream_present"] is False
    assert observation["policy_context"] == "missing_appstream"
    assert observation["source_status"] == "findings"
    assert observation["source_would_gate"] is False
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


def test_source_origin_observe_only_persists_non_actionable_manifest(
    monkeypatch,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is False
    assert len(harness.db.session.persisted) == 1
    request = harness.db.session.persisted[0]
    assert request.request_type == ModerationRequestType.MANIFEST
    assert request.is_observation is True
    assert harness.emails == []


def test_observation_retry_keeps_reused_request_data_loaded(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )
    harness.call()
    harness.db.session.expire_loaded_on_context_exit = True

    result = harness.call()

    assert result.requires_review is False
    assert len(harness.db.session.persisted) == 1
    assert harness.emails == []


def test_complexity_observe_only_persists_non_actionable_manifest(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        complexity_gating_observe_only=True,
        complexity_threshold_units=12,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_complexity_pair(),),
    )

    result = harness.call()

    assert result.requires_review is False
    assert len(harness.db.session.persisted) == 1
    request = harness.db.session.persisted[0]
    assert request.request_type == ModerationRequestType.MANIFEST
    assert request.is_observation is True
    assert json.loads(request.request_data)["findings"] == []
    assert harness.emails == []


def test_manifest_observe_only_takes_precedence_over_matching_gate(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_gating_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is False
    assert len(harness.db.session.persisted) == 1
    assert harness.db.session.persisted[0].is_observation is True
    assert harness.emails == []


def test_observed_source_origin_and_enforced_complexity_share_actionable_row(
    monkeypatch,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
        complexity_gating_enabled=True,
        complexity_threshold_units=5,
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
    assert request.is_observation is False
    body = json.loads(request.request_data)
    assert body["findings"]
    assert body["complexity"]["score_units"] == 5
    assert len(harness.emails) == 1


def test_complexity_observation_is_stored_with_appdata_hold(monkeypatch):
    current_values = _unchanged_values()
    current_values["org.example.App"]["name"] = "Old name"
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=current_values,
        manifest_enabled=True,
        complexity_gating_observe_only=True,
        complexity_threshold_units=12,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_complexity_pair(),),
    )

    result = harness.call()

    assert result.requires_review is True
    assert {request.request_type for request in harness.db.session.persisted} == {
        ModerationRequestType.APPDATA,
        ModerationRequestType.MANIFEST,
    }
    manifest_request = next(
        request
        for request in harness.db.session.persisted
        if request.request_type == ModerationRequestType.MANIFEST
    )
    appdata_request = next(
        request
        for request in harness.db.session.persisted
        if request.request_type == ModerationRequestType.APPDATA
    )
    assert manifest_request.is_observation is True
    assert appdata_request.is_observation is None
    email_requests = harness.emails[0]["messageInfo"]["requests"]
    assert [item["requestType"] for item in email_requests] == [
        ModerationRequestType.APPDATA
    ]


def test_observation_does_not_suppress_random_review(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=True,
        rate=1,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    result = harness.call()

    assert result.requires_review is True
    assert {request.request_type for request in harness.db.session.persisted} == {
        ModerationRequestType.APPDATA,
        ModerationRequestType.MANIFEST,
    }
    assert any(
        request.request_type == ModerationRequestType.MANIFEST
        and request.is_observation is True
        for request in harness.db.session.persisted
    )


def test_observation_invalidation_is_scoped_away_from_appdata(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    appdata_request = models.ModerationRequest(
        appid="org.example.App",
        request_type=ModerationRequestType.APPDATA,
        request_data="{}",
        is_new_submission=False,
        is_observation=False,
        is_outdated=False,
        build_id=41,
        job_id=6,
    )
    harness.db.session.persisted.append(appdata_request)
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    harness.call()

    assert appdata_request.is_outdated is False
    assert harness.db.session.update_calls
    assert any(
        getattr(getattr(criterion, "left", None), "key", None) == "is_observation"
        for criterion in harness.db.session.update_calls[0]["criteria"]
    )


def test_identical_observation_callback_reuses_one_row(monkeypatch):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    harness.call()
    second = harness.call()

    assert second.requires_review is False
    assert len(harness.db.session.persisted) == 1
    assert harness.db.session.add_calls == 1
    assert harness.db.session.commit_calls == 2
    assert harness.emails == []


def test_observation_row_promotes_and_demotes_with_effective_configuration(
    monkeypatch,
):
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=_unchanged_values(),
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_source_manifest_pair(),),
    )

    harness.call()
    monkeypatch.setattr(
        config.settings, "ostree_manifest_source_origin_observe_only", False
    )
    monkeypatch.setattr(
        config.settings, "ostree_manifest_source_origin_gating_enabled", True
    )
    promoted = harness.call()

    assert promoted.requires_review is True
    assert harness.db.session.persisted[0].is_observation is False
    assert harness.db.session.persisted[0].is_outdated is False
    assert len(harness.emails) == 1

    monkeypatch.setattr(
        config.settings, "ostree_manifest_source_origin_observe_only", True
    )
    demoted = harness.call()

    assert demoted.requires_review is False
    assert harness.db.session.persisted[0].is_observation is True
    assert len(harness.emails) == 1


@pytest.mark.parametrize(
    "error",
    [
        moderation.ostree_manifest.ManifestTransportError("ostree_io"),
        moderation.ostree_manifest.ManifestTimeoutError("timeout"),
        moderation.ostree_manifest.CandidateRefMissingError(
            "missing_candidate_ref", "app/org.example.App/x86_64/stable"
        ),
    ],
)
def test_manifest_observe_only_failure_continues_appdata_moderation(monkeypatch, error):
    current_values = _unchanged_values()
    current_values["org.example.App"]["name"] = "Old name"
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=current_values,
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
    )
    monkeypatch.setattr(
        moderation.ostree_manifest,
        "collect_manifest_pairs",
        lambda **kwargs: (_ for _ in ()).throw(error),
    )

    result = harness.call()

    assert result.requires_review is True
    assert [request.request_type for request in harness.db.session.persisted] == [
        ModerationRequestType.APPDATA
    ]
    observation = harness.observations[(42, "org.example.App")]
    assert observation["collection_status"] == "failed"
    assert observation["collection_error_category"] == error.category
    assert observation["source_status"] == "unavailable"
    assert observation["complexity_status"] == "not_scored"
    assert (
        observation["complexity_not_scored_reason"] == "candidate_manifest_unavailable"
    )
    assert harness.emails


def test_manifest_observe_only_invalid_refs_continue_appdata_moderation(
    monkeypatch,
):
    current_values = _unchanged_values()
    current_values["org.example.App"]["name"] = "Old name"
    harness = CallbackHarness(
        monkeypatch,
        enabled=False,
        current_values=current_values,
        manifest_enabled=True,
        manifest_source_origin_observe_only=True,
        build_refs=[
            {
                "ref_name": "app/org.example.App/x86_64/stable",
                "commit": "invalid",
            }
        ],
    )

    result = harness.call()

    assert result.requires_review is True
    assert [request.request_type for request in harness.db.session.persisted] == [
        ModerationRequestType.APPDATA
    ]
    observation = harness.observations[(42, "org.example.App")]
    assert observation["collection_status"] == "failed"
    assert observation["collection_error_category"] == "InvalidBuildRefError"
    assert observation["source_status"] == "unavailable"


class AggregateRow:
    def __init__(self, appid, is_new_submission, updated_at, request_types):
        self.appid = appid
        self.is_new_submission = is_new_submission
        self.updated_at = updated_at
        self.request_types = request_types

    def _asdict(self):
        return {
            "appid": self.appid,
            "is_new_submission": self.is_new_submission,
            "updated_at": self.updated_at,
            "request_types": self.request_types,
        }


class EndpointQuery:
    def __init__(self, session, entities):
        self.session = session
        self.entities = entities
        self.criteria = []
        self.filter_by_criteria = {}

    def filter(self, *criteria):
        self.criteria.extend(criteria)
        return self

    def filter_by(self, **criteria):
        self.filter_by_criteria.update(criteria)
        return self

    def join(self, *args, **kwargs):
        return self

    def group_by(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def having(self, *args, **kwargs):
        return self

    def offset(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def with_for_update(self):
        return self

    def _matches(self, request):
        for key, value in self.filter_by_criteria.items():
            if getattr(request, key, None) != value:
                return False
        for criterion in self.criteria:
            left = getattr(criterion, "left", None)
            key = getattr(left, "key", None)
            if key is None:
                continue
            value = getattr(getattr(criterion, "right", None), "value", None)
            right_name = type(getattr(criterion, "right", None)).__name__
            if right_name == "False_":
                value = False
            elif right_name == "True_":
                value = True
            operator_name = getattr(
                getattr(criterion, "operator", None), "__name__", ""
            )
            current = (
                getattr(request, key, None)
                if self.session.flushed or key != "is_approved"
                else self.session.persisted_approvals.get(request.id)
            )
            if operator_name in {"eq", "is_"} and current != value:
                return False
            if operator_name in {"ne", "is_not"} and current == value:
                return False
        return True

    def all(self):
        requests = [
            request for request in self.session.requests if self._matches(request)
        ]
        if self.entities and self.entities[0] is models.ModerationRequest:
            if len(self.entities) == 1:
                return requests
            return [(request, "Moderator") for request in requests]
        has_actionable_filter = any(
            getattr(getattr(criterion, "left", None), "key", None) == "is_observation"
            and (
                getattr(getattr(criterion, "right", None), "value", None) is False
                or type(getattr(criterion, "right", None)).__name__ == "False_"
            )
            for criterion in self.criteria
        )
        if has_actionable_filter:
            return [
                AggregateRow(
                    appid="org.example.App",
                    is_new_submission=False,
                    updated_at=None,
                    request_types=[ModerationRequestType.MANIFEST],
                )
            ]
        return [
            AggregateRow(
                appid="org.example.App",
                is_new_submission=False,
                updated_at=None,
                request_types=[
                    ModerationRequestType.MANIFEST,
                    ModerationRequestType.APPDATA,
                ],
            ),
            AggregateRow(
                appid="org.observed.App",
                is_new_submission=False,
                updated_at=None,
                request_types=[ModerationRequestType.MANIFEST],
            ),
        ]

    def first(self):
        results = self.all()
        return results[0] if results else None

    def count(self):
        return len(self.all())

    def __iter__(self):
        return iter(self.all())


class EndpointSession:
    def __init__(self):
        self.requests = [
            models.ModerationRequest(
                id=1,
                created_at=datetime.now(UTC),
                appid="org.example.App",
                request_type=ModerationRequestType.APPDATA,
                request_data=json.dumps({"keys": {}, "current_values": {}}),
                is_new_submission=False,
                is_observation=False,
                is_outdated=False,
                build_id=42,
                job_id=7,
            ),
            models.ModerationRequest(
                id=2,
                created_at=datetime.now(UTC),
                appid="org.observed.App",
                request_type=ModerationRequestType.MANIFEST,
                request_data=json.dumps({"findings": [], "complexity": None}),
                is_new_submission=False,
                is_observation=True,
                is_outdated=False,
                build_id=42,
                job_id=7,
            ),
        ]
        self.persisted_approvals = {
            request.id: request.is_approved for request in self.requests
        }
        self.flushed = False

    def query(self, *entities):
        return EndpointQuery(self, entities)

    def merge(self, value):
        return value

    def flush(self):
        self.flushed = True

    def commit(self):
        pass


class EndpointDb:
    def __init__(self):
        self.session = EndpointSession()


def test_observations_are_hidden_from_moderation_endpoints_and_actions(
    monkeypatch,
):
    db = EndpointDb()

    @contextmanager
    def get_db(db_type="replica"):
        yield db

    monkeypatch.setattr(moderation, "get_db", get_db)
    apps = moderation.get_moderation_apps(_moderator=object())
    login = SimpleNamespace(
        user=SimpleNamespace(
            id=9,
            permissions=lambda: {"moderation"},
            dev_flatpaks=lambda session: set(),
        )
    )
    app = moderation.get_moderation_app(login, app_id="org.example.App")

    assert [item.appid for item in apps.apps] == ["org.example.App"]
    assert [request.id for request in app.requests] == [1]
    assert not hasattr(app.requests[0], "is_observation")

    with pytest.raises(HTTPException) as raised:
        moderation.submit_review(
            2,
            moderation.Review(approve=True),
            login,
            SimpleNamespace(),
            object(),
        )

    assert raised.value.status_code == 404
    assert raised.value.detail == "not_found"


def test_observations_do_not_block_remaining_approval_count(monkeypatch):
    db = EndpointDb()
    review_dispatches = []
    emails = []

    @contextmanager
    def get_db(db_type="replica"):
        yield db

    monkeypatch.setattr(moderation, "get_db", get_db)
    monkeypatch.setattr(
        moderation.worker.review_check,
        "send",
        lambda *args: review_dispatches.append(args),
    )
    monkeypatch.setattr(moderation.worker.send_email_new, "send", emails.append)
    monkeypatch.setattr(
        moderation.audit_log, "enqueue_audit_log", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(moderation, "get_json_key", lambda key: None)
    login = SimpleNamespace(
        user=SimpleNamespace(id=9),
    )

    moderation.submit_review(
        1,
        moderation.Review(approve=True),
        login,
        SimpleNamespace(),
        object(),
    )

    assert review_dispatches == [(7, "Passed", None, 42)]


def test_review_handles_all_requests_from_the_build(monkeypatch):
    db = EndpointDb()
    db.session.requests.append(
        models.ModerationRequest(
            id=3,
            created_at=datetime.now(UTC),
            appid="org.example.App",
            request_type=ModerationRequestType.SUMMARY,
            request_data=json.dumps({"keys": {}, "current_values": {}}),
            is_new_submission=False,
            is_observation=False,
            is_outdated=False,
            build_id=42,
            job_id=7,
        )
    )
    review_dispatches = []
    emails = []

    @contextmanager
    def get_db(db_type="replica"):
        yield db

    monkeypatch.setattr(moderation, "get_db", get_db)
    monkeypatch.setattr(
        moderation.worker.review_check,
        "send",
        lambda *args: review_dispatches.append(args),
    )
    monkeypatch.setattr(moderation.worker.send_email_new, "send", emails.append)
    monkeypatch.setattr(
        moderation.audit_log, "enqueue_audit_log", lambda *args, **kwargs: None
    )
    monkeypatch.setattr(moderation, "get_json_key", lambda key: None)

    moderation.submit_review(
        1,
        moderation.Review(approve=True, comment="Reviewed together"),
        SimpleNamespace(user=SimpleNamespace(id=9)),
        SimpleNamespace(),
        object(),
    )

    reviewed = [
        request for request in db.session.requests if not request.is_observation
    ]
    assert [request.is_approved for request in reviewed] == [True, True]
    assert [request.comment for request in reviewed] == [
        "Reviewed together",
        "Reviewed together",
    ]
    assert review_dispatches == [(7, "Passed", None, 42)]
    assert len(emails) == 1
