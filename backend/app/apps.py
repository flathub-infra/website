import logging
import re
from enum import StrEnum

import gi

from . import database, localize, models, schemas, search, utils
from .quality_metadata import update_quality_metadata_timestamps
from .types import JSONValue, is_json_object

gi.require_version("AppStream", "1.0")
from gi.repository import AppStream  # ty: ignore[unresolved-import]

logger = logging.getLogger(__name__)

clean_html_re = re.compile("<.*?>")
all_main_categories = schemas.get_main_categories()


class AppType(StrEnum):
    APPS = "apps"
    DESKTOP = "desktop"
    DESKTOP_APPLICATION = "desktop-application"
    CONSOLE_APPLICATION = "console-application"
    LOCALIZATION = "localization"
    GENERIC = "generic"
    EXTENSION = "extension"
    ADDON = "addon"
    RUNTIME = "runtime"


class SortBy(StrEnum):
    ALPHABETICAL = "alphabetical"
    CREATED_AT = "created-at"
    LAST_UPDATED_AT = "last-updated-at"


def add_to_search(
    app_id: str, app: dict[str, JSONValue], apps_locale: dict[str, JSONValue]
) -> dict[str, JSONValue]:
    description = app.get("description")
    search_description = (
        re.sub(clean_html_re, "", description) if isinstance(description, str) else ""
    )

    search_keywords = app.get("keywords")
    if isinstance(search_keywords, list):
        search_keywords = [
            keyword for keyword in search_keywords if isinstance(keyword, str)
        ]
    else:
        search_keywords = None

    project_license = app.get("project_license", "")
    if not isinstance(project_license, str):
        project_license = ""

    raw_categories = app.get("categories", [])
    categories = (
        [category for category in raw_categories if isinstance(category, str)]
        if isinstance(raw_categories, list)
        else []
    )
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

    app_type = app.get("type")
    app_type = "desktop-application" if app_type == "desktop" else app_type

    translations = {}
    localized_keywords_set: set[str] = set(search_keywords or [])
    for key, apps in apps_locale.items():
        if key in localize.LANGUAGES:
            if not is_json_object(apps):
                continue

            filtered_translations = {}
            for k, v in apps.items():
                if k in ("name", "summary", "description"):
                    if isinstance(v, str) and len(v) > 0:
                        filtered_translations[k] = v
                elif k == "keywords" and isinstance(v, list) and len(v) > 0:
                    keywords = [
                        keyword
                        for keyword in v
                        if isinstance(keyword, str) and len(keyword) > 0
                    ]
                    if keywords:
                        filtered_translations[k] = keywords
                        localized_keywords_set.update(keywords)

            description = filtered_translations.get("description")
            if isinstance(description, str):
                filtered_translations["description"] = re.sub(
                    clean_html_re, "", description
                )

            if filtered_translations:
                translations[key] = filtered_translations

    localized_keywords = (
        sorted(localized_keywords_set) if localized_keywords_set else None
    )
    metadata_value = app.get("metadata")
    metadata = metadata_value if is_json_object(metadata_value) else {}
    bundle_value = app.get("bundle")
    bundle = bundle_value if is_json_object(bundle_value) else {}

    # order of the dict is important for attribute ranking
    document = {
        "id": utils.get_clean_app_id(app_id),
        "type": app_type,
        "name": app["name"],
        "isMobileFriendly": app.get("isMobileFriendly", False),
        "summary": app["summary"],
        "translations": translations,
        "keywords": search_keywords,
        "localized_keywords": localized_keywords,
        "project_license": project_license,
        "is_free_license": AppStream.license_is_free_license(project_license),
        "app_id": app_id,
        "description": search_description,
        "icon": app["icon"],
        "main_categories": main_categories,
        "sub_categories": sub_categories,
        "developer_name": app.get("developer_name"),
        "verification_verified": metadata.get("flathub::verification::verified", False),
        "verification_method": metadata.get("flathub::verification::method"),
        "verification_login_name": metadata.get("flathub::verification::login_name"),
        "verification_login_provider": metadata.get(
            "flathub::verification::login_provider"
        ),
        "verification_login_is_organization": metadata.get(
            "flathub::verification::login_is_organization"
        ),
        "verification_website": metadata.get("flathub::verification::website"),
        "verification_timestamp": metadata.get("flathub::verification::timestamp"),
        "runtime": bundle.get("runtime"),
    }
    if not is_json_object(document):
        raise TypeError("Search document must be a JSON object")
    return document


