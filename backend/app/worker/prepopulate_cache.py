import dramatiq

from .. import models
from ..database import get_db


@dramatiq.actor(time_limit=1000 * 60 * 60)
def prepopulate_cache():
    from ..routes import apps, quality_moderation, stats

    top_app_ids = _get_top_apps(1000)

    for app_id in top_app_ids:
        try:
            apps.get_appstream(app_id=app_id, locale="en")
            apps.get_summary(app_id=app_id)
            apps.get_isFullscreenApp(app_id=app_id)
            apps.get_addons(app_id=app_id)
        except Exception as e:
            print(f"Error prepopulating appstream for {app_id}: {e}")

        try:
            apps.get_eol_rebase_appid(app_id=app_id, branch="stable")
            apps.get_eol_message_appid(app_id=app_id, branch="stable")
        except Exception as e:
            print(f"Error prepopulating EOL for {app_id}: {e}")

        try:
            quality_moderation.get_quality_moderation_for_app(app_id=app_id)
        except Exception as e:
            print(f"Error prepopulating quality moderation for {app_id}: {e}")

        try:
            stats.get_stats_for_app(app_id=app_id)
        except Exception as e:
            print(f"Error prepopulating stats for {app_id}: {e}")


def _get_top_apps(limit: int = 1000) -> list[str]:
    with get_db("replica") as db:
        top_apps = (
            db.query(models.AppStats.app_id)
            .order_by(models.AppStats.installs_total.desc())
            .limit(limit)
            .all()
        )
    return [app.app_id for app in top_apps]
