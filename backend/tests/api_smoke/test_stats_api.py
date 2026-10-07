class TestStatsEndpoint:
    def test_normalizes_missing_version_maps_without_dropping_stats(
        self, client, endpoint_app, monkeypatch, snapshot
    ):
        _app, _apps, _favorites, _oidc, stats = endpoint_app
        monkeypatch.setattr(
            stats.database,
            "get_json_key",
            lambda _key: {
                "totals": {"installs_total": 12345, "installs_last_month": 678},
                "countries": {"US": 987, "DE": 654},
                "downloads_per_day": {"2026-01-14": 42},
                "updates_per_day": {"2026-01-14": 12},
                "delta_downloads_per_day": {"2026-01-14": 30},
                "category_totals": [{"category": "Utility", "count": 14}],
                "os_versions": None,
                "flatpak_versions": None,
                "os_flatpak_versions": None,
            },
        )

        response = client.get("/stats/")

        assert response.status_code == 200
        assert snapshot("stats_overview.json") == response.json()
