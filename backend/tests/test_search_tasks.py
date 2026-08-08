import os
import sys
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

import pytest

import app
from app import search_tasks


class FakeIndex:
    def __init__(self):
        self.update_calls = []
        self.delete_calls = []

    def update_documents(self, documents):
        self.update_calls.append(documents)
        return SimpleNamespace(task_uid=11)

    def delete_documents(self, ids):
        self.delete_calls.append(ids)
        return SimpleNamespace(task_uid=11)


class FakeClient:
    def __init__(self, status):
        self.status = status
        self.index_value = FakeIndex()
        self.wait_calls = []

    def index(self, uid):
        assert uid == "apps-hybrid"
        return self.index_value

    def wait_for_task(self, uid, timeout_in_ms, interval_in_ms):
        self.wait_calls.append((uid, timeout_in_ms, interval_in_ms))
        return SimpleNamespace(status=self.status)


class FakeLock:
    def __init__(self, acquired=True):
        self.acquired = acquired
        self.released = False

    def acquire(self, blocking):
        assert blocking is False
        return self.acquired

    def release(self):
        self.released = True


@pytest.fixture(autouse=True)
def reconciliation_state(monkeypatch):
    monkeypatch.setattr(
        search_tasks.search_health,
        "mark_reconciliation_scheduled",
        lambda: True,
    )
    monkeypatch.setattr(
        search_tasks.search_health,
        "clear_reconciliation_scheduled",
        lambda: None,
    )
    monkeypatch.setattr(
        search_tasks.search_health,
        "hybrid_reconciliation_lock",
        FakeLock,
    )
    monkeypatch.setattr(
        search_tasks.search_health,
        "has_hybrid_task_failures",
        lambda: True,
    )


@pytest.mark.parametrize(
    ("operation", "payload"),
    [
        ("update", [{"id": "org.example.App", "version": 1}]),
        ("delete", ["org.example.App"]),
    ],
)
def test_failed_task_never_replays_historical_payload(monkeypatch, operation, payload):
    client = FakeClient("failed")
    monkeypatch.setattr(app, "search", SimpleNamespace(client=client), raising=False)
    failed = []
    scheduled = []
    monkeypatch.setattr(
        search_tasks.search_health,
        "mark_hybrid_task_failed",
        lambda task_uid: failed.append(task_uid),
    )
    monkeypatch.setattr(
        search_tasks.reconcile_hybrid_index,
        "send_with_options",
        lambda **kwargs: scheduled.append(kwargs),
    )

    search_tasks.monitor_hybrid_index_task.fn(operation, 10, payload)

    assert failed == [10]
    assert client.index_value.update_calls == []
    assert client.index_value.delete_calls == []
    assert scheduled == [
        {
            "args": (0,),
            "delay": search_tasks.RECONCILIATION_DELAY_MS,
        }
    ]


def test_successful_later_task_does_not_clear_failure_state(monkeypatch):
    client = FakeClient("succeeded")
    monkeypatch.setattr(app, "search", SimpleNamespace(client=client), raising=False)
    cleared = []
    monkeypatch.setattr(
        search_tasks.search_health,
        "clear_hybrid_task_failures",
        lambda: cleared.append("clear"),
    )

    search_tasks.monitor_hybrid_index_task.fn("update", 20)

    assert cleared == []


def test_successful_reconciliation_releases_schedule(monkeypatch):
    calls = []
    monkeypatch.setattr(
        app,
        "search_setup",
        SimpleNamespace(reconcile_hybrid_index=lambda: calls.append("repair")),
        raising=False,
    )
    health_checks = iter([True, False])
    monkeypatch.setattr(
        search_tasks.search_health,
        "has_hybrid_task_failures",
        lambda: next(health_checks),
    )
    cleared = []
    monkeypatch.setattr(
        search_tasks.search_health,
        "clear_reconciliation_scheduled",
        lambda: cleared.append("clear"),
    )

    search_tasks.reconcile_hybrid_index.fn(1)

    assert calls == ["repair"]
    assert cleared == ["clear"]


def test_failed_reconciliation_is_retried_without_mutation_payload(monkeypatch):
    monkeypatch.setattr(
        app,
        "search_setup",
        SimpleNamespace(
            reconcile_hybrid_index=lambda: (_ for _ in ()).throw(
                RuntimeError("repair failed")
            )
        ),
        raising=False,
    )
    failures = []
    scheduled = []
    monkeypatch.setattr(
        search_tasks.search_health,
        "mark_hybrid_task_failed",
        lambda task_uid: failures.append(task_uid),
    )
    monkeypatch.setattr(
        search_tasks.reconcile_hybrid_index,
        "send_with_options",
        lambda **kwargs: scheduled.append(kwargs),
    )

    search_tasks.reconcile_hybrid_index.fn(0)

    assert failures == ["reconciliation"]
    assert scheduled == [
        {
            "args": (1,),
            "delay": search_tasks.RECONCILIATION_DELAY_MS,
        }
    ]


def test_reconciliation_scheduling_is_coalesced(monkeypatch):
    claims = iter([True, False])
    monkeypatch.setattr(
        search_tasks.search_health,
        "mark_reconciliation_scheduled",
        lambda: next(claims),
    )
    scheduled = []
    monkeypatch.setattr(
        search_tasks.reconcile_hybrid_index,
        "send_with_options",
        lambda **kwargs: scheduled.append(kwargs),
    )

    search_tasks._schedule_reconciliation(0)
    search_tasks._schedule_reconciliation(0)

    assert scheduled == [
        {
            "args": (0,),
            "delay": search_tasks.RECONCILIATION_DELAY_MS,
        }
    ]


def test_reconciliation_bails_when_index_is_healthy(monkeypatch):
    monkeypatch.setattr(
        search_tasks.search_health,
        "has_hybrid_task_failures",
        lambda: False,
    )
    cleared = []
    monkeypatch.setattr(
        search_tasks.search_health,
        "clear_reconciliation_scheduled",
        lambda: cleared.append("clear"),
    )
    monkeypatch.setattr(
        app,
        "search_setup",
        SimpleNamespace(
            reconcile_hybrid_index=lambda: pytest.fail("unexpected reconciliation")
        ),
        raising=False,
    )

    search_tasks.reconcile_hybrid_index.fn(0)

    assert cleared == ["clear"]


def test_reconciliation_bails_when_another_rebuild_is_running(monkeypatch):
    lock = FakeLock(acquired=False)
    monkeypatch.setattr(
        search_tasks.search_health,
        "hybrid_reconciliation_lock",
        lambda: lock,
    )
    monkeypatch.setattr(
        app,
        "search_setup",
        SimpleNamespace(
            reconcile_hybrid_index=lambda: pytest.fail("unexpected reconciliation")
        ),
        raising=False,
    )

    search_tasks.reconcile_hybrid_index.fn(0)

    assert lock.released is False
