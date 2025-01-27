from contextlib import contextmanager
from typing import Literal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from . import config

writer_engine = create_engine(
    config.settings.database_url,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)

replica_engine = create_engine(
    config.settings.database_replica_url,
    poolclass=QueuePool,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,
)

WriterSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=writer_engine)
ReplicaSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=replica_engine
)


class DBSession:
    def __init__(self, session: Session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    @property
    def session(self):
        return self._session


@contextmanager
def get_db(db_type: Literal["writer", "replica"] = "replica"):
    SessionClass = WriterSessionLocal if db_type == "writer" else ReplicaSessionLocal
    db = SessionClass()
    try:
        yield DBSession(db)
        if db_type == "writer":
            db.commit()
    finally:
        db.close()


def get_db_session(db_type: Literal["writer", "replica"] = "replica") -> Session:
    return WriterSessionLocal() if db_type == "writer" else ReplicaSessionLocal()


class DBSessionMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        with get_db("replica") as db:
            scope["state"]["db"] = db
            await self.app(scope, receive, send)


db = ReplicaSessionLocal()
