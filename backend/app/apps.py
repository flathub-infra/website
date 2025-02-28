import re
from enum import Enum

import gi

from . import database, localize, models, schemas, search, utils

gi.require_version("AppStream", "1.0")
from gi.repository import AppStream

clean_html_re = re.compile("<.*?>")
all_main_categories = schemas.get_main_categories()


class AppType(str, Enum):
    APPS = "apps"
    EXTENSION = "extension"
    RUNTIME = "runtime"


def add_to_search(app_id: str, app: dict, apps_locale: dict) -> dict:
    search_description = (
        re.sub(clean_html_re, "", app["description"])
        if app and app.get("description")
        else ""
    )

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

    # only keep the fist main_category
    # split the rest to the sub_categories
    if len(main_categories) > 0:
        sub_categories = sub_categories + main_categories[1:]
        main_categories = main_categories[0]

    type = "desktop-application" if app.get("type") == "desktop" else app.get("type")

    translations = {}
    for key, apps in apps_locale.items():
        if key in localize.LOCALES:
            filtered_translations = dict(
                filter(
                    lambda x: (
                        x[0] == "name" or x[0] == "summary" or x[0] == "description"
                    )
                    and len(x[1]) > 0,
                    apps.items(),
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
        "isMobileFriendly": app.get("isMobileFriendly", False),
        "summary": app["summary"],
        "translations": translations,
        "keywords": search_keywords,
        "project_license": project_license,
        "is_free_license": AppStream.license_is_free_license(project_license),
        "app_id": app_id,
        "description": search_description,
        "icon": app["icon"],
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


def load_appstream(sqldb) -> None:
    apps = utils.appstream2dict()

    current_apps = get_appids()

    search_apps = []
    developers = set()

    for app_id in apps:
        search_apps.append(
            add_to_search(
                app_id,
                apps[app_id],
                apps[app_id]["locales"],
            )
        )

        if developer_name := apps[app_id].get("developer_name"):
            models.Developers.create(sqldb, developer_name)
            developers.add(apps[app_id].get("developer_name"))

        if type := apps[app_id].get("type"):
            # "desktop" dates back to appstream-glib, need to handle that for backwards compat
            if type == "desktop":
                type = "desktop-application"
        else:
            type = None

        app_data = apps[app_id].copy()
        locales = app_data.pop("locales")

        try:
            app = models.App.set_app(sqldb, app_id, type, locales)
            if app:
                app.appstream = app_data
                sqldb.session.add(app)
                sqldb.session.commit()
        except Exception as e:
            sqldb.session.rollback()
            print(f"Error updating app {app_id}: {str(e)}")

    search.create_or_update_apps(search_apps)

    current_developers = models.Developers.all(sqldb.session)
    for developer in current_developers:
        if developer.name not in developers:
            models.Developers.delete(sqldb, developer.name)

    apps_to_delete_from_search = []
    for app_id in set(current_apps) - set(apps):
        # Preserve app_stats when deleting app
        app_stats_key = f"app_stats:{app_id}"
        if database.redis_conn.exists(app_stats_key):
            continue

        apps_to_delete_from_search.append(utils.get_clean_app_id(app_id))
        models.App.delete_app(sqldb, app_id)

    search.delete_apps(apps_to_delete_from_search)


def get_appids(type: AppType = AppType.APPS) -> list[str]:
    filter = None

    if type == AppType.EXTENSION:
        filter = ["addon"]
    elif type == AppType.RUNTIME:
        filter = ["runtime"]
    else:
        filter = ["desktop-application", "console-application"]

    with database.get_db() as sqldb:
        current_apps = set(
            app.app_id
            for app in sqldb.query(models.App.app_id)
            .filter(models.App.type.in_(filter))
            .all()
        )
    return list(current_apps)


def get_addons(app_id: str, branch: str = "stable") -> list[str]:
    result = []

    with database.get_db() as sqldb:
        app = models.App.by_appid(sqldb, app_id)
        if not app or not app.summary:
            return result

        metadata = app.summary.get("metadata", {})
        if not metadata or "extensions" not in metadata:
            return result

        extension_ids = list(metadata["extensions"].keys())
        addons = set(
            addon.app_id
            for addon in sqldb.query(models.App.app_id)
            .filter(models.App.type == "addon")
            .all()
        )

        for addon in addons:
            for extension_id in extension_ids:
                if addon.startswith(extension_id):
                    result.append(addon)

    return result


def get_appstream(app_id: str) -> dict | None:
    with database.get_db() as sqldb:
        return models.App.get_appstream(sqldb, app_id)
