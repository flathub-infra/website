import copy
import datetime
import json
from pathlib import Path
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


def test_cached_moderator_preview_stays_private(monkeypatch):
    from app.routes import year_in_review

    report = json.loads(
        (
            Path(__file__).parent
            / "snapshots/year_in_review_smoke__year_in_review__test_year_in_review.json"
        ).read_text()
    )
    year = report["year"]
    now = datetime.datetime(year, 12, 1, tzinfo=datetime.UTC)
    redis = AsyncMock()
    cached = {}
    redis.get.side_effect = cached.get
    redis.setex.side_effect = lambda key, ttl, value: cached.update({key: value})
    monkeypatch.setattr(
        year_in_review.stats.database, "get_redis", AsyncMock(return_value=redis)
    )
    monkeypatch.setattr(
        year_in_review.stats, "get_year_stats", AsyncMock(return_value=report)
    )
    get_db = MagicMock()
    get_db.return_value.__enter__.return_value.session.merge.return_value.permissions.return_value = {
        "quality-moderation"
    }
    monkeypatch.setattr(year_in_review, "get_db", get_db)
    api = FastAPI()
    year_in_review.register_to_app(api)
    api.dependency_overrides[login_state] = lambda: LoginInformation(
        state=LoginState.LOGGED_IN, user=MagicMock(), method=None
    )
    with patch.object(year_in_review, "datetime") as clock, TestClient(api) as client:
        clock.datetime.now.return_value = now
        assert client.get(f"/year-in-review/{year}").status_code == 200
        redis.setex.assert_awaited_once()
        redis.get.reset_mock()
        api.dependency_overrides[login_state] = lambda: LoginInformation(
            state=LoginState.LOGGED_OUT, user=None, method=None
        )
        assert client.get(f"/year-in-review/{year}").status_code == 422
        redis.get.assert_not_awaited()


@pytest.mark.parametrize(
    "metadata",
    [
        pytest.param("removed", id="removed-app"),
        pytest.param("redirected", id="rebased-app"),
        pytest.param("broken-redirect", id="removed-rebase-target"),
        pytest.param("eol-redirect", id="eol-rebase-target"),
        pytest.param("cycle", id="rebase-cycle"),
        pytest.param("eol", id="end-of-life-page"),
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
        "_snapshot": {
            "version": stats._YEAR_IN_REVIEW_SNAPSHOT_VERSION,
            "through": "2020-12-31",
        },
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

    app = MagicMock(
        app_id=app_id,
        summary={"branch": "stable"},
        is_eol=metadata == "eol",
        eol_branches=None,
    )
    app.get_translated_appstream.return_value = (
        metadata if isinstance(metadata, dict) else None
    )
    db = MagicMock()
    rebase = metadata in ("redirected", "broken-redirect", "eol-redirect", "cycle")
    apps = [] if metadata == "removed" or rebase else [app]
    rebases = []
    if rebase:
        successor = "org.example.Successor"
        intermediate = "org.example.Intermediate"
        rebases = [
            MagicMock(app_id=intermediate, old_app_ids=[app_id]),
            MagicMock(app_id=successor, old_app_ids=[intermediate]),
        ]
        if metadata == "cycle":
            rebases.append(MagicMock(app_id=app_id, old_app_ids=[successor]))
        if metadata in ("redirected", "eol-redirect"):
            target = MagicMock(
                app_id=successor,
                summary=None,
                is_eol=metadata == "eol-redirect",
                eol_branches=None,
            )
            target.get_translated_appstream.return_value = None
            if metadata == "redirected":
                target.summary = {"branch": "stable"}
                target.get_translated_appstream.return_value = {"name": "Successor"}
            apps.append(target)
    db.query.return_value.filter.side_effect = lambda condition: MagicMock(
        all=lambda: [row for row in apps if row.app_id in condition.right.value]
    )
    db.query.return_value.all.return_value = rebases
    get_db = MagicMock()
    get_db.return_value.__enter__.return_value = db
    monkeypatch.setattr(stats.database, "get_db", get_db)
    redis = AsyncMock()
    cached = {}
    redis.get.side_effect = cached.get
    redis.setex.side_effect = lambda key, ttl, value: cached.update({key: value})
    monkeypatch.setattr(stats.database, "get_redis", AsyncMock(return_value=redis))

    api = FastAPI()
    year_in_review.register_to_app(api)
    api.dependency_overrides[login_state] = lambda: LoginInformation(
        state=LoginState.LOGGED_OUT, user=None, method=None
    )
    with TestClient(api) as client:
        response = client.get("/year-in-review/2020", params={"locale": "de"})
        assert response.status_code == 200
        redis.setex.assert_awaited_once()
        monkeypatch.setattr(
            stats, "get_year_stats", AsyncMock(side_effect=AssertionError("Cache miss"))
        )
        assert (
            client.get("/year-in-review/2020", params={"locale": "de"}).json()
            == response.json()
        )

    fields = metadata if isinstance(metadata, dict) else {}
    expected = {
        key: value if isinstance(value := fields.get(key), str) else ""
        for key in ("name", "icon", "summary")
    }
    expected["name"] = expected["name"] or app_id
    assert response.json()["top_chart_limit"] == 10
    assert redis.get.call_args.args[0].startswith(
        "cache:endpoint:_get_year_in_review_v2_cached:"
    )
    assert response.json()["unavailable_app_ids"] == (
        [] if fields or metadata in ("redirected", "eol-redirect", "eol") else [app_id]
    )
    for key in APP_LISTS:
        assert response.json()[key] == [{**original[key][0], **expected}]
    assert base == original  # Locale enrichment must not mutate persisted statistics.
    if metadata != "removed" and not rebase:
        app.get_translated_appstream.assert_called_once_with("de")
