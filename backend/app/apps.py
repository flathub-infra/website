import re
import json

from . import utils
from . import db


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

            clean_html_re = re.compile("<.*?>")
            search_description = re.sub(clean_html_re, "", apps[appid]["description"])

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
            p.delete(f"apps:{appid}", f"fts:{appid}", f"summary:{appid}")
            db.redis_search.delete_document(f"fts:{appid}")

        new_apps = set(apps) - current_apps
        if not (len(new_apps) != len(apps) and len(new_apps)):
            new_apps = None

        p.delete("apps:index")
        p.sadd("apps:index", *[f"apps:{appid}" for appid in apps])
        p.execute()

    return new_apps


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
    app = db.get_json_key(f"apps:{appid}")
    if not app:
        return []

    return app


def list_appstream(repo: str = "stable"):
    apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    return sorted(apps)


def get_recently_updated(limit: int = 100):
    apps = db.redis_conn.zrevrange("recently_updated_zset", 0, limit - 1)
    keys = (f"apps:{appid}" for appid in apps)
    ret = list_apps_summary(appids=keys, sort=False)
    return ret
