import redis
import redisearch

from . import config

redis_conn = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    decode_responses=True,
)

redis_search = redisearch.Client("apps_search", conn=redis_conn)
