import asyncio
import time
from unittest.mock import AsyncMock

import orjson
import pytest
from pydantic import BaseModel

from app import cache


class CachedItem(BaseModel):
    name: str


@pytest.fixture
def redis(monkeypatch):
    store = AsyncMock()
    store.get.return_value = None
    monkeypatch.setattr(cache.database, "get_redis", AsyncMock(return_value=store))
    return store


@pytest.mark.parametrize("stale", [False, True])
def test_invalid_cached_integer_is_recomputed(redis, stale):
    redis.get.return_value = orjson.dumps(
        {"value": "not an integer", "created_at": time.time(), "is_stale": stale}
    )
    calls = 0

    @cache.cached()
    async def count() -> int:
        nonlocal calls
        calls += 1
        return 7

    assert asyncio.run(count()) == 7
    assert calls == 1
    assert orjson.loads(redis.setex.call_args.args[2])["value"] == 7


def test_cached_optional_model_list_is_reconstructed(redis):
    @cache.cached()
    async def items() -> list[CachedItem] | None:
        return [CachedItem(name="Example")]

    assert asyncio.run(items()) == [CachedItem(name="Example")]
    redis.get.return_value = redis.setex.call_args.args[2]
    redis.setex.reset_mock()

    result = asyncio.run(items())
    assert result == [CachedItem(name="Example")]
    assert result is not None
    assert isinstance(result[0], CachedItem)
    redis.setex.assert_not_awaited()


def test_valid_stale_model_is_returned_when_refresh_fails(redis):
    redis.get.return_value = orjson.dumps(
        {"value": {"name": "Existing"}, "created_at": 1, "is_stale": True}
    )
    redis.set.return_value = True

    @cache.cached()
    async def item() -> CachedItem:
        raise RuntimeError("Backend unavailable")

    assert asyncio.run(item()) == CachedItem(name="Existing")


def test_cached_forward_annotation_is_resolved(redis):
    redis.get.return_value = orjson.dumps(
        {"value": {"name": "Existing"}, "created_at": time.time()}
    )

    @cache.cached()
    async def item() -> "CachedItem":
        raise AssertionError("A valid cache hit must not recompute")

    assert asyncio.run(item()) == CachedItem(name="Existing")
