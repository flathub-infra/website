from datetime import datetime

from fastapi import APIRouter, FastAPI, Path
from fastapi.responses import ORJSONResponse

from .. import database, models, search, stats
from ..database import get_db

router = APIRouter(prefix="/compat", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


def get_created_at(key: str):
    with get_db("replica") as sqldb:
        if created_at := (
            sqldb.query(models.App.initial_release_at)
            .filter(models.App.app_id == key)
            .scalar()
        ):
            # for backwards compatibility, convert the data to string with the unix timestamp
            return str(int(created_at.timestamp()))


def get_short_app(key: str):
    compat_app = None
    if app := database.get_json_key(key):
        app_id = key[5:]
        compat_app = {
            "flatpakAppId": app_id,
            "name": app.get("name"),
            "summary": app.get("summary"),
            "iconDesktopUrl": app.get("icon"),
            "iconMobileUrl": app.get("icon"),
            "currentReleaseVersion": None,
            "currentReleaseDate": None,
            "inStoreSinceDate": get_created_at(app_id),
        }

    return compat_app


@router.get("/apps/collection/recently-updated", tags=["compat"])
@router.get("/apps/collection/recently-updated/25", tags=["compat"])
def get_recently_updated():
    with get_db("replica") as sqldb:
        appids = (
            sqldb.query(models.App.app_id)
            .filter(models.App.type == "desktop")
            .filter(models.App.last_updated_at.isnot(None))
            .order_by(models.App.last_updated_at.desc())
            .limit(25)
            .all()
        )

    recent = [app_id[0] for app_id in appids]
    compat = [get_short_app(f"apps:{app_id}") for app_id in recent]
    return [app for app in compat if app]


@router.get("/apps/collection/new", tags=["compat"])
@router.get("/apps/collection/new/25", tags=["compat"])
def get_recently_added():
    with get_db("replica") as sqldb:
        appids = (
            sqldb.query(models.App.app_id)
            .filter(models.App.type == "desktop")
            .filter(models.App.initial_release_at.isnot(None))
            .order_by(models.App.initial_release_at.desc())
            .limit(25)
            .all()
        )

    added = [app_id[0] for app_id in appids]
    compat = [get_short_app(f"apps:{app_id}") for app_id in added]
    return [app for app in compat if app]


@router.get("/apps/collection/popular", tags=["compat"])
@router.get("/apps/collection/popular/50", tags=["compat"])
def get_popular_apps():
    popular = stats.get_popular(30)
    compat = [get_short_app(f"apps:{app_id}") for app_id in popular[0:50]]
    return [app for app in compat if app]


@router.get("/apps/search/{query}", tags=["compat"])
def get_search(query: str = Path(min_length=2), locale: str = "en"):
    results = [
        {
            "id": app["app_id"],
            "name": app["name"],
            "summary": app["summary"],
            "icon": app.get("icon"),
        }
        for app in search.search_apps(query, locale)["hits"]
        if "app_id"  # this might cause hit count to be wrong, but is better then crashing
        in app
    ]

    ret = []
    for app in results:
        compat_app = {
            "flatpakAppId": app.get("id"),
            "name": app.get("name"),
            "summary": app.get("summary"),
            "iconDesktopUrl": app.get("icon"),
            "iconMobileUrl": app.get("icon"),
            "currentReleaseVersion": None,
            "currentReleaseDate": None,
            "inStoreSinceDate": None,
        }

        ret.append(compat_app)

    return ret


@router.get("/apps/{app_id}", tags=["compat"])
def get_single_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    if app := database.get_json_key(f"apps:{app_id}"):
        compat_app = {
            "flatpakAppId": app_id,
            "name": app.get("name"),
            "summary": app.get("summary"),
            "description": app.get("description"),
            "downloadFlatpakRefUrl": f"https://dl.flathub.org/repo/appstream/{app_id}.flatpakref",
            "projectLicense": app.get("project_license"),
            "iconDesktopUrl": app.get("icon"),
            "iconMobileUrl": app.get("icon"),
            "homepageUrl": app.get("urls", {}).get("homepage"),
            "helpUrl": app.get("urls", {}).get("help"),
            "translateUrl": app.get("urls", {}).get("translate"),
            "bugtrackerUrl": app.get("urls", {}).get("bugtracker"),
            "donationUrl": app.get("urls", {}).get("donation"),
            "developerName": app.get("developer_name"),
            "categories": [
                {"name": category} for category in app.get("categories", [])
            ],
            "currentReleaseDescription": None,
            "currentReleaseVersion": None,
            "currentReleaseDate": None,
            "inStoreSinceDate": None,
            "screenshots": None,
        }

        if releases := app.get("releases"):
            release = releases[0]
            compat_app["currentReleaseVersion"] = release.get("version")
            compat_app["currentReleaseDescription"] = release.get("description")

            if release_ts := release.get("timestamp"):
                release_ts = int(release_ts)
                compat_app["currentReleaseDate"] = datetime.utcfromtimestamp(
                    release_ts
                ).strftime("%Y-%m-%d")

        if created_at := get_created_at(app_id):
            compat_app["inStoreSinceDate"] = created_at

        if screenshots := app.get("screenshots"):
            screenshots = list(filter(None, screenshots))

            compat_screenshots = []
            for screenshot in screenshots:
                screenshots_sizes = sorted(
                    screenshot["sizes"], key=lambda res: int(res["width"])
                )

                if screenshots_sizes:
                    full_size = (
                        screenshots_sizes[-1]["width"]
                        + "x"
                        + screenshots_sizes[-1]["height"]
                    )
                    thumb_size = (
                        screenshots_sizes[0]["width"]
                        + "x"
                        + screenshots_sizes[0]["height"]
                    )

                filename = screenshot["sizes"][0]["src"].split("/")[-1]
                compat_screenshots.append(
                    {
                        "imgDesktopUrl": f"https://dl.flathub.org/repo/screenshots/{app_id}-stable/{full_size}/{filename}",
                        "imgMobileUrl": f"https://dl.flathub.org/repo/screenshots/{app_id}-stable/{full_size}/{filename}",
                        "thumbUrl": f"https://dl.flathub.org/repo/screenshots/{app_id}-stable/{thumb_size}/{filename}",
                    }
                )
            compat_app["screenshots"] = compat_screenshots

        return compat_app
