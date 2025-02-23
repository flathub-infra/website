import itertools
import json
import random
import typing as T
from datetime import UTC, datetime, timedelta
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
from .db import get_all_appids_for_frontend, get_json_key
from .emails import EmailCategory
from .emails import send_email_new as send_email_impl_new
from .emails import send_one_email_new as send_one_email_impl_new
from .moderation import ModerationRequestType

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
            if value := get_json_key(f"apps:{app_id}"):
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


@dramatiq.actor
def process_review_request(build_id: int, job_id: int):
    try:
        # Get build information from flat-manager
        flat_manager_token = utils.create_flat_manager_token(
            "process_review_request",
            ["build"],
            repos=["stable", "beta", "test"],
        )
        build_extended_url = (
            f"{config.settings.flat_manager_api}/api/v1/build/{build_id}/extended"
        )
        build_extended_headers = {
            "Authorization": f"{flat_manager_token}",
            "Content-Type": "application/json",
        }
        response = requests.get(build_extended_url, headers=build_extended_headers)
        response.raise_for_status()

        build_extended = response.json()
        build_metadata = build_extended.get("build")

        build_target_repo = build_metadata.get("repo")
        if build_target_repo in ("beta", "test"):
            return

        build_log_url = build_metadata.get("build_log_url")
        build_ref_arches = set()
        build_refs = build_extended.get("build_refs")
        build_ref_arches = {
            build_ref.get("ref_name").split("/")[2]
            for build_ref in build_refs
            if len(build_ref.get("ref_name").split("/")) == 4
        }

        new_requests: list[models.ModerationRequest] = []

        try:
            build_ref_arch = build_ref_arches.pop()
            build_appstream = utils.appstream2dict(
                f"https://hub.flathub.org/build-repo/{build_id}/appstream/{build_ref_arch}/appstream.xml.gz"
            )
        except KeyError:
            # if build_ref_arches has no elements, something went terribly wrong with the build in general
            return

        r = requests.get(f"https://dl.flathub.org/build-repo/{build_id}/summary")
        r.raise_for_status()
        if not isinstance(r.content, bytes):
            # If the summary file is not a binary file, something also went wrong
            return

        with WorkerDB() as db:
            build_summary, _, _ = summary.parse_summary(r.content, db)

        sentry_context = {"build_summary": build_summary}

        for app_id, app_data in build_appstream.items():
            is_new_submission = True

            keys = {
                "name": app_data.get("name"),
                "summary": app_data.get("summary"),
                "developer_name": app_data.get("developer_name"),
                "project_license": app_data.get("project_license"),
            }
            current_values = {}

            # Check if the app data matches the current appstream
            if app := get_json_key(f"apps:{app_id}"):
                is_new_submission = False

                current_values["name"] = app.get("name")
                current_values["summary"] = app.get("summary")
                current_values["developer_name"] = app.get("developer_name")
                current_values["project_license"] = app.get("project_license")

                for key, value in current_values.items():
                    if value == keys[key]:
                        keys.pop(key, None)

            # Don't consider the first "official" buildbot build as a new submission
            # as it has been already reviewed manually on GitHub
            if is_new_submission and build_metadata.get("token_name") in (
                "default",
                "flathub-ci",
                "buildbot",
            ):
                continue

            if app_id in (
                "org.freedesktop.Platform",
                "org.freedesktop.Sdk",
                "org.gnome.Platform",
                "org.gnome.Sdk",
                "org.kde.Platform",
                "org.kde.Sdk",
                "org.flatpak.Builder",
            ):
                continue

            if "keys" not in locals():
                keys = {}
            if "current_values" not in locals():
                current_values = {}

            with WorkerDB() as db:
                if direct_upload_app := models.DirectUploadApp.by_app_id(db, app_id):
                    if not direct_upload_app.first_seen_at:
                        direct_upload_app.first_seen_at = datetime.now(UTC)
                        db.session.commit()
                        is_new_submission = True
                        current_values = {"direct upload": False}
                        keys = {"direct upload": True}

            with WorkerDB() as db:
                current_summary = None
                current_permissions = None
                current_extradata = False

                app = models.App.by_appid(db, app_id)
                if app and app.summary:
                    current_summary = app.summary
                    sentry_context[f"summary:{app_id}:stable"] = current_summary

                    if current_metadata := current_summary.get("metadata", {}):
                        current_permissions = current_metadata.get("permissions")
                        current_extradata = bool(current_metadata.get("extra-data"))
                elif current_summary := get_json_key(f"summary:{app_id}:stable"):
                    sentry_context[f"summary:{app_id}:stable"] = current_summary

                    if current_metadata := current_summary.get("metadata", {}):
                        current_permissions = current_metadata.get("permissions")
                        current_extradata = bool(current_metadata.get("extra-data"))

                if current_summary:
                    build_summary_app = build_summary.get(app_id) or {}
                    build_summary_metadata = build_summary_app.get("metadata") or {}
                    build_permissions = build_summary_metadata.get("permissions") or {}
                    build_extradata = bool(
                        build_summary_metadata.get("extra-data", False)
                    )

                    if current_extradata != build_extradata:
                        current_values["extra-data"] = current_extradata
                        keys["extra-data"] = build_extradata

                    if current_permissions and build_permissions:
                        if current_permissions != build_permissions:
                            for perm in current_permissions:
                                current_perm = current_permissions[perm]
                                build_perm = build_permissions.get(perm)

                                if isinstance(current_perm, list):
                                    if current_perm != build_perm:
                                        current_values[perm] = current_perm
                                        keys[perm] = build_perm

                                if isinstance(current_perm, dict):
                                    if build_perm is None:
                                        build_perm = {}

                                    dict_keys = current_perm.keys() | build_perm.keys()
                                    for key in dict_keys:
                                        if current_perm.get(key) != build_perm.get(key):
                                            current_values[f"{key}-{perm}"] = (
                                                current_perm.get(key)
                                            )
                                            keys[f"{key}-{perm}"] = build_perm.get(key)

            if len(keys) > 0:
                keys = sort_lists_in_dict(keys)
                current_values = sort_lists_in_dict(current_values)

                request = models.ModerationRequest(
                    appid=app_id,
                    request_type=ModerationRequestType.APPDATA,
                    request_data=json.dumps(
                        {"keys": keys, "current_values": current_values}
                    ),
                    is_new_submission=is_new_submission,
                    is_outdated=False,
                    build_id=build_id,
                    job_id=job_id,
                    build_log_url=build_log_url,
                )
                new_requests.append(request)

        # Mark previous requests as outdated, to avoid flooding the moderation queue with requests that probably aren't
        # relevant anymore. Outdated requests can still be viewed and approved, but they're hidden by default.
        with WorkerDB() as db:
            app_ids = set(request.appid for request in new_requests)
            for app_id in app_ids:
                db.session.query(models.ModerationRequest).filter_by(
                    appid=app_id, is_outdated=False
                ).update({"is_outdated": True})

            if len(new_requests) == 0:
                return

            for request in new_requests:
                db.session.add(request)
            db.session.commit()

            if config.settings.moderation_observe_only:
                return

            apps = itertools.groupby(new_requests, lambda r: r.appid)
            for app_id, request_list in apps:
                request_list = list(request_list)

                if app_metadata := get_json_key(f"apps:{app_id}"):
                    app_name = app_metadata["name"]
                else:
                    app_name = None

                payload = {
                    "messageId": f"{app_id}/{build_id}/held",
                    "creation_timestamp": datetime.now(UTC).timestamp(),
                    "subject": f"Build #{build_id} held for review",
                    "previewText": f"Build #{build_id} held for review",
                    "inform_moderators": True,
                    "messageInfo": {
                        "category": EmailCategory.MODERATION_HELD,
                        "appId": request.appid,
                        "appName": app_name,
                        "buildId": build_id,
                        "buildLogUrl": request.build_log_url,
                        "requests": [
                            {
                                "requestType": request.request_type,
                                "requestData": json.loads(request.request_data),
                                "isNewSubmission": request.is_new_submission,
                            }
                            for request in request_list
                        ],
                    },
                }

                send_email_new.send(payload)

    except Exception as e:
        sentry_sdk.capture_exception(e)
        raise


def sort_lists_in_dict(data: dict) -> dict:
    """Sort any lists found in the dictionary recursively."""
    if isinstance(data, dict):
        for key, value in data.items():
            data[key] = sort_lists_in_dict(value)
    elif isinstance(data, list):
        data.sort()
    return data
