import os
import sys
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

import pytest

from app import config, search_setup


class FakeIndex:
    def __init__(self, pages=None, count=0):
        self.pages = pages or []
        self.page_index = 0
        self.count = count
        self.documents = []
        self.embedder_updates = []

    def get_documents(self, parameters):
        page = self.pages[self.page_index]
        self.page_index += 1
        return page

    def update_documents(self, documents):
        self.documents.append(documents)
        return SimpleNamespace(task_uid=10)

    def update_embedders(self, settings):
        self.embedder_updates.append(settings)
        return SimpleNamespace(task_uid=20)

    def get_stats(self):
        return SimpleNamespace(number_of_documents=self.count)


class FakeClient:
    def __init__(self, source=None, target=None, task_status="succeeded"):
        self.indices = {"apps": source, "apps-hybrid": target}
        self.task_status = task_status
        self.wait_calls = []

    def index(self, uid):
        return self.indices[uid]

    def wait_for_task(self, uid, timeout_in_ms, interval_in_ms):
        self.wait_calls.append((uid, timeout_in_ms, interval_in_ms))
        return SimpleNamespace(status=self.task_status)


def test_build_embedder_settings_contract():
    settings = config.Settings(
        fireworks_api_key="secret",
        search_embedding_dimensions=2048,
    )
    payload = search_setup.build_embedder_settings(settings)
    embedder = payload["apps-fireworks-qwen3"]

    assert embedder == {
        "source": "rest",
        "url": "https://api.fireworks.ai/inference/v1/embeddings",
        "apiKey": "secret",
        "dimensions": 2048,
        "request": {
            "model": "fireworks/qwen3-embedding-8b",
            "input": ["{{text}}", "{{..}}"],
            "dimensions": 2048,
            "encoding_format": "float",
            "normalize": True,
        },
        "response": {"data": [{"embedding": "{{embedding}}"}, "{{..}}"]},
        "documentTemplate": search_setup.DOCUMENT_TEMPLATE,
        "documentTemplateMaxBytes": 2000,
    }


def test_backfill_pages_documents_waits_and_verifies_parity(monkeypatch):
    source = FakeIndex(
        pages=[
            SimpleNamespace(results=[{"id": "a"}], offset=0, limit=1000, total=2),
            SimpleNamespace(results=[{"id": "b"}], offset=1000, limit=1000, total=2),
        ],
        count=2,
    )
    target = FakeIndex(count=2)
    fake_client = FakeClient(source, target)
    monkeypatch.setattr(search_setup, "client", fake_client)

    search_setup.backfill_hybrid_index()

    assert target.documents == [[{"id": "a"}], [{"id": "b"}]]
    assert fake_client.wait_calls == [
        (10, 1_800_000, 1_000),
        (10, 1_800_000, 1_000),
    ]


def test_backfill_rejects_count_mismatch(monkeypatch):
    source = FakeIndex(
        pages=[SimpleNamespace(results=[], offset=0, limit=1000, total=0)],
        count=1,
    )
    target = FakeIndex(count=0)
    monkeypatch.setattr(search_setup, "client", FakeClient(source, target))

    with pytest.raises(RuntimeError, match="count mismatch"):
        search_setup.backfill_hybrid_index()


def test_configure_embedder_requires_key(monkeypatch):
    monkeypatch.setattr(config.settings, "fireworks_api_key", None)

    with pytest.raises(ValueError, match="FIREWORKS_API_KEY"):
        search_setup.configure_hybrid_embedder()


def test_configure_embedder_waits_and_logs_safe_payload(monkeypatch):
    target = FakeIndex(count=2)
    fake_client = FakeClient(target=target)
    monkeypatch.setattr(search_setup, "client", fake_client)
    monkeypatch.setattr(config.settings, "fireworks_api_key", "secret")

    search_setup.configure_hybrid_embedder()

    assert fake_client.wait_calls == [(20, 1_800_000, 1_000)]
    assert target.embedder_updates[0]["apps-fireworks-qwen3"]["apiKey"] == "secret"


def test_configure_embedder_raises_failed_task(monkeypatch):
    target = FakeIndex(count=2)
    fake_client = FakeClient(target=target, task_status="failed")
    monkeypatch.setattr(search_setup, "client", fake_client)
    monkeypatch.setattr(config.settings, "fireworks_api_key", "secret")

    with pytest.raises(RuntimeError, match="ended with failed"):
        search_setup.configure_hybrid_embedder()
