from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.country_population import CountryPopulation


class TestStatsEndpoint:
    def test_normalizes_missing_version_maps_without_dropping_stats(
        self, client, endpoint_app, monkeypatch, snapshot
    ):
        _app, _apps, _favorites, _oidc, stats = endpoint_app

        @contextmanager
        def stored_stats():
            db = MagicMock()
            db.get.return_value = SimpleNamespace(
                data={
                    "totals": {"installs_total": 12345, "installs_last_month": 678},
                    "countries": {"US": 987, "DE": 654},
                    "downloads_per_day": {"2026-01-14": 42},
                    "updates_per_day": {"2026-01-14": 12},
                    "delta_downloads_per_day": {"2026-01-14": 30},
                    "category_totals": [{"category": "Utility", "count": 14}],
                    "os_versions": None,
                    "flatpak_versions": None,
                    "os_flatpak_versions": None,
                }
            )
            yield db

        monkeypatch.setattr(stats.database, "get_db", stored_stats)
        monkeypatch.setattr(
            stats,
            "get_country_population",
            lambda year: CountryPopulation(
                year=2026,
                revision="2024 (revision 1)",
                populations={"US": 349035494, "DE": 83644258},
            ),
        )

        response = client.get("/stats/")

        assert response.status_code == 200
        assert snapshot("stats_overview.json") == response.json()

    def test_population_is_added_without_rewriting_stored_country_counts(
        self, endpoint_app, monkeypatch
    ):
        _app, _apps, _favorites, _oidc, stats = endpoint_app
        stored = {
            "totals": {"downloads": 100},
            "countries": {"US": 95, "AX": 5},
            "downloads_per_day": {},
            "updates_per_day": {},
            "delta_downloads_per_day": {},
            "category_totals": [],
            "os_versions": {},
            "flatpak_versions": {},
            "os_flatpak_versions": {},
        }
        monkeypatch.setattr(stats, "get_country_population", lambda year: None)
        result = stats._normalize_stats_result(stored)
        assert result.country_population is None
        assert result.countries == {"US": 95, "AX": 5}
        assert "country_population" not in stored

    @pytest.mark.parametrize("all_days", [False, True])
    @pytest.mark.parametrize("population_available", [False, True])
    def test_app_population_does_not_rewrite_stored_counts(
        self, client, endpoint_app, monkeypatch, all_days, population_available
    ):
        _app, _apps, _favorites, _oidc, stats = endpoint_app
        stored = {
            "id": "org.example.App",
            "installs_total": 100,
            "installs_per_day": {"2026-01-01": 50, "2026-01-02": 50},
            "installs_per_country": {"US": 95, "AX": 5},
            "installs_per_distro": {"fedora": 60},
            "installs_unreported_distro": 40,
            "installs_last_month": 100,
            "installs_last_7_days": 100,
        }
        monkeypatch.setattr(
            stats.stats, "get_installs_by_ids", lambda ids: {ids[0]: stored}
        )
        monkeypatch.setattr(
            stats,
            "get_country_population",
            lambda year: (
                CountryPopulation(
                    year=year,
                    revision="2024 (revision 1)",
                    populations={"US": 1_000_000},
                )
                if population_available
                else None
            ),
        )
        response = client.get(
            f"/stats/org.example.App?all={str(all_days).lower()}&days=1"
        )
        assert response.status_code == 200
        result = response.json()
        if population_available:
            assert result["country_population"]["populations"] == {"US": 1_000_000}
            assert result["country_population"]["year"] == stats.utils.utcnow().year
        else:
            assert result["country_population"] is None
        assert result["installs_per_country"] == stored["installs_per_country"]
        assert result["installs_per_distro"] == [
            {"id": "fedora", "name": "Fedora", "installs": 60}
        ]
        assert result["installs_other_distros"] == 0
        assert result["installs_unreported_distro"] == 40
        assert stored["installs_per_distro"] == {"fedora": 60}
        assert len(result["installs_per_day"]) == (2 if all_days else 1)
        assert len(stored["installs_per_day"]) == 2
        assert "country_population" not in stored
