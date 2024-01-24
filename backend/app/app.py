from typing import Optional

from fastapi import APIRouter, FastAPI, Path, Response
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from . import (
    apps,
    db,
    schemas,
    search,
    stats,
    utils,
)

router = APIRouter(default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get("/categories", tags=["app"])
def get_categories() -> list[str]:
    return [category.value for category in schemas.MainCategory]


@router.get("/category/{category}", tags=["app"])
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


@router.get("/category/{category}/subcategories/{subcategory}", tags=["app"])
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


@router.get("/developer", tags=["app"])
def get_developers() -> set[str]:
    return db.get_developers()


@router.get("/developer/{developer:path}", tags=["app"])
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


@router.get("/eol/rebase", tags=["app"])
def get_eol_rebase() -> dict[str, list[str]]:
    eol_rebase = db.get_json_key("eol_rebase")
    if eol_rebase is None:
        return {}
    return eol_rebase


@router.get("/eol/rebase/{app_id}", tags=["app"])
def get_eol_rebase_appid(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    branch: str = "stable",
) -> Optional[str]:
    if value := db.get_json_key(f"eol_rebase:{app_id}:{branch}"):
        return value


@router.get("/eol/message", tags=["app"])
def get_eol_message() -> dict[str, str]:
    eol_messages = db.get_json_key("eol_message")
    if eol_messages is None:
        return {}
    return eol_messages


@router.get("/eol/message/{app_id}", tags=["app"])
def get_eol_message_appid(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    branch: str = "stable",
) -> Optional[str]:
    if value := db.get_json_key(f"eol_message:{app_id}:{branch}"):
        return value


@router.get("/appstream", tags=["app"])
def list_appstream() -> list[str]:
    return apps.list_desktop_appstream()


@router.get("/appstream/{app_id}", status_code=200, tags=["app"])
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


@router.post("/search", tags=["app"])
def post_search(query: search.SearchQuery):
    return search.search_apps_post(query)


@router.get("/runtimes", tags=["app"])
def get_runtime_list() -> dict[str, int]:
    return search.get_runtime_list()


@router.get("/collection/recently-updated", tags=["app"])
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


@router.get("/collection/recently-added", tags=["app"])
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


@router.get("/collection/verified", tags=["app"])
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


@router.get("/popular/last-month", tags=["app"])
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


class StatsResult(BaseModel):
    countries: dict[str, int]
    downloads_per_day: dict[str, int]
    updates_per_day: dict[str, int]
    delta_downloads_per_day: dict[str, int]
    downloads: int
    number_of_apps: int
    category_totals: dict[str, int]


@router.get("/stats", status_code=200, tags=["app"])
def get_stats(response: Response) -> StatsResult | None:
    if value := db.get_json_key("stats"):
        return value

    response.status_code = 404
    return None


@router.get("/stats/{app_id}", status_code=200, tags=["app"])
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


@router.get("/summary/{app_id}", status_code=200, tags=["app"])
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


@router.get("/platforms", status_code=200, tags=["app"])
def get_platforms() -> dict[str, utils.Platform]:
    """
    Return a mapping from org-name to platform aliases and dependencies which are
    recognised by the backend.  These are used by things such as the transactions
    and donations APIs to address amounts to the platforms.
    """
    return utils.PLATFORMS


@router.get("/exceptions", tags=["app"])
def get_exceptions():
    return db.get_json_key("exc")


@router.get("/exceptions/{app_id}", tags=["app"])
def get_exceptions_for_app(app_id: str, response: Response):
    if exc := db.get_json_key(f"exc:{app_id}"):
        return exc

    response.status_code = 404
    return None


@router.get("/addon/{app_id}", tags=["app"])
def get_addons(app_id: str) -> list[str]:
    addon_ids = apps.get_addons(app_id)

    return addon_ids
