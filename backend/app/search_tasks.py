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


def _submit_hybrid_operation(
    client: Any, operation: HybridOperation, payload: list[Any]
) -> Any:
    index = client.index("apps-hybrid")
    if operation == "update":
        return index.update_documents(payload)
    return index.delete_documents(payload)


def _schedule_reconciliation(
    operation: HybridOperation,
    task_uid: int | None,
    payload: list[Any],
    failure_task_uid: int | str,
    attempt: int,
) -> None:
    try:
        monitor_hybrid_index_task.send_with_options(
            args=(operation, task_uid, payload, failure_task_uid, attempt),
            delay=RECONCILIATION_DELAY_MS,
        )
    except Exception:
        logger.exception(
            "Unable to schedule hybrid index task reconciliation",
            extra={"task": failure_task_uid, "operation": operation},
        )
        search_health.mark_hybrid_task_failed(failure_task_uid)


@dramatiq.actor(time_limit=TASK_TIMEOUT_MS + 60_000)
def monitor_hybrid_index_task(
    operation: HybridOperation,
    task_uid: int | None,
    payload: list[Any],
    failure_task_uid: int | str | None = None,
    attempt: int = 0,
) -> None:
    from . import search

    if task_uid is None:
        try:
            task = _submit_hybrid_operation(search.client, operation, payload)
            task_uid = task.task_uid
        except Exception:
            failure_uid = failure_task_uid or "submission"
            search_health.mark_hybrid_task_failed(failure_uid)
            if attempt >= MAX_RECONCILIATION_ATTEMPTS:
                logger.exception(
                    "Hybrid index reconciliation failed",
                    extra={"task": failure_uid, "operation": operation},
                )
                return
            logger.exception(
                "Hybrid index reconciliation submission failed",
                extra={"task": failure_uid, "operation": operation},
            )
            _schedule_reconciliation(operation, None, payload, failure_uid, attempt + 1)
            return
    try:
        result = search.client.wait_for_task(
            task_uid,
            timeout_in_ms=TASK_TIMEOUT_MS,
            interval_in_ms=TASK_INTERVAL_MS,
        )
    except Exception:
        failure_uid = failure_task_uid or task_uid or "unknown"
        search_health.mark_hybrid_task_failed(failure_uid)
        if attempt >= MAX_RECONCILIATION_ATTEMPTS:
            logger.exception(
                "Hybrid index task monitoring failed",
                extra={"task": failure_uid, "operation": operation},
            )
            return
        logger.exception(
            "Hybrid index task monitoring failed; retrying",
            extra={"task": failure_uid, "operation": operation},
        )
        _schedule_reconciliation(operation, task_uid, payload, failure_uid, attempt + 1)
        return

    if result.status == "succeeded":
        if failure_task_uid is not None:
            search_health.clear_hybrid_task_failure(failure_task_uid)
        logger.info(
            "Hybrid Meilisearch task complete",
            extra={
                "task": task_uid,
                "operation": operation,
                "reconciliation_attempt": attempt,
            },
        )
        return

    failure_uid = failure_task_uid or task_uid or "unknown"
    search_health.mark_hybrid_task_failed(failure_uid)
    if attempt >= MAX_RECONCILIATION_ATTEMPTS:
        logger.error(
            "Hybrid Meilisearch task failed after reconciliation attempts",
            extra={
                "task": failure_uid,
                "operation": operation,
                "status": result.status,
            },
        )
        return

    logger.warning(
        "Hybrid Meilisearch task failed; retrying",
        extra={
            "task": failure_uid,
            "operation": operation,
            "status": result.status,
            "reconciliation_attempt": attempt,
        },
    )
    try:
        retry_task = _submit_hybrid_operation(search.client, operation, payload)
    except Exception:
        logger.exception(
            "Hybrid index reconciliation submission failed",
            extra={"task": failure_uid, "operation": operation},
        )
        retry_uid = None
    else:
        retry_uid = retry_task.task_uid

    _schedule_reconciliation(operation, retry_uid, payload, failure_uid, attempt + 1)
