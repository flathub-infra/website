import datetime

import pytest

from app import stats, stats_db


@pytest.mark.parametrize("reverse", [False, True])
def test_daily_statistics_sum_runtime_branches(stats_database, reverse):
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
    if reverse:
        refs = dict(reversed(list(refs.items())))
    day = datetime.date(2026, 8, 10)
    now = datetime.datetime(2026, 8, 13, tzinfo=datetime.UTC)
    for offset in range(2):
        stats_db.save_day(day + datetime.timedelta(days=offset), {"refs": refs}, now)
    with stats_database() as db:
        stats._prepare_app_snapshot(db, now.date())
        result = stats._app_batch(
            db,
            [
                "org.freedesktop.Sdk.Extension.node22",
                "org.freedesktop.Platform",
                "org.example.App",
            ],
            now.date(),
        )
    for app_id, installs in {
        "org.freedesktop.Sdk.Extension.node22": 63,
        "org.freedesktop.Platform": 55,
        "org.example.App": 7,
    }.items():
        assert result[app_id]["installs_total"] == installs * 2
        assert result[app_id]["installs_per_day"] == {
            day.isoformat(): installs,
            (day + datetime.timedelta(days=1)).isoformat(): installs,
        }
