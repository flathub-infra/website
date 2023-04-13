import json
import re

from . import db, search, utils


def load_appstream():
    apps = utils.appstream2dict("repo")

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    current_developers = db.redis_conn.smembers("developers:index")
    current_projectgroups = db.redis_conn.smembers("projectgroups:index")

    with db.redis_conn.pipeline() as p:
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
                    "keywords": search_keywords,
                    "app_id": appid,
                    "description": search_description,
                    "icon": apps[appid]["icon"],
                    "categories": apps[appid].get("categories"),
                    "developer_name": apps[appid].get("developer_name"),
                    "project_group": apps[appid].get("project_group"),
                    "verification_verified": apps[appid]
                    .get("custom", {})
                    .get("flathub::verification::verified", None),
                    "verification_method": apps[appid]
                    .get("custom", {})
                    .get("flathub::verification::method", None),
                    "verification_login_name": apps[appid]
                    .get("custom", {})
                    .get("flathub::verification::login_name", None),
                    "verification_login_provider": apps[appid]
                    .get("custom", {})
                    .get("flathub::verification::login_provider", None),
                    "verification_login_is_organization": apps[appid]
                    .get("custom", {})
                    .get("flathub::verification::login_is_organization", None),
                    "verification_website": apps[appid]
                    .get("custom", {})
                    .get("flathub::verification::website", None),
                    "verification_timestamp": apps[appid]
                    .get("custom", {})
                    .get("flathub::verification::timestamp", None),
                }
            )

            if developer_name := apps[appid].get("developer_name"):
                p.sadd("developers:index", developer_name)

            if project_group := apps[appid].get("project_group"):
                p.sadd("projectgroups:index", project_group)

            p.set(f"apps:{appid}", json.dumps(apps[appid]))

            if categories := apps[appid].get("categories"):
                for category in categories:
                    p.sadd(f"categories:{category}", redis_key)

        search.create_or_update_apps(search_apps)

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
