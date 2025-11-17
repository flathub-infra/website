from datetime import datetime

import dramatiq

from .. import cron, database, models


def get_current_month():
    return datetime.now().strftime("%Y-%m")


@cron.cron("0 4 1 * *")  # Run at 4am on the first day of each month
@dramatiq.actor
def update_monthly_permission_stats():
    with database.get_db("writer") as db:
        appids = database.get_all_appids_for_frontend()
        month = get_current_month()
        for app_id in appids:
            app = db.query(models.App).filter(models.App.app_id == app_id).first()
            if not app or not app.summary:
                continue
            metadata = app.summary.get("metadata", {})
            permissions = metadata.get("permissions", {})
            if not permissions:
                continue
            for perm_type, perm_value in permissions.items():
                models.MonthlyPermissionStats.upsert(
                    db, app_id, month, perm_type, perm_value
                )


if __name__ == "__main__":
    update_monthly_permission_stats()
