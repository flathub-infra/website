import random
from datetime import datetime, timedelta

import dramatiq

from .. import models
from ..db import get_all_appids_for_frontend
from .core import WorkerDB


@dramatiq.actor
def update_app_picks():
    with WorkerDB() as sqldb:
        today = datetime.utcnow().date()
        pick_app_of_the_day_automatically(sqldb, today)

        tomorrow = (datetime.utcnow() + timedelta(days=1)).date()
        pick_app_of_the_day_automatically(sqldb, tomorrow)


def pick_app_of_the_day_automatically(sqldb, day):
    # Check if we already have an app of the day
    if x := models.AppOfTheDay.by_date(sqldb, day):
        print("App of the day already set for day", day)
        return

    x = [
        {
            "id": appId,
            "quality-moderation-status": models.QualityModeration.by_appid_summarized(
                sqldb, appId
            ),
            "last-time-app-of-the-day": models.AppOfTheDay.by_appid_last_time_app_of_the_day(
                sqldb, appId
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
        sqldb, day.isocalendar().week, day.year
    )

    for app_of_the_week in apps_of_the_week:
        if app_of_the_week.app_id in oldest_apps:
            oldest_apps.remove(app_of_the_week.app_id)

    # Pick random app
    random.shuffle(oldest_apps)

    if len(oldest_apps) > 0:
        models.AppOfTheDay.set_app_of_the_day(sqldb, oldest_apps[0], day)
