import datetime
from unittest.mock import MagicMock

import orjson
import pytest

from app import models, stats  # noqa: F401 - initialize models before stats/utils


@pytest.fixture(params=[False, True], ids=["source-order", "reversed-order"])
def daily_stats(request):
    # node22 counts from https://flathub.org/stats/2026/08/10.json.
    refs = {
        "org.freedesktop.Sdk.Extension.node22/24.08": {
            "aarch64": [4, 0],
            "x86_64": [12, 0],
        },
        "org.freedesktop.Sdk.Extension.node22/25.08": {
            "aarch64": [11, 2],
            "x86_64": [63, 25],
        },
        "org.freedesktop.Platform/24.08": {"x86_64": [30, 10]},
        "org.freedesktop.Platform/25.08": {"x86_64": [50, 15]},
        "org.example.App": {"x86_64": [10, 3]},
    }
    if request.param:
        refs = dict(reversed(list(refs.items())))
    return {"refs": refs}


def test_daily_aggregates_sum_runtime_branches_smoke(daily_stats):
    agg = stats._init_empty_aggregates()
    day = datetime.date(2026, 8, 10)
    next_day = day + datetime.timedelta(days=1)

    stats._update_aggregates_for_date(day, daily_stats, agg)
    stats._update_aggregates_for_date(next_day, daily_stats, agg)

    for app_id, installs in {
        "org.freedesktop.Sdk.Extension.node22": 63,
        "org.freedesktop.Platform": 55,
        "org.example.App": 7,
    }.items():
        assert agg["per_day"][app_id] == {
            day.isoformat(): installs,
            next_day.isoformat(): installs,
        }
        assert sum(counts[2] for counts in agg["totals"][app_id].values()) == (
            installs * 2
        )


def test_daily_stats_fallback_sums_runtime_branches_smoke(monkeypatch, daily_stats):
    day = datetime.date(2026, 8, 10)
    monkeypatch.setattr(stats, "FIRST_STATS_DATE", day)
    monkeypatch.setattr(
        stats.utils,
        "utcnow",
        lambda: datetime.datetime(2026, 8, 13, tzinfo=datetime.UTC),
    )
    monkeypatch.setattr(stats.database, "get_json_key", lambda key: None)
    monkeypatch.setattr(stats, "_get_stats_for_date", lambda date: daily_stats)
    cache_set = MagicMock()
    monkeypatch.setattr(stats.redis_conn, "set", cache_set)

    result = stats._get_app_stats_per_day()

    assert result == {
        app_id: {"2026-08-10": installs, "2026-08-11": installs}
        for app_id, installs in {
            "org.freedesktop.Sdk.Extension.node22": 63,
            "org.freedesktop.Platform": 55,
            "org.example.App": 7,
        }.items()
    }
    assert orjson.loads(cache_set.call_args.args[1]) == result
