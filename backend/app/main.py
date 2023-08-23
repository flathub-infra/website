import sentry_sdk
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from . import (
    apps,
    compat,
    config,
    db,
    emails,
    feeds,
    invites,
    logins,
    moderation,
    purchases,
    schemas,
    search,
    stats,
    utils,
    vending,
    verification,
    wallet,
    worker,
)

if config.settings.sentry_dsn:
    sentry_sdk.init(
        dsn=config.settings.sentry_dsn,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        environment="production",
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
    )

app = FastAPI(title=config.settings.app_name, default_response_class=ORJSONResponse)

origins = config.settings.cors_origins.split(" ")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

emails.register_to_app(app)
logins.register_to_app(app)
moderation.register_to_app(app)
wallet.register_to_app(app)
vending.register_to_app(app)

verification.register_to_app(app)
purchases.register_to_app(app)
invites.register_to_app(app)

compat.register_to_app(app)


@app.on_event("startup")
def startup_event():
    db.wait_for_redis()


@app.post("/update")
async def update():
    worker.update.send()


@app.post("/update/stats")
async def update_stats():
    worker.update_stats.send()


@app.post("/update/process-pending-transfers")
def process_transfers():
    """
    Process any pending transfers which may be in the system
    """
    wallet.Wallet().perform_pending_transfers()
    return Response(None, status_code=200)


@app.get("/categories")
def get_categories():
    return [category.value for category in schemas.MainCategory]


@app.get("/category/{category}")
def get_category(
    category: schemas.MainCategory,
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_selected_categories([category], page, per_page)

    return result


@app.get("/category/{category}/subcategories/{subcategory}")
def get_subcategory(
    category: schemas.MainCategory,
    subcategory: str,
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_selected_category_and_subcategory(
        category, subcategory, page, per_page
    )

    return result


@app.get("/developer")
def get_developers():
    return db.get_developers()


@app.get("/developer/{developer:path}")
def get_developer(
    developer: str,
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_developer(developer, page, per_page)

    return result


@app.get("/eol/rebase")
def get_eol_rebase():
    return db.get_json_key("eol_rebase")


@app.get("/eol/rebase/{appid}")
def get_eol_rebase_appid(
    appid: str,
):
    if value := db.get_json_key(f"eol_rebase:{appid}"):
        return value


@app.get("/eol/message")
def get_eol_message():
    return db.get_json_key("eol_message")


@app.get("/eol/message/{appid}")
def get_eol_message_appid(
    appid: str,
):
    if value := db.get_json_key(f"eol_message:{appid}"):
        return value


@app.get("/projectgroup")
def get_project_groups():
    return db.get_project_groups()


@app.get("/projectgroup/{project_group}")
def get_project_group(
    project_group: str,
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_project_group(project_group, page, per_page)

    return result


@app.get("/appstream")
def list_appstream():
    return apps.list_desktop_appstream()


@app.get("/appstream/{appid}", status_code=200)
def get_appstream(appid: str, response: Response):
    if value := db.get_json_key(f"apps:{appid}"):
        return value

    response.status_code = 404
    return None


@app.post("/search")
def post_search(query: search.SearchQuery):
    return search.search_apps_post(query)


@app.get("/runtimes")
def get_runtime_list():
    return search.get_runtime_list()


@app.get("/collection/recently-updated")
def get_recently_updated(
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_updated_at(page, per_page)

    return result


@app.get("/collection/recently-added")
def get_recently_added(
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_added_at(page, per_page)

    return result


@app.get("/collection/verified")
def get_verified(
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_verified(page, per_page)

    return result


@app.get("/popular/last-month")
def get_popular_last_month(
    page: int = None,
    per_page: int = None,
    response: Response = Response,
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_installs_last_month(page, per_page)

    return result


@app.get("/feed/recently-updated")
def get_recently_updated_apps_feed():
    return Response(
        content=feeds.get_recently_updated_apps_feed(), media_type="application/rss+xml"
    )


@app.get("/feed/new")
def get_new_apps_feed():
    return Response(content=feeds.get_new_apps_feed(), media_type="application/rss+xml")


@app.get("/status", status_code=200)
def healthcheck():
    return {"status": "OK"}


@app.get("/stats", status_code=200)
def get_stats(response: Response):
    if value := db.get_json_key("stats"):
        return value

    response.status_code = 404
    return None


@app.get("/stats/{appid}", status_code=200)
def get_stats_for_app(appid: str, response: Response, all=False, days: int = 180):
    if value := stats.get_installs_by_ids([appid]).get(appid, None):
        if all:
            return value

        if per_day := value.get("installs_per_day"):
            requested_dates = list(per_day.keys())[-days:]
            requested_per_day = {date: per_day[date] for date in requested_dates}
            value["installs_per_day"] = requested_per_day
            return value

    response.status_code = 404
    return None


@app.get("/summary/{appid}", status_code=200)
def get_summary(appid: str, response: Response):
    if value := db.get_json_key(f"summary:{appid}"):
        return value

    response.status_code = 404
    return None


@app.get("/platforms", status_code=200)
def get_platforms() -> dict[str, utils.Platform]:
    """
    Return a mapping from org-name to platform aliases and dependencies which are
    recognised by the backend.  These are used by things such as the transactions
    and donations APIs to address amounts to the platforms.
    """
    return utils.PLATFORMS


@app.get("/exceptions")
def get_exceptions():
    return db.get_json_key("exc")


@app.get("/exceptions/{appid}")
def get_exceptions_for_app(appid: str, response: Response):
    if exc := db.get_json_key(f"exc:{appid}"):
        return exc

    response.status_code = 404
    return None


@app.get("/addon/{appid}")
def get_addons(appid: str):
    addon_ids = apps.get_addons(appid)

    return addon_ids
