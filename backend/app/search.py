from urllib.parse import unquote

import meilisearch

from . import config

client = meilisearch.Client(
    config.settings.meilisearch_url, config.settings.meilisearch_master_key
)
client.create_index("apps")
client.index("apps").update_sortable_attributes(["downloads_last_month"])
client.index("apps").update_searchable_attributes(
    [
        "name",
        "summary",
        "keywords",
        "description",
    ]
)


def add_apps(app_search_items):
    client.index("apps").add_documents(app_search_items)


def update_apps(apps_to_update):
    client.index("apps").update_documents(apps_to_update)


def delete_apps(app_id_list):
    if len(app_id_list) > 0:
        client.index("apps").delete_documents(app_id_list)


def search_apps(query: str):
    query = unquote(query)

    if results := client.index("apps").search(
        query, {"limit": 250, "sort": ["downloads_last_month:desc"]}
    ):
        ret = []
        for app in results["hits"]:
            entry = {
                "id": app["app_id"],
                "name": app["name"],
                "summary": app["summary"],
                "icon": app.get("icon"),
            }
            ret.append(entry)

        return ret

    return []
