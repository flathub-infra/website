import base64
from datetime import datetime, timedelta

import dramatiq
import dramatiq.brokers.redis
import jwt
import requests
import sentry_dramatiq
import sentry_sdk

from . import apps, compat, config, db, exceptions, search, stats, summary, utils
from .config import settings

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


@dramatiq.actor(time_limit=1000 * 60 * 60)
def update_stats():
    apps = [app[5:] for app in db.redis_conn.smembers("apps:index")]
    stats.update(apps)


@dramatiq.actor
def update():
    new_apps = apps.load_appstream()
    summary.update()
    compat.update_picks()
    exceptions.update()

    if new_apps:
        new_apps_zset = {}
        for appid in new_apps:
            if metadata := db.get_json_key(f"summary:{appid}"):
                new_apps_zset[appid] = metadata.get("timestamp", 0)
        if new_apps_zset:
            db.redis_conn.zadd("new_apps_zset", new_apps_zset)

    added_at_values = db.redis_conn.zrange(
        "new_apps_zset",
        0,
        -1,
        desc=True,
        withscores=True,
    )

    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}
    added_at: list = []

    for [appid, value] in added_at_values:
        if appid not in current_apps:
            continue

        added_at.append(
            {
                "id": utils.get_clean_app_id(appid),
                "added_at": round(value),
            }
        )

    search.create_or_update_apps(added_at)


@dramatiq.actor
def republish_app(appid: str):
    from .vending import VendingError

    if not settings.flat_manager_build_secret or not settings.flat_manager_api:
        return

    repos = ["stable", "beta"]

    # Create a token to use in the request
    token = "Bearer " + jwt.encode(
        {
            "jti": "flathub_backend_internal_token",
            "sub": "build",
            "scope": ["republish"],
            "apps": [appid],
            "repos": repos,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(minutes=5),
            "name": "Backend token for internal use (republish_app)",
        },
        base64.b64decode(settings.flat_manager_build_secret),
        algorithm="HS256",
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
