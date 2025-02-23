import dramatiq

from .. import stats
from .core import WorkerDB


@dramatiq.actor(time_limit=1000 * 60 * 60)  # 1 hour timeout
def update_stats():
    with WorkerDB() as sqldb:
        stats.update(sqldb)
