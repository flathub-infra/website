import time

import orjson
import redis

from . import config, schemas

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
        except:
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


def get_categories():
    return {category for category in redis_conn.smembers("categories:index")}


def get_app_count(type: schemas.Type = schemas.Type.Desktop) -> int:
    if type == schemas.Type.All:
        return redis_conn.scard("apps:index")
    else:
        return redis_conn.scard(f"types:{type.value}")


def get_developers():
    return {developer for developer in redis_conn.smembers("developers:index")}


def get_project_groups():
    return {
        project_group for project_group in redis_conn.smembers("projectgroups:index")
    }
