import asyncio
import logging

import dramatiq
from fastapi import Response

from .. import cache, models
from ..database import get_db

logger = logging.getLogger(__name__)


async def _refresh_cache_impl():
    await cache.mark_stale_by_pattern("cache:endpoint:*")
    await _prepopulate_cache()


@dramatiq.actor(time_limit=1000 * 60 * 60)
def refresh_cache():
    asyncio.run(_refresh_cache_impl())


async def _prepopulate_cache():
    from ..routes import apps, quality_moderation, stats

    top_app_ids = _get_top_apps(1000)

    for app_id in top_app_ids:
        try:
            await apps.get_appstream(app_id=app_id, locale="en")
            await apps.get_summary(app_id=app_id)
            await apps.get_isFullscreenApp(app_id=app_id)
            await apps.get_addons(app_id=app_id)
        except Exception:
            logger.exception("Error prepopulating app data for %s", app_id)

        try:
            await apps.get_eol_rebase_appid(app_id=app_id, branch="stable")
            await apps.get_eol_message_appid(app_id=app_id, branch="stable")
        except Exception:
            logger.exception("Error prepopulating EOL data for %s", app_id)

        try:
            quality_moderation.get_quality_moderation_for_app(app_id=app_id)
        except Exception:
            logger.exception("Error prepopulating quality moderation for %s", app_id)

        try:
            response = Response()
            await stats.get_stats_for_app(response=response, app_id=app_id)
        except Exception:
            logger.exception("Error prepopulating stats for %s", app_id)


def _get_top_apps(limit: int = 1000) -> list[str]:
    with get_db("replica") as db:
        top_apps = (
            db.query(models.AppStats.app_id)
            .order_by(models.AppStats.installs_total.desc())
            .limit(limit)
            .all()
        )
    return [app.app_id for app in top_apps]
