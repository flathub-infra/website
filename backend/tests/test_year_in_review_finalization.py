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


def test_incomplete_rebuild_serves_previous_finalized_snapshot(annual_stats):
    clock, _, records, writer = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    records[2018] = {
        "_snapshot": {"version": 1, "through": "2018-12-31"},
        "year": 2018,
        "updates_count": 21,
    }
    saved = records[2018]
    with writer() as db:
        db.execute(delete(models.StatsDaily))

    result = asyncio.run(stats.get_year_stats(2018))

    assert result["updates_count"] == 21
    assert result["top_chart_limit"] == 3
    assert "_snapshot" not in result
    assert records[2018] is saved


@pytest.mark.parametrize(
    "snapshot",
    [
        {},
        {"_snapshot": {"version": 1, "through": "2018-12-31"}},
    ],
    ids=["legacy", "top-three"],
)
def test_on_demand_rebuilds_old_snapshot_and_hides_bookkeeping(
    annual_stats, monkeypatch, snapshot
):
    clock, _, records, _ = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    records[2018] = {"year": 2018, "updates_count": 7, **snapshot}
    result = asyncio.run(stats.get_year_stats(2018))
    assert result["updates_count"] == 21
    assert result["top_chart_limit"] == 10
    assert "_snapshot" not in result
    assert records[2018]["_snapshot"]["through"] == "2018-12-31"
    monkeypatch.setattr(
        stats,
        "_build_year_in_review_base",
        MagicMock(side_effect=AssertionError("Finalized year rebuilt")),
    )
    assert asyncio.run(stats.get_year_stats(2018)) == result


def test_current_year_retries_old_snapshot_until_upgraded(annual_stats, monkeypatch):
    _, put, records, writer = annual_stats
    day = datetime.date(2018, 12, 29)
    records[2018] = {
        "_snapshot": {"version": 1, "through": "2018-12-28"},
        "year": 2018,
        "updates_count": 4,
    }
    with writer() as db:
        db.execute(delete(models.StatsDaily).where(models.StatsDaily.date == day))
    fallback = asyncio.run(stats.get_year_stats(2018))
    assert fallback["top_chart_limit"] == 3
    assert fallback["updates_count"] == 4

    put(day)
    upgraded = asyncio.run(stats.get_year_stats(2018))
    assert upgraded["top_chart_limit"] == 10
    assert upgraded["updates_count"] == 7
    assert records[2018]["_snapshot"] == {"version": 2, "through": day.isoformat()}
    monkeypatch.setattr(
        stats, "_build_year_in_review_base", MagicMock(side_effect=AssertionError)
    )
    assert asyncio.run(stats.get_year_stats(2018)) == upgraded


@pytest.mark.parametrize(("version", "limit"), [(1, 3), (2, 10)])
def test_rollover_serves_last_published_report_until_daily_data_recovers(
    annual_stats, version, limit
):
    clock, put, records, writer = annual_stats
    day = datetime.date(2018, 12, 30)
    published = asyncio.run(stats.get_year_stats(2018))
    records[2018]["_snapshot"]["version"] = version
    clock.now = datetime.datetime(2019, 1, 1, tzinfo=datetime.UTC)
    with writer() as db:
        db.execute(delete(models.StatsDaily).where(models.StatsDaily.date == day))
    assert asyncio.run(stats.get_year_stats(2018)) == {
        **published,
        "top_chart_limit": limit,
    }
    assert not stats._year_in_review_is_finalized(records[2018], 2018)
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    put(day)
    assert asyncio.run(stats.get_year_stats(2018))["updates_count"] == 21
    assert stats._year_in_review_is_finalized(records[2018], 2018)


