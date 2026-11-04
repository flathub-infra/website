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


def test_app_stats_group_installs_per_distro(stats_database):
    now = datetime.datetime(2026, 8, 13, tzinfo=datetime.UTC)
    payload = {
        "refs": {"org.example.App": {"x86_64": [40, 5], "aarch64": [10, 5]}},
        "ref_by_os_version": {
            "org.example.App": {
                "fedora;44": [12, 2],
                "fedora;45": [5, 0],
                "ubuntu;26.10": [8, 3],
                "unknown;unknown": [4, 0],
                "org.kde.Platform;6.11": [2, 0],
                "org.gnome.os;50": [1, 0],
            }
        },
    }
    stats_db.save_day(now.date() - datetime.timedelta(days=1), payload, now)
    stats_db.save_day(now.date() - datetime.timedelta(days=30), payload, now)
    with stats_database() as db:
        stats._prepare_app_snapshot(db, now.date())
        result = stats._app_batch(db, ["org.example.App"], now.date())

    item = result["org.example.App"]
    assert item["installs_last_month"] == 40
    assert item["installs_per_distro"] == {
        "fedora": 15,
        "ubuntu": 5,
        "org.gnome.os": 1,
    }
    assert item["installs_unreported_distro"] == 19
    assert stats.get_distro_name("org.gnome.os") == "GNOME OS"
    assert stats.get_distro_name("some-distro") == "Some Distro"


def test_format_distro_installs_keeps_top_distros():
    per_distro = {f"distro-{i}": i + 1 for i in range(25)}
    top, other = stats.format_distro_installs(per_distro)

    assert len(top) == stats.MAX_DISTROS_IN_RESPONSE
    assert top[0] == {"id": "distro-24", "name": "Distro 24", "installs": 25}
    assert top[-1]["installs"] == 6
    assert other == 1 + 2 + 3 + 4 + 5
