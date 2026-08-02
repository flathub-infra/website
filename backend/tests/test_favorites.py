import os
import sys
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import cache
from app.login_info import LoginInformation, LoginState, logged_in
from app.routes import favorites


@pytest.fixture
def client():
    app = FastAPI()
    favorites.register_to_app(app)
    app.add_middleware(cache.CacheControlMiddleware)
    app.dependency_overrides[logged_in] = lambda: LoginInformation(
        state=LoginState.LOGGED_IN,
        user=SimpleNamespace(id=1),
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


def test_unauthenticated_favorites_route_is_private(client):
    def reject_login():
        raise HTTPException(status_code=401, detail="not_logged_in")

    client.app.dependency_overrides[logged_in] = reject_login
    response = client.get("/favorites")

    assert response.status_code == 401
    assert response.json() == {"detail": "not_logged_in"}
    assert response.headers["Cache-Control"] == "private"
