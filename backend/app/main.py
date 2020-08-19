import re
import json
from datetime import datetime
import time

import redis
import redisearch
from fastapi import BackgroundTasks, FastAPI

import utils

app = FastAPI()
redis_conn = redis.Redis(decode_responses=True)
redis_search = redisearch.Client("apps_search", conn=redis_conn)


def cleanhtml(text):
    clean_re = re.compile('<.*?>')
    cleantext = re.sub(clean_re, '', text)
    return cleantext


def get_icon_path(app):
    appid = app["id"]

    if icons := app.get("icon"):
        if isinstance(icons, dict):
            if icons["type"] == "cached":
                size = icons["height"]
                icon_path = f"/repo/appstream/x86_64/icons/{size}x{size}/{appid}.png"
                return icon_path
            else:
                icon_path = icons["value"]
                return icon_path

        cached_icons = [icon["height"] for icon in icons if icon["type"] == "cached"]
        if cached_icons:
            cached_icons.sort()
            size = cached_icons[0]
            icon_path = f"/repo/appstream/x86_64/icons/{size}x{size}/{appid}.png"
            return icon_path

        remote_icons = [icon for icon in icons if icon["type"] == "remote"]
        if remote_icons:
            icon_path = remote_icons[0]["value"]
            return icon_path

    return None


def get_app_summary(app):
    appid = app["id"]
    release = app["releases"][0] if app.get("releases") else {}

    icon_path = get_icon_path(app)

    short_app = {
                "flatpakAppId": appid,
                "name": app["name"],
                "summary": app["summary"],
                "currentReleaseVersion": release.get("version"),
                "currentReleaseDate:": release.get("timestamp"),
                "iconDesktopUrl": icon_path,
                "iconMobileUrl": icon_path,
    }

    return short_app


@app.on_event("startup")
def startup_event():
    apps = redis_conn.smembers("apps:index")
    if not apps:
        try:
            redis_search.create_index([redisearch.TextField('name'), redisearch.TextField('summary'), redisearch.TextField('description')])
        except:
            pass

        load_appstream()


@app.post("/v1/apps/update")
def load_appstream(background_tasks: BackgroundTasks):
    apps = utils.appstream2dict("repo")

    current_apps = redis_conn.smembers("apps:index")
    current_categories = redis_conn.smembers("categories:index")

    with redis_conn.pipeline() as p:
        p.delete("categories:index", *current_categories)

        for appid in apps:
            redis_key = f"apps:{appid}"

            p.set(f"apps:{appid}", json.dumps(apps[appid]))
            redis_search.add_document(f"fts:{appid}", name=apps[appid]["name"], summary=apps[appid]["summary"], description=cleanhtml(apps[appid]["description"]), replace=True)

            if categories := apps[appid].get("categories"):
                for category in categories:
                    p.sadd("categories:index", category)
                    p.sadd(f"categories:{category}", redis_key)


        for appid in current_apps - set(apps):
            p.delete(f"apps:{appid}", f"fts:{appid}")
            redis_search.delete_document(f"fts:appid")

        p.delete(f"apps:index")
        p.sadd("apps:index", *[f"apps:{appid}" for appid in apps])
        p.execute()

    background_tasks.add_task(populate_build_dates, list(apps.keys()))

    return len(apps)


# TODO: should be optimized/cached, it's fairly slow at 23 req/s
@app.get("/v1/apps")
def list_apps_summary(index="apps:index", appids=None):
    if not appids:
        appids = redis_conn.smembers(index)
        if not appids:
            return []

    apps = redis_conn.mget(appids)
    ret = [get_app_summary(json.loads(app)) for app in sorted(apps)]

    return ret


@app.get("/v1/apps/category/{category}")
def list_apps_in_category(category: str):
    return list_apps_summary(f"categories:{category}")


@app.get("/v1/apps/{appid}")
def get_app(appid: str):
    app = redis_conn.get(f"apps:{appid}")
    if not app:
        return []

    screenshot_sizes = {
            "desktop": "752x423",
            "mobile": "624x351",
            "thumbnail": "224x126",
    }
    screenshots = []
    for screenshot in app["screenshots"]:
        screenshots.append(
                {
                    "thumbUrl": screenshot[screenshot_sizes["thumbnail"]],
                    "imgMobileUrl": screenshot[screenshot_sizes["mobile"]],
                    "imgDesktopUrl": screenshot[screenshot_sizes["desktop"]],
                }
        )

    icon_path = get_icon_path(app)

    if "categories" in app:
        categories = [{"name": category} for category in app["categories"]]
    else:
        categories = None

    release = app["releases"][0] if len(app["releases"]) else {}

    legacy_app = {
        "flatpakAppId": appid,
        "name": app["name"],
        "summary": app["summary"],
        "description": app["description"],
        "developerName": app.get("developer_name"),
        "projectLicense": app.get("project_license"),
        "homepageUrl": app.get("urls").get("homepage"),
        "donationUrl": app.get("urls").get("donation"),
        "translateUrl": app.get("urls").get("translate"),
        "bugtrackerUrl": app.get("urls").get("bugtracker"),
        "categories": categories,
        "downloadFlatpakRefUrl": f"/repo/appstream/{appid}.flatpakref",
        "currentReleaseVersion": release.get("version"),
        "currentReleaseDate:": release.get("timestamp"),
        "currentReleaseDescription": release.get("description"),
        "iconDesktopUrl": icon_path,
        "iconMobileUrl": icon_path,
        "screenshots": screenshots,
    }

    return legacy_app


@app.get("/v1/appstream/{appid}")
def get_appid_appstream(appid: str, repo: str = "stable"):
    app = redis_conn.get(f"apps:{appid}")
    if not app:
        return []

    return app


@app.get("/v1/apps/search/{userquery}")
def search(userquery: str):
    query = redisearch.Query(userquery).no_content()
    results = redis_search.search(query)

    appids = [doc.id.replace("fts", "apps") for doc in results.docs]
    ret = list_apps_summary(appids=appids)
    return ret


@app.get("/v1/flatpak/info/{appid}")
def flatpak_info(appid: str):
    flatpak = utils.Flatpak()
    return flatpak.remote_info(appid)


@app.get("/v1/apps/collection/recently-updated")
@app.get("/v1/apps/collection/recently-updated/{limit}")
def get_recently_updated(limit=100):
    apps = redis_conn.zrevrange("recently_updated", 0, limit)
    ret = list_apps_summary(appids=[f"apps:{appid}" for appid in apps])
    return ret


# TODO: rework to celery/redis queue?
# single remote-info fetch takes between 0.8-1.2s, it might be too long for
# fastapi's background tasks
# TODO: locking
def populate_build_dates(appids: list):
    flatpak = utils.Flatpak()
    appids = [appid.split(':')[1] for appid in redis_conn.smembers("apps:index")]

    recently_updated = {}

    for appid in appids:
        date_key = f"flatpak:{appid}:date"
        commit_key = f"flatpak:{appid}:commit"

        if stored_commit := redis_conn.get(commit_key):
            remote_commit = flatpak.show_commit(appid)

            if stored_commit == remote_commit:
                continue

        remote_info = flatpak.remote_info(appid)
        date = datetime.strptime(remote_info["Date"], "%Y-%m-%d %H:%M:%S %z")
        timestamp = int(time.mktime(date.timetuple()))
        redis_conn.mset({date_key: timestamp, commit_key: remote_info["Commit"]})

        recently_updated[appid] = timestamp

    redis_conn.zadd("recently_updated", recently_updated)
