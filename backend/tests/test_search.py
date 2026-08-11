import importlib
import os
import sys
from contextlib import nullcontext
from types import ModuleType, SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

import meilisearch.errors
import pytest


class FakeIndex:
    def __init__(self, uid):
        self.uid = uid
        self.settings = {}
        self.update_calls = []
        self.delete_calls = []
        self.search_calls = []
        self.search_error = None
        self.update_error = None
        self.delete_error = None
        self.search_response = {
            "hits": [],
            "query": "",
            "processingTimeMs": 1,
            "hitsPerPage": 21,
            "page": 1,
            "totalPages": 0,
            "totalHits": 0,
            "facetDistribution": {
                "runtime": {},
                "developer_name": {},
                "verification_verified": {"true": 0},
            },
        }

    def update_pagination_settings(self, value):
        self.settings["paginationSettings"] = value

    def update_sortable_attributes(self, value):
        self.settings["sortableAttributes"] = value

    def update_searchable_attributes(self, value):
        self.settings["searchableAttributes"] = value

    def update_filterable_attributes(self, value):
        self.settings["filterableAttributes"] = value

    def update_ranking_rules(self, value):
        self.settings["rankingRules"] = value

    def update_documents(self, documents):
        if self.update_error:
            raise self.update_error
        self.update_calls.append(documents)
        return SimpleNamespace(task_uid=1)

    def delete_documents(self, ids):
        if self.delete_error:
            raise self.delete_error
        self.delete_calls.append(ids)
        return SimpleNamespace(task_uid=1)

    def search(self, query, options):
        self.search_calls.append((query, options))
        if self.search_error:
            raise self.search_error
        return {**self.search_response, "query": query}


class FakeClient:
    def __init__(self):
        self.indices = {}
        self.created = []

    def create_index(self, uid, options):
        self.created.append((uid, options))
        self.indices.setdefault(uid, FakeIndex(uid))
        return SimpleNamespace(task_uid=1)

    def index(self, uid):
        return self.indices.setdefault(uid, FakeIndex(uid))


class FakeMonitor:
    def __init__(self):
        self.sent = []

    def send(self, *args):
        self.sent.append(args)


@pytest.fixture
def search_module(monkeypatch):
    import app as app_package

    fake_client = FakeClient()
    monkeypatch.setattr("meilisearch.Client", lambda *args, **kwargs: fake_client)
    fake_models = ModuleType("app.models")
    fake_models.ConnectedAccountProvider = str
    previous_models = sys.modules.pop("app.models", None)
    previous_database = sys.modules.pop("app.database", None)
    previous_models_attribute = getattr(app_package, "models", None)
    previous_database_attribute = getattr(app_package, "database", None)
    monkeypatch.setitem(sys.modules, "app.models", fake_models)
    previous_search = sys.modules.pop("app.search", None)
    module = importlib.import_module("app.search")
    monitor = FakeMonitor()
    monkeypatch.setattr(module, "monitor_hybrid_index_task", monitor)
    monkeypatch.setattr(module.search_health, "has_hybrid_task_failures", lambda: False)
    monkeypatch.setattr(module.search_health, "mark_hybrid_task_failed", lambda _: None)
    monkeypatch.setattr(module.search_health, "hybrid_mutation_lock", nullcontext)
    monkeypatch.setattr(module.search_health, "record_lexical_mutation", lambda _: None)
    yield module, fake_client
    sys.modules.pop("app.search", None)
    sys.modules.pop("app.database", None)
    if previous_models is not None:
        sys.modules["app.models"] = previous_models
    else:
        sys.modules.pop("app.models", None)
    if previous_database is not None:
        sys.modules["app.database"] = previous_database
    else:
        sys.modules.pop("app.database", None)
    if previous_search is None:
        if hasattr(app_package, "search"):
            delattr(app_package, "search")
    else:
        sys.modules["app.search"] = previous_search
    if previous_models_attribute is not None:
        app_package.models = previous_models_attribute
    elif hasattr(app_package, "models"):
        delattr(app_package, "models")
    if previous_database_attribute is not None:
        app_package.database = previous_database_attribute
    elif hasattr(app_package, "database"):
        delattr(app_package, "database")


