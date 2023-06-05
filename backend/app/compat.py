from datetime import datetime

import requests
from fastapi import APIRouter, BackgroundTasks, FastAPI
from fastapi.responses import ORJSONResponse

from . import apps, db, search, stats

router = APIRouter(prefix="/compat", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


def get_repo_creation_date(appid: str) -> str | None:
    key = f"created_at:{appid}"
    if created_at := db.redis_conn.get(key):
        return created_at
    else:
        try:
            github_repo = requests.get(f"https://api.github.com/repos/flathub/{appid}")
            github_repo.raise_for_status()
            created_at = github_repo.json().get("created_at")
            db.redis_conn.set(key, created_at)
            return created_at
        except requests.exceptions.RequestException:
            pass


def get_short_app(key: str):
    compat_app = None
    if app := db.get_json_key(key):
        appid = key[5:]
        compat_app = {
            "flatpakAppId": appid,
            "name": app.get("name"),
            "summary": app.get("summary"),
            "iconDesktopUrl": app.get("icon"),
            "iconMobileUrl": app.get("icon"),
            "currentReleaseVersion": None,
            "currentReleaseDate": None,
            "inStoreSinceDate": db.redis_conn.get(f"created_at:{appid}"),
        }

    return compat_app


def list_apps_in_index(index="apps:index"):
    appids = sorted(db.redis_conn.smembers(index))
    ret = []

    for appid in appids:
        if app := get_short_app(appid):
            ret.append(app)

    return ret


@router.get("/apps")
def get_apps():
    return list_apps_in_index()


@router.get("/apps/category/{category}")
def get_apps_in_category(category: str):
    return list_apps_in_index(f"categories:{category}")


@router.get("/apps/collection/recently-updated")
@router.get("/apps/collection/recently-updated/50")
def get_recently_updated():
    recent = apps.get_recently_updated(50)
    compat = [get_short_app(f"apps:{appid}") for appid in recent]
    return [app for app in compat if app]


@router.get("/apps/collection/new")
@router.get("/apps/collection/new/50")
def get_recently_added():
    added = apps.get_recently_added(50)
    compat = [get_short_app(f"apps:{appid}") for appid in added]
    return [app for app in compat if app]


@router.get("/apps/collection/popular")
@router.get("/apps/collection/popular/50")
def get_popular_apps():
    popular = stats.get_popular(30)
    compat = [get_short_app(f"apps:{appid}") for appid in popular[0:50]]
    return [app for app in compat if app]


@router.get("/apps/search/{query}")
def get_search(query: str):
    results = [
        {
            "id": app["app_id"],
            "name": app["name"],
            "summary": app["summary"],
            "icon": app.get("icon"),
        }
        for app in search.search_apps(query)["hits"]
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


@router.get("/apps/{appid}")
def get_single_app(appid: str, background_tasks: BackgroundTasks):
    if app := db.get_json_key(f"apps:{appid}"):
        compat_app = {
            "flatpakAppId": appid,
            "name": app.get("name"),
            "summary": app.get("summary"),
            "description": app.get("description"),
            "downloadFlatpakRefUrl": f"https://dl.flathub.org/repo/appstream/{appid}.flatpakref",
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

        if created_at := db.redis_conn.get(f"created_at:{appid}"):
            compat_app["inStoreSinceDate"] = created_at
        else:
            background_tasks.add_task(get_repo_creation_date, appid)

        if screenshots := app.get("screenshots"):
            screenshots = list(filter(None, screenshots))

            compat_screenshots = []
            for screenshot in screenshots:
                screenshots_sizes = sorted(
                    screenshot.keys(), key=lambda res: int(res.split("x")[0])
                )

                if screenshots_sizes:
                    full_size = screenshots_sizes[-1]
                    thumb_size = screenshots_sizes[0]

                filename = list(screenshot.values())[0].split("/")[-1]
                compat_screenshots.append(
                    {
                        "imgDesktopUrl": f"https://dl.flathub.org/repo/screenshots/{appid}-stable/{full_size}/{filename}",
                        "imgMobileUrl": f"https://dl.flathub.org/repo/screenshots/{appid}-stable/{full_size}/{filename}",
                        "thumbUrl": f"https://dl.flathub.org/repo/screenshots/{appid}-stable/{thumb_size}/{filename}",
                    }
                )
            compat_app["screenshots"] = compat_screenshots

        return compat_app
