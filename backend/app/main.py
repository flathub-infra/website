import json
import re
import struct
import subprocess
import time
from datetime import datetime
from functools import lru_cache
from typing import Tuple

import requests
import redis
import redisearch
from fastapi import status, Response, BackgroundTasks, FastAPI
from feedgen.feed import FeedGenerator

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
    cdn_baseurl = "https://dl.flathub.org"
    appid = app["id"]

    if icons := app.get("icon"):
        if isinstance(icons, dict):
            if icons["type"] == "cached":
                size = icons["height"]
                icon_path = f"{cdn_baseurl}/repo/appstream/x86_64/icons/{size}x{size}/{appid}.png"
                return icon_path
            else:
                icon_path = icons["value"]
                return icon_path

        cached_icons = [icon["height"] for icon in icons if icon["type"] == "cached"]
        if cached_icons:
            cached_icons.sort()
            size = cached_icons[0]
            icon_path = (
                f"{cdn_baseurl}/repo/appstream/x86_64/icons/{size}x{size}/{appid}.png"
            )
            return icon_path

        remote_icons = [icon for icon in icons if icon["type"] == "remote"]
        if remote_icons:
            icon_path = remote_icons[0]["value"]
            return icon_path

    return None


def get_current_release_date(appid: str, template: str = "%Y-%m-%d"):
    # The v1 API uses currentReleaseDate field to describe when the app
    # has been updated in the Flathub repo. It's not related to appdata
    # releases section.
    if updated_at := redis_conn.get(f"recently_updated:{appid}"):
        updated_at_ts = int(updated_at)
    else:
        return None

    return datetime.utcfromtimestamp(updated_at_ts).strftime(template)


