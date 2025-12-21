from fastapi import APIRouter, FastAPI, HTTPException, Path
from fastapi.responses import ORJSONResponse

from .. import api_models, apps, cache, database, models, search, utils
from ..database import get_db

router = APIRouter(default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get(
    "/eol/rebase",
    tags=["app"],
    responses={
        200: {"description": "End-of-life rebase information"},
    },
)
@cache.cached(ttl=21600)
async def get_eol_rebase() -> dict[str, list[str]]:
    eol_rebase = database.get_json_key("eol_rebase")
    if eol_rebase is None:
        return {}
    return eol_rebase


@router.get(
    "/eol/rebase/{app_id}",
    tags=["app"],
    responses={
        200: {"description": "End-of-life rebase information for specific app"},
        404: {"description": "App rebase information not found"},
    },
)
@cache.cached(ttl=21600)
async def get_eol_rebase_appid(
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


@router.get(
    "/eol/message",
    tags=["app"],
    responses={
        200: {"description": "End-of-life messages for all apps"},
    },
)
@cache.cached(ttl=21600)
async def get_eol_message() -> dict[str, str]:
    eol_messages = database.get_json_key("eol_message")
    if eol_messages is None:
        return {}
    return eol_messages


@router.get(
    "/eol/message/{app_id}",
    tags=["app"],
    responses={
        200: {"description": "End-of-life message for specific app"},
        404: {"description": "App message not found"},
    },
)
@cache.cached(ttl=21600)
async def get_eol_message_appid(
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


@router.get(
    "/appstream",
    response_model=list[str],
    tags=["app"],
    responses={
        200: {"description": "List of all app IDs"},
    },
)
@cache.cached(ttl=3600)
async def list_appstream(
    filter: apps.AppType = apps.AppType.APPS,
    sort: apps.SortBy = apps.SortBy.ALPHABETICAL,
) -> list[str]:
    """
    Get a list of all application IDs in the repository.

    - **filter**: Filter by app type (default: apps)
    - **sort**: Sort order (default: alphabetical)
      - `alphabetical`: Sort by app ID alphabetically
      - `created-at`: Sort by creation date (newest first)
      - `last-updated-at`: Sort by last update date (newest first)
    """
    return apps.get_appids(filter, sort_by=sort)


@router.get(
    "/appstream/{app_id}",
    status_code=200,
    response_model=api_models.Appstream,
    response_model_exclude_none=True,
    response_model_by_alias=True,
    tags=["app"],
    responses={
        200: {"description": "AppStream metadata for the app"},
        404: {"description": "App not found"},
    },
)
@cache.cached(ttl=3600)
async def get_appstream(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    locale: str = "en",
):
    """
    Get the AppStream metadata for a specific application.

    Returns the full appstream data including name, description, screenshots,
    releases, and other metadata. The response is localized based on the
    locale parameter.
    """
    with get_db("replica") as db_session:
        from sqlalchemy.orm import load_only

        app = (
            db_session.session.query(models.App)
            .options(
                load_only(
                    models.App.appstream,
                    models.App.localization,
                    models.App.is_eol,
                    models.App.eol_branches,
                )
            )
            .filter(models.App.app_id == app_id)
            .first()
        )

        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        if models.App.is_fully_eol(db_session, app_id, app=app):
            raise HTTPException(status_code=404, detail="App not found")

        result = app.get_translated_appstream(locale)
        if not result:
            raise HTTPException(status_code=404, detail="App not found")

        # Return the correct union type
        if result.get("type") == "addon":
            return api_models.AddonAppstream(**result)
        elif result.get("type") == "localization":
            return api_models.LocalizationAppstream(**result)
        elif result.get("type") == "generic":
            return api_models.GenericAppstream(**result)
        elif result.get("type") == "runtime":
            return api_models.RuntimeAppstream(**result)
        else:
            return api_models.DesktopAppstream(**result)


@router.get(
    "/is-fullscreen-app/{app_id}",
    status_code=200,
    response_model=bool,
    tags=["app"],
    responses={
        200: {"description": "Whether the app is a fullscreen app"},
    },
)
@cache.cached(ttl=3600)
async def get_isFullscreenApp(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
) -> bool:
    """Check if an application is configured to run in fullscreen mode."""
    with get_db("replica") as db_session:
        return models.App.get_fullscreen_app(db_session, app_id)


@router.post(
    "/search",
    response_model=search.MeilisearchResponse[search.AppsIndex],
    tags=["app"],
    responses={
        200: {"description": "Search results for apps"},
        400: {"description": "Invalid search query"},
    },
)
def post_search(
    query: search.SearchQuery, locale: str = "en"
) -> search.MeilisearchResponse[search.AppsIndex]:
    """
    Search for applications using Meilisearch.

    Accepts a search query with filters and returns matching applications
    with facets and pagination information.
    """
    return search.search_apps_post(query, locale)


@router.get(
    "/runtimes",
    response_model=dict[str, int],
    tags=["app"],
    responses={
        200: {"description": "List of available runtimes"},
    },
)
def get_runtime_list() -> dict[str, int]:
    """
    Get a list of available Flatpak runtimes with usage counts.

    Returns a mapping of runtime names to the number of apps using each runtime.
    """
    return search.get_runtime_list()


@router.get(
    "/summary/{app_id}",
    status_code=200,
    response_model=api_models.SummaryResponse,
    response_model_exclude_none=True,
    response_model_by_alias=True,
    tags=["app"],
    responses={
        200: {"description": "App summary information"},
        404: {"description": "App not found"},
    },
)
@cache.cached(ttl=3600)
async def get_summary(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    branch: str | None = None,
):
    """
    Get summary information for a specific application.

    Returns information about the app's size, architectures, runtime metadata,
    and flatpak-specific configuration.
    """
    with get_db("replica") as db_session:
        app = models.App.by_appid(db_session, app_id)
        if not app:
            raise HTTPException(status_code=404, detail="App not found")

        if models.App.is_fully_eol(db_session, app_id):
            raise HTTPException(status_code=404, detail="App not found")

        if app.summary:
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

            # FastAPI will automatically validate and convert this dict
            # to SummaryResponse based on response_model
            return summary

        raise HTTPException(status_code=404, detail="App not found")


@router.get(
    "/platforms",
    status_code=200,
    response_model=dict[str, utils.Platform],
    tags=["app"],
    responses={
        200: {"description": "Available platforms information"},
    },
)
def get_platforms() -> dict[str, utils.Platform]:
    """
    Return a mapping from org-name to platform aliases and dependencies which are
    recognised by the backend.  These are used by things such as the transactions
    and donations APIs to address amounts to the platforms.
    """
    return utils.PLATFORMS


@router.get(
    "/addon/{app_id}",
    response_model=list[str],
    tags=["app"],
    responses={
        200: {"description": "List of addons for the app"},
    },
)
@cache.cached(ttl=3600)
async def get_addons(app_id: str) -> list[str]:
    """
    Get a list of addon IDs that are compatible with the specified application.

    Addons extend the functionality of base applications (e.g., codecs, themes).
    """
    return [addon_id.split("//", 1)[0] for addon_id in apps.get_addons(app_id)]
