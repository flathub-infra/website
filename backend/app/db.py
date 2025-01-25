import time

import orjson
import redis
from sqlalchemy import or_

from . import config, models
from .database import get_db, get_db_session

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
    if value := redis_conn.get(key):
        return orjson.loads(value)

    return None


def get_developers():
    with get_db_session() as sqldb:
        return {developer.name for developer in models.Developers.all(sqldb)}


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
        app_type = (
            sqldb.query(models.App.type).filter(models.App.app_id == app_id).scalar()
        )

    if app_type == "desktop-application":
        return True

    if app_type == "console-application":
        app_data = get_json_key(f"apps:{app_id}")
        if app_data and app_data.get("icon") and app_data.get("screenshots"):
            return True

    return False
