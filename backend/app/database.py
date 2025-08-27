from contextlib import contextmanager
from typing import Literal

import orjson
import redis
from sqlalchemy import create_engine, or_
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import QueuePool

from . import config, models
from .db_session import DBSession

redis_conn = redis.Redis(
    db=config.settings.redis_db,
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    decode_responses=True,
)

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


def get_json_key(key: str):
    if key.startswith("apps:"):
        app_id = key.split(":")[1]
        with get_db() as sqldb:
            app_data = models.App.get_appstream(sqldb, app_id)
            return app_data

    if key == "exc":
        with get_db() as sqldb:
            return models.Exceptions.get_all_exceptions(sqldb)

    if key.startswith("exc:"):
        app_id = key.split(":")[1]
        with get_db() as sqldb:
            return models.Exceptions.get_exception(sqldb, app_id)

    if key.startswith("summary:") and not key.startswith("summary:reverse_lookup"):
        parts = key.split(":")
        app_id = parts[1]

        with get_db() as sqldb:
            app = models.App.by_appid(sqldb, app_id)
            if app and app.summary:
                if len(parts) > 2 and app.summary.get("branch") == parts[2]:
                    return app.summary
                elif len(parts) == 2:
                    return app.summary.get("branch", "stable")

    if key == "summary:reverse_lookup":
        with get_db() as sqldb:
            return models.AppExtensionLookup.get_all_mappings(sqldb)

    if key == "eol_rebase":
        with get_db() as sqldb:
            return models.AppEolRebase.get_all_rebases(sqldb)

    if key == "eol_message":
        with get_db() as sqldb:
            apps_with_eol_messages = (
                sqldb.query(models.App.app_id, models.App.eol_message)
                .filter(models.App.eol_message.isnot(None))
                .all()
            )
            return {app.app_id: app.eol_message for app in apps_with_eol_messages}

    if key.startswith("eol_rebase:"):
        parts = key.split(":")
        old_app_id = parts[1]
        with get_db() as sqldb:
            return models.AppEolRebase.get_new_app_id(sqldb, old_app_id)

    if key.startswith("eol_message:"):
        parts = key.split(":")
        if len(parts) > 1:
            app_id = parts[1]
            branch = parts[2] if len(parts) > 2 else None
            with get_db() as sqldb:
                is_eol = models.App.get_eol_data(sqldb, app_id, branch)
                if is_eol:
                    return (
                        models.App.get_eol_message(sqldb, app_id)
                        or "This application is end-of-life."
                    )
                return None

    if key.startswith("app_stats:"):
        app_id = key.split(":", 1)[1]
        with get_db() as sqldb:
            app_stats = models.AppStats.get_stats(sqldb, app_id)
            return app_stats.to_dict() if app_stats else None

    if value := redis_conn.get(key):
        return orjson.loads(value)

    return None


def bulk_set_app_stats(stats_dict: dict[str, dict]):
    """Bulk set app stats in PostgreSQL"""
    with get_db("writer") as sqldb:
        models.AppStats.bulk_set_stats(sqldb, stats_dict)


def get_all_appids_for_frontend():
    appids = []

    with get_db() as sqldb:
        apps = (
            sqldb.query(models.App.app_id, models.App.type)
            .filter(
                or_(
                    models.App.type == "desktop-application",
                    models.App.type == "console-application",
                )
            )
            .all()
        )

    for app in apps:
        if app.type == "desktop-application":
            appids.append(app.app_id)
        elif app.type == "console-application" and is_appid_for_frontend(app.app_id):
            appids.append(app.app_id)

    return appids


def is_appid_for_frontend(app_id: str):
    with get_db() as sqldb:
        app = sqldb.query(models.App).filter(models.App.app_id == app_id).first()

        if not app:
            return False

        if app.type == "desktop-application":
            return True

        if app.type == "console-application":
            app_data = app.appstream
            if app_data and app_data.get("icon") and app_data.get("screenshots"):
                return True

    return False
