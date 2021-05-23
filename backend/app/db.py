import json
import time

import redis
import redisearch

from . import config

redis_conn = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    decode_responses=True,
)

redis_search = redisearch.Client("apps_search", conn=redis_conn)


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


def initialize():
    apps = redis_conn.smembers("apps:index")
    if not apps:
        try:
            definition = redisearch.IndexDefinition(prefix=["fts:"])
            redis_search.create_index(
                (
                    redisearch.TextField("id"),
                    redisearch.TextField("name"),
                    redisearch.TextField("summary"),
                    redisearch.TextField("description", 0.2),
                    redisearch.TextField("keywords"),
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

    # This seems to confuse redisearch too
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
    ]
    for char in reserved_chars:
        userquery = userquery.replace(char, "")

    # TODO: should input be sanitized here?
    name_query = redisearch.Query(f"@name:'{userquery}'").no_content()
    generic_query = redisearch.Query(userquery).no_content()

    # TODO: Backend API doesn't support paging so bring fifty results
    # instead of just 10, which is the redisearch default
    name_query.paging(0, 50)
    generic_query.paging(0, 50)

    search_results = redis_search.search(name_query)
    for doc in search_results.docs:
        results.append(doc.id)

    search_results = redis_search.search(generic_query)
    for doc in search_results.docs:
        results.append(doc.id)

    # redisearch does not support fuzzy search for non-alphabet strings
    if not len(results):
        if userquery.isalpha():
            query = redisearch.Query(f"%{userquery}%").no_content()
            search_results = redis_search.search(query)

            for doc in search_results.docs:
                results.append(doc.id)
        else:
            return None

    return list(dict.fromkeys(results))


def get_json_key(key: str):
    if value := redis_conn.get(key):
        return json.loads(value)

    return None
