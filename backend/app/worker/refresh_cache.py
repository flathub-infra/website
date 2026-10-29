import asyncio

import dramatiq

from .. import cache, database


async def _refresh_cache_impl():
    try:
        await cache.mark_stale_by_pattern("cache:endpoint:*")
    finally:
        await database.close_redis()


@dramatiq.actor(queue_name="slow", time_limit=1000 * 60 * 60)
def refresh_cache():
    asyncio.run(_refresh_cache_impl())
