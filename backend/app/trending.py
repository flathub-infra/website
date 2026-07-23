from math import nextafter, tanh

from . import zscore


def _normalize_trend(adjusted_trend: float) -> float:
    limit = 20.0
    normalized_trend = limit * tanh(adjusted_trend / limit)
    # tanh rounds to +/-1 for large finite floats; keep the score inside the limit.
    if normalized_trend >= limit:
        return nextafter(limit, 0.0)
    if normalized_trend <= -limit:
        return nextafter(-limit, 0.0)
    return normalized_trend


def calculate_trending_score(
    installs_over_days: list[int],
    quality_passed_ratio: float,
    icon_quality_bonus: int,
    is_eol: bool,
    is_new_app: bool,
) -> float:
    """Calculate an app's Trending score from install and quality signals."""
    eol_penalty = 0.5
    quality_bonus_max = 15.0

    quality_bonus = (quality_passed_ratio**0.7) * quality_bonus_max

    if len(installs_over_days) < 2:
        if len(installs_over_days) == 1:
            base_score = installs_over_days[0] * 0.1
            if is_new_app:
                base_score *= 1.5
            if is_eol:
                base_score *= eol_penalty
            return _normalize_trend(base_score) + quality_bonus + icon_quality_bonus
        return quality_bonus + icon_quality_bonus

    recent_days = (
        installs_over_days[-3:]
        if len(installs_over_days) >= 3
        else installs_over_days[-2:]
    )
    older_days = (
        installs_over_days[:-3]
        if len(installs_over_days) > 3
        else installs_over_days[:-2]
    )

    recent_avg = sum(recent_days) / len(recent_days) if recent_days else 0
    older_avg = sum(older_days) / len(older_days) if older_days else recent_avg

    if older_avg > 0:
        momentum = (recent_avg - older_avg) / older_avg
    elif recent_avg > 0:
        momentum = 1.0
    else:
        momentum = 0.0

    if len(installs_over_days) >= 4:
        first_half = installs_over_days[: len(installs_over_days) // 2]
        second_half = installs_over_days[len(installs_over_days) // 2 :]
        first_half_growth = first_half[-1] - first_half[0] if len(first_half) > 1 else 0
        second_half_growth = (
            second_half[-1] - second_half[0] if len(second_half) > 1 else 0
        )
        velocity = second_half_growth - first_half_growth
    else:
        velocity = 0

    latest_value = installs_over_days[-1]
    z_score_calc = zscore.zscore(0.75, installs_over_days[:-1])
    z_component = z_score_calc.score(latest_value)

    base_score = (
        z_component * 0.5 + momentum * 20.0 + (velocity / max(recent_avg, 1)) * 5.0
    )

    if is_eol:
        base_score *= eol_penalty

    if is_new_app and len(installs_over_days) <= 7:
        new_app_boost = 1.0 + (0.3 * (7 - len(installs_over_days)) / 7)
        base_score *= new_app_boost

    return _normalize_trend(base_score) + quality_bonus + icon_quality_bonus
