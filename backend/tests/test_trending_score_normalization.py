import math
import os
import sys

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.trending import calculate_trending_score


def score(history, *, quality=0.0, icon_quality=0, is_eol=False):
    return calculate_trending_score(
        installs_over_days=history,
        quality_passed_ratio=quality,
        icon_quality_bonus=icon_quality,
        is_eol=is_eol,
    )


def test_sustained_growth_ranks_above_flat_activity_and_decline():
    sustained_growth = [10] * 14 + [20] * 7
    flat_activity = [10] * 21
    decline = [20] * 14 + [10] * 7

    assert score(sustained_growth) > score(flat_activity) > score(decline)


def test_sustained_growth_ranks_above_one_day_spike_with_same_recent_total():
    sustained_growth = [10] * 14 + [20] * 7
    one_day_spike = [10] * 14 + [0] * 6 + [140]

    assert score(sustained_growth) > score(one_day_spike)


def test_higher_volume_growth_ranks_above_same_growth_at_tiny_volume():
    tiny_volume = [1] * 14 + [2] * 7
    higher_volume = [100] * 14 + [200] * 7

    assert score(higher_volume) > score(tiny_volume) > 0


@pytest.mark.parametrize("quality, icon_quality", [(0.0, 0), (0.5, 2), (1.0, 5)])
def test_flat_history_scores_zero_regardless_of_quality(quality, icon_quality):
    assert score([10] * 21, quality=quality, icon_quality=icon_quality) == 0


def test_eol_only_reduces_positive_momentum():
    growth = [10] * 14 + [20] * 7
    decline = [20] * 14 + [10] * 7

    assert 0 < score(growth, is_eol=True) < score(growth)
    assert score(decline, is_eol=True) == score(decline)

    active_raw = 20 * math.atanh(score(growth) / 20)
    eol_raw = 20 * math.atanh(score(growth, is_eol=True) / 20)
    assert eol_raw == pytest.approx(active_raw * 0.5)


@pytest.mark.parametrize(
    "history",
    [
        [0] * 21,
        [10] * 14 + [20] * 7,
        [20] * 14 + [10] * 7,
        [10**300] * 14 + [-(10**300)] * 7,
        [-(10**300)] * 14 + [10**300] * 7,
        [1e308] * 14 + [-1e308] * 7,
        [-1e308] * 14 + [1e308] * 7,
        [10**1000] * 14 + [-(10**1000)] * 7,
        [10**1000, -(10**1000)] * 7 + [10**1000] * 7,
        [10**400] * 14 + [1] * 7,
    ],
)
def test_scores_are_finite_and_strictly_bounded(history):
    result = score(history, quality=1.0, icon_quality=5)

    assert math.isfinite(result)
    assert -20 < result < 20


@pytest.mark.parametrize("history", [[], [0] * 20, [0] * 22])
def test_history_must_contain_exactly_21_values(history):
    with pytest.raises(ValueError, match="exactly 21"):
        score(history)


@pytest.mark.parametrize("non_finite", [math.inf, -math.inf, math.nan])
def test_history_values_must_be_finite(non_finite):
    with pytest.raises(ValueError, match="finite"):
        score([0] * 20 + [non_finite])


@pytest.mark.parametrize("quality", [-0.01, 1.01, math.inf, -math.inf, math.nan])
def test_quality_ratio_must_be_finite_and_bounded(quality):
    with pytest.raises(ValueError, match="quality_passed_ratio"):
        score([0] * 21, quality=quality)


def test_icon_quality_bonus_cannot_be_negative():
    with pytest.raises(ValueError, match="icon_quality_bonus"):
        score([0] * 21, icon_quality=-1)
