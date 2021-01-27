import redis
import redisearch

from . import config

redis_conn = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    decode_responses=True,
)

redis_search = redisearch.Client("apps_search", conn=redis_conn)


def initialize():
    apps = redis_conn.smembers("apps:index")
    if not apps:
        try:
            redis_search.create_index(
                [
                    redisearch.TextField("appid"),
                    redisearch.TextField("name"),
                    redisearch.TextField("summary"),
                    redisearch.TextField("description", 0.2),
                    redisearch.TextField("keywords"),
                ]
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
    reserved_chars = ["@", "!", "{", "}", "(", ")", "|", "-", "=", ">", "[", "]", ":", ";"]
    for char in reserved_chars:
        userquery = userquery.replace(char, "")

    # TODO: should input be sanitized here?
    name_query = redisearch.Query(f"@name:'{userquery}'").no_content()

    # redisearch does not support fuzzy search for non-alphabet strings
    if userquery.isalpha():
        generic_query = redisearch.Query(f"%{userquery}%").no_content()
    else:
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

    if not len(results):
        return None

    return list(dict.fromkeys(results))
