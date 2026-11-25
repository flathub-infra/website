import json
import os
import sys
from contextlib import contextmanager, nullcontext
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import cache, login_info
from app.db_session import DBSession
from app.login_info import LoginInformation, LoginState, logged_in
from app.routes import favorites


@pytest.fixture
def client():
    app = FastAPI()
    favorites.register_to_app(app)
    app.add_middleware(cache.CacheControlMiddleware)
    app.dependency_overrides[logged_in] = lambda: LoginInformation(
        state=LoginState.LOGGED_IN,
        user=favorites.models.FlathubUser(id=1),
        method=None,
    )

    with TestClient(app) as client_:
        yield client_


@pytest.mark.parametrize("path", ["/favorites", "/favorites/org.example.App"])
def test_authenticated_favorites_routes_are_private(client, path):
    with (
        patch.object(
            favorites.models.UserFavoriteApp, "all_favorited_by_user", return_value=[]
        ),
        patch.object(
            favorites.models.UserFavoriteApp, "is_favorited_by_user", return_value=False
        ),
    ):
        response = client.get(path)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "private"


@pytest.mark.parametrize(
    ("path", "policy"),
    [
        ("/favorites", "private"),
        ("/favorites/org.example.App/recommendations", "private"),
        ("/favorites/org.example.App/count/current", "private, no-store"),
    ],
)
def test_unauthenticated_favorites_route_is_private(client, path, policy):
    def reject_login():
        raise HTTPException(status_code=401, detail="not_logged_in")

    client.app.dependency_overrides[logged_in] = reject_login
    response = client.get(path)

    assert response.status_code == 401
    assert response.json() == {"detail": "not_logged_in"}
    assert response.headers["Cache-Control"] == policy


def test_recommendations_rank_eligible_apps_and_localize_cards(monkeypatch):
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL is not configured")
    engine = create_engine(url)
    with Session(engine) as session:
        db = DBSession(session)
        session.execute(
            text(
                "CREATE TEMP TABLE user_favorite_app (app_id text, account int, UNIQUE (app_id, account))"
            )
        )
        session.execute(
            text(
                "CREATE TEMP TABLE apps (app_id text PRIMARY KEY, type text, is_eol boolean, appstream jsonb, localization jsonb)"
            )
        )
        for app_id, accounts in {
            "source": range(5),
            "popular": range(20),
            "close": range(4),
            "too-few": range(2),
            "unrelated": range(5, 10),
            "eol": range(5),
            "addon": range(5),
            "no-icon": range(5),
            **{f"other{i}": range(3) for i in range(6)},
        }.items():
            session.execute(
                text("INSERT INTO user_favorite_app VALUES (:id, :account)"),
                [{"id": app_id, "account": account} for account in accounts],
            )
            session.execute(
                text(
                    "INSERT INTO apps VALUES (:id, :type, :eol, CAST(:appstream AS jsonb), CAST(:localization AS jsonb))"
                ),
                {
                    "id": app_id,
                    "type": "addon"
                    if app_id == "addon"
                    else "console-application"
                    if app_id == "close"
                    else "desktop-application",
                    "eol": app_id == "eol",
                    "appstream": json.dumps(
                        {
                            "name": app_id,
                            "summary": "Default",
                            "icon": None if app_id == "no-icon" else "icon.png",
                            "metadata": {"flathub::verification::verified": True},
                        }
                    ),
                    "localization": json.dumps(
                        {
                            "de": {"summary": "Beschreibung"},
                            "de-AT": {"name": "Name AT"},
                        }
                    ),
                },
            )
        monkeypatch.setattr(favorites, "get_db", lambda _: nullcontext(db))
        login = LoginInformation(
            state=LoginState.LOGGED_IN,
            user=favorites.models.FlathubUser(id=1),
            method=None,
        )
        cards = favorites.get_favorite_recommendations("source", login, "de-AT")
        assert [card.id for card in cards] == [
            "close",
            "other0",
            "other1",
            "other2",
            "other3",
            "other4",
        ]
        assert cards[0].name == "Name AT"
        assert cards[0].summary == "Beschreibung"
        assert cards[0].metadata and cards[0].metadata.flathub_verification_verified
        assert favorites.get_favorite_recommendations("too-few", login) == []
        assert (
            favorites.get_favorite_recommendations("source", login)[0].name == "close"
        )
    engine.dispose()


@pytest.mark.parametrize("admin, status", [(False, 403), (True, 200)])
def test_recommendations_require_admin(client, monkeypatch, admin, status):
    user = SimpleNamespace(permissions=lambda: ["modify-users"] if admin else [])
    db = SimpleNamespace(session=SimpleNamespace(merge=lambda _: user))
    monkeypatch.setattr(login_info, "get_db", lambda _: nullcontext(db))
    with patch.object(
        favorites.models.UserFavoriteApp, "recommended_apps", return_value=[]
    ) as query:
        response = client.get("/favorites/org.example.App/recommendations")
    assert response.status_code == status
    assert response.headers["Cache-Control"] == "private"
    assert query.call_count == int(admin)


def test_count_after_bookmark_changes(client, monkeypatch, tmp_path):
    engines = {
        role: create_engine(f"sqlite:///{tmp_path}/{role}.db")
        for role in ("writer", "replica")
    }
    for engine in engines.values():
        favorites.models.UserFavoriteApp.__table__.create(engine)

    @contextmanager
    def get_db(role):
        with Session(engines[role]) as session:
            yield session

    monkeypatch.setattr(favorites, "get_db", get_db)
    redis = AsyncMock()
    # An overlapping read can leave a pre-mutation count in Redis.
    redis.get.return_value = '{"value":{"favorites_count":0}}'
    monkeypatch.setattr(cache.database, "get_redis", AsyncMock(return_value=redis))

    path = "/favorites/org.example.App"

    def assert_count(expected):
        response = client.get(f"{path}/count/current")
        assert response.status_code == 200
        assert response.json() == {"favorites_count": expected}
        assert response.headers["Cache-Control"] == "private, no-store"
        assert client.get(path).json() is bool(expected)

    assert_count(0)
    assert client.post(f"{path}/add").status_code == 200
    assert_count(1)
    public_count = client.get(f"{path}/count")
    assert public_count.json() == {"favorites_count": 0}
    assert public_count.headers["Cache-Control"] == "public, max-age=0, s-maxage=60"
    assert client.delete(f"{path}/remove").status_code == 200
    assert_count(0)
