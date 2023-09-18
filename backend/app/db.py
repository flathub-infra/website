import time

import orjson
import redis

from . import config

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


def search_by_key(key: str):
    if value := list(redis_conn.scan_iter(f"{key}")):
        return value

    return []


def get_json_key(key: str):
    if value := redis_conn.get(key):
        return orjson.loads(value)

    return None


def get_developers():
    return {developer for developer in redis_conn.smembers("developers:index")}


def get_project_groups():
    return {
        project_group for project_group in redis_conn.smembers("projectgroups:index")
    }


def get_all_appids_for_frontend():
    return {
        appid[5:]
        for appid in redis_conn.smembers("apps:index")
        if is_appid_for_frontend(appid[5:])
    }


# keep in sync with show_in_frontend
def is_appid_for_frontend(appid: str):
    if redis_conn.sismember("types:desktop", f"apps:{appid}"):
        return True

    if redis_conn.sismember("types:desktop-application", f"apps:{appid}"):
        return True

    # get app from redis
    if app := get_json_key(f"apps:{appid}"):
        if (
            app.get("type") == "console-application"
            and app.get("icon")
            and app.get("screenshots")
        ):
            return True

    return False