def get_app_summary(app):
    appid = app["id"]
    release = app["releases"][0] if app.get("releases") else {}

    icon_path = get_icon_path(app)
    updated_at = get_current_release_date(appid)

    short_app = {
        "flatpakAppId": appid,
        "name": app["name"],
        "summary": app["summary"],
        "currentReleaseVersion": release.get("version"),
        "currentReleaseDate": updated_at,
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


def run_query(variables):
    headers = {"Authorization": f"token {config.settings.github_token}"}

    query = """
query getRepos($cursor: String) {
  search(query: "org:flathub", type: REPOSITORY, first: 100, after: $cursor) {
    edges {
      node {
        ... on Repository {
          name
          createdAt
        }
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
"""

    request = requests.post(
        "https://api.github.com/graphql",
        json={"query": query, "variables": variables},
        headers=headers,
    )
    if request.status_code == 200:
        return request.json()
    else:
        raise Exception(
            "Query failed to run by returning code of {}. {}".format(
                request.status_code, query
            )
        )


def populate_creation_dates():
    created_at = {}
    variables = {"cursor": None}

    while True:
        ret = run_query(variables)
        for repo in ret["data"]["search"]["edges"]:
            repo_name = repo["node"]["name"]
            repo_created_at = repo["node"]["createdAt"]

            if redis_conn.exists(f"apps:{repo_name}"):
                dt = datetime.strptime(repo_created_at, "%Y-%m-%dT%H:%M:%SZ")
                timestamp = int(datetime.timestamp(dt))
                created_at[repo_name] = timestamp

        pageinfo = ret["data"]["search"]["pageInfo"]
        if pageinfo["hasNextPage"]:
            variables = {"cursor": pageinfo["endCursor"]}
        else:
            break

    redis_conn.zadd("created_at_zset", created_at)
    return len(created_at)


@app.on_event("startup")
def startup_event():
    remote_add_cmd = [
        "flatpak",
        "--user",
        "remote-add",
        "--if-not-exists",
        "flathub",
        "https://flathub.org/repo/flathub.flatpakrepo",
    ]
    subprocess.run(remote_add_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

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
def update_apps(background_tasks: BackgroundTasks):
    appids = load_appstream()
    populate_build_dates(appids)
    background_tasks.add_task(populate_creation_dates)

    list_apps_summary.cache_clear()
    get_recently_updated.cache_clear()

    return len(appids)


# TODO: should be optimized/cached, it's fairly slow at 23 req/s
@app.get("/v1/apps")
@lru_cache()
def list_apps_summary(
    index: str = "apps:index", appids: Tuple[str, ...] = None, sort: bool = True
):
    if not appids:
        appids = redis_conn.smembers(index)
        if not appids:
            return []

    apps = redis_conn.mget(appids)

    ret = [get_app_summary(json.loads(app)) for app in apps]

    if sort:
        ret = sorted(ret, key=lambda x: x["name"])

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
    if app_screenshots := app.get("screenshots"):
        for screenshot in app_screenshots:
            screenshots.append(
                {
                    "thumbUrl": screenshot.get(screenshot_sizes["thumbnail"]),
                    "imgMobileUrl": screenshot.get(screenshot_sizes["mobile"]),
                    "imgDesktopUrl": screenshot.get(screenshot_sizes["desktop"]),
                }
            )

    icon_path = get_icon_path(app)

    if "categories" in app:
        categories = [{"name": category} for category in app["categories"]]
    else:
        categories = None

    release = {}
    if app_releases := app.get("releases"):
        release = app_releases[0] if len(app_releases) else {}

    updated_at = get_current_release_date(appid)

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
        "downloadFlatpakRefUrl": f"https://dl.flathub.org/repo/appstream/{appid}.flatpakref",
        "currentReleaseVersion": release.get("version"),
        "currentReleaseDescription": release.get("description"),
        "iconDesktopUrl": icon_path,
        "iconMobileUrl": icon_path,
        "screenshots": screenshots,
        "currentReleaseDate": updated_at,
    }

    return legacy_app


@app.get("/v1/appstream/{appid}")
def get_appid_appstream(appid: str, repo: str = "stable"):
    app = get_json_key(f"apps:{appid}")
    if not app:
        return []

    return app


@app.get("/v1/apps/search/{userquery}")
def search(userquery: str):
    # TODO: figure out how to escape dashes
    # "D-Feet" seems to be interpreted as "d and not feet"
    userquery = userquery.replace("-", " ")

    results = []

    # TODO: should input be sanitized here?
    name_query = redisearch.Query(f"@name:'{userquery}'").no_content()
    generic_query = redisearch.Query(userquery).no_content()

    search_results = redis_search.search(name_query)
    for doc in search_results.docs:
        results.append(doc.id)

    search_results = redis_search.search(generic_query)
    for doc in search_results.docs:
        results.append(doc.id)

    results = list(dict.fromkeys(results))
    appids = tuple(doc_id.replace("fts", "apps") for doc_id in results)

    ret = list_apps_summary(appids=appids, sort=False)
    return ret


@app.get("/v1/apps/collection/recently-updated")
@app.get("/v1/apps/collection/recently-updated/{limit}")
@lru_cache()
def get_recently_updated(limit: int = 100):
    apps = redis_conn.zrevrange("recently_updated_zset", 0, limit)
    keys = (f"apps:{appid}" for appid in apps)
    ret = list_apps_summary(appids=keys, sort=False)
    return ret


def generate_feed(key: str, title: str, description: str, link: str):
    feed = FeedGenerator()
    feed.title(title)
    feed.description(description)
    feed.link(href=link)
    feed.language("en")

    appids = redis_conn.zrevrange(key, 0, 10, withscores=True)
    apps = [(get_json_key(f"apps:{appid[0]}"), appid[1]) for appid in appids]

    for app, timestamp in reversed(apps):
        entry = feed.add_entry()
        entry.title(app["name"])
        entry.link(href=f"https://flathub.org/apps/details/{app['id']}")

        timestamp = int(timestamp)
        entry_date = datetime.utcfromtimestamp(timestamp).strftime(
            "%a, %d %b %Y %H:%M:%S"
        )
        entry.pubDate(f"{entry_date} UTC")

        content = [
            '<img src="https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/{}.png">'.format(
                app["id"]
            ),
            f"<p>{app['summary']}</p>",
            f"<p>{app['description']}</p>",
            "<h3>Additional information:</h3>",
            "<ul>",
        ]

        if developer_name := app.get("developer_name"):
            content.append(f"<li>Developer: {developer_name}</li>")

        if license := app.get("license"):
            content.append(f"<li>License: {license}")

        if app_releases := app.get("releases"):
            release = app_releases[0] if len(app_releases) else None
            if release:
                content.append(f"<li>Version: {release['version']}")

        content.append("</ul>")

        for screenshot in app["screenshots"][0:3]:
            if image := screenshot.get("624x351"):
                content.append('<img src="{}">'.format(image))

        entry.description("".join(content))

    return feed.rss_str()


@app.get("/v1/feed/recently-updated")
def get_recently_updated_apps_feed():
    feed = generate_feed(
        "recently_updated_zset",
        "Flathub – recently updated applications",
        "Recently updated applications published on Flathub",
        "https://flathub.org/apps/collection/recently-updated",
    )
    return Response(content=feed, media_type="application/rss+xml")


@app.get("/v1/feed/new")
def get_new_apps_feed():
    feed = generate_feed(
        "created_at_zset",
        "Flathub – recently added applications",
        "Applications recently published on Flathub",
        "https://flathub.org/apps/collection/new",
    )
    return Response(content=feed, media_type="application/rss+xml")


@app.get("/status", status_code=200)
def healthcheck(response: Response):
    # redis_status = redis_conn.ping()
    # if not redis_status:
    #     response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    #     return {"status": "REDIS_DOWN"}

    return {"status": "OK"}
