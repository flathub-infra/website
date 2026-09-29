import json
import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy.dialects import postgresql

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

from app import config
from app.moderation import jev_observation

API_KEY = "test-typesafe-secret-key"
STATE = {"old": {}, "new": {}}
PROBABILITIES = {
    "custom_build_logic": 0.94,
    "mechanical_refresh": 0.16,
    "dependency_supply": 0.88,
    "runtime_integration": 0.8,
    "architecture_behavior": 0.58,
    "packaging_procedure": 0.9,
}
PENDING = {
    "status": "pending",
    "provider": "typesafe",
    "model": "jev-1.13.0",
    "state_schema_version": 2,
    "question_schema_version": 1,
    "state_hash": "sha256:" + "0" * 64,
    "probabilities": None,
    "truncation": {"source_details": False, "content": False},
}


def success_body():
    return {
        "model": "jev-1.13.0",
        "answers": {
            key: {"type": "noul", "noul": value} for key, value in PROBABILITIES.items()
        },
    }


def fake_response(status_code, body=None, text=None):
    return httpx.Response(
        status_code,
        json=body,
        text=text,
        request=httpx.Request("POST", jev_observation.JEV_API_URL),
    )


@pytest.fixture
def settings(monkeypatch):
    monkeypatch.setattr(config.settings, "typesafe_api_key", API_KEY)
    monkeypatch.setattr(config.settings, "typesafe_jev_model", "jev-1.13.0")
    monkeypatch.setattr(config.settings, "ostree_manifest_jev_timeout_seconds", 3.0)


def respond(monkeypatch, response=None, exception=None):
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        if exception is not None:
            raise exception
        return response

    monkeypatch.setattr(jev_observation.http_client, "post", post)
    return calls


def test_valid_response_extracts_six_probabilities(monkeypatch, settings):
    calls = respond(monkeypatch, fake_response(200, success_body()))

    result = jev_observation.call_jev(STATE)

    assert result["status"] == "success"
    assert result["probabilities"] == PROBABILITIES
    assert isinstance(result["latency_ms"], int)
    url, kwargs = calls[0]
    assert url == "https://api.typesafe.ai/v1/systemone"
    assert kwargs["headers"] == {"Authorization": f"Bearer {API_KEY}"}
    assert kwargs["timeout"] == 3.0
    assert kwargs["json"]["model"] == "jev-1.13.0"
    assert kwargs["json"]["state"] == STATE
    assert set(kwargs["json"]["questions"]) == set(PROBABILITIES)


@pytest.mark.parametrize(
    "answer",
    [
        None,
        {"type": "noul", "noul": "0.9"},
        {"type": "noul", "noul": True},
        {"type": "noul", "noul": 1.2},
        {"type": "choice", "noul": 0.5},
    ],
    ids=["missing", "string", "bool", "out-of-range", "wrong-type"],
)
def test_invalid_answers_are_rejected(monkeypatch, settings, answer):
    body = success_body()
    if answer is None:
        del body["answers"]["custom_build_logic"]
    else:
        body["answers"]["custom_build_logic"] = answer
    respond(monkeypatch, fake_response(200, body))

    result = jev_observation.call_jev(STATE)

    assert result["status"] == "error"
    assert result["probabilities"] is None


@pytest.mark.parametrize(
    ("response", "exception", "status"),
    [
        (None, httpx.ReadTimeout("slow"), "timeout"),
        (None, httpx.ConnectError("down"), "error"),
        (fake_response(429, {}), None, "http_error"),
        (fake_response(200, text="not json"), None, "error"),
        (fake_response(200, ["answers"]), None, "error"),
    ],
)
def test_failures_are_categorized(monkeypatch, settings, response, exception, status):
    respond(monkeypatch, response, exception)

    result = jev_observation.call_jev(STATE)

    assert result["status"] == status
    assert result["probabilities"] is None
    assert isinstance(result["latency_ms"], int)


class FakeSession:
    def __init__(self, fail=False):
        self.statements = []
        self.fail = fail

    def execute(self, statement):
        if self.fail:
            raise RuntimeError("database unavailable")
        self.statements.append(statement)


def run_actor(monkeypatch, session):
    @contextmanager
    def get_db(db_type="replica"):
        assert db_type == "writer"
        yield SimpleNamespace(session=session)

    monkeypatch.setattr(jev_observation, "get_db", get_db)
    jev_observation.observe_manifest_semantics.fn(42, "org.example.App", STATE, PENDING)


def compiled_params(statement):
    return statement.compile(dialect=postgresql.dialect()).params


@pytest.mark.parametrize(
    ("response", "exception", "status"),
    [
        (fake_response(200, success_body()), None, "success"),
        (None, httpx.ReadTimeout("slow"), "timeout"),
        (fake_response(429, {}), None, "http_error"),
    ],
)
def test_actor_updates_matching_observation(
    monkeypatch, settings, response, exception, status
):
    respond(monkeypatch, response, exception)
    session = FakeSession()

    run_actor(monkeypatch, session)

    [statement] = session.statements
    params = compiled_params(statement)
    payload = params["jev_semantic_analysis"]
    assert payload["status"] == status
    for key in (
        "provider",
        "model",
        "state_schema_version",
        "question_schema_version",
        "state_hash",
        "truncation",
    ):
        assert payload[key] == PENDING[key]
    if status == "success":
        assert payload["probabilities"] == PROBABILITIES
        assert all(
            isinstance(value, float) for value in payload["probabilities"].values()
        )
    else:
        assert payload["probabilities"] is None
    assert PENDING["state_hash"] in params.values()
    assert 42 in params.values()
    assert "org.example.App" in params.values()
    assert API_KEY not in json.dumps(payload)
    rendered = str(statement.compile(dialect=postgresql.dialect()))
    assert "jev_semantic_analysis ->> " in rendered


def test_actor_logs_database_errors(monkeypatch, settings, caplog):
    respond(monkeypatch, fake_response(200, success_body()))

    run_actor(monkeypatch, FakeSession(fail=True))

    [record] = caplog.records
    assert record.levelname == "ERROR"
    assert isinstance(record.exc_info[1], RuntimeError)
