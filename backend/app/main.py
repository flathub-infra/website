import sentry_sdk

from functools import lru_cache

from fastapi import status, Response, BackgroundTasks, FastAPI
from sentry_sdk.integrations.asgi import SentryAsgiMiddleware

from . import config
from . import feeds
from . import apps
from . import schemas
from . import picks
from . import utils
from . import flatpak

app = FastAPI()
if config.settings.sentry_dsn:
    sentry_sdk.init(dsn=config.settings.sentry_dsn, traces_sample_rate=0.01)
    app.add_middleware(SentryAsgiMiddleware)


@app.on_event("startup")
def startup_event():
    flatpak.Flatpak()
    apps.initialize()


@app.post("/update")
def update_apps(background_tasks: BackgroundTasks):
    ret = apps.update_apps(background_tasks)
    picks.update()

    list_apps_in_category.cache_clear()
    get_recently_updated.cache_clear()

    return ret


# TODO: should be paginated
@lru_cache()
@app.get("/category/{category}")
def list_apps_in_category(category: schemas.Category):
    return apps.list_apps_summary(f"categories:{category}", appids=None, sort=True)


@app.get("/appstream/{appid}")
def get_appid_appstream(appid: str, repo: str = "stable"):
    return apps.get_appid_appstream(appid, repo)


@app.get("/updated_at/{appid}")
def get_updated_at(appid: str):
    return apps.get_updated_at(appid)


@app.get("/search/{userquery}")
def search(userquery: str):
    return apps.search(userquery)


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
