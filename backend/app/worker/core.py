import dramatiq
import dramatiq.brokers.redis

from ..config import settings

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.dramatiq import DramatiqIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment="production",
        integrations=[DramatiqIntegration()],
    )

import os

broker = dramatiq.brokers.redis.RedisBroker(
    host=settings.redis_host, port=settings.redis_port, db=1
)

if os.getenv("MEMRAY_PROFILING", "").lower() == "true":
    from .profiling import MemrayMiddleware

    broker.add_middleware(MemrayMiddleware())

dramatiq.set_broker(broker)
