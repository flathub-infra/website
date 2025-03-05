from datetime import UTC, datetime

import dramatiq

from .. import apps, exceptions, models, search, summary, utils
from ..database import get_db, get_json_key


@dramatiq.actor
def update():
    with get_db("writer") as db:
        apps.load_appstream(db)
        summary.update(db)
    exceptions.update()

    current_apps = apps.get_appids(include_eol=True)
    apps_created_at = {}

    for app_id in current_apps:
        with get_db("writer") as db:
            created_at = (
                db.session.query(models.App.initial_release_at)
                .filter(models.App.app_id == app_id)
                .scalar()
            )

        if created_at:
            apps_created_at[app_id] = created_at.timestamp()
        else:
            with get_db("writer") as db:
                app = models.App.by_appid(db, app_id)
                if app and app.summary and "timestamp" in app.summary:
                    created_at = app.summary["timestamp"]
                elif metadata := get_json_key(f"summary:{app_id}:stable"):
                    created_at = metadata.get("timestamp")

                if not created_at:
                    created_at = int(datetime.now(UTC).timestamp())

            apps_created_at[app_id] = float(created_at)
            with get_db("writer") as db:
                models.App.set_initial_release_at(
                    db,
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
