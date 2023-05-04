from urllib.parse import unquote

import meilisearch

from . import config, schemas

client = meilisearch.Client(
    config.settings.meilisearch_url, config.settings.meilisearch_master_key
)
client.create_index("apps", {"primaryKey": "id"})
client.index("apps").update_sortable_attributes(
    ["installs_last_month", "added_at", "updated_at", "verification_timestamp"]
)
client.index("apps").update_searchable_attributes(
    ["name", "summary", "keywords", "description", "id"]
)
client.index("apps").update_filterable_attributes(
    [
        "categories",
        "developer_name",
        "verification_verified",
        "is_free_license",
    ]
)


def create_or_update_apps(apps_to_update):
    return client.index("apps").update_documents(apps_to_update)


def delete_apps(app_id_list):
    if len(app_id_list) > 0:
        return client.index("apps").delete_documents(app_id_list)
    return None


def get_by_selected_categories(
    selected_categories: list[schemas.MainCategory], page: int, hits_per_page: int
):
    category_list = [
        f"categories = {category.value}" for category in selected_categories
    ]

    return client.index("apps").search(
        "",
        {
            "filter": [category_list],
            "sort": ["installs_last_month:desc"],
            "hitsPerPage": hits_per_page or 250,
            "page": page or 1,
        },
    )


def get_by_installs_last_month(page: int, hits_per_page: int):
    return client.index("apps").search(
        "",
        {
            "sort": ["installs_last_month:desc"],
            "hitsPerPage": hits_per_page or 250,
            "page": page or 1,
        },
    )


def get_by_added_at(page: int, hits_per_page: int):
    return client.index("apps").search(
        "",
        {
            "sort": ["added_at:desc"],
            "hitsPerPage": hits_per_page or 250,
            "page": page or 1,
        },
    )


def get_by_updated_at(page: int, hits_per_page: int):
    return client.index("apps").search(
        "",
        {
            "sort": ["updated_at:desc"],
            "hitsPerPage": hits_per_page or 250,
            "page": page or 1,
        },
    )


def get_by_verified(page: int, hits_per_page: int):
    return client.index("apps").search(
        "",
        {
            "filter": ["verification_verified = true"],
            "sort": ["verification_timestamp:desc"],
            "hitsPerPage": hits_per_page or 250,
            "page": page or 1,
        },
    )


def get_by_developer(developer: str, page: int, hits_per_page: int):
    escaped_developer = (
        developer.replace("'", "\\'")
        .replace('"', '\\"')
        .replace("(", "\\(")
        .replace(")", "\\)")
        .replace("/", "\\/")
    )

    return client.index("apps").search(
        "",
        {
            "filter": [f"developer_name = '{escaped_developer}'"],
            "sort": ["installs_last_month:desc"],
            "hitsPerPage": hits_per_page or 250,
            "page": page or 1,
        },
    )


def search_apps(query: str, free_software_only: bool = False):
    query = unquote(query)

    return client.index("apps").search(
        query,
        {
            "limit": 250,
            "sort": ["installs_last_month:desc"],
            "filter": ["is_free_license = true"] if free_software_only else None,
        },
    )
