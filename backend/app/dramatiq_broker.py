import dramatiq
import dramatiq.brokers.redis

from .config import settings

broker = dramatiq.brokers.redis.RedisBroker(
    host=settings.redis_host, port=settings.redis_port, db=1
)

dramatiq.set_broker(broker)
