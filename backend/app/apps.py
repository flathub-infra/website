import re
import json
import requests
import struct
import string
import gi
import redisearch

gi.require_version("OSTree", "1.0")

from gi.repository import OSTree, Gio, GLib
from datetime import datetime

from . import config
from . import utils
from . import db


def cleanhtml(text):
    clean_re = re.compile("<.*?>")
    cleantext = re.sub(clean_re, "", text)
    return cleantext


def contains_whitespace(s: str):
    for char in s:
        if char in string.whitespace:
            return True
    return False


def get_current_release_date(appid: str, template: str = "%Y-%m-%d"):
    # The v1 API uses currentReleaseDate field to describe when the app
    # has been updated in the Flathub repo. It's not related to appdata
    # releases section.
    if updated_at := db.redis_conn.get(f"recently_updated:{appid}"):
        updated_at_ts = int(updated_at)
    else:
        return None

    return datetime.utcfromtimestamp(updated_at_ts).strftime(template)


def get_app_summary(app):
    appid = app["id"]
    release = app["releases"][0] if app.get("releases") else {}

    updated_at = get_current_release_date(appid)

    short_app = {
        "flatpakAppId": appid,
        "name": app["name"],
        "summary": app["summary"],
        "currentReleaseVersion": release.get("version"),
        "currentReleaseDate": updated_at,
        "iconDesktopUrl": app.get("icon"),
        "iconMobileUrl": app.get("icon"),
    }

    return short_app


def load_appstream():
    apps = utils.appstream2dict("repo")

    current_apps = db.redis_conn.smembers("apps:index")
    current_categories = db.redis_conn.smembers("categories:index")

    with db.redis_conn.pipeline() as p:
        p.delete("categories:index", *current_categories)

        for appid in apps:
            redis_key = f"apps:{appid}"

            search_description = cleanhtml(apps[appid]["description"])

            if search_keywords := apps[appid].get("keywords"):
                search_keywords = " ".join(search_keywords)
            else:
                search_keywords = ""

            p.set(f"apps:{appid}", json.dumps(apps[appid]))
            db.redis_search.add_document(
                f"fts:{appid}",
                appid=appid,
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
            db.redis_search.delete_document(f"fts:appid")

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

    db.redis_conn.zadd("recently_updated_zset", recently_updated)
    db.redis_conn.mset(
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

            if db.redis_conn.exists(f"apps:{repo_name}"):
                dt = datetime.strptime(repo_created_at, "%Y-%m-%dT%H:%M:%SZ")
                timestamp = int(datetime.timestamp(dt))
                created_at[repo_name] = timestamp

        pageinfo = ret["data"]["search"]["pageInfo"]
        if pageinfo["hasNextPage"]:
            variables = {"cursor": pageinfo["endCursor"]}
        else:
            break

    db.redis_conn.zadd("created_at_zset", created_at)
    return len(created_at)


def initialize():
    apps = db.redis_conn.smembers("apps:index")
    if not apps:
        try:
            db.redis_search.create_index(
                [
                    redisearch.TextField("appid"),
                    redisearch.TextField("name"),
                    redisearch.TextField("summary"),
                    redisearch.TextField("description", 0.2),
                    redisearch.TextField("keywords"),
                ]
            )
        except:
            pass


def update_apps(background_tasks):
    appids = load_appstream()
    populate_build_dates(appids)

    if config.settings.github_token is not None:
        background_tasks.add_task(populate_creation_dates)

    return len(appids)


def list_apps_summary(index="apps:index", appids=None, sort=False):
    if not appids:
        appids = db.redis_conn.smembers(index)
        if not appids:
            return []

    apps = db.redis_conn.mget(appids)

    ret = [get_app_summary(json.loads(app)) for app in apps if isinstance(app, str)]

    if sort:
        ret = sorted(ret, key=lambda x: x["name"].casefold())

    return ret


def list_apps_in_category(category: str):
    return list_apps_summary(f"categories:{category}")


def get_app(appid: str):
    app = utils.get_json_key(f"apps:{appid}")
    if not app:
        return None

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
        "helpUrl": app.get("urls").get("help"),
        "categories": categories,
        "downloadFlatpakRefUrl": f"https://dl.flathub.org/repo/appstream/{appid}.flatpakref",
        "currentReleaseVersion": release.get("version"),
        "currentReleaseDescription": release.get("description"),
        "iconDesktopUrl": app.get("icon"),
        "iconMobileUrl": app.get("icon"),
        "screenshots": screenshots,
        "currentReleaseDate": updated_at,
    }

    return legacy_app


def get_appid_appstream(appid: str, repo: str = "stable"):
    app = utils.get_json_key(f"apps:{appid}")
    if not app:
        return []

    return app


def search(userquery: str):
    results = []

    # TODO: figure out how to escape dashes
    # "D-Feet" seems to be interpreted as "d and not feet"
    userquery = userquery.replace("-", " ")

    # TODO: should input be sanitized here?
    name_query = redisearch.Query(f"@name:'{userquery}'").no_content()

    # redisearch does not support fuzzy search for non-alphabet strings
    if userquery.isalpha():
        generic_query = redisearch.Query(f"%{userquery}%").no_content()
    else:
        generic_query = redisearch.Query(userquery).no_content()

    # TODO: Backend API doesn't support paging so bring fifty results
    # instead of just 10, which is the redisearch default
    name_query.paging(0, 50)
    generic_query.paging(0, 50)

    search_results = db.redis_search.search(name_query)
    for doc in search_results.docs:
        results.append(doc.id)

    search_results = db.redis_search.search(generic_query)
    for doc in search_results.docs:
        results.append(doc.id)

    results = list(dict.fromkeys(results))
    if not len(results):
        return []

    appids = tuple(doc_id.replace("fts", "apps") for doc_id in results)
    ret = list_apps_summary(appids=appids, sort=False)

    return ret


def get_recently_updated(limit: int = 100):
    apps = db.redis_conn.zrevrange("recently_updated_zset", 0, limit - 1)
    keys = (f"apps:{appid}" for appid in apps)
    ret = list_apps_summary(appids=keys, sort=False)
    return ret
