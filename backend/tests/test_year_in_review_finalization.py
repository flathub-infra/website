import asyncio
import datetime
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app import models, stats


@pytest.fixture
def annual_stats(monkeypatch):
    clock = SimpleNamespace(now=datetime.datetime(2018, 12, 31, tzinfo=datetime.UTC))
    monkeypatch.setattr(stats.utils, "utcnow", lambda: clock.now)
    monkeypatch.setattr(stats, "FIRST_STATS_DATE", datetime.date(2018, 12, 29))
    monkeypatch.setattr(stats.redis_conn, "get", lambda key: None)
    monkeypatch.setattr(stats.redis_conn, "set", MagicMock())
    fetch = MagicMock(return_value={"updates": 7, "refs": {}, "ref_by_country": {}})
    monkeypatch.setattr(stats, "_get_stats_for_date", fetch)

    @contextmanager
    def empty_db(*args):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        yield db

    monkeypatch.setattr(stats.database, "get_db", empty_db)
    monkeypatch.setattr(stats.database, "get_all_appids_for_frontend", set)
    monkeypatch.setattr(stats, "_get_app_stats_per_day", dict)
    records = {}
    monkeypatch.setattr(
        models.YearInReviewStats,
        "get_for_year",
        lambda db, year: (
            SimpleNamespace(data=records[year]) if year in records else None
        ),
    )
    monkeypatch.setattr(
        models.YearInReviewStats,
        "set_for_year",
        lambda db, year, data: records.update({year: data}),
    )
    return clock, fetch, records


def test_rollover_finalizes_only_after_december_31_is_stable(annual_stats):
    clock, fetch, records = annual_stats
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 7

    clock.now = datetime.datetime(2019, 1, 1, tzinfo=datetime.UTC)
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 14

    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 21
    fetch.reset_mock()
    stats._generate_and_store_year_in_review_stats(None)
    fetch.assert_not_called()


@pytest.mark.parametrize("failure", [None, RuntimeError("source unavailable")])
def test_missing_day_preserves_snapshot_and_retries(annual_stats, failure):
    clock, fetch, records = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    records[2018] = {"year": 2018, "updates_count": 7}
    old_snapshot = records[2018].copy()

    def daily(date, session=None, **kwargs):
        if date.day == 30:
            if isinstance(failure, Exception):
                raise failure
            return failure
        return {"updates": 7, "refs": {}, "ref_by_country": {}}

    fetch.side_effect = daily
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018] == old_snapshot
    fetch.side_effect = None
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 21


def test_missing_day_does_not_create_snapshot(annual_stats):
    clock, fetch, records = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    fetch.return_value = None
    stats._generate_and_store_year_in_review_stats(None)
    assert records == {}
    assert asyncio.run(stats.get_year_stats(2018)) is None
    assert records == {}


def test_on_demand_rebuilds_legacy_snapshot_and_hides_bookkeeping(annual_stats):
    clock, fetch, records = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    records[2018] = {"year": 2018, "updates_count": 7}
    result = asyncio.run(stats.get_year_stats(2018))
    assert result["updates_count"] == 21
    assert "_snapshot" not in result
    assert records[2018]["_snapshot"]["through"] == "2018-12-31"
    fetch.reset_mock()
    assert asyncio.run(stats.get_year_stats(2018)) == result
    fetch.assert_not_called()


def test_on_demand_incomplete_rebuild_preserves_legacy_snapshot(annual_stats):
    clock, fetch, records = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    records[2018] = {"year": 2018, "updates_count": 7}
    fetch.return_value = None
    assert asyncio.run(stats.get_year_stats(2018)) is None
    assert records[2018] == {"year": 2018, "updates_count": 7}


@pytest.mark.parametrize(
    "helper",
    [
        stats._get_app_downloads_for_year,
        stats._get_country_downloads_for_year,
        stats._get_category_downloads_for_year,
        stats._get_basic_year_stats,
    ],
)
def test_comparison_helpers_reject_missing_daily_data(annual_stats, helper):
    clock, fetch, _ = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    fetch.side_effect = lambda date, session=None, **kwargs: (
        None if date.day == 30 else {"refs": {}, "updates": 0}
    )
    with pytest.raises(stats._IncompleteYearStats, match="2018-12-30"):
        helper(2018)


def test_missing_comparison_data_prevents_publication(annual_stats):
    clock, fetch, records = annual_stats
    clock.now = datetime.datetime(2019, 1, 3, tzinfo=datetime.UTC)
    fetch.side_effect = lambda date, session=None, **kwargs: (
        None if date.year == 2018 else {"refs": {}, "updates": 0}
    )
    stats._generate_and_store_year_in_review_stats(None)
    assert records == {}
    assert asyncio.run(stats.get_year_stats(2019)) is None


def test_known_historical_gap_preserves_daily_alignment(monkeypatch):
    before = {"updates": 7, "refs": {}}
    after = {"updates": 11, "refs": {}}
    monkeypatch.setattr(
        stats, "_fetch_stats_parallel", lambda *args, **kwargs: [before, None, after]
    )

    result = stats._fetch_complete_year_stats(
        datetime.date(2018, 6, 18), datetime.date(2018, 6, 20)
    )
    assert len(result) == 3
    assert result[0] == before
    assert result[2] == after
    assert result[1] == {
        "date": datetime.date(2018, 6, 19),
        "countries": {},
        "delta_downloads": 0,
        "downloads": 0,
        "updates": 0,
        "flatpak_versions": {},
        "os_flatpak_versions": {},
        "os_versions": {},
        "ostree_versions": {},
        "ref_by_country": {},
        "ref_by_os_version": {},
        "refs": {},
    }


def test_known_historical_gap_uses_data_when_available(monkeypatch):
    daily = {"updates": 7, "refs": {}}
    monkeypatch.setattr(stats, "_fetch_stats_parallel", lambda *args, **kwargs: [daily])

    assert stats._fetch_complete_year_stats(
        datetime.date(2018, 6, 19), datetime.date(2018, 6, 19)
    ) == [daily]


@pytest.mark.parametrize("day", [18, 20])
def test_other_historical_gaps_still_raise(monkeypatch, day):
    monkeypatch.setattr(stats, "_fetch_stats_parallel", lambda *args, **kwargs: [None])
    date = datetime.date(2018, 6, day)

    with pytest.raises(stats._IncompleteYearStats, match=date.isoformat()):
        stats._fetch_complete_year_stats(date, date)


def test_zero_activity_is_complete_data(annual_stats):
    clock, fetch, records = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    fetch.return_value = {"refs": {}, "updates": 0, "ref_by_country": {}}
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["total_downloads"] == 0
    assert records[2018]["updates_count"] == 0
    assert stats._year_in_review_is_finalized(records[2018], 2018)


def test_leap_day_and_first_available_date_are_included(annual_stats, monkeypatch):
    clock, fetch, _ = annual_stats
    clock.now = datetime.datetime(2020, 3, 2, tzinfo=datetime.UTC)
    monkeypatch.setattr(stats, "FIRST_STATS_DATE", datetime.date(2020, 2, 28))
    # Comparison years before data collection began have no expected days.
    assert stats._normalize_year_date_range(2019) is None
    result = asyncio.run(stats._build_year_in_review_base(2020))
    assert result["updates_count"] == 14
    assert {call.args[0] for call in fetch.call_args_list} == {
        datetime.date(2020, 2, 28),
        datetime.date(2020, 2, 29),
    }
