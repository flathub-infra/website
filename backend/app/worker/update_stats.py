import dramatiq

from .. import stats
from ..database import get_db


@dramatiq.actor(time_limit=1000 * 60 * 60)  # 1 hour timeout
def update_stats():
    with get_db("writer") as db:
        stats.update(db)
