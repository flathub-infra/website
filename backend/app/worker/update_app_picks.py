import random
from datetime import datetime, timedelta

import dramatiq

from .. import cache, cron, models
from ..database import get_all_appids_for_frontend, get_db


@cron.cron("0 3 * * *")  # every day at 3am
@dramatiq.actor
def update_app_picks():
    with get_db("writer") as db:
        today = datetime.utcnow().date()
        pick_app_of_the_day_automatically(db, today)

        tomorrow = (datetime.utcnow() + timedelta(days=1)).date()
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

    all_passed_apps = [
        app
        for app in x
        if app["quality-moderation-status"].passes and app["last-time-app-of-the-day"]
    ]

    # Sort by last time app of the day
    all_passed_apps.sort(
        key=lambda app: (app["last-time-app-of-the-day"]),
    )

    # Filter by oldest
    oldest_apps = [
        app["id"]
        for app in all_passed_apps
        if app["last-time-app-of-the-day"]
        == all_passed_apps[0]["last-time-app-of-the-day"]
    ]

    # Remove apps of the week from the list
    apps_of_the_week = models.AppsOfTheWeek.by_week(
        db, day.isocalendar().week, day.year
    )

    for app_of_the_week in apps_of_the_week:
        if app_of_the_week.app_id in oldest_apps:
            oldest_apps.remove(app_of_the_week.app_id)

    # Pick random app
    random.shuffle(oldest_apps)

    if len(oldest_apps) > 0:
        models.AppOfTheDay.set_app_of_the_day(db, oldest_apps[0], day)
        cache.invalidate_cache_by_pattern("cache:endpoint:get_app_of_the_day:*")
