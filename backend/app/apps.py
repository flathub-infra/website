import json
import re

import gi

from . import database, db, localize, models, schemas, search, utils

gi.require_version("AppStream", "1.0")
from gi.repository import AppStream

clean_html_re = re.compile("<.*?>")
all_main_categories = schemas.get_main_categories()


def add_to_search(app_id: str, app: dict, apps_locale: dict) -> dict:
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

    translations = {}
    for key, apps in apps_locale.items():
        if app_id in apps and key in localize.LOCALES:
            filtered_translations = dict(
                filter(
                    lambda x: (
                        x[0] == "name" or x[0] == "summary" or x[0] == "description"
                    )
                    and len(x[1]) > 0,
                    apps[app_id].items(),
                )
            )

            if "description" in filtered_translations:
                filtered_translations["description"] = re.sub(
                    clean_html_re, "", filtered_translations["description"]
                )

            translations[key] = filtered_translations

    # order of the dict is important for attribute ranking
    return {
        "id": utils.get_clean_app_id(app_id),
        "type": type,
        "name": app["name"],
        "summary": app["summary"],
        "translations": translations,
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


def load_appstream(sqldb) -> None:
    apps, apps_locale = utils.appstream2dict()

    current_apps = get_appids()

    with db.redis_conn.pipeline() as p:
        p.delete("developers:index")

        search_apps = []
        postgres_apps = []

        for app_id in apps:
            redis_key = f"apps:{app_id}"

            if show_in_frontend(apps[app_id]):
                search_apps.append(
                    add_to_search(
                        app_id,
                        apps[app_id],
                        apps_locale,
                    )
                )

                if developer_name := apps[app_id].get("developer_name"):
                    p.sadd("developers:index", developer_name)

            p.set(redis_key, json.dumps(apps[app_id]))

            if type := apps[app_id].get("type"):
                # "desktop" dates back to appstream-glib, need to handle that for backwards compat
                if type == "desktop":
                    type = "desktop-application"
            else:
                type = None

            postgres_apps.append(
                {
                    "app_id": app_id,
                    "type": type,
                }
            )
            for locale, value in apps_locale.items():
                if app_id in value:
                    p.set(f"apps_locale:{app_id}:{locale}", json.dumps(value[app_id]))

            models.Apps.set_app(sqldb, app_id, type)

        search.create_or_update_apps(search_apps)

        apps_to_delete_from_search = []
        for app_id in current_apps - set(apps):
            p.delete(
                f"apps:{app_id}",
                f"apps_locale:{app_id}",
                f"summary:{app_id}",
                f"app_stats:{app_id}",
            )
            apps_to_delete_from_search.append(utils.get_clean_app_id(app_id))
        search.delete_apps(apps_to_delete_from_search)

        for app_id in current_apps - set(apps):
            models.Apps.delete_app(sqldb, app_id)

        p.execute()


def get_appids() -> list[str]:
    with database.get_db() as sqldb:
        current_apps = set(
            app.app_id
            for app in sqldb.query(models.Apps.app_id)
            .filter(models.Apps.type.in_(["desktop", "console-application"]))
            .all()
        )
    return list(current_apps)


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

        with database.get_db() as sqldb:
            addons = set(
                addon.app_id
                for addon in sqldb.session.query(models.Apps.app_id)
                .filter(models.Apps.type == "addon")
                .all()
            )

        for addon in addons:
            for extension_id in extension_ids:
                if addon.startswith(extension_id):
                    result.append(addon)

    return result
