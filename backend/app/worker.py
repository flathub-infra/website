import dramatiq
import dramatiq.brokers.redis

from . import apps, compat, db, exceptions, stats, summary
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
