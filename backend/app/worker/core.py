import dramatiq
import dramatiq.brokers.redis
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from ..config import settings

if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.dramatiq import DramatiqIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment="production",
        integrations=[DramatiqIntegration()],
    )

broker = dramatiq.brokers.redis.RedisBroker(
    host=settings.redis_host, port=settings.redis_port, db=1
)
dramatiq.set_broker(broker)

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class WorkerDB:
    """Database context manager for worker tasks."""

    def __init__(self):
        self._session = None

    @property
    def session(self) -> Session:
        return self._session

    def __enter__(self):
        self._session = SessionLocal()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._session.close()
