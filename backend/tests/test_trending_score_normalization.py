import os
import sys

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.trending import calculate_trending_score


@pytest.mark.parametrize(
    ("raw_trend", "expected"),
    [
        (-40, -19.280552),
        (-20, -15.231884),
        (-10, -9.242343),
        (0, 0.0),
        (10, 9.242343),
        (20, 15.231884),
        (40, 19.280552),
    ],
)
def test_one_value_history_normalizes_representative_trends(raw_trend, expected):
    score = calculate_trending_score(
        installs_over_days=[raw_trend * 10],
        quality_passed_ratio=0.0,
        icon_quality_bonus=0,
        is_eol=False,
        is_new_app=False,
    )

    assert score == pytest.approx(expected)


def test_normalized_trends_preserve_sign_bounds_and_ordering():
    scores = [
        calculate_trending_score(
            installs_over_days=[raw_trend * 10],
            quality_passed_ratio=0.0,
            icon_quality_bonus=0,
            is_eol=False,
            is_new_app=False,
        )
        for raw_trend in (-1_000, -40, -10, 0, 10, 40, 1_000)
    ]

    assert scores == sorted(scores)
    assert all(-20 < score < 20 for score in scores)
    assert scores[0] < 0 < scores[-1]
    assert scores[3] == 0


@pytest.mark.parametrize(
    ("is_eol", "is_new_app", "expected"),
    [
        (True, False, 9.242343),
        (False, True, 18.102965),
        (True, True, 12.702979),
    ],
)
def test_limited_history_adjustments_are_normalized(is_eol, is_new_app, expected):
    score = calculate_trending_score(
        installs_over_days=[200],
        quality_passed_ratio=0.0,
        icon_quality_bonus=0,
        is_eol=is_eol,
        is_new_app=is_new_app,
    )

    assert score == pytest.approx(expected)


@pytest.mark.parametrize(
    ("is_eol", "is_new_app", "expected"),
    [
        (True, False, 16.965673),
        (False, True, 19.907898),
        (True, True, 18.166470),
    ],
)
def test_normal_history_adjustments_are_normalized(is_eol, is_new_app, expected):
    score = calculate_trending_score(
        installs_over_days=[100, 200],
        quality_passed_ratio=0.0,
        icon_quality_bonus=0,
        is_eol=is_eol,
        is_new_app=is_new_app,
    )

    assert score == pytest.approx(expected)


def test_normal_history_install_contribution_is_bounded():
    score = calculate_trending_score(
        installs_over_days=[10, 10, 10, 1_000_000],
        quality_passed_ratio=0.0,
        icon_quality_bonus=0,
        is_eol=False,
        is_new_app=False,
    )

    assert 0 < score < 20


@pytest.mark.parametrize(
    "installs_over_days",
    [[], [400], [10, 10, 10, 1_000]],
)
def test_quality_bonuses_are_exact_after_install_normalization(installs_over_days):
    install_score = calculate_trending_score(
        installs_over_days=installs_over_days,
        quality_passed_ratio=0.0,
        icon_quality_bonus=0,
        is_eol=False,
        is_new_app=False,
    )
    final_score = calculate_trending_score(
        installs_over_days=installs_over_days,
        quality_passed_ratio=1.0,
        icon_quality_bonus=5,
        is_eol=False,
        is_new_app=False,
    )

    assert final_score == pytest.approx(install_score + 20)
