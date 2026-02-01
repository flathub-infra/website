from contextlib import contextmanager
from typing import Literal

import orjson
import redis.asyncio as aioredis
from sqlalchemy import create_engine, or_
from sqlalchemy.orm import Session, sessionmaker

from . import config, models
from .db_session import DBSession

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.Redis(
            host=config.settings.redis_host,
            port=config.settings.redis_port,
            db=config.settings.redis_db,
            decode_responses=True,
        )
    return _redis


async def close_redis():
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


writer_engine = create_engine(
    config.settings.database_url,
    pool_size=4,
    max_overflow=0,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000",
    },
)

replica_engine = create_engine(
    config.settings.database_replica_url,
    pool_size=4,
    max_overflow=0,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "connect_timeout": 10,
        "options": "-c statement_timeout=30000",
    },
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
                .filter(models.App.is_eol)
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

    from .worker.redis import redis_conn

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
