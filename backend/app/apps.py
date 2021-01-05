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
    if updated_at := db.redis_conn.get(f"updated_at:{appid}"):
        updated_at_ts = int(updated_at)
    else:
        return None

    return datetime.utcfromtimestamp(updated_at_ts).strftime(template)


def get_app_summary(app):
    short_app = {
        "id": app["id"],
        "name": app["name"],
        "summary": app["summary"],
        "icon": app.get("icon"),
    }

    return short_app


def load_appstream():
    apps = utils.appstream2dict("repo")

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
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
            db.redis_search.delete_document(f"fts:{appid}")

        new_apps_zset = {appid: db.redis_conn.get(f"updated_at:{appid}") for appid in set(apps) - current_apps}
        if len(new_apps_zset) != len(apps) and len(new_apps_zset) > 0:
            db.redis_conn.zadd("new_apps_zset", new_apps_zset)

        p.delete("apps:index")
        p.sadd("apps:index", *[f"apps:{appid}" for appid in apps])
        p.execute()

    return len(apps)


def populate_build_dates():
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

        if arch != "x86_64" or branch != "stable":
            continue

        timestamp = struct.pack("<Q", info["ostree.commit.timestamp"])
        timestamp = struct.unpack(">Q", timestamp)[0]

        recently_updated[appid] = timestamp

    db.redis_conn.zadd("recently_updated_zset", recently_updated)
    db.redis_conn.mset(
        {
            f"updated_at:{appid}": recently_updated[appid]
            for appid in recently_updated
        }
    )

    return len(recently_updated)


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
    populate_build_dates()
    return load_appstream()


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
