from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def endpoint_app(monkeypatch):
    # Route imports initialize the Meilisearch client; keep these HTTP tests
    # independent of a running search service.
    with patch("meilisearch.Client"):
        from app.routes import apps, favorites, oidc, stats

    app = FastAPI()
    apps.register_to_app(app)
    favorites.register_to_app(app)
    oidc.register_to_app(app)
    stats.register_to_app(app)

    redis = AsyncMock()
    redis.get.return_value = None
    monkeypatch.setattr(apps.database, "get_redis", AsyncMock(return_value=redis))

    return app, apps, favorites, oidc, stats


@pytest.fixture
def client(endpoint_app):
    with TestClient(endpoint_app[0]) as test_client:
        yield test_client
