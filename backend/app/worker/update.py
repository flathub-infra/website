from datetime import UTC, datetime

import dramatiq

from .. import apps, exceptions, models, search, summary, utils
from ..db import get_json_key
from .core import WorkerDB


@dramatiq.actor
def update():
    with WorkerDB() as sqldb:
        apps.load_appstream(sqldb)
        summary.update(sqldb)
    exceptions.update()

    current_apps = apps.get_appids()
    apps_created_at = {}

    for app_id in current_apps:
        with WorkerDB() as sqldb:
            created_at = (
                sqldb.session.query(models.App.initial_release_at)
                .filter(models.App.app_id == app_id)
                .scalar()
            )

        if created_at:
            apps_created_at[app_id] = created_at.timestamp()
        else:
            with WorkerDB() as sqldb:
                app = models.App.by_appid(sqldb, app_id)
                if app and app.summary and "timestamp" in app.summary:
                    created_at = app.summary["timestamp"]
                elif metadata := get_json_key(f"summary:{app_id}:stable"):
                    created_at = metadata.get("timestamp")

                if not created_at:
                    created_at = int(datetime.now(UTC).timestamp())

            apps_created_at[app_id] = float(created_at)
            with WorkerDB() as sqldb:
                models.App.set_initial_release_at(
                    sqldb,
                    app_id,
                    datetime.fromtimestamp(float(created_at)),
                )

    if apps_created_at:
        search_added_at = []
        for app_id, value in apps_created_at.items():
            if app_id not in current_apps:
                continue

            search_added_at.append(
                {
                    "id": utils.get_clean_app_id(app_id),
                    "added_at": int(value),
                }
            )

        search.create_or_update_apps(search_added_at)
