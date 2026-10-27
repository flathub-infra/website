import asyncio
import datetime
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def classify_app(monkeypatch):
    # Initialize models before stats/utils and avoid search setup's network calls.
    from app import models  # noqa: F401

    with patch("meilisearch.Client"):
        from app import stats

    def build(app_id, main_category, sub_categories):
        app = SimpleNamespace(
            app_id=app_id, main_category=main_category, sub_categories=sub_categories
        )

        @contextmanager
        def app_db(*args, **kwargs):
            sqldb = MagicMock()
            sqldb.query.return_value.filter.return_value.all.return_value = [app]
            yield sqldb

        monkeypatch.setattr(
            stats.utils,
            "utcnow",
            lambda: datetime.datetime(2018, 5, 1, tzinfo=datetime.UTC),
        )
        monkeypatch.setattr(
            stats,
            "_get_stats_for_date",
            lambda date, session=None, **kwargs: {
                "refs": {app_id: {"x86_64": [10, 0]}}
            },
        )
        monkeypatch.setattr(stats.database, "get_db", app_db)
        monkeypatch.setattr(stats.database, "get_all_appids_for_frontend", set)
        monkeypatch.setattr(stats, "_get_app_stats_per_day", dict)
        monkeypatch.setattr(stats.config.settings, "env", "development")

        result = asyncio.run(stats._build_year_in_review_base(2018))
        return {
            key: result[key]
            for key in (
                "top_apps",
                "top_games",
                "top_emulators",
                "top_game_stores",
                "top_game_utilities",
            )
            if result[key]
        }

    return build


@pytest.mark.parametrize(
    ("subcategory", "expected"),
    [
        ("launcherStore", "top_game_stores"),
        ("packageManager", "top_game_stores"),
        ("gameTool", "top_game_utilities"),
        ("utility", "top_game_utilities"),
        ("network", "top_game_utilities"),
        ("emulator", "top_emulators"),
        ("actionGame", "top_games"),
    ],
)
@pytest.mark.parametrize("casing", [str, str.lower, str.upper])
def test_gaming_subcategories(classify_app, subcategory, expected, casing):
    app_id = "org.example.Game"
    assert classify_app(app_id, "Game", [casing(subcategory)]) == {
        expected: [{"app_id": app_id, "downloads": 10}]
    }


@pytest.mark.parametrize(
    ("main_category", "subcategories", "expected"),
    [
        ("game", None, "top_games"),
        ("GAME", [], "top_games"),
        ("game", ["emulator", "launcherStore", "gameTool"], "top_emulators"),
        ("game", ["launcherStore", "gameTool"], "top_game_stores"),
        ("utility", ["gameTool"], "top_apps"),
    ],
)
def test_category_precedence(classify_app, main_category, subcategories, expected):
    app_id = "org.example.Game"
    assert classify_app(app_id, main_category, subcategories) == {
        expected: [{"app_id": app_id, "downloads": 10}]
    }


@pytest.mark.parametrize(
    ("app_id", "expected"),
    [
        ("net.lutris.Lutris", "top_game_stores"),
        ("org.scummvm.ScummVM", "top_game_utilities"),
        ("org.prismlauncher.PrismLauncher", "top_game_utilities"),
        ("com.moonlight_stream.Moonlight", "top_game_utilities"),
        ("org.polymc.PolyMC", "top_game_utilities"),
    ],
)
@pytest.mark.parametrize(
    ("main_category", "subcategories"),
    [
        ("game", []),
        ("game", ["emulator"]),
        ("game", ["launcherStore"]),
        ("game", ["gameTool"]),
        ("utility", []),
    ],
)
def test_manual_overrides(classify_app, app_id, expected, main_category, subcategories):
    assert classify_app(app_id, main_category, subcategories) == {
        expected: [{"app_id": app_id, "downloads": 10}]
    }
