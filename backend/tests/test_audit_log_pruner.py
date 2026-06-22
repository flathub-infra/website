import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

import sys  # noqa: E402

from app.worker import prune_audit_logs  # noqa: E402

_prune_module = sys.modules[prune_audit_logs.fn.__module__]


class FakeFilterChain:
    """Stand-in for query().filter(...).delete(...)."""

    def __init__(self, deleted_result=0):
        self.deleted_result = deleted_result
        self.filter_applied = False

    def filter(self, condition):
        self.filter_applied = True
        self.condition = condition
        return self

    def delete(self, synchronize_session=False):
        return self.deleted_result


class FakeDb:
    def __init__(self, deleted_result=0):
        self._chain = FakeFilterChain(deleted_result)

    def query(self, *args, **kwargs):
        return self._chain

    def commit(self):
        pass


def _make_get_db(deleted_result=0):
    captured = {}

    @contextmanager
    def fake_get_db(db_type="replica"):
        db = FakeDb(deleted_result)
        captured["db"] = db
        yield db

    return fake_get_db, captured


def test_prune_audit_logs_deletes_old_entries(monkeypatch):
    fake_get_db, captured = _make_get_db(deleted_result=42)
    monkeypatch.setattr(_prune_module, "get_db", fake_get_db)
    monkeypatch.setattr(_prune_module.config.settings, "audit_log_retention_days", 90)

    prune_audit_logs()

    db = captured["db"]
    assert db._chain.filter_applied is True
    assert "created_at" in str(db._chain.condition)


def test_prune_audit_logs_no_op_when_nothing_to_delete(monkeypatch):
    fake_get_db, _ = _make_get_db(deleted_result=0)
    monkeypatch.setattr(_prune_module, "get_db", fake_get_db)
    monkeypatch.setattr(_prune_module.config.settings, "audit_log_retention_days", 90)

    # Must not raise even when nothing is deleted.
    prune_audit_logs()


def test_prune_audit_logs_actor_is_registered():
    """The pruner must be a dramatiq actor so the worker discovers it."""
    assert hasattr(prune_audit_logs, "actor_name")
    assert prune_audit_logs.actor_name == "prune_audit_logs"
