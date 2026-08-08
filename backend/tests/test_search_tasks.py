import os
import sys
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

import app
from app import search_tasks


class FakeIndex:
    def __init__(self, task_uid):
        self.task_uid = task_uid
        self.update_calls = []
        self.delete_calls = []

    def update_documents(self, documents):
        self.update_calls.append(documents)
        return SimpleNamespace(task_uid=self.task_uid)

    def delete_documents(self, ids):
        self.delete_calls.append(ids)
        return SimpleNamespace(task_uid=self.task_uid)


class FakeClient:
    def __init__(self, status):
        self.status = status
        self.index_value = FakeIndex(11)
        self.wait_calls = []

    def index(self, uid):
        assert uid == "apps-hybrid"
        return self.index_value

    def wait_for_task(self, uid, timeout_in_ms, interval_in_ms):
        self.wait_calls.append((uid, timeout_in_ms, interval_in_ms))
        return SimpleNamespace(status=self.status)


def test_failed_task_is_retried_and_marked_unhealthy(monkeypatch):
    client = FakeClient("failed")
    fake_search = SimpleNamespace(client=client)
    monkeypatch.setattr(app, "search", fake_search, raising=False)
    failed = []
    scheduled = []
    monkeypatch.setattr(
        search_tasks.search_health,
        "mark_hybrid_task_failed",
        lambda task_uid: failed.append(task_uid),
    )
    monkeypatch.setattr(
        search_tasks.monitor_hybrid_index_task,
        "send_with_options",
        lambda **kwargs: scheduled.append(kwargs),
    )

    payload = [{"id": "org.example.App"}]
    search_tasks.monitor_hybrid_index_task.fn("update", 10, payload)

    assert failed == [10]
    assert client.index_value.update_calls == [payload]
    assert scheduled == [
        {
            "args": ("update", 11, payload, 10, 1),
            "delay": search_tasks.RECONCILIATION_DELAY_MS,
        }
    ]


def test_successful_reconciliation_clears_failure(monkeypatch):
    client = FakeClient("succeeded")
    fake_search = SimpleNamespace(client=client)
    monkeypatch.setattr(app, "search", fake_search, raising=False)
    cleared = []
    monkeypatch.setattr(
        search_tasks.search_health,
        "clear_hybrid_task_failure",
        lambda task_uid: cleared.append(task_uid),
    )

    search_tasks.monitor_hybrid_index_task.fn(
        "update", 11, [{"id": "org.example.App"}], 10, 1
    )

    assert cleared == [10]
    assert client.index_value.update_calls == []
