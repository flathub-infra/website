import datetime
import os
import sys
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import models, trending
from app.db_session import DBSession


@pytest.mark.parametrize("icon_quality_bonus", range(6))
def test_icon_quality_bonus_adds_exact_points(icon_quality_bonus):
    baseline = trending.calculate_trending_score(
        installs_over_days=[10, 12, 15, 20],
        quality_passed_ratio=0.0,
        icon_quality_bonus=0,
        is_eol=False,
        is_new_app=False,
    )

    score = trending.calculate_trending_score(
        installs_over_days=[10, 12, 15, 20],
        quality_passed_ratio=0.0,
        icon_quality_bonus=icon_quality_bonus,
        is_eol=False,
        is_new_app=False,
    )

    assert score == pytest.approx(baseline + icon_quality_bonus)


@pytest.mark.parametrize(
    ("installs_over_days", "is_eol", "is_new_app"),
    [
        ([], False, False),
        ([10], False, False),
        ([10, 12, 15, 20], False, False),
        ([10, 12, 15, 20], True, False),
        ([10, 12, 15, 20], False, True),
    ],
)
def test_icon_quality_bonus_applies_to_every_score_path(
    installs_over_days, is_eol, is_new_app
):
    args = {
        "installs_over_days": installs_over_days,
        "quality_passed_ratio": 0.6,
        "is_eol": is_eol,
        "is_new_app": is_new_app,
    }

    baseline = trending.calculate_trending_score(icon_quality_bonus=0, **args)
    score = trending.calculate_trending_score(icon_quality_bonus=3, **args)

    assert score == pytest.approx(baseline + 3)


@pytest.fixture
def quality_db():
    engine = create_engine("sqlite://")
    models.Base.metadata.create_all(
        engine,
        tables=[
            models.FlathubUser.__table__,
            models.GuidelineCategory.__table__,
            models.Guideline.__table__,
            models.QualityModeration.__table__,
        ],
    )

    with Session(engine) as session:
        yield SimpleNamespace(db=DBSession(session), engine=engine)


def test_icon_quality_passed_counts_are_batched_and_filtered(quality_db):
    today = datetime.date(2026, 7, 23)
    quality_db.db.session.add_all(
        [
            models.GuidelineCategory(id="app-icon", order=1),
            models.GuidelineCategory(id="general", order=2),
            models.Guideline(
                id="icon-passed",
                url="https://example.com/icon-passed",
                needed_to_pass_since=today,
                order=1,
                guideline_category_id="app-icon",
            ),
            models.Guideline(
                id="icon-failed",
                url="https://example.com/icon-failed",
                needed_to_pass_since=today,
                order=2,
                guideline_category_id="app-icon",
            ),
            models.Guideline(
                id="icon-unrated",
                url="https://example.com/icon-unrated",
                needed_to_pass_since=today,
                order=3,
                guideline_category_id="app-icon",
            ),
            models.Guideline(
                id="other-passed",
                url="https://example.com/other-passed",
                needed_to_pass_since=today,
                order=4,
                guideline_category_id="general",
            ),
            models.QualityModeration(
                app_id="org.example.One",
                guideline_id="icon-passed",
                passed=True,
            ),
            models.QualityModeration(
                app_id="org.example.One",
                guideline_id="icon-failed",
                passed=False,
            ),
            models.QualityModeration(
                app_id="org.example.One",
                guideline_id="other-passed",
                passed=True,
            ),
            models.QualityModeration(
                app_id="org.example.Two",
                guideline_id="icon-passed",
                passed=True,
            ),
        ]
    )
    quality_db.db.session.commit()

    statements = 0

    def count_statement(*_args):
        nonlocal statements
        statements += 1

    event.listen(quality_db.engine, "before_cursor_execute", count_statement)
    try:
        result = models.QualityModeration.by_appids_icon_quality_passed_count(
            quality_db.db,
            ["org.example.One", "org.example.Two", "org.example.Missing"],
        )
    finally:
        event.remove(quality_db.engine, "before_cursor_execute", count_statement)

    assert statements == 1
    assert result == {"org.example.One": 1, "org.example.Two": 1}
    assert result.get("org.example.Missing", 0) == 0


def test_icon_quality_passed_counts_skip_query_for_no_apps(quality_db):
    statements = 0

    def count_statement(*_args):
        nonlocal statements
        statements += 1

    event.listen(quality_db.engine, "before_cursor_execute", count_statement)
    try:
        result = models.QualityModeration.by_appids_icon_quality_passed_count(
            quality_db.db, []
        )
    finally:
        event.remove(quality_db.engine, "before_cursor_execute", count_statement)

    assert result == {}
    assert statements == 0
