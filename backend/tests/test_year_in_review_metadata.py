import copy
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import models  # noqa: F401 - initialize models before stats/utils
from app.login_info import LoginInformation, LoginState, login_state

APP_LISTS = (
    "top_apps",
    "top_games",
    "top_emulators",
    "top_game_stores",
    "top_game_utilities",
    "popular_apps_by_category",
    "biggest_growth_by_category",
    "newcomers_by_category",
    "most_improved_by_category",
    "hidden_gems",
)


@pytest.mark.parametrize(
    "metadata",
    [
        pytest.param("removed", id="removed-app"),
        pytest.param(None, id="missing-appstream"),
        pytest.param({}, id="missing-fields"),
        pytest.param({"name": None, "icon": None, "summary": None}, id="null-fields"),
        pytest.param({"name": 42, "icon": [], "summary": {}}, id="invalid-fields"),
        pytest.param({"name": "", "icon": "", "summary": ""}, id="empty-fields"),
        pytest.param({"name": "Übersetzter Name"}, id="translated-name-only"),
        pytest.param(
            {"icon": "https://example.org/icon.png", "summary": "Beschreibung"},
            id="missing-name",
        ),
        pytest.param(
            {
                "name": "Übersetzter Name",
                "icon": "https://example.org/icon.png",
                "summary": "Beschreibung",
            },
            id="complete-translation",
        ),
    ],
)
def test_historical_response_with_missing_metadata(monkeypatch, metadata):
    with patch("meilisearch.Client"):
        from app import stats
        from app.routes import year_in_review

    app_id = "org.example.HistoricalApp"
    base = {
        "_snapshot": {"version": 1, "through": "2020-12-31"},
        "year": 2020,
        "total_downloads": 100,
        "new_apps_count": 1,
        "total_apps": 1,
        "updates_count": 10,
        "total_downloads_change": 50,
        "total_downloads_change_percentage": 100.0,
    }
    for key in APP_LISTS:
        item = {"app_id": app_id}
        if "category" in key:
            item["category"] = "Utility"
        if key in ("biggest_growth_by_category", "most_improved_by_category"):
            item.update(growth=50, growth_percentage=100)
        else:
            item["downloads"] = 100
        base[key] = [item]
    original = copy.deepcopy(base)
    monkeypatch.setattr(stats, "_load_year_in_review_base", lambda year: base)
    monkeypatch.setattr(
        stats,
        "_build_year_in_review_base",
        AsyncMock(side_effect=AssertionError("Finalized snapshots must not rebuild")),
    )

    app = MagicMock(app_id=app_id)
    app.get_translated_appstream.return_value = metadata
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = (
        [] if metadata == "removed" else [app]
    )
    get_db = MagicMock()
    get_db.return_value.__enter__.return_value = db
    monkeypatch.setattr(stats.database, "get_db", get_db)
    redis = AsyncMock()
    redis.get.return_value = None
    monkeypatch.setattr(stats.database, "get_redis", AsyncMock(return_value=redis))

    api = FastAPI()
    year_in_review.register_to_app(api)
    api.dependency_overrides[login_state] = lambda: LoginInformation(
        state=LoginState.LOGGED_OUT, user=None, method=None
    )
    with TestClient(api) as client:
        response = client.get("/year-in-review/2020", params={"locale": "de"})
        assert response.status_code == 200

    fields = metadata if isinstance(metadata, dict) else {}
    expected = {
        key: value if isinstance(value := fields.get(key), str) else ""
        for key in ("name", "icon", "summary")
    }
    expected["name"] = expected["name"] or app_id
    for key in APP_LISTS:
        assert response.json()[key] == [{**original[key][0], **expected}]
    assert base == original  # Locale enrichment must not mutate persisted statistics.
    if metadata != "removed":
        app.get_translated_appstream.assert_called_once_with("de")
