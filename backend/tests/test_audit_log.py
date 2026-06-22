import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

# app.search connects to Meilisearch at import time; stub it out for unit tests.
sys.modules["app.search"] = SimpleNamespace()

from app import audit_log, models  # noqa: E402


class FakeSession:
    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        pass

    def commit(self):
        self.committed = True


class FakeDb:
    def __init__(self):
        self.session = FakeSession()

    def add(self, obj):
        self.session.add(obj)

    def flush(self):
        pass


class FakeRequest:
    class _Client:
        host = "198.51.100.7"

    client = _Client()

    def __init__(self, user_agent="Mozilla/5.0 audit-test"):
        self.headers = {"user-agent": user_agent}


def test_audit_log_create_flushes_all_fields():
    db = FakeDb()
    entry = models.AuditLog.create(
        db,
        user_id=42,
        event_type=models.AuditEventType.LOGIN_SUCCESS,
        target_user_id=None,
        provider="github",
        ip_address="10.0.0.1",
        user_agent="ua",
        details={"k": "v"},
    )
    assert entry in db.session.added
    assert entry.user_id == 42
    assert entry.event_type == models.AuditEventType.LOGIN_SUCCESS
    assert entry.provider == "github"
    assert entry.details == {"k": "v"}


def test_audit_event_type_values_are_distinct_strings():
    values = [e.value for e in models.AuditEventType]
    assert len(values) == len(set(values)), (
        "duplicate event_type values would corrupt filters"
    )


def test_log_audit_event_actor_forwards_to_create(monkeypatch):
    captured = {}

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield FakeDb()

    def fake_create(db, **kwargs):
        captured["kwargs"] = kwargs
        return SimpleNamespace(**kwargs)

    monkeypatch.setattr(audit_log, "get_db", fake_get_db)
    monkeypatch.setattr(models.AuditLog, "create", staticmethod(fake_create))

    audit_log.log_audit_event(
        user_id=7,
        event_type="login-success",
        provider="github",
        target_user_id=None,
        ip_address="1.2.3.4",
        user_agent="ua",
        details={"a": 1},
    )

    assert captured["kwargs"]["user_id"] == 7
    assert captured["kwargs"]["event_type"] == models.AuditEventType.LOGIN_SUCCESS
    assert captured["kwargs"]["details"] == {"a": 1}


def test_log_audit_event_actor_swallows_errors(monkeypatch):
    @contextmanager
    def raising_get_db(db_type="replica"):
        raise RuntimeError("db down")
        yield  # pragma: no cover

    monkeypatch.setattr(audit_log, "get_db", raising_get_db)
    # Must not raise.
    audit_log.log_audit_event(user_id=1, event_type="logout")


def test_enqueue_audit_log_extracts_ip_and_user_agent(monkeypatch):
    sent = {}
    monkeypatch.setattr(audit_log.log_audit_event, "send", lambda **kw: sent.update(kw))

    request = FakeRequest(user_agent="test-ua")
    audit_log.enqueue_audit_log(
        request,
        user_id=9,
        event_type=models.AuditEventType.ROLE_GRANTED,
        target_user_id=3,
        details={"role": "moderator"},
    )

    assert sent["user_id"] == 9
    assert sent["event_type"] == "role-granted"
    assert sent["ip_address"] == "198.51.100.7"
    assert sent["user_agent"] == "test-ua"
    assert sent["target_user_id"] == 3
    assert sent["details"] == {"role": "moderator"}


def test_enqueue_audit_log_without_request_records_nulls(monkeypatch):
    sent = {}
    monkeypatch.setattr(audit_log.log_audit_event, "send", lambda **kw: sent.update(kw))

    audit_log.enqueue_audit_log(
        None,
        user_id=9,
        event_type=models.AuditEventType.LOGOUT,
    )

    assert sent["ip_address"] is None
    assert sent["user_agent"] is None
    assert sent["event_type"] == "logout"


def test_log_audit_event_sync_writes_synchronously(monkeypatch):
    captured = {}

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield FakeDb()

    def fake_create(db, **kwargs):
        captured["kwargs"] = kwargs
        return SimpleNamespace(**kwargs)

    monkeypatch.setattr(audit_log, "get_db", fake_get_db)
    monkeypatch.setattr(models.AuditLog, "create", staticmethod(fake_create))

    audit_log.log_audit_event_sync(
        user_id=5,
        event_type=models.AuditEventType.APP_ARCHIVED,
        details={"app_id": "org.test.App"},
    )

    assert captured["kwargs"]["user_id"] == 5
    assert captured["kwargs"]["event_type"] == models.AuditEventType.APP_ARCHIVED


def test_log_audit_event_sync_swallows_errors(monkeypatch):
    @contextmanager
    def raising_get_db(db_type="replica"):
        raise RuntimeError("db down")
        yield  # pragma: no cover

    monkeypatch.setattr(audit_log, "get_db", raising_get_db)
    # Must not raise.
    audit_log.log_audit_event_sync(user_id=1, event_type=models.AuditEventType.LOGOUT)


def test_log_audit_event_registered_on_worker():
    """The actor must be importable from app.worker so the dramatiq worker
    discovers it (regression guard for G1)."""
    saved_worker = sys.modules.pop("app.worker", None)
    try:
        import app.worker
    finally:
        if saved_worker is not None:
            sys.modules["app.worker"] = saved_worker

    assert hasattr(app.worker, "log_audit_event"), (
        "log_audit_event is not re-exported from app.worker; the worker will not "
        "consume audit events."
    )
    assert "log_audit_event" in app.worker.__all__
    assert app.worker.log_audit_event.actor_name == "log_audit_event"
    assert app.worker.log_audit_event.broker is app.worker.broker
