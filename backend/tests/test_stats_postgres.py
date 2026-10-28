import os
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import sessionmaker

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import database, models, stats, stats_db


@pytest.fixture
def stats_database(monkeypatch):
    database_url = os.getenv("STATS_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("STATS_TEST_DATABASE_URL is not configured")

    schema = f"stats_test_{uuid4().hex}"
    admin_engine = create_engine(database_url)
    engine = None
    created = False
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        created = True
        engine = create_engine(database_url)

        def set_search_path(connection, _record):
            cursor = connection.cursor()
            cursor.execute(f'SET search_path TO "{schema}"')
            cursor.close()

        event.listen(engine, "connect", set_search_path)
        with engine.begin() as connection:
            models.Base.metadata.create_all(
                connection,
                tables=[
                    models.StatsDaily.__table__,
                    models.StatsDailyRef.__table__,
                    models.StatsGlobal.__table__,
                ],
            )
        session_factory = sessionmaker(bind=engine)
        monkeypatch.setattr(database, "WriterSessionLocal", session_factory)
        monkeypatch.setattr(database, "ReplicaSessionLocal", session_factory)
        yield session_factory
    finally:
        if engine is not None:
            engine.dispose()
        if created:
            with admin_engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()


def projected_refs(session_factory, day):
    with session_factory() as session:
        rows = session.execute(
            select(
                models.StatsDailyRef.ref,
                models.StatsDailyRef.architecture,
                models.StatsDailyRef.downloads,
                models.StatsDailyRef.updates,
            ).where(models.StatsDailyRef.date == day)
        )
        return {
            (ref, arch): (downloads, updates) for ref, arch, downloads, updates in rows
        }


def test_daily_replacement_and_rebuild(stats_database):
    day = date(2024, 1, 2)
    other_day = date(2024, 1, 3)
    fetched = datetime(2024, 1, 4, tzinfo=UTC)
    old = {
        "refs": {
            "org.example.App/stable": {"x86_64": [1, 2], "aarch64": [3, 4]},
            "org.example.Runtime/1": {"x86_64": [5, 6]},
        },
        "countries": {"US": 7},
    }
    replacement = {
        "refs": {"org.example.App/stable": {"x86_64": [2**40, 2**39]}},
        "countries": {"CA": 9},
        "extra": {"preserved": True},
    }
    stats_db.save_day(day, old, fetched)
    stats_db.save_day(other_day, old, fetched)
    stats_db.save_day(day, replacement, fetched)
    stats_db.save_day(day, replacement, fetched)

    assert stats_db.load_day(day) == (replacement, fetched)
    assert stats_db.load_day(date(2024, 1, 1)) is None
    assert stats_db.known_dates(day, other_day) == {day, other_day}
    assert projected_refs(stats_database, day) == {
        ("org.example.App/stable", "x86_64"): (2**40, 2**39)
    }
    stats_db.rebuild_refs()
    assert projected_refs(stats_database, day) == {
        ("org.example.App/stable", "x86_64"): (2**40, 2**39)
    }
    assert len(projected_refs(stats_database, other_day)) == 3


def test_invalid_projection_rolls_back_replacement(stats_database):
    day = date(2024, 2, 1)
    fetched = datetime(2024, 2, 2, tzinfo=UTC)
    original = {"refs": {"org.example.App/stable": {"x86_64": [12, 4]}}}
    invalid = {"refs": {"org.example.Other/stable": {"x86_64": ["invalid", 8]}}}
    stats_db.save_day(day, original, fetched)

    with pytest.raises(DBAPIError):
        stats_db.save_day(day, invalid, datetime(2024, 2, 3, tzinfo=UTC))

    assert stats_db.load_day(day) == (original, fetched)
    assert projected_refs(stats_database, day) == {
        ("org.example.App/stable", "x86_64"): (12, 4)
    }


def test_concurrent_replacements_leave_one_complete_projection(stats_database):
    day = date(2024, 3, 1)
    fetched = datetime(2024, 3, 2, tzinfo=UTC)
    payloads = [
        {"refs": {"org.example.First/stable": {"x86_64": [11, 1], "aarch64": [12, 2]}}},
        {"refs": {"org.example.Second/stable": {"x86_64": [21, 3]}}},
    ]
    barrier = Barrier(2, timeout=30)

    def replace(payload):
        barrier.wait()
        stats_db.save_day(day, payload, fetched)

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(replace, payload) for payload in payloads]
        for future in futures:
            future.result(timeout=30)

    payload, timestamp = stats_db.load_day(day)
    assert timestamp == fetched
    assert payload in payloads
    expected = {
        (ref, arch): tuple(counts)
        for ref, arches in payload["refs"].items()
        for arch, counts in arches.items()
    }
    assert projected_refs(stats_database, day) == expected


