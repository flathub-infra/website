import asyncio
from unittest.mock import AsyncMock

import pytest
from redis.exceptions import ConnectionError

from app import database


def test_redis_pool_waits_for_released_connection(monkeypatch):
    monkeypatch.setattr(database, "_redis", None)

    async def run():
        redis = await database.get_redis()
        pool = redis.connection_pool
        monkeypatch.setattr(pool, "ensure_connection", AsyncMock())
        connections = []
        waiting = None
        try:
            assert pool.max_connections == 100
            for _ in range(pool.max_connections):
                connections.append(await pool.get_connection())

            waiting = asyncio.create_task(pool.get_connection())
            await asyncio.sleep(0)
            assert not waiting.done()

            released = connections.pop()
            await pool.release(released)
            connection = await asyncio.wait_for(waiting, timeout=1)
            connections.append(connection)
            assert connection is released
        finally:
            if waiting is not None:
                waiting.cancel()
                await asyncio.gather(waiting, return_exceptions=True)
            for connection in connections:
                await pool.release(connection)
            await database.close_redis()

    asyncio.run(run())


def test_redis_pool_wait_has_a_timeout(monkeypatch):
    monkeypatch.setattr(database, "_redis", None)

    async def run():
        redis = await database.get_redis()
        pool = redis.connection_pool
        monkeypatch.setattr(pool, "ensure_connection", AsyncMock())
        connections = []
        try:
            assert pool.timeout == 1
            pool.timeout = 0.01
            for _ in range(pool.max_connections):
                connections.append(await pool.get_connection())
            with pytest.raises(ConnectionError, match="No connection available"):
                await asyncio.wait_for(pool.get_connection(), timeout=1)
        finally:
            for connection in connections:
                await pool.release(connection)
            await database.close_redis()

    asyncio.run(run())


def test_redis_client_owns_and_closes_its_pool(monkeypatch):
    monkeypatch.setattr(database, "_redis", None)

    async def run():
        redis = await database.get_redis()
        assert await database.get_redis() is redis
        disconnect = AsyncMock()
        monkeypatch.setattr(redis.connection_pool, "disconnect", disconnect)

        await database.close_redis()

        disconnect.assert_awaited_once()
        assert database._redis is None

    asyncio.run(run())
