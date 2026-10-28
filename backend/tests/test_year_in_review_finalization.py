import asyncio
import datetime
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from sqlalchemy import delete

from app import models, stats, stats_db


@pytest.fixture
def annual_stats(monkeypatch, stats_database):
    clock = SimpleNamespace(now=datetime.datetime(2018, 12, 31, tzinfo=datetime.UTC))
    monkeypatch.setattr(stats.utils, "utcnow", lambda: clock.now)
    monkeypatch.setattr(stats, "FIRST_STATS_DATE", datetime.date(2018, 12, 29))

    @contextmanager
    def empty_db(*args):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        yield db

    monkeypatch.setattr(stats.database, "get_db", empty_db)
    monkeypatch.setattr(stats.database, "get_all_appids_for_frontend", set)
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

    def put(day, payload=None):
        stats_db.save_day(
            day,
            payload
            if payload is not None
            else {"updates": 7, "refs": {}, "ref_by_country": {}},
            datetime.datetime.combine(
                day + datetime.timedelta(days=2), datetime.time(), datetime.UTC
            ),
        )

    for day in range(29, 32):
        put(datetime.date(2018, 12, day))
    return clock, put, records, stats_database


def test_rollover_finalizes_only_after_december_31_is_stable(annual_stats, monkeypatch):
    clock, _, records, _ = annual_stats
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 7
    clock.now = datetime.datetime(2019, 1, 1, tzinfo=datetime.UTC)
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 14
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 21
    monkeypatch.setattr(
        stats,
        "_build_year_in_review_base",
        MagicMock(side_effect=AssertionError("Finalized year rebuilt")),
    )
    stats._generate_and_store_year_in_review_stats(None)


def test_missing_day_preserves_snapshot_and_retries(annual_stats):
    clock, put, records, writer = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    records[2018] = {"year": 2018, "updates_count": 7}
    old_snapshot = records[2018].copy()
    with writer() as db:
        db.execute(
            delete(models.StatsDaily).where(
                models.StatsDaily.date == datetime.date(2018, 12, 30)
            )
        )
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018] == old_snapshot
    assert asyncio.run(stats.get_year_stats(2018)) is None
    put(datetime.date(2018, 12, 30))
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["updates_count"] == 21


def test_missing_day_does_not_create_snapshot(annual_stats):
    clock, _, records, writer = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    with writer() as db:
        db.execute(delete(models.StatsDaily))
    stats._generate_and_store_year_in_review_stats(None)
    assert records == {}
    assert asyncio.run(stats.get_year_stats(2018)) is None
    assert records == {}


def test_on_demand_rebuilds_legacy_snapshot_and_hides_bookkeeping(
    annual_stats, monkeypatch
):
    clock, _, records, _ = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    records[2018] = {"year": 2018, "updates_count": 7}
    result = asyncio.run(stats.get_year_stats(2018))
    assert result["updates_count"] == 21
    assert "_snapshot" not in result
    assert records[2018]["_snapshot"]["through"] == "2018-12-31"
    monkeypatch.setattr(
        stats,
        "_build_year_in_review_base",
        MagicMock(side_effect=AssertionError("Finalized year rebuilt")),
    )
    assert asyncio.run(stats.get_year_stats(2018)) == result


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
    clock, _, _, writer = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    with writer() as db:
        db.execute(
            delete(models.StatsDaily).where(
                models.StatsDaily.date == datetime.date(2018, 12, 30)
            )
        )
    with pytest.raises(stats._IncompleteYearStats):
        helper(2018)


def test_missing_comparison_data_prevents_publication(annual_stats):
    clock, put, records, writer = annual_stats
    clock.now = datetime.datetime(2019, 1, 3, tzinfo=datetime.UTC)
    with writer() as db:
        db.execute(delete(models.StatsDaily))
    put(datetime.date(2019, 1, 1))
    stats._generate_and_store_year_in_review_stats(None)
    assert records == {}
    assert asyncio.run(stats.get_year_stats(2019)) is None


def test_known_historical_gap_preserves_daily_alignment(stats_database):
    fetched = datetime.datetime(2018, 6, 22, tzinfo=datetime.UTC)
    stats_db.save_day(datetime.date(2018, 6, 18), {"updates": 7, "refs": {}}, fetched)
    stats_db.save_day(datetime.date(2018, 6, 20), {"updates": 11, "refs": {}}, fetched)

    assert (
        stats._annual_data(datetime.date(2018, 6, 18), datetime.date(2018, 6, 20))[3]
        == 18
    )


def test_known_historical_gap_uses_data_when_available(stats_database):
    day = datetime.date(2018, 6, 19)
    stats_db.save_day(
        day,
        {"updates": 7, "refs": {}},
        datetime.datetime(2018, 6, 22, tzinfo=datetime.UTC),
    )

    assert stats._annual_data(day, day)[3] == 7


@pytest.mark.parametrize("day", [18, 20])
def test_other_historical_gaps_still_raise(stats_database, day):
    date = datetime.date(2018, 6, day)

    with pytest.raises(stats._IncompleteYearStats, match=date.isoformat()):
        stats._annual_data(date, date)


def test_zero_activity_is_complete_data(annual_stats):
    clock, put, records, _ = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    for day in range(29, 32):
        put(
            datetime.date(2018, 12, day),
            {"refs": {}, "updates": 0, "ref_by_country": {}},
        )
    stats._generate_and_store_year_in_review_stats(None)
    assert records[2018]["total_downloads"] == 0
    assert records[2018]["updates_count"] == 0
    assert stats._year_in_review_is_finalized(records[2018], 2018)


def test_leap_day_and_first_available_date_are_included(annual_stats, monkeypatch):
    clock, put, _, _ = annual_stats
    clock.now = datetime.datetime(2020, 3, 2, tzinfo=datetime.UTC)
    monkeypatch.setattr(stats, "FIRST_STATS_DATE", datetime.date(2020, 2, 28))
    put(datetime.date(2020, 2, 28))
    put(datetime.date(2020, 2, 29))
    assert stats._normalize_year_date_range(2019) is None
    result = asyncio.run(stats._build_year_in_review_base(2020))
    assert result["updates_count"] == 14
