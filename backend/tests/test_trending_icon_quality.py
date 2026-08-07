import datetime
import math
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


def _score(history, *, quality=0.0, icon_quality=0):
    return trending.calculate_trending_score(
        installs_over_days=history,
        quality_passed_ratio=quality,
        icon_quality_bonus=icon_quality,
        is_eol=False,
    )


def _raw_score(normalized_score):
    return 20 * math.atanh(normalized_score / 20)


def test_quality_only_improves_positive_momentum_within_multiplier_limit():
    history = [10] * 14 + [20] * 7
    baseline = _score(history)
    guideline_quality = _score(history, quality=1.0)
    maximum_quality = _score(history, quality=1.0, icon_quality=5)

    baseline_raw = _raw_score(baseline)
    guideline_raw = _raw_score(guideline_quality)
    maximum_raw = _raw_score(maximum_quality)

    assert baseline_raw < guideline_raw < maximum_raw
    assert maximum_raw == pytest.approx(baseline_raw * 1.025)


@pytest.mark.parametrize("history", [[10] * 21, [20] * 14 + [10] * 7])
def test_quality_does_not_improve_flat_or_declining_momentum(history):
    assert _score(history, quality=1.0, icon_quality=5) == _score(history)


def test_icon_quality_bonus_is_clamped_at_five():
    history = [10] * 14 + [20] * 7

    assert _score(history, icon_quality=10**1000) == _score(history, icon_quality=5)


@pytest.mark.parametrize("icon_quality_bonus", range(6))
def test_icon_quality_increases_positive_momentum(icon_quality_bonus):
    history = [10] * 14 + [20] * 7
    baseline = trending.calculate_trending_score(
        installs_over_days=history,
        quality_passed_ratio=0.0,
        icon_quality_bonus=0,
        is_eol=False,
    )

    score = trending.calculate_trending_score(
        installs_over_days=history,
        quality_passed_ratio=0.0,
        icon_quality_bonus=icon_quality_bonus,
        is_eol=False,
    )

    assert baseline <= score <= baseline * 1.025
    assert (score > baseline) == (icon_quality_bonus > 0)


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