def test_both_indices_have_identical_settings(search_module):
    search, client = search_module

    assert client.created == [
        (search.LEXICAL_APPS_INDEX, {"primaryKey": "id"}),
        (search.HYBRID_APPS_INDEX, {"primaryKey": "id"}),
    ]
    assert (
        client.indices[search.LEXICAL_APPS_INDEX].settings
        == client.indices[search.HYBRID_APPS_INDEX].settings
    )
    assert (
        client.indices[search.LEXICAL_APPS_INDEX].settings["rankingRules"]
        == search.RANKING_RULES
    )


def test_documents_are_written_to_both_indices_and_hybrid_failure_is_isolated(
    search_module,
):
    search, client = search_module
    document = {"id": "org.example.App", "app_id": "org.example.App"}
    hybrid = client.indices[search.HYBRID_APPS_INDEX]
    hybrid.update_error = RuntimeError("provider unavailable")

    search.create_or_update_apps([document])

    lexical = client.indices[search.LEXICAL_APPS_INDEX]
    assert lexical.update_calls == [[document]]
    assert hybrid.update_calls == []

    hybrid.delete_error = RuntimeError("provider unavailable")
    search.delete_apps([document["id"]])
    assert lexical.delete_calls == [[document["id"]]]

    assert hybrid.delete_calls == []


def test_hybrid_document_task_is_monitored(search_module):
    search, _client = search_module

    document = {"id": "org.example.App", "app_id": "org.example.App"}
    search.create_or_update_apps([document])

    assert search.monitor_hybrid_index_task.sent == [("update", 1)]


def test_lexical_mutations_advance_reconciliation_generation(
    search_module, monkeypatch
):
    search, _ = search_module
    recorded = []
    monkeypatch.setattr(
        search.search_health,
        "record_lexical_mutation",
        lambda task_uids: recorded.append(task_uids),
    )

    search.create_or_update_apps(
        [{"id": "org.example.App", "app_id": "org.example.App"}]
    )
    search.delete_apps(["org.example.App"])

    assert recorded == [[1], [1]]


def test_failed_hybrid_tasks_force_lexical_fallback(search_module, monkeypatch):
    search, client = search_module
    search.config.settings.search_hybrid_enabled = True
    monkeypatch.setattr(search.search_health, "has_hybrid_task_failures", lambda: True)

    search.search_apps_post(search.SearchQuery(query="record my screen"), "en")

    assert client.indices[search.LEXICAL_APPS_INDEX].search_calls
    assert not client.indices[search.HYBRID_APPS_INDEX].search_calls


def test_hybrid_candidate_and_app_id_detection(search_module):
    search, _ = search_module
    assert search._is_hybrid_candidate(search.SearchQuery(query="record my screen"))
    assert search._is_hybrid_candidate(
        search.SearchQuery(
            query="drawing",
            filters=[search.Filter(filterType="type", value="desktop-application")],
        )
    )
    assert not search._is_hybrid_candidate(search.SearchQuery(query=""))
    assert not search._is_hybrid_candidate(search.SearchQuery(query="org.gimp.GIMP"))
    assert not search._is_hybrid_candidate(
        search.SearchQuery(
            query="runtime", filters=[search.Filter(filterType="type", value="runtime")]
        )
    )


@pytest.mark.parametrize(
    ("enabled", "query", "filters", "expected_index"),
    [
        (False, "record my screen", None, "apps"),
        (True, "", None, "apps"),
        (True, "org.gimp.GIMP", None, "apps"),
        (True, "runtime", "runtime", "apps"),
    ],
)
def test_non_hybrid_searches_use_lexical_index(
    search_module, enabled, query, filters, expected_index
):
    search, client = search_module
    search.config.settings.search_hybrid_enabled = enabled
    if filters == "runtime":
        filters = [search.Filter(filterType="type", value="runtime")]
    search.search_apps_post(search.SearchQuery(query=query, filters=filters), "en")

    assert client.indices[expected_index].search_calls
    assert not client.indices[search.HYBRID_APPS_INDEX].search_calls


