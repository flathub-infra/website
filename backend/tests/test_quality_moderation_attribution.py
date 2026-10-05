import datetime
import os
import sys
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import models
from app.routes import quality_moderation


class EditorQuery:
    def filter(self, _condition):
        return self

    def all(self):
        return [(42, "Quality Moderator")]


class Session:
    def query(self, *_columns):
        return EditorQuery()


def test_public_quality_response_omits_editor_attribution(monkeypatch):
    guideline = SimpleNamespace(
        id="guideline-a",
        url="https://example.org/guideline",
        needed_to_pass_since=datetime.date(2024, 1, 1),
        read_only=False,
        guideline_category_id="general",
    )
    moderation = SimpleNamespace(
        updated_at=datetime.datetime(2025, 1, 2, 3, 4, tzinfo=datetime.UTC),
        updated_by=42,
        passed=True,
        comment=None,
    )
    monkeypatch.setattr(
        models.QualityModeration,
        "by_appid",
        lambda _db, _app_id: [(guideline, moderation, None)],
    )
    monkeypatch.setattr(
        models.QualityModerationRequest, "by_appid", lambda _db, _app_id: None
    )
    monkeypatch.setattr(models.App, "get_fullscreen_app", lambda _db, _app_id: False)
    monkeypatch.setattr(models.App, "by_appid", lambda _db, _app_id: None)

    response = quality_moderation._get_quality_moderation_response(
        SimpleNamespace(session=Session()), "org.example.App", include_attribution=False
    )

    guideline_data = response.model_dump()["guidelines"][0]
    assert "updated_at" not in guideline_data
    assert "updated_by" not in guideline_data


def test_moderator_quality_response_resolves_editor_display_name(monkeypatch):
    guideline = SimpleNamespace(
        id="guideline-a",
        url="https://example.org/guideline",
        needed_to_pass_since=datetime.date(2024, 1, 1),
        read_only=False,
        guideline_category_id="general",
    )
    moderation = SimpleNamespace(
        updated_at=datetime.datetime(2025, 1, 2, 3, 4, tzinfo=datetime.UTC),
        updated_by=42,
        passed=True,
        comment=None,
    )
    monkeypatch.setattr(
        models.QualityModeration,
        "by_appid",
        lambda _db, _app_id: [(guideline, moderation, None)],
    )
    monkeypatch.setattr(
        models.QualityModerationRequest, "by_appid", lambda _db, _app_id: None
    )
    monkeypatch.setattr(models.App, "get_fullscreen_app", lambda _db, _app_id: False)
    monkeypatch.setattr(models.App, "by_appid", lambda _db, _app_id: None)

    response = quality_moderation._get_quality_moderation_response(
        SimpleNamespace(session=Session()), "org.example.App", include_attribution=True
    )

    guideline_data = response.model_dump()["guidelines"][0]
    assert guideline_data["updated_at"] == datetime.datetime(
        2025, 1, 2, 3, 4, tzinfo=datetime.UTC
    )
    assert guideline_data["updated_by"] == "Quality Moderator"


def test_moderator_attribution_endpoint_requires_quality_moderator():
    route = next(
        route
        for route in quality_moderation.router.routes
        if route.path == "/quality-moderation/{app_id}/moderator"
    )

    assert any(
        dependency.call.__name__ == "quality_moderator_only"
        for dependency in route.dependant.dependencies
    )
