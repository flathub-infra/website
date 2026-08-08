import logging
from typing import Any, cast

import redis

from . import config

logger = logging.getLogger(__name__)
HYBRID_FAILURE_KEY = "search:apps-hybrid:failed-tasks"
HYBRID_MUTATION_GENERATION_KEY = "search:apps-hybrid:mutation-generation"
HYBRID_MUTATION_TASK_KEY = "search:apps-hybrid:last-lexical-task"
HYBRID_MUTATION_LOCK_KEY = "search:apps-hybrid:mutation-lock"
HYBRID_RECONCILIATION_SCHEDULED_KEY = "search:apps-hybrid:reconciliation-scheduled"
HYBRID_RECONCILIATION_LOCK_KEY = "search:apps-hybrid:reconciliation-lock"
RECONCILIATION_STATE_TTL_SECONDS = 21_600

redis_conn = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    db=config.settings.redis_db,
    decode_responses=True,
)


def hybrid_mutation_lock():
    return redis_conn.lock(
        HYBRID_MUTATION_LOCK_KEY,
        timeout=60,
        blocking_timeout=30,
    )


def hybrid_reconciliation_lock():
    return redis_conn.lock(
        HYBRID_RECONCILIATION_LOCK_KEY,
        timeout=3_900,
        blocking_timeout=0,
    )


def record_lexical_mutation(task_uids: list[int]) -> None:
    if not task_uids:
        return
    with redis_conn.pipeline() as pipeline:
        pipeline.incr(HYBRID_MUTATION_GENERATION_KEY)
        pipeline.set(HYBRID_MUTATION_TASK_KEY, max(task_uids))
        pipeline.execute()


def get_lexical_mutation_state() -> tuple[int, int | None]:
    generation, task_uid = cast(
        "list[Any]",
        redis_conn.mget([HYBRID_MUTATION_GENERATION_KEY, HYBRID_MUTATION_TASK_KEY]),
    )
    return int(generation or 0), int(task_uid) if task_uid is not None else None


def mark_reconciliation_scheduled() -> bool:
    return bool(
        redis_conn.set(
            HYBRID_RECONCILIATION_SCHEDULED_KEY,
            "1",
            nx=True,
            ex=RECONCILIATION_STATE_TTL_SECONDS,
        )
    )


def clear_reconciliation_scheduled() -> None:
    try:
        redis_conn.delete(HYBRID_RECONCILIATION_SCHEDULED_KEY)
    except Exception:
        logger.exception("Unable to clear hybrid reconciliation schedule state")


def mark_hybrid_task_failed(task_uid: int | str) -> None:
    try:
        redis_conn.sadd(HYBRID_FAILURE_KEY, str(task_uid))
    except Exception:
        logger.exception("Unable to record hybrid index task failure")


def has_hybrid_task_failures() -> bool:
    try:
        return bool(redis_conn.scard(HYBRID_FAILURE_KEY))
    except Exception:
        logger.exception("Unable to read hybrid index health state")
        return True


def clear_hybrid_task_failures() -> bool:
    try:
        redis_conn.delete(HYBRID_FAILURE_KEY)
    except Exception:
        logger.exception("Unable to clear hybrid index task failures")
        return False
    return True
