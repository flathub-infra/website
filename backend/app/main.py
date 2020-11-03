import sentry_sdk

from functools import lru_cache
from typing import Tuple

from fastapi import status, Response, BackgroundTasks, FastAPI
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from . import config
from . import utils
from . import feeds
from . import apps
from . import flatpak

app = FastAPI()
if config.settings.sentry_dsn:
    sentry_sdk.init(dsn=config.settings.sentry_dsn, traces_sample_rate=0.01)
    app.add_middleware(SentryAsgiMiddleware)


@app.on_event("startup")
def startup_event():
    flatpak.initialize()
    apps.initialize()


@app.post("/v1/apps/update")
def update_apps(background_tasks: BackgroundTasks):
    return apps.update_apps(background_tasks)


# TODO: should be optimized/cached, it's fairly slow at 23 req/s
@app.get("/v1/apps")
@lru_cache()
def list_apps_summary(
    index: str = "apps:index", appids: Tuple[str, ...] = None, sort: bool = True
):
    ret = apps.list_apps_summary(index, appids, sort)
    list_apps_summary.cache_clear()
    get_recently_updated.cache_clear()
    return ret


@app.get("/v1/apps/category/{category}")
def list_apps_in_category(category: str):
    return list_apps_summary(f"categories:{category}")


@app.get("/v1/apps/{appid}", status_code=status.HTTP_200_OK)
def get_app(appid: str, response: Response):
    app = apps.get_app(appid)
    if not app:
        response.status_code = status.HTTP_204_NO_CONTENT
        return response
    return app


@app.get("/v1/appstream/{appid}")
def get_appid_appstream(appid: str, repo: str = "stable"):
    return apps.get_appid_appstream(appid, repo)


@app.get("/v1/apps/search/{userquery}")
def search(userquery: str):
    return apps.search(userquery)


@app.get("/v1/apps/collection/recently-updated")
@app.get("/v1/apps/collection/recently-updated/{limit}")
@lru_cache()
def get_recently_updated(limit: int = 100):
    return apps.get_recently_updated(limit)


@app.get("/v1/feed/recently-updated")
def get_recently_updated_apps_feed():
    return Response(
        content=feeds.get_recently_updated_apps_feed(), media_type="application/rss+xml"
    )


@app.get("/v1/feed/new")
def get_new_apps_feed():
    return Response(content=feeds.get_new_apps_feed(), media_type="application/rss+xml")


@app.get("/status", status_code=200)
def healthcheck(response: Response):
    # redis_status = redis_conn.ping()
    # if not redis_status:
    #     response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    #     return {"status": "REDIS_DOWN"}

    return {"status": "OK"}
