import random
from datetime import UTC, datetime, timedelta

import dramatiq

from .. import cron, models
from ..database import get_all_appids_for_frontend, get_db
from .redis import invalidate_cache_by_pattern


@cron.cron("0 3 * * *")  # every day at 3am
@dramatiq.actor
def update_app_picks():
    with get_db("writer") as db:
        today = datetime.now(UTC).date()
        pick_app_of_the_day_automatically(db, today)

        tomorrow = (datetime.now(UTC) + timedelta(days=1)).date()
        pick_app_of_the_day_automatically(db, tomorrow)


def pick_app_of_the_day_automatically(db, day):
    # Check if we already have an app of the day
    if x := models.AppOfTheDay.by_date(db, day):
        print("App of the day already set for day", day)
        return

    x = [
        {
            "id": appId,
            "quality-moderation-status": models.QualityModeration.by_appid_summarized(
                db, appId
            ),
            "last-time-app-of-the-day": models.AppOfTheDay.by_appid_last_time_app_of_the_day(
                db, appId
            ),
        }
        for appId in get_all_appids_for_frontend()
    ]

    all_passed_apps = [app for app in x if app["quality-moderation-status"].passes]

    # Remove apps of the week from the list
    apps_of_the_week = models.AppsOfTheWeek.by_week(
        db, day.isocalendar().week, day.year
    )
    apps_of_the_week_ids = [app.app_id for app in apps_of_the_week]

    all_passed_apps = [
        app for app in all_passed_apps if app["id"] not in apps_of_the_week_ids
    ]

    # Sort by last time app of the day
    all_passed_apps.sort(
        key=lambda app: app["last-time-app-of-the-day"],
    )

    if not all_passed_apps:
        return

    # Filter by oldest
    oldest_apps = [
        app["id"]
        for app in all_passed_apps
        if app["last-time-app-of-the-day"]
        == all_passed_apps[0]["last-time-app-of-the-day"]
    ]

    # Pick random app
    random.shuffle(oldest_apps)

    if len(oldest_apps) > 0:
        models.AppOfTheDay.set_app_of_the_day(db, oldest_apps[0], day)
        invalidate_cache_by_pattern("cache:endpoint:get_app_of_the_day:*")
