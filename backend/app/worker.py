from typing import List

import dramatiq
import dramatiq.brokers.redis

from . import apps, compat, db, exceptions, search, stats, summary, utils
from .config import settings

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
    search.delete_all_apps()
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
    added_at: List = []

    for [appid, value] in added_at_values:
        if appid not in current_apps:
            continue

        added_at.append(
            {
                "id": utils.get_clean_app_id(appid),
                "added_at": round(value),
            }
        )

    search.update_apps(added_at)
