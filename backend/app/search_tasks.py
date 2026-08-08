import logging
from typing import Any, Literal

import dramatiq

from . import search_health

logger = logging.getLogger(__name__)

HybridOperation = Literal["update", "delete"]
MAX_RECONCILIATION_ATTEMPTS = 3
RECONCILIATION_DELAY_MS = 60_000
TASK_TIMEOUT_MS = 1_800_000
TASK_INTERVAL_MS = 1_000
RECONCILIATION_TIME_LIMIT_MS = 3_600_000


def _enqueue_reconciliation(attempt: int) -> None:
    reconcile_hybrid_index.send_with_options(
        args=(attempt,),
        delay=RECONCILIATION_DELAY_MS,
    )


def _schedule_reconciliation(attempt: int) -> None:
    try:
        if not search_health.mark_reconciliation_scheduled():
            return
        _enqueue_reconciliation(attempt)
    except Exception:
        search_health.clear_reconciliation_scheduled()
        logger.exception(
            "Unable to schedule hybrid index reconciliation",
            extra={"reconciliation_attempt": attempt},
        )
        search_health.mark_hybrid_task_failed("reconciliation")


@dramatiq.actor(time_limit=RECONCILIATION_TIME_LIMIT_MS)
def reconcile_hybrid_index(attempt: int = 0) -> None:
    from . import search_setup

    lock = search_health.hybrid_reconciliation_lock()
    if not lock.acquire(blocking=False):
        return

    try:
        if not search_health.has_hybrid_task_failures():
            search_health.clear_reconciliation_scheduled()
            return

        try:
            search_setup.reconcile_hybrid_index()
        except Exception:
            search_health.mark_hybrid_task_failed("reconciliation")
            if attempt >= MAX_RECONCILIATION_ATTEMPTS:
                search_health.clear_reconciliation_scheduled()
                logger.exception(
                    "Hybrid index reconciliation failed",
                    extra={"reconciliation_attempt": attempt},
                )
                return
            logger.exception(
                "Hybrid index reconciliation failed; retrying",
                extra={"reconciliation_attempt": attempt},
            )
            try:
                _enqueue_reconciliation(attempt + 1)
            except Exception:
                search_health.clear_reconciliation_scheduled()
                logger.exception(
                    "Unable to reschedule hybrid index reconciliation",
                    extra={"reconciliation_attempt": attempt + 1},
                )
            return

        search_health.clear_reconciliation_scheduled()
        if search_health.has_hybrid_task_failures():
            _schedule_reconciliation(0)
        logger.info(
            "Hybrid index reconciliation complete",
            extra={"reconciliation_attempt": attempt},
        )
    finally:
        lock.release()


@dramatiq.actor(time_limit=TASK_TIMEOUT_MS + 60_000)
def monitor_hybrid_index_task(
    operation: HybridOperation,
    task_uid: int | None,
    payload: list[Any] | None = None,
    failure_task_uid: int | str | None = None,
    attempt: int = 0,
) -> None:
    from . import search

    del payload, failure_task_uid, attempt
    if task_uid is None:
        search_health.mark_hybrid_task_failed("unknown")
        logger.error(
            "Hybrid Meilisearch task has no task identifier; scheduling current-state reconciliation",
            extra={"operation": operation},
        )
        _schedule_reconciliation(0)
        return
    try:
        result = search.client.wait_for_task(
            task_uid,
            timeout_in_ms=TASK_TIMEOUT_MS,
            interval_in_ms=TASK_INTERVAL_MS,
        )
    except Exception:
        failure_uid = task_uid or "unknown"
        search_health.mark_hybrid_task_failed(failure_uid)
        logger.exception(
            "Hybrid index task monitoring failed; scheduling current-state reconciliation",
            extra={"task": failure_uid, "operation": operation},
        )
        _schedule_reconciliation(0)
        return

    if result.status == "succeeded":
        logger.info(
            "Hybrid Meilisearch task complete",
            extra={"task": task_uid, "operation": operation},
        )
        return

    failure_uid = task_uid or "unknown"
    search_health.mark_hybrid_task_failed(failure_uid)
    logger.error(
        "Hybrid Meilisearch task failed; scheduling current-state reconciliation",
        extra={
            "task": failure_uid,
            "operation": operation,
            "status": result.status,
        },
    )
    _schedule_reconciliation(0)