@pytest.mark.parametrize("on_demand", [True, False])
def test_rebuild_preserves_published_ranks(annual_stats, monkeypatch, on_demand):
    clock, put, records, _ = annual_stats
    clock.now = datetime.datetime(2019, 1, 2, tzinfo=datetime.UTC)
    downloads = {
        "Alpha": 40,
        "Beta": 60,
        "Gamma": 30,
        "Delta": 10,
        "Epsilon": 50,
        "Zeta": 20,
        "Theta": 8,
        "Eta": 8,
        "Kappa": 7,
        "Lambda": 5,
        "Iota": 7,
    }
    apps = [
        SimpleNamespace(
            app_id=f"org.example.{category}{name}",
            main_category=category,
            sub_categories=[],
        )
        for category in ("Utility", "Game")
        for name in downloads
    ]
    charts = {
        chart: [
            {"app_id": f"org.example.{category}{name}", "downloads": downloads[name]}
            for name in (
                "Beta",
                "Epsilon",
                "Alpha",
                "Gamma",
                "Zeta",
                "Delta",
                "Eta",
                "Theta",
                "Iota",
                "Kappa",
            )
        ]
        for chart, category in (("top_apps", "Utility"), ("top_games", "Game"))
    }
    records[2018] = {
        "_snapshot": {"version": 1, "through": "2018-12-31"},
        **{chart: entries[:3] for chart, entries in charts.items()},
    }
    # The first app disappeared, and the first game is now categorized as a utility.
    apps = [app for app in apps if app.app_id != "org.example.UtilityBeta"]
    next(
        app for app in apps if app.app_id == "org.example.GameBeta"
    ).main_category = "Utility"
    apps.append(
        SimpleNamespace(
            app_id="org.example.Reclassified", main_category="Game", sub_categories=[]
        )
    )

    @contextmanager
    def app_db(*args):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = apps
        yield db

    monkeypatch.setattr(stats.database, "get_db", app_db)
    monkeypatch.setattr(stats.config.settings, "env", "development")
    put(
        datetime.date(2018, 12, 31),
        {
            "refs": {"org.example.Reclassified": {"x86_64": [100, 0]}}
            | {
                f"org.example.{category}{name}": {"x86_64": [count, 0]}
                for category in ("Utility", "Game")
                for name, count in downloads.items()
            }
        },
    )

    if on_demand:

        async def translate(base, locale):
            return base.copy()

        monkeypatch.setattr(stats, "_add_translations_to_year_in_review", translate)
        asyncio.run(stats.get_year_stats(2018))
    else:
        stats._generate_and_store_year_in_review_stats(None)

    assert stats._year_in_review_is_finalized(records[2018], 2018)
    for chart, entries in charts.items():
        assert records[2018][chart] == entries


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


@pytest.mark.parametrize(
    ("start", "end"),
    [
        (datetime.date(2018, 6, 18), datetime.date(2018, 6, 20)),
        (datetime.date(2018, 11, 19), datetime.date(2018, 11, 28)),
        (datetime.date(2018, 12, 8), datetime.date(2018, 12, 11)),
    ],
)
def test_annual_updates_include_both_sides_of_known_gap(stats_database, start, end):
    fetched = datetime.datetime(2019, 1, 1, tzinfo=datetime.UTC)
    stats_db.save_day(start, {"updates": 7, "refs": {}}, fetched)
    stats_db.save_day(end, {"updates": 11, "refs": {}}, fetched)

    assert stats._annual_data(start, end)[3] == 18


def test_2018_and_2019_reports_use_available_data_across_december_gap(
    annual_stats, monkeypatch
):
    clock, put, _, _ = annual_stats
    clock.now = datetime.datetime(2019, 1, 3, tzinfo=datetime.UTC)
    monkeypatch.setattr(stats, "FIRST_STATS_DATE", datetime.date(2018, 12, 8))
    put(datetime.date(2018, 12, 8), {"refs": {"app": {"x86_64": [5, 0]}}})
    # December 9 and 10 are missing; the fixture already covers December 29-31.
    for day in range(11, 29):
        put(datetime.date(2018, 12, day))
    put(datetime.date(2019, 1, 1), {"refs": {"app": {"x86_64": [9, 0]}}})

    review_2018 = asyncio.run(stats.get_year_stats(2018))
    review_2019 = asyncio.run(stats.get_year_stats(2019))
    assert review_2018["total_downloads"] == 5
    assert review_2019["total_downloads"] == 9
    assert review_2019["total_downloads_change"] == 4


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