def load_appstream(sqldb) -> None:
    apps = utils.appstream2dict()

    all_apps = get_appids(include_eol=True)
    non_eol_apps = get_appids(include_eol=False)

    search_apps = []
    developers = set()

    for app_id in apps:
        app = apps[app_id]
        locales_value = app.get("locales")
        locales = locales_value if is_json_object(locales_value) else {}
        if app_id in non_eol_apps:
            search_apps.append(add_to_search(app_id, app, locales))

        if (
            isinstance(developer_name := app.get("developer_name"), str)
            and developer_name
        ):
            models.Developers.create(sqldb, developer_name)
            developers.add(developer_name)

        if type := app.get("type"):
            # "desktop" dates back to appstream-glib, need to handle that for backwards compat
            if type == "desktop":
                type = "desktop-application"
        else:
            type = None

        app_data = app.copy()
        locales = app_data.pop("locales")
        content_rating_details = app_data.pop("content_rating_details", None)

        raw_categories = app.get("categories", [])
        categories = (
            [category for category in raw_categories if isinstance(category, str)]
            if isinstance(raw_categories, list)
            else []
        )
        main_categories_list = [
            category
            for category in categories
            if category.lower() in all_main_categories
        ]
        sub_categories_list = [
            category
            for category in categories
            if category.lower() not in all_main_categories
        ]

        # Only keep the first main_category, move rest to sub_categories
        main_category = None
        if len(main_categories_list) > 0:
            sub_categories_list = sub_categories_list + main_categories_list[1:]
            main_category = main_categories_list[0]

        try:
            app = models.App.set_app(
                sqldb, app_id, type, locales, content_rating_details
            )
            if app:
                app.quality_metadata_updated_at = update_quality_metadata_timestamps(
                    app.appstream,
                    app_data,
                    app.quality_metadata_updated_at,
                    utils.utcnow().isoformat(),
                )
                app.appstream = app_data
                app.main_category = main_category
                app.sub_categories = (
                    sub_categories_list if sub_categories_list else None
                )
                sqldb.session.add(app)
                sqldb.session.commit()
        except Exception:
            sqldb.session.rollback()
            logger.exception("Error updating app %s", app_id)

    search.create_or_update_apps(search_apps)

    current_developers = models.Developers.all(sqldb.session)
    for developer in current_developers:
        if developer.name not in developers:
            models.Developers.delete(sqldb, developer.name)

    apps_to_delete_from_search = []
    for app_id in set(all_apps) - set(apps):
        apps_to_delete_from_search.append(utils.get_clean_app_id(app_id))

        # Preserve app_stats when deleting app
        app_stats = models.AppStats.get_stats(sqldb, app_id)
        if app_stats:
            continue

        models.App.delete_app(sqldb, app_id)

    search.delete_apps(apps_to_delete_from_search)


def get_appids(
    type: AppType = AppType.APPS,
    include_eol: bool = False,
    sort_by: SortBy = SortBy.ALPHABETICAL,
) -> list[str]:
    filter = None

    if type == AppType.EXTENSION or type == AppType.ADDON:
        filter = ["addon"]
    elif type == AppType.RUNTIME:
        filter = ["runtime"]
    elif type == AppType.DESKTOP:
        filter = ["desktop"]
    elif type == AppType.DESKTOP_APPLICATION:
        filter = ["desktop-application"]
    elif type == AppType.CONSOLE_APPLICATION:
        filter = ["console-application"]
    elif type == AppType.LOCALIZATION:
        filter = ["localization"]
    elif type == AppType.GENERIC:
        filter = ["generic"]
    else:  # AppType.APPS (default)
        filter = ["desktop-application", "console-application"]

    with database.get_db() as sqldb:
        query = sqldb.query(
            models.App.app_id, models.App.created_at, models.App.last_updated_at
        ).filter(models.App.type.in_(filter))

        if not include_eol:
            query = query.filter(~models.App.is_eol)

        if sort_by == SortBy.CREATED_AT:
            query = query.order_by(models.App.created_at.desc())
        elif sort_by == SortBy.LAST_UPDATED_AT:
            query = query.order_by(models.App.last_updated_at.desc().nulls_last())
        else:  # SortBy.ALPHABETICAL (default)
            query = query.order_by(models.App.app_id)

        current_apps = [app.app_id for app in query.all()]
    return current_apps


def get_addons(app_id: str, branch: str = "stable") -> list[str]:
    result = []

    with database.get_db() as sqldb:
        app = models.App.by_appid(sqldb, app_id)
        if not app or not app.summary or models.App.is_fully_eol(sqldb, app_id):
            return result

        metadata = app.summary.get("metadata", {})
        if not metadata or "extensions" not in metadata:
            return result

        extension_ids: list[str] = []
        for ext_id, ext_data in metadata["extensions"].items():
            has_version = False
            if "version" in ext_data:
                has_version = True
                extension_ids.append(f"{ext_id}//{ext_data['version']}")
            if "versions" in ext_data:
                has_version = True
                versions = (
                    v.strip() for v in ext_data["versions"].split(";") if v.strip()
                )
                extension_ids.extend(f"{ext_id}//{version}" for version in versions)
            if not has_version:
                extension_ids.append(f"{ext_id}//{branch}")

        addons = {
            f"{addon.app_id}//{addon.summary.get('branch', branch) if addon.summary else branch}"
            for addon in sqldb.query(models.App)
            .filter(models.App.type == "addon")
            .filter(~models.App.is_eol)
            .all()
        }

        for addon in addons:
            for extension_id in extension_ids:
                id_part, branch_part = extension_id.split("//", 1)
                if addon.startswith(id_part) and addon.endswith(branch_part):
                    result.append(addon)

    return result


def get_appstream(app_id: str) -> dict[str, JSONValue] | None:
    with database.get_db() as sqldb:
        return models.App.get_appstream(sqldb, app_id)
