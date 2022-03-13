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
    try:
        definition = IndexDefinition(prefix=["fts:"])
        redis_conn.ft().create_index(
            (
                TextField("id"),
                TextField("name"),
                TextField("summary"),
                TextField("description"),
                TextField("keywords"),
            ),
            definition=definition,
        )
    except:
        pass


def search(search_term: str):
    results = []

    # TODO: figure out how to escape dashes
    # "D-Feet" seems to be interpreted as "d and not feet"
    search_term = search_term.replace("-", " ")

    # This seems to confuse redis too
    search_term = search_term.replace(".*", "*")

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
        search_term = search_term.replace(char, "")

    if len(search_term.strip()) == 0:
        return None

    # TODO: should input be sanitized here?
    generic_query = Query(build_query(f"{search_term}*")).no_content()

    # TODO: Backend API doesn't support paging so bring twohundredfifty results
    # instead of just 10, which is the redis default
    generic_query.paging(0, 250)

    search_results = redis_conn.ft().search(generic_query)
    for doc in search_results.docs:
        results.append(doc.id)

    # redis does not support fuzzy search for non-alphabet strings
    if not len(results):
        if search_term.isalpha():
            query = Query(build_query(f"%{search_term}%")).no_content()
            search_results = redis_conn.ft().search(query)

            for doc in search_results.docs:
                results.append(doc.id)
        else:
            return None

    return results


def build_query(search_term: str):
    return f"""
       (
      (@id:({search_term})) => {{ $weight: 1 }}
      |
      (@name:({search_term})) => {{ $weight: 2 }}
      |
      (@summary:({search_term})) => {{ $weight: 0.5 }}
      |
      (@description:({search_term})) => {{ $weight: 0.2 }}
      |
      (@keywords:({search_term})) => {{ $weight: 0.8 }}
    )
    """


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
