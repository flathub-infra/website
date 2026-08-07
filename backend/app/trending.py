from decimal import Decimal, localcontext
from math import isfinite, nextafter, tanh


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
    installs_over_days: list[int | float],
    quality_passed_ratio: float,
    icon_quality_bonus: int,
    is_eol: bool,
) -> float:
    """Calculate an app's trending score from a prepared 21-day history."""
    if len(installs_over_days) != 21:
        raise ValueError("installs_over_days must contain exactly 21 values")
    if not all(isinstance(value, int) or isfinite(value) for value in installs_over_days):
        raise ValueError("installs_over_days values must be finite")
    if not isfinite(quality_passed_ratio) or not 0 <= quality_passed_ratio <= 1:
        raise ValueError("quality_passed_ratio must be finite and between 0 and 1")
    if icon_quality_bonus < 0:
        raise ValueError("icon_quality_bonus cannot be negative")

    with localcontext() as context:
        context.prec = 50
        history = [
            Decimal(value) if isinstance(value, int) else Decimal.from_float(value)
            for value in installs_over_days
        ]
        baseline = history[:14]
        recent = history[14:]
        baseline_rate = sum(baseline, Decimal(0)) / 14
        recent_rate = sum(recent, Decimal(0)) / 7
        recent_volume = sum((abs(value) for value in recent), Decimal(0))

        growth = (recent_rate - baseline_rate) / (abs(baseline_rate) + 5)
        directional_growth = growth if recent_rate > 0 else min(growth, Decimal(0))
        confidence = recent_volume / (recent_volume + 50)

        recent_variance = (
            sum(((value - recent_rate) ** 2 for value in recent), Decimal(0)) / 7
        )
        recent_dispersion = recent_variance.sqrt()
        consistency_denominator = abs(recent_rate) + recent_dispersion
        consistency = (
            abs(recent_rate) / consistency_denominator
            if consistency_denominator
            else Decimal(0)
        )
        consistency_weight = Decimal("0.5") + Decimal("0.5") * consistency

        adjusted_momentum = (
            20 * directional_growth * confidence * consistency_weight
        )
        if adjusted_momentum > 0:
            guideline_quality = Decimal.from_float(quality_passed_ratio**0.7)
            icon_quality = min(Decimal(icon_quality_bonus) / 5, Decimal(1))
            quality_signal = (
                Decimal("0.75") * guideline_quality
                + Decimal("0.25") * icon_quality
            )
            quality_multiplier = 1 + Decimal("0.025") * quality_signal
            adjusted_momentum *= quality_multiplier

            if is_eol:
                adjusted_momentum *= Decimal("0.5")

    return _normalize_trend(float(adjusted_momentum))
