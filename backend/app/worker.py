import contextlib
import typing as T
from datetime import datetime

import dramatiq
import dramatiq.brokers.redis
import requests
import sentry_dramatiq
import sentry_sdk
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
from .emails import EmailInfo
from .emails import send_email as send_email_impl
from .emails import send_one_email as send_one_email_impl

if config.settings.sentry_dsn:
    sentry_sdk.init(
        dsn=config.settings.sentry_dsn,
        environment="production",
        integrations=[sentry_dramatiq.DramatiqIntegration()],
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
    summary.update()
    exceptions.update()

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    apps_created_at = {}

    for app_id in current_apps:
        if not db.is_appid_for_frontend(app_id):
            continue

        # created_at keys were used by the old backend to store the repository
        # creation date; attempt to re-use that by checking if it's string
        # and converting it to Unix timestamp, then rewriting to that form in
        # Redis
        if created_at := db.redis_conn.get(f"created_at:{app_id}"):
            if isinstance(created_at, str):
                with contextlib.suppress(ValueError):
                    created_at = int(created_at)

            if isinstance(created_at, str):
                try:
                    created_at_format = "%Y-%m-%dT%H:%M:%SZ"
                    created_at_dt = datetime.strptime(created_at, created_at_format)
                    created_at = int(created_at_dt.timestamp())
                except (ValueError, TypeError):
                    created_at = None

        if not created_at:
            if metadata := db.get_json_key(f"summary:{app_id}:stable"):
                created_at = metadata.get("timestamp")
            else:
                created_at = int(datetime.utcnow().timestamp())

        if created_at:
            db.redis_conn.set(f"created_at:{app_id}", created_at)
            apps_created_at[app_id] = float(created_at)

    if apps_created_at:
        db.redis_conn.zadd("new_apps_zset", apps_created_at)

    search_added_at = []
    for app_id, value in apps_created_at.items():
        if app_id not in current_apps:
            continue

        if not db.is_appid_for_frontend(app_id):
            continue

        search_added_at.append(
            {
                "id": utils.get_clean_app_id(app_id),
                "added_at": int(value),
            }
        )

    search.create_or_update_apps(search_added_at)


@dramatiq.actor
def republish_app(app_id: str):
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
                response = session.post(
                    f"{settings.flat_manager_api}/api/v1/repo/{repo}/republish",
                    headers={"Authorization": token},
                    json={"app": app_id},
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
def send_email(email):
    with WorkerDB() as db:
        send_email_impl(EmailInfo(**email), db)


@dramatiq.actor
def send_one_email(message: str, dest: str):
    send_one_email_impl(message, dest)


@dramatiq.actor
def update_quality_moderation():
    with WorkerDB() as sqldb:
        appids = {app[5:] for app in db.redis_conn.smembers("apps:index")}

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


@dramatiq.actor
def refresh_github_repo_list(gh_access_token: str, accountId: int):
    with WorkerDB() as sqldb:
        logins.refresh_repo_list(sqldb, gh_access_token, accountId)
        sqldb.session.commit()
