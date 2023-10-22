from typing import Optional

import sentry_sdk
from fastapi import FastAPI, Path, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from . import (
    app_picks,
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
    quality_moderation,
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

app = FastAPI(
    title=config.settings.app_name,
    default_response_class=ORJSONResponse,
    root_path="/" if config.settings.env == "development" else "/api/v2",
)

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

quality_moderation.register_to_app(app)
app_picks.register_to_app(app)


@app.on_event("startup")
def startup_event():
    db.wait_for_redis()


@app.post("/update", tags=["update"])
async def update():
    worker.update.send()
    worker.update_quality_moderation.send()


@app.post("/update/stats", tags=["update"])
async def update_stats():
    worker.update_stats.send()


@app.post("/update/process-pending-transfers", tags=["update"])
def process_transfers():
    """
    Process any pending transfers which may be in the system
    """
    wallet.Wallet().perform_pending_transfers()
    return Response(None, status_code=200)


@app.get("/categories", tags=["app"])
def get_categories():
    return [category.value for category in schemas.MainCategory]


@app.get("/category/{category}", tags=["app"])
def get_category(
    category: schemas.MainCategory,
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_selected_categories([category], page, per_page)

    return result


@app.get("/category/{category}/subcategories/{subcategory}", tags=["app"])
def get_subcategory(
    category: schemas.MainCategory,
    subcategory: str,
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
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


@app.get("/developer", tags=["app"])
def get_developers():
    return db.get_developers()


@app.get("/developer/{developer:path}", tags=["app"])
def get_developer(
    developer: str,
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_developer(developer, page, per_page)

    return result


@app.get("/eol/rebase", tags=["app"])
def get_eol_rebase():
    return db.get_json_key("eol_rebase")


@app.get("/eol/rebase/{app_id}", tags=["app"])
def get_eol_rebase_appid(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    branch: str = "stable",
):
    if value := db.get_json_key(f"eol_rebase:{app_id}:{branch}"):
        return value


@app.get("/eol/message", tags=["app"])
def get_eol_message():
    return db.get_json_key("eol_message")


@app.get("/eol/message/{app_id}", tags=["app"])
def get_eol_message_appid(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    branch: str = "stable",
):
    if value := db.get_json_key(f"eol_message:{app_id}:{branch}"):
        return value


@app.get("/projectgroup", tags=["app"])
def get_project_groups():
    return db.get_project_groups()


@app.get("/projectgroup/{project_group}", tags=["app"])
def get_project_group(
    project_group: str,
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_project_group(project_group, page, per_page)

    return result


@app.get("/appstream", tags=["app"])
def list_appstream():
    return apps.list_desktop_appstream()


@app.get("/appstream/{app_id}", status_code=200, tags=["app"])
def get_appstream(
    response: Response,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    if value := db.get_json_key(f"apps:{app_id}"):
        return value

    response.status_code = 404
    return None


@app.post("/search", tags=["app"])
def post_search(query: search.SearchQuery):
    return search.search_apps_post(query)


@app.get("/runtimes", tags=["app"])
def get_runtime_list():
    return search.get_runtime_list()


@app.get("/collection/recently-updated", tags=["app"])
def get_recently_updated(
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_updated_at(page, per_page)

    return result


@app.get("/collection/recently-added", tags=["app"])
def get_recently_added(
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_added_at(page, per_page)

    return result


@app.get("/collection/verified", tags=["app"])
def get_verified(
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_verified(page, per_page)

    return result


@app.get("/popular/last-month", tags=["app"])
def get_popular_last_month(
    page: int | None = None,
    per_page: int | None = None,
    response: Response = Response(),
):
    if (page is None and per_page is not None) or (
        page is not None and per_page is None
    ):
        response.status_code = 400
        return response

    result = search.get_by_installs_last_month(page, per_page)

    return result


@app.get("/feed/recently-updated", tags=["feed"])
def get_recently_updated_apps_feed():
    return Response(
        content=feeds.get_recently_updated_apps_feed(), media_type="application/rss+xml"
    )


@app.get("/feed/new", tags=["feed"])
def get_new_apps_feed():
    return Response(content=feeds.get_new_apps_feed(), media_type="application/rss+xml")


@app.get("/status", status_code=200, tags=["healthcheck"])
def healthcheck():
    return {"status": "OK"}


@app.get("/stats", status_code=200, tags=["app"])
def get_stats(response: Response):
    if value := db.get_json_key("stats"):
        return value

    response.status_code = 404
    return None


@app.get("/stats/{app_id}", status_code=200, tags=["app"])
def get_stats_for_app(
    response: Response,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    all: bool = False,
    days: int = 180,
):
    if value := stats.get_installs_by_ids([app_id]).get(app_id, None):
        if all:
            return value

        if per_day := value.get("installs_per_day"):
            requested_dates = list(per_day.keys())[-days:]
            requested_per_day = {date: per_day[date] for date in requested_dates}
            value["installs_per_day"] = requested_per_day
            return value

    response.status_code = 404
    return None


@app.get("/summary/{app_id}", status_code=200, tags=["app"])
def get_summary(
    response: Response,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    branch: Optional[str] = None,
):
    if not branch:
        possible_branches = db.search_by_key(f"summary:{app_id}:*")
        if len(possible_branches) > 0:
            key = possible_branches[0]
        else:
            key = f"summary:{app_id}:{branch}"
    else:
        key = f"summary:{app_id}:{branch}"

    if value := db.get_json_key(key):
        if "metadata" in value and value["metadata"] and "runtime" in value["metadata"]:
            runtime_appid, _, runtime_branch = value["metadata"]["runtime"].split("/")

            value["metadata"]["runtimeIsEol"] = bool(
                db.get_json_key(f"eol_message:{runtime_appid}:{runtime_branch}")
            )

        return value

    response.status_code = 404
    return None


@app.get("/platforms", status_code=200, tags=["app"])
def get_platforms() -> dict[str, utils.Platform]:
    """
    Return a mapping from org-name to platform aliases and dependencies which are
    recognised by the backend.  These are used by things such as the transactions
    and donations APIs to address amounts to the platforms.
    """
    return utils.PLATFORMS


@app.get("/exceptions", tags=["app"])
def get_exceptions():
    return db.get_json_key("exc")


@app.get("/exceptions/{app_id}", tags=["app"])
def get_exceptions_for_app(app_id: str, response: Response):
    if exc := db.get_json_key(f"exc:{app_id}"):
        return exc

    response.status_code = 404
    return None


@app.get("/addon/{app_id}", tags=["app"])
def get_addons(app_id: str):
    addon_ids = apps.get_addons(app_id)

    return addon_ids
