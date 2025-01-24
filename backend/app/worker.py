import random
import typing as T
from datetime import datetime, timedelta
from typing import Optional

import dramatiq
import dramatiq.brokers.redis
import requests
import sentry_sdk
from sentry_sdk.integrations.dramatiq import DramatiqIntegration
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from . import (
    apps,
    config,
    db,
    exceptions,
    logins,
    models,
    search,
    stats,
    summary,
    utils,
)
from .config import settings
from .db import get_all_appids_for_frontend
from .emails import send_email_new as send_email_impl_new
from .emails import send_one_email_new as send_one_email_impl_new

if config.settings.sentry_dsn:
    sentry_sdk.init(
        dsn=config.settings.sentry_dsn,
        environment="production",
        integrations=[DramatiqIntegration()],
    )

broker = dramatiq.brokers.redis.RedisBroker(
    host=settings.redis_host, port=settings.redis_port, db=1
)
dramatiq.set_broker(broker)

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class WorkerDB:
    def __init__(self):
        self._session = None

    @property
    def session(self) -> Session:
        return self._session

    def __enter__(self):
        self._session = SessionLocal()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._session.close()


@dramatiq.actor(time_limit=1000 * 60 * 60)
def update_stats():
    with WorkerDB() as sqldb:
        stats.update(sqldb)


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
                sqldb.session.query(models.Apps.initial_release_at)
                .filter(models.Apps.app_id == app_id)
                .scalar()
            )

        if created_at:
            apps_created_at[app_id] = created_at.timestamp()
        else:
            if metadata := db.get_json_key(f"summary:{app_id}:stable"):
                created_at = metadata.get("timestamp")
            else:
                created_at = int(datetime.utcnow().timestamp())

            apps_created_at[app_id] = float(created_at)
            with WorkerDB() as sqldb:
                models.Apps.set_initial_release_at(
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


@dramatiq.actor
def republish_app(
    app_id: str, endoflife: Optional[str] = None, endoflife_rebase: Optional[str] = None
):
    from .vending import VendingError

    if not settings.flat_manager_build_secret or not settings.flat_manager_api:
        return

    repos = ["stable"]

    token = utils.create_flat_manager_token(
        "republish_app", ["republish"], apps=[app_id], repos=repos
    )

    with requests.Session() as session:
        for repo in repos:
            try:
                payload = {"app": app_id}
                if endoflife:
                    payload["endoflife"] = endoflife
                if endoflife_rebase:
                    payload["endoflife_rebase"] = endoflife_rebase

                response = session.post(
                    f"{settings.flat_manager_api}/api/v1/repo/{repo}/republish",
                    headers={"Authorization": token},
                    json=payload,
                )

                if response.status_code != 200:
                    raise VendingError("republish failed")

            except Exception:
                raise VendingError("republish failed")


@dramatiq.actor
def review_check(
    job_id: int,
    status: T.Literal["Passed"] | T.Literal["Failed"],
    reason: str | None,
    build_id: int | None = None,
):
    token = utils.create_flat_manager_token("review_check", ["reviewcheck"])
    r = requests.post(
        f"{settings.flat_manager_api}/api/v1/job/{job_id}/check/review",
        json={"new-status": {"status": status, "reason": reason}},
        headers={"Authorization": token},
    )
    r.raise_for_status()

    if status == "Passed" and build_id:
        token = utils.create_flat_manager_token(
            "review_check_publish_approved", ["publish"], repos=["stable"]
        )
        r = requests.post(
            f"{settings.flat_manager_api}/api/v1/build/{build_id}/publish",
            json={},
            headers={"Authorization": token},
        )
        r.raise_for_status()


@dramatiq.actor
def send_email_new(email):
    with WorkerDB() as db:
        send_email_impl_new(dict(**email), db)


@dramatiq.actor
def send_one_email_new(message: dict, dest: str):
    send_one_email_impl_new(message, dest)


@dramatiq.actor
def update_quality_moderation():
    with WorkerDB() as sqldb:
        appids = apps.get_appids()

        if not appids:
            return

        appids_for_frontend = [
            app_id for app_id in appids if app_id and db.is_appid_for_frontend(app_id)
        ]

        if not appids_for_frontend:
            return

        for app_id in appids_for_frontend:
            if value := db.get_json_key(f"apps:{app_id}"):
                # Check app name length
                models.QualityModeration.upsert(
                    sqldb,
                    app_id,
                    "app-name-not-too-long",
                    "name" in value and len(value["name"]) <= 20,
                    None,
                )

                # Check app summary length
                models.QualityModeration.upsert(
                    sqldb,
                    app_id,
                    "app-summary-not-too-long",
                    "summary" in value and len(value["summary"]) <= 35,
                    None,
                )

                models.QualityModeration.upsert(
                    sqldb,
                    app_id,
                    "screenshots-at-least-one-screenshot",
                    "screenshots" in value and len(value["screenshots"]) >= 1,
                    None,
                )

                models.QualityModeration.upsert(
                    sqldb,
                    app_id,
                    "branding-has-primary-brand-colors",
                    "branding" in value
                    and (
                        (
                            any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                                and branding["scheme_preference"] == "light"
                            )
                            and any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                                and branding["scheme_preference"] == "dark"
                            )
                        )
                        or (
                            any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                                and (
                                    branding["scheme_preference"] == "light"
                                    or branding["scheme_preference"] == "dark"
                                )
                            )
                            and any(
                                branding
                                for branding in value["branding"]
                                if "type" in branding
                                and "scheme_preference" not in branding
                                and "value" in branding
                                and branding["type"] == "primary"
                            )
                        )
                        or any(
                            branding
                            for branding in value["branding"]
                            if "type" in branding
                            and "value" in branding
                            and branding["type"] == "primary"
                        )
                    ),
                    None,
                )


@dramatiq.actor
def refresh_github_repo_list(gh_access_token: str, accountId: int):
    with WorkerDB() as sqldb:
        if not gh_access_token:
            return

        logins.refresh_repo_list(gh_access_token, accountId)
        sqldb.session.commit()


@dramatiq.actor
def update_app_picks():
    with WorkerDB() as sqldb:
        today = datetime.utcnow().date()
        pick_app_of_the_day_automatically(sqldb, today)

        tomorrow = (datetime.utcnow() + timedelta(days=1)).date()
        pick_app_of_the_day_automatically(sqldb, tomorrow)


def pick_app_of_the_day_automatically(sqldb, day):
    # do we have an app of the day for the day?
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
