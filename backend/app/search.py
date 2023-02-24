from typing import List
from urllib.parse import unquote

import meilisearch

from . import config, schemas

client = meilisearch.Client(
    config.settings.meilisearch_url, config.settings.meilisearch_master_key
)
client.create_index("apps", {"primaryKey": "id"})
client.index("apps").update_sortable_attributes(
    ["installs_last_month", "added_at", "updated_at"]
)
client.index("apps").update_searchable_attributes(
    ["name", "summary", "keywords", "description", "id"]
)
client.index("apps").update_filterable_attributes(
    ["categories", "developer_name", "project_group"]
)


def add_apps(app_search_items):
    return client.index("apps").add_documents(app_search_items)


def update_apps(apps_to_update):
    return client.index("apps").update_documents(apps_to_update)


def delete_apps(app_id_list):
    if len(app_id_list) > 0:
        return client.index("apps").delete_documents(app_id_list)
    return None


def delete_all_apps():
    return client.index("apps").delete_all_documents()


def get_by_selected_categories(
    selected_categories: List[schemas.MainCategory], page: int, hits_per_page: int
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


def search_apps(query: str):
    query = unquote(query)

    if results := client.index("apps").search(
        query, {"limit": 250, "sort": ["installs_last_month:desc"]}
    ):
        ret = [
            {
                "id": app["app_id"],
                "name": app["name"],
                "summary": app["summary"],
                "icon": app.get("icon"),
            }
            for app in results["hits"]
            if "app_id"  # this might cause hit count to be wrong, but is better then crashing
            in app
        ]

        return ret

    return []
