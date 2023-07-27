import base64
import contextlib
import typing as T
from datetime import datetime, timedelta

import dramatiq
import dramatiq.brokers.redis
import jwt
import requests
import sentry_dramatiq
import sentry_sdk
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from . import apps, config, db, exceptions, search, stats, summary, utils
from .config import settings
from .emails import (
    EmailInfo,
)
from .emails import (
    send_email as send_email_impl,
)
from .emails import (
    send_one_email as send_one_email_impl,
)

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
    apps = [app[5:] for app in db.redis_conn.smembers("apps:index")]
    stats.update(apps)


@dramatiq.actor
def update():
    apps.load_appstream()
    summary.update()
    exceptions.update()

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    apps_created_at = {}

    for appid in current_apps:
        if not db.is_appid_for_frontend(appid):
            continue

        # created_at keys were used by the old backend to store the repository
        # creation date; attempt to re-use that by checking if it's string
        # and converting it to Unix timestamp, then rewriting to that form in
        # Redis
        if created_at := db.redis_conn.get(f"created_at:{appid}"):
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
            if metadata := db.get_json_key(f"summary:{appid}"):
                created_at = metadata.get("timestamp")
            else:
                created_at = int(datetime.utcnow().timestamp())

        if created_at:
            db.redis_conn.set(f"created_at:{appid}", created_at)
            apps_created_at[appid] = float(created_at)

    if apps_created_at:
        db.redis_conn.zadd("new_apps_zset", apps_created_at)

    search_added_at = []
    for appid, value in apps_created_at.items():
        if appid not in current_apps:
            continue

        if not db.is_appid_for_frontend(appid):
            continue

        search_added_at.append(
            {
                "id": utils.get_clean_app_id(appid),
                "added_at": int(value),
            }
        )

    search.create_or_update_apps(search_added_at)


def _create_flat_manager_token(use: str, scopes: list[str], **kwargs):
    return "Bearer " + jwt.encode(
        {
            "sub": "build",
            "scope": scopes,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(minutes=5),
            "name": f"Backend token for internal use ({use})",
            **kwargs,
        },
        base64.b64decode(settings.flat_manager_build_secret),
        algorithm="HS256",
    )


@dramatiq.actor
def republish_app(appid: str):
    from .vending import VendingError

    if not settings.flat_manager_build_secret or not settings.flat_manager_api:
        return

    repos = ["stable"]

    token = _create_flat_manager_token(
        "republish_app", ["republish"], apps=[appid], repos=repos
    )

    with requests.Session() as session:
        for repo in repos:
            try:
                response = session.post(
                    f"{settings.flat_manager_api}/api/v1/repo/{repo}/republish",
                    headers={"Authorization": token},
                    json={"app": appid},
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
):
    token = _create_flat_manager_token("review_check", ["reviewcheck"])
    requests.post(
        f"{settings.flat_manager_api}/api/v1/job/{job_id}/check/review",
        json={"new-status": {"status": status, "reason": reason}},
        headers={"Authorization": token},
    )


@dramatiq.actor
def send_email(email):
    with WorkerDB() as db:
        send_email_impl(EmailInfo(**email), db)


@dramatiq.actor
def send_one_email(message: str, dest: str):
    send_one_email_impl(message, dest)
