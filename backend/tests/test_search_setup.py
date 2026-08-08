import os
import sys
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

import pytest

from app import config, search_index, search_setup


class FakeIndex:
    def __init__(self, pages=None, count=0):
        self.pages = pages or []
        self.page_index = 0
        self.count = count
        self.documents = []
        self.embedder_updates = []
        self.settings = {}
        self.setting_task_uid = 30

    def get_documents(self, parameters):
        page = self.pages[self.page_index]
        self.page_index += 1
        return page

    def update_documents(self, documents):
        self.documents.append(documents)
        return SimpleNamespace(task_uid=10)

    def update_sortable_attributes(self, value):
        self.settings["sortableAttributes"] = value
        return self._setting_task()

    def update_searchable_attributes(self, value):
        self.settings["searchableAttributes"] = value
        return self._setting_task()

    def update_filterable_attributes(self, value):
        self.settings["filterableAttributes"] = value
        return self._setting_task()

    def update_ranking_rules(self, value):
        self.settings["rankingRules"] = value
        return self._setting_task()

    def _setting_task(self):
        task_uid = self.setting_task_uid
        self.setting_task_uid += 1
        return SimpleNamespace(task_uid=task_uid)

    def update_embedders(self, settings):
        self.embedder_updates.append(settings)
        return SimpleNamespace(task_uid=20)

    def get_stats(self):
        return SimpleNamespace(number_of_documents=self.count)


class FakeClient:
    def __init__(
        self, source=None, target=None, task_status="succeeded", embedded_count=None
    ):
        self.indices = {"apps": source, "apps-hybrid": target}
        self.task_status = task_status
        self.wait_calls = []
        self.created = []
        self.http = (
            SimpleNamespace(
                get=lambda path: {"numberOfEmbeddedDocuments": embedded_count}
            )
            if embedded_count is not None
            else None
        )

    def create_index(self, uid, options):
        self.created.append((uid, options))
        if self.indices.get(uid) is None:
            self.indices[uid] = FakeIndex()
        return SimpleNamespace(task_uid=1)

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


def test_ensure_hybrid_index_applies_shared_settings(monkeypatch):
    fake_client = FakeClient()
    monkeypatch.setattr(search_setup, "client", fake_client)

    search_setup.ensure_hybrid_index()

    target = fake_client.indices["apps-hybrid"]
    assert fake_client.created == [
        ("apps-hybrid", {"primaryKey": "id"}),
    ]
    assert target.settings["sortableAttributes"] == search_index.SORTABLE_ATTRIBUTES
    assert target.settings["searchableAttributes"] == search_index.SEARCHABLE_ATTRIBUTES
    assert target.settings["filterableAttributes"] == search_index.FILTERABLE_ATTRIBUTES
    assert target.settings["rankingRules"] == search_index.RANKING_RULES
    assert fake_client.wait_calls == [
        (1, 1_800_000, 1_000),
        (30, 1_800_000, 1_000),
        (31, 1_800_000, 1_000),
        (32, 1_800_000, 1_000),
        (33, 1_800_000, 1_000),
    ]


def test_verify_embedding_coverage_rejects_partial_embeddings(monkeypatch):
    target = FakeIndex(count=2)
    fake_client = FakeClient(target=target, embedded_count=1)
    monkeypatch.setattr(search_setup, "client", fake_client)

    with pytest.raises(RuntimeError, match="embedding count mismatch"):
        search_setup.verify_embedding_coverage()


def test_main_runs_setup_and_clears_failed_task_state(monkeypatch):
    calls = []
    monkeypatch.setattr(
        search_setup, "ensure_hybrid_index", lambda: calls.append("ensure")
    )
    monkeypatch.setattr(
        search_setup, "backfill_hybrid_index", lambda: calls.append("backfill")
    )
    monkeypatch.setattr(
        search_setup, "configure_hybrid_embedder", lambda: calls.append("embedder")
    )
    monkeypatch.setattr(
        search_setup, "verify_embedding_coverage", lambda: calls.append("verify")
    )
    monkeypatch.setattr(
        search_setup.search_health,
        "clear_hybrid_task_failures",
        lambda: calls.append("clear"),
    )

    search_setup.main()

    assert calls == ["ensure", "backfill", "embedder", "verify", "clear"]