def test_calculations_group_branches_architectures_and_signed_counts(stats_database):
    first_day = date(2024, 4, 1)
    second_day = date(2024, 4, 2)
    fetched = datetime(2024, 4, 4, tzinfo=UTC)
    stats_db.save_day(
        first_day,
        {"refs": {"org.example.Runtime/1": {"x86_64": [0, 0]}}, "updates": 0},
        fetched,
    )
    stats_db.save_day(
        second_day,
        {
            "refs": {
                "org.example.Runtime/1": {"x86_64": [15, 5], "aarch64": [2, 7]},
                "org.example.Runtime/2": {"aarch64": [6, 2]},
            },
            "updates": 14,
        },
        fetched,
    )

    apps, architectures, countries, updates = stats._annual_data(first_day, second_day)
    assert apps == {"org.example.Runtime": 14}
    assert architectures == {"x86_64": 10, "aarch64": 4}
    assert countries == {}
    assert updates == 14
    assert stats._first_seen()["org.example.Runtime"] == first_day
    with database.get_db("writer") as session:
        today = second_day + timedelta(days=2)
        stats._prepare_app_snapshot(session, today)
        result = stats._app_batch(session, ["org.example.Runtime"], today)
    runtime = result["org.example.Runtime"]
    assert runtime["installs_total"] == 9
    assert runtime["installs_per_day"] == {
        first_day.isoformat(): 0,
        second_day.isoformat(): 9,
    }


def test_resumed_import_refreshes_archived_partial_day(
    stats_database, monkeypatch, tmp_path
):
    import json

    from app import stats_import

    day = date(2024, 4, 1)
    now = datetime(2024, 4, 10, tzinfo=UTC)
    stats_db.save_day(
        day,
        {"refs": {"org.example.App": {"x86_64": [10, 3]}}},
        datetime(2024, 4, 2, tzinfo=UTC),
    )
    source = tmp_path / "2024" / "04" / "01.json"
    source.parent.mkdir(parents=True)
    source.write_text(
        json.dumps(
            {
                "refs": {"org.example.App": {"x86_64": [20, 3]}},
                "downloads": 20,
                "updates": 3,
            }
        )
    )
    monkeypatch.setattr(stats, "FIRST_STATS_DATE", day)
    monkeypatch.setattr(stats.utils, "utcnow", lambda: now)
    monkeypatch.setattr(stats.config.settings, "stats_baseurl", tmp_path.as_uri())
    monkeypatch.setattr(stats.database, "get_all_appids_for_frontend", list)
    monkeypatch.setattr(
        stats.search, "get_number_of_verified_apps", lambda: 0, raising=False
    )
    monkeypatch.setattr(stats, "get_category_totals", list)
    monkeypatch.setattr(sys, "argv", ["stats_import"])

    stats_import.main()

    assert stats_db.load_day(day)[1] == now
    assert projected_refs(stats_database, day) == {
        ("org.example.App", "x86_64"): (20, 3)
    }
