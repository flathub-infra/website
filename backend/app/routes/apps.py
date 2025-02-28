from fastapi import APIRouter, FastAPI, Path, Response
from fastapi.responses import ORJSONResponse

from .. import apps, database, models, search, utils
from ..database import get_db

router = APIRouter(default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get("/eol/rebase", tags=["app"])
def get_eol_rebase() -> dict[str, list[str]]:
    eol_rebase = database.get_json_key("eol_rebase")
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
) -> str | None:
    if value := database.get_json_key(f"eol_rebase:{app_id}:{branch}"):
        return value


@router.get("/eol/message", tags=["app"])
def get_eol_message() -> dict[str, str]:
    eol_messages = database.get_json_key("eol_message")
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
) -> str | None:
    if value := database.get_json_key(f"eol_message:{app_id}:{branch}"):
        return value


@router.get("/appstream", tags=["app"])
def list_appstream(filter: apps.AppType = apps.AppType.APPS) -> list[str]:
    return sorted(apps.get_appids(filter))


@router.get("/appstream/{app_id}", status_code=200, tags=["app"])
def get_appstream(
    response: Response,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    locale: str = "en",
):
    with get_db("replica") as db_session:
        app = models.App.by_appid(db_session, app_id)
        if not app:
            response.status_code = 404
            return None

        result = app.get_translated_appstream(locale)
        if not result:
            response.status_code = 404
            return None

        return result


@router.get("/is-fullscreen-app/{app_id}", status_code=200, tags=["app"])
def get_isFullscreenApp(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
) -> bool:
    with get_db("replica") as db_session:
        return models.App.get_fullscreen_app(db_session, app_id)


@router.post("/search", tags=["app"])
def post_search(query: search.SearchQuery, locale: str = "en"):
    return search.search_apps_post(query, locale)


@router.get("/runtimes", tags=["app"])
def get_runtime_list() -> dict[str, int]:
    return search.get_runtime_list()


@router.get("/summary/{app_id}", status_code=200, tags=["app"])
def get_summary(
    response: Response,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    branch: str | None = None,
):
    with get_db("replica") as db_session:
        app = models.App.by_appid(db_session, app_id)
        if app and app.summary:
            summary = app.summary
            if (
                "metadata" in summary
                and summary["metadata"]
                and "runtime" in summary["metadata"]
            ):
                runtime_appid, _, runtime_branch = summary["metadata"]["runtime"].split(
                    "/"
                )
                runtime_is_eol = models.App.get_eol_data(
                    db_session, runtime_appid, runtime_branch
                )
                summary["metadata"]["runtimeIsEol"] = runtime_is_eol

            return summary

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


@router.get("/addon/{app_id}", tags=["app"])
def get_addons(app_id: str) -> list[str]:
    addon_ids = apps.get_addons(app_id)

    return addon_ids
