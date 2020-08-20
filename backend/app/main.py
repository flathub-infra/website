import json
import re
import struct
import time
from datetime import datetime
from functools import lru_cache
from typing import Tuple

import redis
import redisearch
from fastapi import FastAPI

import gi

gi.require_version("OSTree", "1.0")
from gi.repository import OSTree, Gio, GLib

import config
import utils

app = FastAPI()
redis_conn = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    decode_responses=True,
)
redis_search = redisearch.Client("apps_search", conn=redis_conn)


def cleanhtml(text):
    clean_re = re.compile("<.*?>")
    cleantext = re.sub(clean_re, "", text)
    return cleantext


def get_json_key(key):
    if key := redis_conn.get(key):
        return json.loads(key)

    return None


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


def load_appstream():
    apps = utils.appstream2dict("repo")

    current_apps = redis_conn.smembers("apps:index")
    current_categories = redis_conn.smembers("categories:index")

    with redis_conn.pipeline() as p:
        p.delete("categories:index", *current_categories)

        for appid in apps:
            redis_key = f"apps:{appid}"

            search_description = cleanhtml(apps[appid]["description"])

            if search_keywords := apps[appid].get("keywords"):
                search_keywords = " ".join(search_keywords)
            else:
                search_keywords = ""

            p.set(f"apps:{appid}", json.dumps(apps[appid]))
            redis_search.add_document(
                f"fts:{appid}",
                name=apps[appid]["name"],
                summary=apps[appid]["summary"],
                description=search_description,
                keywords=search_keywords,
                replace=True,
            )

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

    return list(apps.keys())


def populate_build_dates(appids):
    recently_updated = {}

    repo_file = Gio.File.new_for_path(config.settings.ostree_repo)
    repo = OSTree.Repo.new(repo_file)
    repo.open(None)

    status, summary, signatures = repo.remote_fetch_summary("flathub", None)
    data = GLib.Variant.new_from_bytes(
        GLib.VariantType.new(OSTree.SUMMARY_GVARIANT_STRING), summary, True
    )

    refs, summmary_info = data.unpack()

    for ref, (_, _, info) in refs:
        if not ref.startswith("app/"):
            continue

        reftype, appid, arch, branch = ref.split("/")

        if appid not in appids:
            continue

        if arch != "x86_64" or branch != "stable":
            continue

        timestamp = struct.pack("<Q", info["ostree.commit.timestamp"])
        timestamp = struct.unpack(">Q", timestamp)[0]

        recently_updated[appid] = timestamp

    redis_conn.zadd("recently_updated_zset", recently_updated)
    redis_conn.mset(
        {
            f"recently_updated:{appid}": recently_updated[appid]
            for appid in recently_updated
        }
    )

    return len(recently_updated)


@app.on_event("startup")
def startup_event():
    apps = redis_conn.smembers("apps:index")
    if not apps:
        try:
            redis_search.create_index(
                [
                    redisearch.TextField("name"),
                    redisearch.TextField("summary"),
                    redisearch.TextField("description", 0.2),
                    redisearch.TextField("keywords"),
                ]
            )
        except:
            pass

        update_apps()


@app.post("/v1/apps/update")
def update_apps():
    appids = load_appstream()
    populate_build_dates(appids)

    return len(appids)


# TODO: should be optimized/cached, it's fairly slow at 23 req/s
@app.get("/v1/apps")
@lru_cache()
def list_apps_summary(index: str = "apps:index", appids: Tuple[str, ...] = None, sort: bool = True):
    if not appids:
        appids = redis_conn.smembers(index)
        if not appids:
            return []

    apps = redis_conn.mget(appids)

    if sort:
        apps.sort()

    ret = [get_app_summary(json.loads(app)) for app in apps]

    return ret


@app.get("/v1/apps/category/{category}")
def list_apps_in_category(category: str):
    return list_apps_summary(f"categories:{category}")


@app.get("/v1/apps/{appid}")
def get_app(appid: str):
    app = get_json_key(f"apps:{appid}")
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
        "updatedAt": redis_conn.get(f"recently_updated:{appid}"),
    }

    return legacy_app


@app.get("/v1/appstream/{appid}")
def get_appid_appstream(appid: str, repo: str = "stable"):
    app = get_json_key(f"apps:{appid}")
    if not app:
        return []

    return app


# TODO: search separately in the name field for direct hits
@app.get("/v1/apps/search/{userquery}")
def search(userquery: str):
    # TODO: figure out how to escape dashes
    # "D-Feet" seems to be interpreted as "d and not feet"
    userquery = userquery.replace("-", " ")

    # TODO: should input be sanitized here?
    query = redisearch.Query(userquery).no_content()

    results = redis_search.search(query)
    appids = (doc.id.replace("fts", "apps") for doc in results.docs)

    ret = list_apps_summary(appids=appids, sort=False)
    return ret


@app.get("/v1/apps/collection/recently-updated")
@app.get("/v1/apps/collection/recently-updated/{limit}")
def get_recently_updated(limit=100):
    apps = redis_conn.zrevrange("recently_updated_zset", 0, limit)
    keys = (f"apps:{appid}" for appid in apps)
    ret = list_apps_summary(appids=keys)
    return ret
