import datetime
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models


@pytest.fixture
def client(monkeypatch):
    with patch("meilisearch.Client"):
        from app.routes import stats

    redis = AsyncMock()
    redis.get.return_value = None
    monkeypatch.setattr(stats.database, "get_redis", AsyncMock(return_value=redis))
    monkeypatch.setattr(
        stats.utils,
        "utcnow",
        lambda: datetime.datetime(2026, 1, 15, tzinfo=datetime.UTC),
    )
    app = FastAPI()
    stats.register_to_app(app)
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize("months,start", [(6, "2025-08"), (12, "2025-02")])
def test_monthly_window_and_full_snapshot(client, monkeypatch, months, start):
    from app.routes import stats

    seen = []
    snapshot = SimpleNamespace(
        snapshot_date=datetime.date(2026, 1, 14),
        eligible_apps=3,
        apps_with_stable_metadata=2,
        permission_counts={"context": {"filesystems": {"home": 2, "host:ro": 1}}},
    )

    @contextmanager
    def db():
        yield object()

    def monthly(db, start_date, end_date):
        seen.append((start_date, end_date))
        return [snapshot]

    monkeypatch.setattr(stats.database, "get_db", db)
    monkeypatch.setattr(models.PermissionStatsSnapshot, "get_monthly", monthly)
    response = client.get("/stats/permissions", params={"months": months})
    assert response.status_code == 200
    assert response.json() == {
        "start_month": start,
        "end_month": "2026-01",
        "snapshots": [
            {
                "snapshot_date": "2026-01-14",
                "eligible_apps": 3,
                "apps_with_stable_metadata": 2,
                "permission_counts": snapshot.permission_counts,
            }
        ],
    }
    assert seen == [
        (datetime.date.fromisoformat(start + "-01"), datetime.date(2026, 1, 15))
    ]


def test_default_window_and_empty_history(client, monkeypatch):
    from app.routes import stats

    @contextmanager
    def db():
        yield object()

    monkeypatch.setattr(stats.database, "get_db", db)
    monkeypatch.setattr(
        models.PermissionStatsSnapshot, "get_monthly", lambda *a, **kw: []
    )
    assert client.get("/stats/permissions").json() == {
        "start_month": "2025-08",
        "end_month": "2026-01",
        "snapshots": [],
    }


@pytest.mark.parametrize("months", [0, 1, 7, 13, "invalid"])
def test_invalid_window(client, months):
    assert (
        client.get("/stats/permissions", params={"months": months}).status_code == 422
    )


def test_latest_monthly_dates_are_selected_in_sql():
    # Exercise the actual selection query with dates; JSON maps are loaded only
    # by the second query. SQLite substitutes PostgreSQL's date_trunc function.
    engine = create_engine("sqlite://")
    with engine.connect() as connection:
        connection.connection.driver_connection.create_function(
            "date_trunc", 2, lambda unit, value: value[:7]
        )
        connection.exec_driver_sql(
            "CREATE TABLE permission_stats_snapshots (snapshot_date DATE PRIMARY KEY)"
        )
        for date in [
            "2025-07-31",
            "2025-08-01",
            "2025-08-31",
            "2025-10-12",
            "2026-01-14",
            "2026-01-16",
        ]:
            connection.exec_driver_sql(
                "INSERT INTO permission_stats_snapshots VALUES (?)", (date,)
            )
        with Session(bind=connection) as session:
            dates = models.PermissionStatsSnapshot.monthly_dates(
                session, datetime.date(2025, 8, 1), datetime.date(2026, 1, 15)
            )
            assert dates == [
                datetime.date(2025, 8, 31),
                datetime.date(2025, 10, 12),
                datetime.date(2026, 1, 14),
            ]
