import json
import re

import gi

from . import db, models, schemas, search, utils

gi.require_version("AppStream", "1.0")
from gi.repository import AppStream

clean_html_re = re.compile("<.*?>")
all_main_categories = schemas.get_main_categories()


def add_to_search(app_id: str, app: dict) -> dict:
    search_description = re.sub(clean_html_re, "", app["description"])

    search_keywords = app.get("keywords")

    project_license = app.get("project_license", "")

    categories = app.get("categories", [])
    main_categories = [
        category for category in categories if category.lower() in all_main_categories
    ]
    sub_categories = [
        category
        for category in categories
        if category.lower() not in all_main_categories
    ]

    type = "desktop-application" if app.get("type") == "desktop" else app.get("type")

    # order of the dict is important for attritbute ranking
    return {
        "id": utils.get_clean_app_id(app_id),
        "type": type,
        "name": app["name"],
        "summary": app["summary"],
        "keywords": search_keywords,
        "project_license": project_license,
        "is_free_license": AppStream.license_is_free_license(project_license),
        "app_id": app_id,
        "description": search_description,
        "icon": app["icon"],
        "categories": categories,
        "main_categories": main_categories,
        "sub_categories": sub_categories,
        "developer_name": app.get("developer_name"),
        "verification_verified": app.get("metadata", {}).get(
            "flathub::verification::verified", False
        ),
        "verification_method": app.get("metadata", {}).get(
            "flathub::verification::method", None
        ),
        "verification_login_name": app.get("metadata", {}).get(
            "flathub::verification::login_name", None
        ),
        "verification_login_provider": app.get("metadata", {}).get(
            "flathub::verification::login_provider", None
        ),
        "verification_login_is_organization": app.get("metadata", {}).get(
            "flathub::verification::login_is_organization", None
        ),
        "verification_website": app.get("metadata", {}).get(
            "flathub::verification::website", None
        ),
        "verification_timestamp": app.get("metadata", {}).get(
            "flathub::verification::timestamp", None
        ),
        "runtime": app.get("bundle", {}).get("runtime", None),
    }


# keep in sync with db.is_appid_for_frontend
def show_in_frontend(app: dict) -> bool:
    if app.get("type") == "desktop":
        return True

    if app.get("type") == "desktop-application":
        return True

    if (
        app.get("type") == "console-application"
        and app.get("icon")
        and app.get("screenshots")
    ):
        return True

    return False


def load_appstream(sqldb):
    apps = utils.appstream2dict()

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    current_types = db.redis_conn.smembers("types:index")

    with db.redis_conn.pipeline() as p:
        p.delete("developers:index")
        p.delete("types:index")
        for type in current_types:
            p.delete(f"types:{type}")

        search_apps = []
        postgres_apps = []
        for app_id in apps:
            redis_key = f"apps:{app_id}"

            if show_in_frontend(apps[app_id]):
                search_apps.append(add_to_search(app_id, apps[app_id]))

                if developer_name := apps[app_id].get("developer_name"):
                    p.sadd("developers:index", developer_name)

            p.set(redis_key, json.dumps(apps[app_id]))

            if type := apps[app_id].get("type"):
                # TODO: standardize around desktop-application
                if type == "desktop-application":
                    type = "desktop"

                p.sadd("types:index", type)
                p.sadd(f"types:{type}", redis_key)
            else:
                type = "generic"

            # only used for compat
            if categories := apps[app_id].get("categories"):
                for category in categories:
                    p.sadd(f"categories:{category}", redis_key)

            postgres_apps.append(
                {
                    "app_id": app_id,
                    "type": type,
                }
            )

        search.create_or_update_apps(search_apps)

        for app in postgres_apps:
            models.Apps.set_app(sqldb, app["app_id"], app["type"])

        apps_to_delete_from_search = []
        for app_id in current_apps - set(apps):
            p.delete(
                f"apps:{app_id}",
                f"summary:{app_id}",
                f"app_stats:{app_id}",
            )
            apps_to_delete_from_search.append(utils.get_clean_app_id(app_id))
        search.delete_apps(apps_to_delete_from_search)

        for app_id in current_apps - set(apps):
            models.Apps.delete_app(sqldb, app_id)

        p.delete("apps:index")
        p.sadd("apps:index", *[f"apps:{app_id}" for app_id in apps])
        p.execute()


# Only used for sitemap
def list_desktop_appstream():
    apps_desktop = {app[5:] for app in db.redis_conn.smembers("types:desktop")}
    apps_desktop_application = {
        app[5:] for app in db.redis_conn.smembers("types:desktop-application")
    }
    apps_console_application = {
        app[5:] for app in db.redis_conn.smembers("types:console-application")
    }

    return sorted(
        list(apps_desktop | apps_desktop_application | apps_console_application)
    )


# Only used for compat
def get_recently_updated(limit: int = 100):
    zset = db.redis_conn.zrevrange("recently_updated_zset", 0, limit - 1)
    return [
        app_id
        for app_id in zset
        if db.redis_conn.exists("types:desktop-application", f"apps:{app_id}")
        or db.redis_conn.exists("types:desktop", f"apps:{app_id}")
    ]


# Only used for compat
def get_recently_added(limit: int = 100):
    zset = db.redis_conn.zrevrange("new_apps_zset", 0, limit - 1)
    return [
        app_id
        for app_id in zset
        if db.redis_conn.exists("types:desktop-application", f"apps:{app_id}")
        or db.redis_conn.exists("types:desktop", f"apps:{app_id}")
    ]


def get_addons(app_id: str, branch: str = "stable") -> list[str]:
    result = []
    summary = db.get_json_key(f"summary:{app_id}:{branch}")
    if (
        summary
        and "metadata" in summary
        and summary["metadata"]
        and "extensions" in summary["metadata"]
        and summary["metadata"]["extensions"]
    ):
        extension_ids = list(summary["metadata"]["extensions"].keys())

        apps = {app[5:] for app in db.redis_conn.smembers("types:addon")}

        for app in apps:
            for extension_id in extension_ids:
                if app.startswith(extension_id):
                    result.append(app)

    return result
