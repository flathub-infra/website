import json
import re

from . import db, utils


def load_appstream():
    apps = utils.appstream2dict("repo")

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    current_categories = db.redis_conn.smembers("categories:index")
    current_developers = db.redis_conn.smembers("developers:index")
    current_types = db.redis_conn.smembers("types:index")

    db.initialize()
    with db.redis_conn.pipeline() as p:
        p.delete("categories:index", *current_categories)
        p.delete("developers:index", *current_developers)
        p.delete("types:index", *current_types)

        for appid in apps:
            redis_key = f"apps:{appid}"

            if apps[appid].get("type") == "desktop":
                clean_html_re = re.compile("<.*?>")
                search_description = re.sub(
                    clean_html_re, "", apps[appid]["description"]
                )

                if search_keywords := apps[appid].get("keywords"):
                    search_keywords = " ".join(search_keywords)
                else:
                    search_keywords = ""

                fts = {
                    "id": appid,
                    "name": apps[appid]["name"],
                    "summary": apps[appid]["summary"],
                    "description": search_description,
                    "keywords": search_keywords,
                }

                if developer_name := apps[appid].get("developer_name"):
                    p.sadd("developers:index", developer_name)
                    p.sadd(f"developers:{developer_name}", redis_key)

                p.hset(f"fts:{appid}", mapping=fts)

            p.set(f"apps:{appid}", json.dumps(apps[appid]))

            if type := apps[appid].get("type"):
                p.sadd("types:index", type)
                p.sadd(f"types:{type}", redis_key)

            if extends := apps[appid].get("extends"):
                p.sadd(f"addons:{extends}", redis_key)

            if categories := apps[appid].get("categories"):
                for category in categories:
                    p.sadd("categories:index", category)
                    p.sadd(f"categories:{category}", redis_key)

        for appid in current_apps - set(apps):
            p.delete(
                f"apps:{appid}",
                f"fts:{appid}",
                f"summary:{appid}",
                f"app_stats:{appid}",
                f"addons:{appid}",
            )
            db.redis_conn.ft().delete_document(f"fts:{appid}")

        new_apps = set(apps) - current_apps
        if not len(new_apps):
            new_apps = None

        p.delete("apps:index")
        p.sadd("apps:index", *[f"apps:{appid}" for appid in apps])
        p.execute()

    return new_apps


def list_appstream(type: str = "desktop"):
    apps = {app[5:] for app in db.redis_conn.smembers(f"types:{type}")}
    return sorted(apps)


def get_recently_updated(limit: int = 100):
    zset = db.redis_conn.zrevrange("recently_updated_zset", 0, limit - 1)
    return [appid for appid in zset if db.redis_conn.exists(f"apps:{appid}")]


def get_category(category: str):
    if index := db.redis_conn.smembers(f"categories:{category}"):
        return [appid.removeprefix("apps:") for appid in index]
    else:
        return []


def get_developer(developer: str):
    if index := db.redis_conn.smembers(f"developers:{developer}"):
        return [appid.removeprefix("apps:") for appid in index]
    else:
        return []


def get_addons(appid: str):
    result = []
    if summary := db.get_json_key(f"summary:{appid}"):
        extension_ids = list(summary["metadata"]["extensions"].keys())

        apps = list_appstream(type="addon")

        for app in apps:
            for extension_id in extension_ids:
                if app.startswith(extension_id):
                    result.append(app)

    if index := db.redis_conn.smembers(f"addons:{appid}"):
        json_appdata = db.redis_conn.mget(index)
        appdata = [json.loads(app) for app in json_appdata]

        result.append((app["id"]) for app in appdata)

    return result


def search(query: str):
    if results := db.search(query):
        appids = tuple(doc_id.replace("fts", "apps") for doc_id in results)
        apps = [json.loads(x) for x in db.redis_conn.mget(appids)]

        ret = []
        for app in apps:
            entry = {
                "id": app["id"],
                "name": app["name"],
                "summary": app["summary"],
                "icon": app.get("icon"),
            }
            ret.append(entry)

        return ret

    return []
