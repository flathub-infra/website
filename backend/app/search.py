from urllib.parse import unquote

import meilisearch
from pydantic import BaseModel

from . import config, schemas


class Filter(BaseModel):
    filterType: str
    value: str


class SearchQuery(BaseModel):
    query: str
    filters: list[Filter] | None = None


client = meilisearch.Client(
    config.settings.meilisearch_url, config.settings.meilisearch_master_key
)
client.create_index("apps", {"primaryKey": "id"})
client.index("apps").update_sortable_attributes(
    [
        "installs_last_month",
        "trending",
        "added_at",
        "updated_at",
        "verification_timestamp",
    ]
)
client.index("apps").update_searchable_attributes(
    ["name", "keywords", "summary", "description", "id"]
)
client.index("apps").update_filterable_attributes(
    [
        "categories",
        "main_categories",
        "sub_categories",
        "developer_name",
        "verification_verified",
        "is_free_license",
        "runtime",
        "type",
        "arches",
        "icon",
        "keywords",
        "isMobileFriendly",
    ]
)


def _translate_name_and_summary(locale: str, searchResults: dict):
    fallbackLocale = locale.split("-")[0]

    for searchResult in searchResults["hits"]:
        picked_locale = None

        if "translations" in searchResult and searchResult["translations"]:
            if locale in searchResult["translations"].keys():
                picked_locale = locale
            elif fallbackLocale in searchResult["translations"].keys():
                picked_locale = fallbackLocale

        if not picked_locale:
            continue

        if "name" in searchResult["translations"][picked_locale]:
            searchResult["name"] = searchResult["translations"][picked_locale]["name"]

        if "summary" in searchResult["translations"][picked_locale]:
            searchResult["summary"] = searchResult["translations"][picked_locale][
                "summary"
            ]

        if "description" in searchResult["translations"][picked_locale]:
            searchResult["description"] = searchResult["translations"][picked_locale][
                "description"
            ]

        if "translations" in searchResult:
            del searchResult["translations"]

    return searchResults


def create_or_update_apps(apps_to_update: list[dict]):
    client.index("apps").update_documents(apps_to_update)


def delete_apps(app_id_list):
    if len(app_id_list) > 0:
        return client.index("apps").delete_documents(app_id_list)
    return None


def get_by_selected_categories(
    selected_categories: list[schemas.MainCategory],
    page: int | None,
    hits_per_page: int | None,
    locale: str,
):
    category_list = [
        f"categories = {category.value}" for category in selected_categories
    ]

    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "filter": [
                    category_list,
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
                "sort": ["installs_last_month:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
            },
        ),
    )


def get_by_selected_category_and_subcategory(
    selected_category: schemas.MainCategory,
    selected_subcategory: str,
    page: int | None,
    hits_per_page: int | None,
    locale: str,
):
    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "filter": [
                    f"main_categories = {selected_category.value}",
                    f"sub_categories = {selected_subcategory}",
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
                "sort": ["installs_last_month:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
            },
        ),
    )


def get_by_installs_last_month(
    page: int | None, hits_per_page: int | None, locale: str
):
    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "sort": ["installs_last_month:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
                "filter": [
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
            },
        ),
    )


def get_by_trending(page: int | None, hits_per_page: int | None, locale: str):
    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "sort": ["trending:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
                "filter": [
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
            },
        ),
    )


def get_by_added_at(page: int | None, hits_per_page: int | None, locale: str):
    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "sort": ["added_at:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
                "filter": [
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
            },
        ),
    )


def get_by_updated_at(page: int | None, hits_per_page: int | None, locale: str):
    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "sort": ["updated_at:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
                "filter": [
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
            },
        ),
    )


def get_by_verified(page: int | None, hits_per_page: int | None, locale: str):
    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "filter": [
                    "verification_verified = true",
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
                "sort": ["verification_timestamp:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
            },
        ),
    )


def get_by_mobile(page: int | None, hits_per_page: int | None, locale: str):
    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "filter": [
                    "isMobileFriendly = true",
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
                "sort": ["trending:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
            },
        ),
    )


def get_by_developer(
    developer: str, page: int | None, hits_per_page: int | None, locale: str
):
    escaped_developer = (
        developer.replace("'", "\\'").replace('"', '\\"').replace("/", "\\/")
    )

    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "filter": [
                    f"developer_name = '{escaped_developer}'",
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
                "sort": ["installs_last_month:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
            },
        ),
    )


def get_by_keyword(
    keyword: str, page: int | None, hits_per_page: int | None, locale: str
):
    escaped_keyword = (
        keyword.replace("'", "\\'").replace('"', '\\"').replace("/", "\\/")
    )

    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            "",
            {
                "filter": [
                    f"keywords = '{escaped_keyword}'",
                    "type IN [console-application, desktop-application]",
                    "NOT icon IS NULL",
                ],
                "sort": ["installs_last_month:desc"],
                "hitsPerPage": hits_per_page or 250,
                "page": page or 1,
            },
        ),
    )


## remove this, when compat get's removed
def search_apps(query: str, locale: str, free_software_only: bool = False):
    query = unquote(query)

    filters = ["type in desktop-application, console-application"]

    if free_software_only:
        filters.append("is_free_license = true")

    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            query,
            {"limit": 250, "sort": ["installs_last_month:desc"], "filter": filters},
        ),
    )


def search_apps_post(searchquery: SearchQuery, locale: str):
    filters = []

    filteringForType = False
    filteringForDesktopOrConsole = False

    for filter in searchquery.filters or []:
        if filter.filterType == "type":
            filteringForType = True

            if filter.value == "desktop-application":
                filteringForDesktopOrConsole = True
            elif filter.value == "console-application":
                filteringForDesktopOrConsole = True

        filters.append(f"{filter.filterType} = '{filter.value}'")

    if not filteringForType and not filteringForDesktopOrConsole:
        filters.append("type IN [desktop-application, console-application]")

    if not (filteringForType and not filteringForDesktopOrConsole):
        filters.append("NOT icon IS NULL")

    filterString = " AND ".join(filters)

    return _translate_name_and_summary(
        locale,
        client.index("apps").search(
            searchquery.query,
            {
                "limit": 250,
                "sort": ["installs_last_month:desc"],
                "filter": filterString if filterString else None,
                "facets": [
                    "verification_verified",
                    "main_categories",
                    "is_free_license",
                    "type",
                    "arches",
                ],
            },
        ),
    )


def get_runtime_list():
    return client.index("apps").search(
        "",
        {
            "limit": 0,
            "sort": ["installs_last_month:desc"],
            "facets": ["runtime"],
        },
    )["facetDistribution"]["runtime"]
