import asyncio
import datetime
from contextlib import contextmanager
from unittest.mock import MagicMock

import orjson

from app import stats


def test_add_unknown_version_count():
    versions = {"1.16": 80, "unknown": 5}

    stats._add_unknown_version_count(versions, total=100, reported=85)
    stats._add_unknown_version_count(versions, total=10, reported=12)

    assert versions == {"1.16": 80, "unknown": 20}


def test_recent_version_stats_adds_unknown_os_from_ostree_total(monkeypatch):
    end_date = datetime.date(2026, 8, 12)
    payloads = {
        end_date: {
            "ostree_versions": {"1.16": 100},
            "os_versions": {
                "fedora;42": 40,
                "arch;unknown": 25,
                "unknown": 2,
            },
            "flatpak_versions": {"1.16": 80, "unknown": 5},
        },
        end_date - datetime.timedelta(days=1): {
            "ostree_versions": {"1.16": 10},
            "os_versions": {"fedora;42": 12},
            "flatpak_versions": {"1.16": 12},
        },
        end_date - datetime.timedelta(days=2): {
            "os_versions": {"debian;13": 5},
        },
    }

    monkeypatch.setattr(
        stats.utils,
        "utcnow",
        lambda: datetime.datetime(2026, 8, 14, tzinfo=datetime.UTC),
    )
    monkeypatch.setattr(stats, "_get_stats_for_date", payloads.get)

    os_versions, flatpak_versions, _ = stats._compute_recent_version_stats(days=3)

    assert os_versions == {
        "fedora;42": 52,
        "arch;unknown": 25,
        "debian;13": 5,
        "unknown": 35,
    }
    assert flatpak_versions == {"1.16": 92, "unknown": 20}


def test_year_in_review_uses_sync_redis_cache(monkeypatch):
    cached_stats = {
        "updates": 7,
        "refs": {},
        "ref_by_country": {},
    }
    get_cached = MagicMock(return_value=orjson.dumps(cached_stats))
    get_source_stats = MagicMock()

    @contextmanager
    def empty_db(*args, **kwargs):
        sqldb = MagicMock()
        sqldb.query.return_value.filter.return_value.all.return_value = []
        yield sqldb

    monkeypatch.setattr(
        stats.utils,
        "utcnow",
        lambda: datetime.datetime(2018, 4, 29, tzinfo=datetime.UTC),
    )
    monkeypatch.setattr(stats.redis_conn, "get", get_cached)
    monkeypatch.setattr(stats, "_get_stats_for_date", get_source_stats)
    monkeypatch.setattr(stats.database, "get_db", empty_db)
    monkeypatch.setattr(stats.database, "get_all_appids_for_frontend", set)
    monkeypatch.setattr(stats, "_get_app_stats_per_day", dict)

    result = asyncio.run(stats._build_year_in_review_base(2018))

    assert result is not None
    assert result["updates_count"] == 7
    get_cached.assert_called_once_with("stats:date:2018-04-29")
    get_source_stats.assert_not_called()
