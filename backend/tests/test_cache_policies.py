import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from collections.abc import Iterator
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from fastapi.testclient import TestClient
from starlette.requests import Request

from app import cache


class CustomError(Exception):
    pass


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = FastAPI()

    def requires_auth() -> str:
        raise HTTPException(status_code=401, detail="unauthorized")

    @app.exception_handler(CustomError)
    def handle_custom_error(_request: Request, _exc: CustomError):
        return JSONResponse(
            {"detail": "custom"},
            status_code=418,
            headers={"X-Error": "yes"},
        )

    @app.get("/private")
    @cache.private
    def private_response():
        response = Response(content="private", headers={"X-Test": "yes"})
        response.raw_headers.extend(
            [
                (b"cache-control", b"public"),
                (b"cache-control", b"max-age=60"),
            ]
        )
        return response

    @app.get("/no-store")
    @cache.no_store
    def no_store_response():
        return Response(
            content="no-store",
            headers={"Cache-Control": "public", "Pragma": "custom"},
        )

    @app.get("/dependency")
    @cache.private
    def dependency_response(
        _value: Annotated[str, Depends(requires_auth)],
    ):
        return {"ok": True}

    @app.get("/validation")
    @cache.private
    def validation_response(value: int):
        return {"value": value}

    @app.get("/redirect")
    @cache.no_store
    def redirect_response():
        return RedirectResponse("/destination", status_code=307)

    @app.get("/stream")
    @cache.private
    def stream_response():
        return StreamingResponse(iter([b"one", b"two"]), media_type="text/plain")

    @app.get("/custom")
    @cache.no_store
    def custom_response():
        raise CustomError

    @app.get("/error")
    @cache.no_store
    def error_response():
        raise RuntimeError("failure")

    @app.get("/public")
    def public_response():
        return Response(
            content="public",
            headers={"Cache-Control": "public, max-age=60", "X-Test": "yes"},
        )

    @app.get("/cached")
    @cache.private
    @cache.cached()
    async def cached_response():
        return {"ok": True}

    with TestClient(
        cache.CacheControlMiddleware(app), raise_server_exceptions=False
    ) as client_:
        yield client_


def test_private_replaces_cache_control_and_preserves_other_headers(client):
    response = client.get("/private")

    assert response.status_code == 200
    assert response.text == "private"
    assert response.headers.get_list("cache-control") == ["private"]
    assert "pragma" not in response.headers
    assert response.headers["x-test"] == "yes"


def test_no_store_replaces_cache_control_and_sets_pragma(client):
    response = client.get("/no-store")

    assert response.status_code == 200
    assert response.text == "no-store"
    assert response.headers.get_list("cache-control") == ["no-store"]
    assert response.headers["pragma"] == "no-cache"


def test_markers_cover_dependency_and_validation_errors(client):
    dependency_response = client.get("/dependency")
    validation_response = client.get("/validation")

    assert dependency_response.status_code == 401
    assert dependency_response.headers["cache-control"] == "private"
    assert validation_response.status_code == 422
    assert validation_response.headers["cache-control"] == "private"


def test_markers_cover_redirect_stream_and_custom_exception(client):
    redirect_response = client.get("/redirect", follow_redirects=False)
    stream_response = client.get("/stream")
    custom_response = client.get("/custom")

    assert redirect_response.status_code == 307
    assert redirect_response.headers["location"] == "/destination"
    assert redirect_response.headers["cache-control"] == "no-store"
    assert redirect_response.headers["pragma"] == "no-cache"
    assert stream_response.status_code == 200
    assert stream_response.text == "onetwo"
    assert stream_response.headers["cache-control"] == "private"
    assert custom_response.status_code == 418
    assert custom_response.json() == {"detail": "custom"}
    assert custom_response.headers["cache-control"] == "no-store"
    assert custom_response.headers["pragma"] == "no-cache"
    assert custom_response.headers["x-error"] == "yes"


def test_outer_middleware_covers_generated_server_error(client):
    response = client.get("/error")

    assert response.status_code == 500
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"


def test_unmarked_responses_and_unmatched_routes_are_unchanged(client):
    public_response = client.get("/public")
    missing_response = client.get("/missing")

    assert public_response.status_code == 200
    assert public_response.headers["cache-control"] == "public, max-age=60"
    assert public_response.headers["x-test"] == "yes"
    assert "pragma" not in public_response.headers
    assert missing_response.status_code == 404
    assert "cache-control" not in missing_response.headers


def test_cached_wrapper_retains_policy_metadata():
    endpoint = cache.private(cache.cached()(lambda: None))

    assert getattr(endpoint, cache.CACHE_CONTROL_POLICY) == ("private", None)
