import datetime
import os
import sys
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.models import QualityModeration
from app.trending import calculate_trending_score as _calculate_trending_score


@pytest.mark.parametrize(
    "installs", [[0] * 20 + [100], [0] * 19 + [10, 20], [0] * 14 + [100] * 7]
)
@pytest.mark.parametrize("is_eol", [False, True])
def test_new_apps_without_passing_icons_lose_ninety_percent(installs, is_eol):
    kwargs = {
        "installs_over_days": installs,
        "quality_passed_ratio": 1.0,
        "icon_quality_bonus": 5,
        "is_eol": is_eol,
        "is_new_app": True,
    }
    passing_score = _calculate_trending_score(**kwargs, icons_passed=True)
    assert passing_score > 0
    assert _calculate_trending_score(**kwargs, icons_passed=False) == pytest.approx(
        passing_score * 0.1
    )


def test_older_apps_are_not_penalized_for_icons():
    kwargs = {
        "installs_over_days": [10] * 14 + [100] * 7,
        "quality_passed_ratio": 0.5,
        "icon_quality_bonus": 2,
        "is_eol": False,
        "is_new_app": False,
    }
    assert _calculate_trending_score(**kwargs, icons_passed=False) == (
        _calculate_trending_score(**kwargs, icons_passed=True)
    )


def test_icon_penalty_does_not_improve_negative_scores():
    kwargs = {
        "installs_over_days": [100] * 14 + [10] * 7,
        "quality_passed_ratio": 0.0,
        "icon_quality_bonus": 0,
        "is_eol": False,
        "is_new_app": True,
    }
    passing_score = _calculate_trending_score(**kwargs, icons_passed=True)
    assert passing_score < 0
    assert _calculate_trending_score(**kwargs, icons_passed=False) == passing_score


def test_icon_status_requires_all_applicable_guidelines_to_pass():
    engine = create_engine("sqlite://")
    with Session(engine) as session:
        # Only the columns used by the query are needed for this database test.
        session.execute(
            text("CREATE TABLE apps (app_id TEXT, is_fullscreen_app BOOLEAN)")
        )
        session.execute(
            text("""
            CREATE TABLE guideline (
                id TEXT, guideline_category_id TEXT,
                needed_to_pass_since DATE, show_on_fullscreen_app BOOLEAN
            )
        """)
        )
        session.execute(
            text("""
            CREATE TABLE qualitymoderation (
                app_id TEXT, guideline_id TEXT, passed BOOLEAN
            )
        """)
        )
        app_ids = ["passing", "failed", "partial", "unreviewed", "fullscreen"]
        session.execute(
            text("INSERT INTO apps VALUES (:app_id, :fullscreen)"),
            [
                {"app_id": app_id, "fullscreen": app_id == "fullscreen"}
                for app_id in app_ids
            ],
        )
        today = datetime.datetime.now(datetime.UTC).date()
        session.execute(
            text("INSERT INTO guideline VALUES (:id, :category, :date, :fullscreen)"),
            [
                {
                    "id": "icon",
                    "category": "app-icon",
                    "date": today,
                    "fullscreen": True,
                },
                {
                    "id": "desktop-icon",
                    "category": "app-icon",
                    "date": today,
                    "fullscreen": False,
                },
                {
                    "id": "future-icon",
                    "category": "app-icon",
                    "date": today + datetime.timedelta(days=1),
                    "fullscreen": True,
                },
                {
                    "id": "other",
                    "category": "general",
                    "date": today,
                    "fullscreen": True,
                },
            ],
        )
        session.execute(
            text("INSERT INTO qualitymoderation VALUES (:app_id, :guideline, :passed)"),
            [
                {"app_id": "passing", "guideline": "icon", "passed": True},
                {"app_id": "passing", "guideline": "desktop-icon", "passed": True},
                {"app_id": "failed", "guideline": "icon", "passed": True},
                {"app_id": "failed", "guideline": "desktop-icon", "passed": False},
                {"app_id": "partial", "guideline": "icon", "passed": True},
                {"app_id": "fullscreen", "guideline": "icon", "passed": True},
            ],
        )
        db = SimpleNamespace(session=session)
        assert QualityModeration.by_appids_icon_status(db, app_ids + ["missing"]) == {
            "passing": True,
            "failed": False,
            "partial": False,
            "unreviewed": False,
            "fullscreen": True,
            "missing": False,
        }
        assert QualityModeration.by_appids_icon_status(db, []) == {}
    engine.dispose()
