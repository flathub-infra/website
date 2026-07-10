import datetime
import os
import sys
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.login_info import quality_moderator_only
from app.routes import app_picks


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(app_picks.router)
    with TestClient(app) as client_:
        yield client_


@pytest.fixture
def moderator_override(client):
    client.app.dependency_overrides[quality_moderator_only] = lambda: SimpleNamespace(
        user=SimpleNamespace(id=1)
    )
    try:
        yield
    finally:
        client.app.dependency_overrides.pop(quality_moderator_only, None)


@pytest.fixture
def curated_selection():
    return SimpleNamespace(
        id=1,
        theme_id=1,
        enabled=True,
        theme=SimpleNamespace(key="creative-tools"),
        slot="after-hero",
        starts_at=datetime.date(2026, 7, 5),
        ends_at=datetime.date(2026, 7, 10),
        apps=[
            SimpleNamespace(app_id="org.example.App", position=0),
            SimpleNamespace(app_id="org.example.Invalid", position=1),
        ],
    )


def test_curated_app_selections_smoke(client, snapshot, monkeypatch, curated_selection):
    duplicate_slot = SimpleNamespace(
        id=2,
        theme=SimpleNamespace(key="creative-tools"),
        slot="after-hero",
        starts_at=datetime.date(2026, 7, 5),
        ends_at=datetime.date(2026, 7, 10),
        apps=[SimpleNamespace(app_id="org.example.Other", position=0)],
    )

    monkeypatch.setattr(
        app_picks,
        "_app_pick_recommendation_ids",
        lambda _db, _date: {"org.example.App"},
    )
    monkeypatch.setattr(
        app_picks.models.ScheduledSelection,
        "active_by_date",
        lambda _db, _date: [curated_selection, duplicate_slot],
    )

    response = client.get("/app-picks/curated-app-selections/2026-07-05")

    assert response.status_code == 200
    assert snapshot("test_curated_app_selections.json") == response.json()


def test_curated_app_selection_themes_admin_smoke(
    client, snapshot, monkeypatch, moderator_override
):
    monkeypatch.setattr(
        app_picks.models.SelectionTheme,
        "all",
        lambda _db, include_disabled=False: [
            SimpleNamespace(
                id=1,
                key="new-year-new-workflows",
                name="New Year, New Workflows",
                enabled=True,
            ),
            SimpleNamespace(
                id=2,
                key="free-software-favorites",
                name="Free Software Favorites",
                enabled=True,
            ),
            SimpleNamespace(
                id=3,
                key="spring-creativity",
                name="Spring Creativity",
                enabled=True,
            ),
            SimpleNamespace(
                id=4,
                key="fresh-desktop-releases",
                name="Fresh Desktop Releases",
                enabled=True,
            ),
            SimpleNamespace(
                id=5,
                key="staying-connected",
                name="Staying Connected",
                enabled=True,
            ),
            SimpleNamespace(
                id=6,
                key="summer-travel",
                name="Summer Travel",
                enabled=True,
            ),
            SimpleNamespace(
                id=7,
                key="back-to-learning",
                name="Back to Learning",
                enabled=True,
            ),
            SimpleNamespace(
                id=8,
                key="winter-comforts",
                name="Winter Comforts",
                enabled=True,
            ),
            SimpleNamespace(
                id=9,
                key="tools-for-developers",
                name="Tools for Developers",
                enabled=True,
            ),
            SimpleNamespace(
                id=10,
                key="take-better-notes",
                name="Take Better Notes",
                enabled=True,
            ),
            SimpleNamespace(
                id=11,
                key="get-focused",
                name="Get Focused",
                enabled=True,
            ),
            SimpleNamespace(
                id=12,
                key="make-some-noise",
                name="Make Some Noise",
                enabled=True,
            ),
            SimpleNamespace(
                id=13,
                key="get-to-work",
                name="Get To Work",
                enabled=True,
            ),
        ],
    )

    response = client.get("/app-picks/admin/curated-app-selection-themes")

    assert response.status_code == 200
    assert snapshot("test_curated_app_selection_themes_admin.json") == response.json()


def test_curated_app_selections_admin_smoke(
    client, snapshot, monkeypatch, moderator_override, curated_selection
):
    monkeypatch.setattr(
        app_picks.models.ScheduledSelection,
        "all",
        lambda _db: [curated_selection],
    )

    response = client.get("/app-picks/admin/curated-app-selections")

    assert response.status_code == 200
    assert snapshot("test_curated_app_selections_admin.json") == response.json()
