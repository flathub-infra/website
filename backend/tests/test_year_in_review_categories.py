import asyncio
import datetime
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture
def classify_app(monkeypatch, stats_database):
    # Initialize models before stats/utils and avoid search setup's network calls.
    from app import stats_db

    with patch("meilisearch.Client"):
        from app import stats

    def build(*entries, include_subcategories=False):
        apps = [
            SimpleNamespace(
                app_id=app_id,
                main_category=main_category,
                sub_categories=sub_categories,
            )
            for app_id, main_category, sub_categories, _ in entries
        ]

        @contextmanager
        def app_db(*args, **kwargs):
            sqldb = MagicMock()
            sqldb.query.return_value.filter.return_value.all.return_value = apps
            yield sqldb

        monkeypatch.setattr(
            stats.utils,
            "utcnow",
            lambda: datetime.datetime(2018, 5, 1, tzinfo=datetime.UTC),
        )
        stats_db.save_day(
            datetime.date(2018, 4, 29),
            {
                "refs": {
                    app_id: {"x86_64": [downloads, 0]}
                    for app_id, _, _, downloads in entries
                }
            },
            datetime.datetime(2018, 5, 1, tzinfo=datetime.UTC),
        )
        monkeypatch.setattr(stats.database, "get_db", app_db)
        monkeypatch.setattr(stats.database, "get_all_appids_for_frontend", set)
        monkeypatch.setattr(stats.config.settings, "env", "development")

        result = asyncio.run(stats._build_year_in_review_base(2018))
        keys = ["top_apps", "top_games"]
        if include_subcategories:
            keys.extend(["top_emulators", "top_game_stores", "top_game_utilities"])
        return {key: result[key] for key in keys if result[key]}

    return build


@pytest.mark.parametrize(
    ("subcategory", "expected"),
    [
        ("launcherStore", ["top_apps", "top_game_stores"]),
        ("packageManager", ["top_apps", "top_game_stores"]),
        ("gameTool", ["top_apps", "top_game_utilities"]),
        ("utility", ["top_apps", "top_game_utilities"]),
        ("network", ["top_apps", "top_game_utilities"]),
        ("emulator", ["top_apps", "top_emulators"]),
        ("actionGame", ["top_games"]),
    ],
)
@pytest.mark.parametrize("casing", [str, str.lower, str.upper])
def test_gaming_subcategories(classify_app, subcategory, expected, casing):
    app_id = "org.example.Game"
    assert classify_app(
        (app_id, "Game", [casing(subcategory)], 10), include_subcategories=True
    ) == {key: [{"app_id": app_id, "downloads": 10}] for key in expected}


@pytest.mark.parametrize(
    ("main_category", "subcategories", "expected"),
    [
        ("game", None, ["top_games"]),
        ("GAME", [], ["top_games"]),
        (
            "game",
            ["emulator", "launcherStore", "gameTool"],
            ["top_apps", "top_emulators"],
        ),
        ("game", ["launcherStore", "gameTool"], ["top_apps", "top_game_stores"]),
        ("utility", ["gameTool"], ["top_apps"]),
    ],
)
def test_category_precedence(classify_app, main_category, subcategories, expected):
    app_id = "org.example.Game"
    assert classify_app(
        (app_id, main_category, subcategories, 10), include_subcategories=True
    ) == {key: [{"app_id": app_id, "downloads": 10}] for key in expected}


@pytest.mark.parametrize(
    ("app_id", "specialist_chart"),
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
def test_manual_overrides(
    classify_app, app_id, specialist_chart, main_category, subcategories
):
    assert classify_app(
        (app_id, main_category, subcategories, 10), include_subcategories=True
    ) == {
        key: [{"app_id": app_id, "downloads": 10}]
        for key in ("top_apps", specialist_chart)
    }


def test_gaming_tools_compete_with_other_apps_by_downloads(classify_app):
    assert classify_app(
        ("org.example.Launcher", "Game", ["LauncherStore"], 20),
        ("org.example.Editor", "Utility", [], 30),
        ("org.example.Emulator", "Game", ["Emulator"], 40),
        ("org.example.Game", "Game", ["ActionGame"], 50),
        ("org.example.GameTool", "Game", ["GameTool"], 60),
    ) == {
        "top_apps": [
            {"app_id": "org.example.GameTool", "downloads": 60},
            {"app_id": "org.example.Emulator", "downloads": 40},
            {"app_id": "org.example.Editor", "downloads": 30},
            {"app_id": "org.example.Launcher", "downloads": 20},
        ],
        "top_games": [{"app_id": "org.example.Game", "downloads": 50}],
    }
