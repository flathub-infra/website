import datetime
from unittest.mock import MagicMock

import pytest

from app import stats, stats_db


def test_recent_version_stats_adds_unknown_os_from_ostree_total(
    monkeypatch, stats_database
):
    end_date = datetime.date(2026, 8, 12)
    payloads = {
        end_date: {
            "ostree_versions": {"1.16": 100},
            "os_versions": {"fedora;42": 40, "arch;unknown": 25, "unknown": 2},
            "flatpak_versions": {"1.16": 80, "unknown": 5},
        },
        end_date - datetime.timedelta(days=1): {
            "ostree_versions": {"1.16": 10},
            "os_versions": {"fedora;42": 12},
            "flatpak_versions": {"1.16": 12},
        },
        end_date - datetime.timedelta(days=2): {"os_versions": {"debian;13": 5}},
    }
    now = datetime.datetime(2026, 8, 14, tzinfo=datetime.UTC)
    monkeypatch.setattr(stats.utils, "utcnow", lambda: now)
    monkeypatch.setattr(
        stats.search, "get_number_of_verified_apps", lambda: 0, raising=False
    )
    monkeypatch.setattr(stats, "get_category_totals", list)
    for day, payload in payloads.items():
        stats_db.save_day(day, payload, now)
    with stats_database() as db:
        result = stats._global_data(db, 0)
    assert result["os_versions"] == {
        "fedora;42": 52,
        "arch;unknown": 25,
        "debian;13": 5,
        "unknown": 35,
    }
    assert result["flatpak_versions"] == {"1.16": 92, "unknown": 20}


@pytest.mark.parametrize("fetched_day, refresh", [(1, True), (2, False)])
def test_partial_source_refreshes_before_stable_use(
    monkeypatch, stats_database, fetched_day, refresh
):
    day = datetime.date(2018, 12, 31)
    cached = {"updates": 7, "refs": {}, "ref_by_country": {}}
    complete = {**cached, "updates": 11}
    now = datetime.datetime(2019, 1, 2, 1, tzinfo=datetime.UTC)
    stats_db.save_day(
        day, cached, datetime.datetime(2019, 1, fetched_day, tzinfo=datetime.UTC)
    )
    monkeypatch.setattr(stats.utils, "utcnow", lambda: now)
    response = MagicMock(status_code=200)
    response.json.return_value = complete
    session = MagicMock()
    session.get.return_value = response
    result = stats._get_stats_for_date(day, session)
    assert result["updates"] == (11 if refresh else 7)
    assert stats_db.load_day(day)[0]["updates"] == result["updates"]
    assert session.get.called == refresh


def test_failed_source_fetch_preserves_previous_day(monkeypatch, stats_database):
    day = datetime.date(2026, 8, 12)
    previous = {"refs": {"org.example.App": {"x86_64": [10, 2]}}}
    fetched = datetime.datetime(2026, 8, 13, tzinfo=datetime.UTC)
    stats_db.save_day(day, previous, fetched)
    monkeypatch.setattr(
        stats.utils,
        "utcnow",
        lambda: datetime.datetime(2026, 8, 14, tzinfo=datetime.UTC),
    )
    session = MagicMock()
    session.get.return_value = MagicMock(status_code=404)
    assert stats._get_stats_for_date(day, session) is None
    assert stats_db.load_day(day) == (previous, fetched)
