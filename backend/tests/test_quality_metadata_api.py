import os
import sys
from contextlib import nullcontext
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.routes import quality_moderation


@pytest.mark.parametrize(
    "timestamps, expected",
    [
        (None, {}),
        ({}, {}),
        (
            {"app-name": "2026-10-01T12:00:00"},
            {"app-name": "2026-10-01T12:00:00"},
        ),
    ],
)
def test_quality_metadata_timestamps_in_response(monkeypatch, timestamps, expected):
    monkeypatch.setattr(quality_moderation, "get_db", lambda _: nullcontext(None))
    monkeypatch.setattr(
        quality_moderation.App,
        "by_appid",
        lambda *_: SimpleNamespace(
            excluded_from_app_picks=False, quality_metadata_updated_at=timestamps
        ),
    )
    monkeypatch.setattr(quality_moderation.QualityModeration, "by_appid", lambda *_: [])
    monkeypatch.setattr(
        quality_moderation.QualityModerationRequest, "by_appid", lambda *_: None
    )
    monkeypatch.setattr(quality_moderation.App, "get_fullscreen_app", lambda *_: False)
    app = FastAPI()
    app.include_router(quality_moderation.router)

    with TestClient(app) as client:
        response = client.get("/quality-moderation/org.example.App")

    assert response.status_code == 200
    assert response.json()["metadata_changed_at"] == expected
