import asyncio
import copy
import datetime
import json
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

import pytest

from app.country_population import CountryPopulation


@pytest.mark.parametrize("population_available", [True, False])
def test_population_ranking_uses_all_countries_and_review_year(
    monkeypatch, population_available
):
    with patch("meilisearch.Client"):
        from app import stats

    base = {
        "geographic_stats": {
            "top_countries": [{"country_code": "US", "downloads": 100_000}],
            "total_countries": 8,
        }
    }
    original = copy.deepcopy(base)
    monkeypatch.setattr(stats, "_load_year_in_review_base", lambda year: base)
    monkeypatch.setattr(stats, "_year_in_review_is_finalized", lambda data, year: True)
    monkeypatch.setattr(
        stats,
        "_add_translations_to_year_in_review",
        AsyncMock(side_effect=lambda data, locale: copy.deepcopy(data)),
    )

    def get_population(year):
        assert year == 2024
        if not population_available:
            return None
        return CountryPopulation(
            year=year,
            revision="2024 (revision 1)",
            populations={
                "US": 1_000_000,
                "VA": 500,
                "DE": 100_000,
                "FR": 100_000,
                "JP": 100_000,
                "CA": 100_000,
                "GB": 100_000,
            },
        )

    monkeypatch.setattr(stats, "get_country_population", get_population)

    def get_countries(year):
        assert population_available
        assert year == 2024
        return {
            "US": 100_000,
            "DE": 9_000,
            "FR": 8_000,
            "JP": 7_000,
            "CA": 6_000,
            "GB": 5_000,
            "VA": 100,
            "XX": 999_999,
        }

    monkeypatch.setattr(stats, "_get_country_downloads_for_year", get_countries)
    result = asyncio.run(stats.get_year_stats(2024))
    geography = result["geographic_stats"]
    assert geography["top_countries"] == original["geographic_stats"]["top_countries"]
    assert base == original
    if population_available:
        ranking = geography["top_countries_per_capita"]
        assert [country["country_code"] for country in ranking] == [
            "VA",
            "US",
            "DE",
            "FR",
            "JP",
        ]
        assert ranking[0] == {
            "country_code": "VA",
            "downloads": 100,
            "downloads_per_100000": 20_000,
        }
        assert geography["population_year"] == 2024
        assert geography["population_revision"] == "2024 (revision 1)"
    else:
        assert "top_countries_per_capita" not in geography


@pytest.mark.parametrize("reason", ["Missing daily stats", "Unstable daily stats"])
def test_saved_review_survives_incomplete_country_data(monkeypatch, reason):
    with patch("meilisearch.Client"):
        from app.routes import stats as stats_route

    stats = stats_route.stats

    base = {
        "year": 2024,
        "total_downloads": 100_000,
        "top_apps": [{"app_id": "org.example.App", "downloads": 50_000}],
        "geographic_stats": {
            "top_countries": [{"country_code": "US", "downloads": 100_000}],
            "total_countries": 1,
        },
    }
    original = copy.deepcopy(base)
    monkeypatch.setattr(stats, "_load_year_in_review_base", lambda year: base)
    monkeypatch.setattr(stats, "_year_in_review_is_finalized", lambda data, year: True)
    monkeypatch.setattr(
        stats,
        "_build_year_in_review_base",
        AsyncMock(side_effect=AssertionError("Saved review must not be rebuilt")),
    )
    monkeypatch.setattr(
        stats,
        "_add_translations_to_year_in_review",
        AsyncMock(return_value=copy.deepcopy(base)),
    )
    get_countries = Mock(side_effect=stats._IncompleteYearStats(reason))
    monkeypatch.setattr(stats, "_get_country_downloads_for_year", get_countries)

    result = asyncio.run(stats.get_year_stats(2024))

    get_countries.assert_called_once_with(2024)
    assert result == original
    assert result["geographic_stats"].get("top_countries_per_capita") is None
    assert base == original


def test_population_ranking_matches_annual_smoke_snapshots(monkeypatch, stats_database):
    from sqlalchemy import text

    from app import stats, stats_db
    from app.routes.year_in_review import YearInReviewGeographicStats

    tests = Path(__file__).parent
    fetched = datetime.datetime(2027, 1, 2, tzinfo=datetime.UTC)
    monkeypatch.setattr(stats.utils, "utcnow", lambda: fetched)
    with stats_database() as db:
        db.execute(
            text("""
                INSERT INTO stats_daily (date, data, fetched_at)
                SELECT day::date, '{"refs": {}, "ref_by_country": {}, "updates": 0}'::jsonb, :fetched
                FROM generate_series('2024-01-01'::date, '2024-12-31'::date, '1 day'::interval) day
            """),
            {"fetched": fetched},
        )
    for day, filename in [
        ("2024-05-18", "004-two-weeks-ago.json"),
        ("2024-05-29", "000-three-days-ago.json"),
        ("2024-05-30", "001-day-before-yesterday.json"),
        ("2024-05-31", "002-yesterday.json"),
        ("2024-06-01", "003-today.json"),
    ]:
        stats_db.save_day(
            datetime.date.fromisoformat(day),
            json.loads((tests / "stats" / filename).read_text()),
            fetched,
        )
    for snapshot in (tests / "snapshots").glob("year_in_review_smoke__*.json"):
        expected = json.loads(snapshot.read_text())["geographic_stats"]
        base = {
            "geographic_stats": {
                "top_countries": expected["top_countries"],
                "total_countries": 4,
                "fastest_growing_regions": [],
            }
        }
        monkeypatch.setattr(
            stats, "_load_year_in_review_base", lambda year, base=base: base
        )
        monkeypatch.setattr(
            stats, "_year_in_review_is_finalized", lambda data, year: True
        )
        monkeypatch.setattr(
            stats,
            "_add_translations_to_year_in_review",
            AsyncMock(return_value=copy.deepcopy(base)),
        )
        result = asyncio.run(stats.get_year_stats(2024))
        assert (
            YearInReviewGeographicStats.model_validate(
                result["geographic_stats"]
            ).model_dump()
            == expected
        )
