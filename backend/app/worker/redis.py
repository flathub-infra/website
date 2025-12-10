import redis

from .. import config

redis_conn = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    db=config.settings.redis_db,
    decode_responses=True,
)


def invalidate_cache_by_pattern(pattern: str) -> int:
    """Sync cache invalidation for Dramatiq workers."""
    try:
        deleted_count = 0
        cursor = 0
        while True:
            cursor, keys = redis_conn.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                deleted_count += redis_conn.delete(*keys)
            if cursor == 0:
                break
        return deleted_count
    except Exception as e:
        print(f"Cache invalidation error for pattern {pattern}: {e}")
        return 0
