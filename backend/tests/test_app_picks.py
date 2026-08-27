import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import patch

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import cache
from app.login_info import quality_moderator_only
from app.routes import app_picks


def test_get_app_of_the_day_admin_bypasses_shared_cache_and_replica():
    database_types = []

    @contextmanager
    def fake_get_db(database_type):
        database_types.append(database_type)
        yield object()

    app = FastAPI()
    app.dependency_overrides[quality_moderator_only] = lambda: object()
    app_picks.register_to_app(app)
    app.add_middleware(cache.CacheControlMiddleware)

    with (
        patch("app.routes.app_picks.get_db", side_effect=fake_get_db),
        patch(
            "app.routes.app_picks.models.AppOfTheDay.by_date",
            return_value=SimpleNamespace(app_id="org.example.App"),
        ),
        patch(
            "app.routes.app_picks.models.App.by_appid",
            return_value=SimpleNamespace(excluded_from_app_picks=False),
        ),
        TestClient(app) as client,
    ):
        response = client.get("/app-picks/admin/app-of-the-day/2026-08-27")

    assert response.status_code == 200
    assert response.json() == {
        "app_id": "org.example.App",
        "day": "2026-08-27",
    }
    assert response.headers["Cache-Control"] == "private"
    assert database_types == ["writer"]
