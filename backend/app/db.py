import json
import time

import redis
from redis.commands.search.field import TextField
from redis.commands.search.indexDefinition import IndexDefinition
from redis.commands.search.query import Query

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
        except:
            retry_no += 1
            sleep = 5 * retry_no
            time.sleep(sleep)
            retries -= 1

    if retries == 0:
        raise redis.exceptions.ConnectionError


def initialize():
    apps = redis_conn.smembers("apps:index")
    if not apps:
        try:
            definition = IndexDefinition(prefix=["fts:"])
            redis_conn.ft().create_index(
                (
                    TextField("id"),
                    TextField("name"),
                    TextField("summary"),
                    TextField("description", weight=0.2),
                    TextField("keywords"),
                ),
                definition=definition,
            )
        except:
            pass


def search(userquery: str):
    results = []

    # TODO: figure out how to escape dashes
    # "D-Feet" seems to be interpreted as "d and not feet"
    userquery = userquery.replace("-", " ")

    # This seems to confuse redis too
    userquery = userquery.replace(".*", "*")

    # Remove reserved characters
    reserved_chars = [
        "@",
        "!",
        "{",
        "}",
        "(",
        ")",
        "|",
        "-",
        "=",
        ">",
        "[",
        "]",
        ":",
        ";",
        "*",
    ]
    for char in reserved_chars:
        userquery = userquery.replace(char, "")

    if len(userquery.strip()) == 0:
        return None

    # TODO: should input be sanitized here?
    name_query = Query(f"@name:'{userquery}'").no_content()
    generic_query = Query(userquery).no_content()

    # TODO: Backend API doesn't support paging so bring fifty results
    # instead of just 10, which is the redis default
    name_query.paging(0, 50)
    generic_query.paging(0, 50)

    search_results = redis_conn.ft().search(name_query)
    for doc in search_results.docs:
        results.append(doc.id)

    search_results = redis_conn.ft().search(generic_query)
    for doc in search_results.docs:
        results.append(doc.id)

    # redis does not support fuzzy search for non-alphabet strings
    if not len(results):
        if userquery.isalpha():
            query = Query(f"%{userquery}%").no_content()
            search_results = redis_conn.ft().search(query)

            for doc in search_results.docs:
                results.append(doc.id)
        else:
            return None

    return list(dict.fromkeys(results))


def get_json_key(key: str):
    if value := redis_conn.get(key):
        return json.loads(value)

    return None


def get_app_count() -> int:
    return redis_conn.scard("types:desktop") + redis_conn.scard(
        "types:console-application"
    )


def get_developers():
    return {developer for developer in redis_conn.smembers("developers:index")}
