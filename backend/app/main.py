import sentry_sdk

from functools import lru_cache

from fastapi import Response, BackgroundTasks, FastAPI
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from . import config
from . import feeds
from . import apps
from . import schemas
from . import picks
from . import db
from . import summary

app = FastAPI()
if config.settings.sentry_dsn:
    sentry_sdk.init(dsn=config.settings.sentry_dsn, traces_sample_rate=0.01)
    app.add_middleware(SentryAsgiMiddleware)


@app.on_event("startup")
def startup_event():
    db.initialize()


@app.post("/update")
def update(background_tasks: BackgroundTasks):
    new_apps = apps.load_appstream()
    summary.update()
    picks.update()

    if new_apps:
        new_apps_zset = {}
        for appid in new_apps:
            if metadata := db.get_json_key(f"summary:{appid}"):
                new_apps_zset[appid] = metadata.get("timestamp", 0)
        db.redis_conn.zadd("new_apps_zset", new_apps_zset)

    list_apps_in_category.cache_clear()
    get_recently_updated.cache_clear()


# TODO: should be paginated
@lru_cache()
@app.get("/category/{category}")
def list_apps_in_category(category: schemas.Category):
    return apps.list_apps_summary(f"categories:{category}", appids=None, sort=True)


@app.get("/appstream")
def list_appstream():
    return apps.list_appstream()


@app.get("/appstream/{appid}", status_code=200)
def get_appstream(appid: str, response: Response):
    if value  := db.get_json_key(f"apps:{appid}"):
        return value

    response.status_code = 404
    return None


@app.get("/search/{userquery}")
def search(userquery: str):
    results = db.search(userquery)
    if results:
        appids = tuple(doc_id.replace("fts", "apps") for doc_id in results)
        return apps.list_apps_summary(appids=appids, sort=False)
    else:
        return []


@app.get("/collection/recently-updated")
@app.get("/collection/recently-updated/{limit}")
@lru_cache()
def get_recently_updated(limit: int = 100):
    return apps.get_recently_updated(limit)


@app.get("/picks/{pick}")
def get_picks(pick: str):
    return picks.get_pick(pick)


@app.get("/feed/recently-updated")
def get_recently_updated_apps_feed():
    return Response(
        content=feeds.get_recently_updated_apps_feed(), media_type="application/rss+xml"
    )


@app.get("/feed/new")
def get_new_apps_feed():
    return Response(content=feeds.get_new_apps_feed(), media_type="application/rss+xml")


@app.get("/status", status_code=200)
def healthcheck(response: Response):
    return {"status": "OK"}


@app.get("/summary/{appid}", status_code=200)
def get_summary(appid: str, response: Response):
    if value := db.get_json_key(f"summary:{appid}"):
        return value

    response.status_code = 404
    return None
