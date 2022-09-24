import json
import re

from . import db, search, utils


def load_appstream():
    apps = utils.appstream2dict("repo")

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    current_categories = db.redis_conn.smembers("categories:index")
    current_developers = db.redis_conn.smembers("developers:index")
    current_projectgroups = db.redis_conn.smembers("developers:projectgroups")

    with db.redis_conn.pipeline() as p:
        p.delete("categories:index", *current_categories)
        p.delete("developers:index", *current_developers)
        p.delete("projectgroups:index", *current_projectgroups)

        clean_html_re = re.compile("<.*?>")
        search_apps = []
        for appid in apps:
            redis_key = f"apps:{appid}"

            search_description = re.sub(clean_html_re, "", apps[appid]["description"])

            search_keywords = apps[appid].get("keywords")

            # order of the dict is important for attritbute ranking
            search_apps.append(
                {
                    "id": utils.get_clean_app_id(appid),
                    "name": apps[appid]["name"],
                    "summary": apps[appid]["summary"],
                    "downloads_last_month": 0,
                    "keywords": search_keywords,
                    "app_id": appid,
                    "description": search_description,
                    "icon": apps[appid]["icon"],
                }
            )

            if developer_name := apps[appid].get("developer_name"):
                p.sadd("developers:index", developer_name)
                p.sadd(f"developers:{developer_name}", redis_key)

            if project_group := apps[appid].get("project_group"):
                p.sadd("projectgroups:index", project_group)
                p.sadd(f"projectgroups:{project_group}", redis_key)

            p.set(f"apps:{appid}", json.dumps(apps[appid]))

            if categories := apps[appid].get("categories"):
                for category in categories:
                    p.sadd("categories:index", category)
                    p.sadd(f"categories:{category}", redis_key)

        search.add_apps(search_apps)

        apps_to_delete_from_search = []
        for appid in current_apps - set(apps):
            p.delete(
                f"apps:{appid}",
                f"summary:{appid}",
                f"app_stats:{appid}",
            )
            apps_to_delete_from_search.append(utils.get_clean_app_id(appid))
        search.delete_apps(apps_to_delete_from_search)

        new_apps = set(apps) - current_apps
        if not len(new_apps):
            new_apps = None

        p.delete("apps:index")
        p.sadd("apps:index", *[f"apps:{appid}" for appid in apps])
        p.execute()

    return new_apps


def list_appstream():
    apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    return sorted(apps)


def get_recently_updated(limit: int = 100):
    zset = db.redis_conn.zrevrange("recently_updated_zset", 0, limit - 1)
    return [appid for appid in zset if db.redis_conn.exists(f"apps:{appid}")]


def get_recently_added(limit: int = 100):
    zset = db.redis_conn.zrevrange("new_apps_zset", 0, limit - 1)
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


def get_project_group(project_group: str):
    if index := db.redis_conn.smembers(f"projectgroups:{project_group}"):
        return [appid.removeprefix("apps:") for appid in index]
    else:
        return []
