import logging

import redis

from . import config

logger = logging.getLogger(__name__)
HYBRID_FAILURE_KEY = "search:apps-hybrid:failed-tasks"

redis_conn = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    db=config.settings.redis_db,
    decode_responses=True,
)


def mark_hybrid_task_failed(task_uid: int | str) -> None:
    try:
        redis_conn.sadd(HYBRID_FAILURE_KEY, str(task_uid))
    except Exception:
        logger.exception("Unable to record hybrid index task failure")


def clear_hybrid_task_failure(task_uid: int | str) -> None:
    try:
        redis_conn.srem(HYBRID_FAILURE_KEY, str(task_uid))
    except Exception:
        logger.exception("Unable to clear hybrid index task failure")


def has_hybrid_task_failures() -> bool:
    try:
        return bool(redis_conn.scard(HYBRID_FAILURE_KEY))
    except Exception:
        return False


def clear_hybrid_task_failures() -> None:
    try:
        redis_conn.delete(HYBRID_FAILURE_KEY)
    except Exception:
        logger.exception("Unable to clear hybrid index task failures")
