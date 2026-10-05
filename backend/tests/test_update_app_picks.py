import importlib
import os
import sys
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

from app import models
from app.db_session import DBSession

app_picks = importlib.import_module("app.worker.update_app_picks")


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://")
    models.AppOfTheDay.__table__.create(engine)
    apps = {
        "org.example.Excluded": SimpleNamespace(excluded_from_app_picks=True),
        "org.example.Eligible": SimpleNamespace(excluded_from_app_picks=False),
        "org.example.Other": SimpleNamespace(excluded_from_app_picks=False),
    }
    monkeypatch.setattr(models.App, "by_appid", lambda _db, app_id: apps[app_id])
    monkeypatch.setattr(app_picks, "get_all_appids_for_frontend", lambda: list(apps))
    monkeypatch.setattr(
        models.QualityModeration,
        "by_appid_summarized",
        lambda _db, _app_id: SimpleNamespace(passes=True),
    )
    monkeypatch.setattr(models.AppsOfTheWeek, "by_week", lambda *_args: [])
    monkeypatch.setattr(app_picks.random, "shuffle", lambda _apps: None)
    monkeypatch.setattr(app_picks, "invalidate_cache_by_pattern", lambda _pattern: None)
    with Session(engine) as session:
        yield DBSession(session)
    engine.dispose()


def test_automatic_picks_skip_excluded_apps_and_rotate(db):
    today = date(2026, 10, 5)

    app_picks.pick_app_of_the_day_automatically(db, today)
    app_picks.pick_app_of_the_day_automatically(db, today + timedelta(days=1))

    assert models.AppOfTheDay.by_date(db, today).app_id == "org.example.Eligible"
    assert (
        models.AppOfTheDay.by_date(db, today + timedelta(days=1)).app_id
        == "org.example.Other"
    )


def test_automatic_picks_preserve_existing_selection(db):
    today = date(2026, 10, 5)
    models.AppOfTheDay.set_app_of_the_day(db, "org.example.Other", today)

    app_picks.pick_app_of_the_day_automatically(db, today)

    assert models.AppOfTheDay.by_date(db, today).app_id == "org.example.Other"


def test_automatic_picks_with_only_excluded_apps(db, monkeypatch):
    monkeypatch.setattr(
        app_picks, "get_all_appids_for_frontend", lambda: ["org.example.Excluded"]
    )
    today = date(2026, 10, 5)

    app_picks.pick_app_of_the_day_automatically(db, today)

    assert models.AppOfTheDay.by_date(db, today) is None
