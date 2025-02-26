import time

import orjson
import redis
from sqlalchemy import or_

from . import config, models
from .database import get_db

redis_conn = redis.Redis(
    db=config.settings.redis_db,
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    decode_responses=True,
)


def wait_for_redis():
    retries = 5
    retry_no = 0

    while retries != 0:
        try:
            if redis_conn.ping():
                break
            else:
                raise redis.exceptions.ConnectionError
        except redis.exceptions.ConnectionError:
            retry_no += 1
            sleep = 5 * retry_no
            time.sleep(sleep)
            retries -= 1

    if retries == 0:
        raise redis.exceptions.ConnectionError


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

    if key.startswith("eol_message:"):
        parts = key.split(":")
        if len(parts) > 1:
            app_id = parts[1]
            with get_db() as sqldb:
                is_eol = models.App.get_eol_data(sqldb, app_id)
                if is_eol:
                    return "This application is end-of-life."
                return None

    if value := redis_conn.get(key):
        return orjson.loads(value)

    return None


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