def test_desktop_intent_search_uses_exact_hybrid_payload(search_module):
    search, client = search_module
    search.config.settings.search_hybrid_enabled = True
    search.config.settings.search_hybrid_semantic_ratio = 0.3
    search.config.settings.search_hybrid_embedder = "apps-fireworks-qwen3"

    query = search.SearchQuery(
        query="record my screen",
        filters=[search.Filter(filterType="type", value="desktop-application")],
        hits_per_page=10,
        page=2,
    )
    search.search_apps_post(query, "en")

    lexical = client.indices[search.LEXICAL_APPS_INDEX]
    hybrid = client.indices[search.HYBRID_APPS_INDEX]
    assert not lexical.search_calls
    assert hybrid.search_calls == [
        (
            "record my screen",
            {
                "hitsPerPage": 10,
                "page": 2,
                "sort": ["installs_last_month:desc"],
                "filter": "type = 'desktop-application' AND NOT icon IS NULL",
                "facets": [
                    "verification_verified",
                    "main_categories",
                    "is_free_license",
                    "type",
                    "arches",
                ],
                "hybrid": {
                    "embedder": "apps-fireworks-qwen3",
                    "semanticRatio": 0.3,
                },
            },
        )
    ]


def test_hybrid_error_retries_lexically_with_same_options(search_module):
    search, client = search_module
    search.config.settings.search_hybrid_enabled = True
    hybrid = client.indices[search.HYBRID_APPS_INDEX]
    hybrid.search_error = meilisearch.errors.MeilisearchCommunicationError("down")

    search.search_apps_post(search.SearchQuery(query="compress pdf"), "en")

    lexical = client.indices[search.LEXICAL_APPS_INDEX]
    assert len(lexical.search_calls) == 1
    hybrid_query, hybrid_options = hybrid.search_calls[0]
    lexical_query, lexical_options = lexical.search_calls[0]
    assert lexical_query == hybrid_query == "compress pdf"
    assert lexical_options == {
        key: value for key, value in hybrid_options.items() if key != "hybrid"
    }

    lexical.search_error = meilisearch.errors.MeilisearchTimeoutError("down")
    with pytest.raises(meilisearch.errors.MeilisearchTimeoutError):
        search.search_apps_post(search.SearchQuery(query="compress pdf"), "en")


@pytest.mark.parametrize(
    "call",
    [
        lambda search: search.get_by_selected_categories([], [], 1, 1, "en"),
        lambda search: search.get_by_selected_category_and_subcategory(
            search.schemas.MainCategory.Game, [], [], 1, 1, "en"
        ),
        lambda search: search.get_by_installs_last_month(1, 1, "en"),
        lambda search: search.get_by_trending(1, 1, "en"),
        lambda search: search.get_by_added_at(1, 1, "en"),
        lambda search: search.get_by_updated_at(1, 1, "en"),
        lambda search: search.get_by_verified(1, 1, "en"),
        lambda search: search.get_by_favorites_count(1, 1, "en"),
        lambda search: search.get_by_mobile(1, 1, "en"),
        lambda search: search.get_by_developer("Example", 1, 1, "en"),
        lambda search: search.get_by_keyword("drawing", 1, 1, "en"),
        lambda search: search.get_runtime_list(),
        lambda search: search.get_developers(1, 1),
        lambda search: search.get_number_of_verified_apps(),
    ],
)
def test_non_text_queries_use_only_lexical_index(search_module, call):
    search, client = search_module
    call(search)

    assert client.indices[search.LEXICAL_APPS_INDEX].search_calls
    assert not client.indices[search.HYBRID_APPS_INDEX].search_calls
