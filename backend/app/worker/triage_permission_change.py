import logging
from datetime import timedelta

import dramatiq
import sentry_sdk
from sqlalchemy import select, update

from .. import cron, models, utils
from ..database import get_db
from ..moderation import permission_assessment, permission_triage

logger = logging.getLogger(__name__)

QUEUE = "permission-triage"
MAX_ATTEMPTS = 5
MAX_DELAY_SECONDS = 60 * 60
SWEEP_AFTER = timedelta(minutes=30)


def _store(assessment_id: int, **values) -> None:
    triage = models.PermissionTriage
    with get_db("writer") as db:
        db.session.execute(
            update(triage)
            .where(triage.assessment_id == assessment_id, triage.status == "pending")
            .values(**values)
        )


def _end(assessment_id: int, status: str, error: str) -> None:
    logger.info(
        "Permission triage ended without result",
        extra={"assessment_id": assessment_id, "status": status, "error": error},
    )
    _store(assessment_id, status=status, error=error)


def _claim(
    assessment_id: int,
) -> tuple[models.PermissionAssessmentObservation, int] | None:
    with get_db("writer") as db:
        row = db.session.get(
            models.PermissionTriage, assessment_id, with_for_update=True
        )
        if row is None or row.status != "pending":
            return None
        if row.attempts >= MAX_ATTEMPTS:
            row.status = "failed"
            row.error = f"gave up after {MAX_ATTEMPTS} attempts"
            return None
        observation = db.session.get(
            models.PermissionAssessmentObservation, assessment_id
        )
        assert observation is not None
        newer = permission_assessment.superseded_by(db.session, observation)
        if observation.outcome != "pending" or newer is not None:
            row.status = "skipped"
            row.error = (
                f"superseded by {newer}"
                if newer is not None
                else f"observation is {observation.outcome}"
            )
            return None
        row.attempts += 1
        db.session.expunge(observation)
        return observation, row.attempts


@dramatiq.actor(
    queue_name=QUEUE,
    max_retries=MAX_ATTEMPTS,
    min_backoff=60_000,
    max_backoff=600_000,
    time_limit=1_800_000,
)
def triage_permission_change(assessment_id: int) -> None:
    claimed = _claim(assessment_id)
    if claimed is None:
        return
    observation, attempts = claimed
    try:
        values = permission_triage.triage(observation)
    except permission_triage.RateLimited as exc:
        delay = min(max(exc.retry_after or 0, 60 * 2**attempts), MAX_DELAY_SECONDS)
        logger.warning(
            "Permission triage rate limited, rescheduling",
            extra={"assessment_id": assessment_id, "retry_in": delay},
        )
        triage_permission_change.send_with_options(
            args=(assessment_id,), delay=int(delay * 1000)
        )
    except permission_triage.TransientError as exc:
        if attempts < MAX_ATTEMPTS:
            raise
        _end(assessment_id, "failed", f"gave up after {attempts} attempts: {exc}")
    except permission_triage.TriageFailed as exc:
        _end(assessment_id, "failed", repr(exc))
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        logger.exception(
            "Permission triage failed", extra={"assessment_id": assessment_id}
        )
        _end(assessment_id, "failed", repr(exc))
    else:
        _store(assessment_id, **values)


@cron.cron("*/30 * * * *")
@dramatiq.actor
def sweep_permission_triage() -> None:
    triage = models.PermissionTriage
    with get_db() as db:
        stale = db.session.scalars(
            select(triage.assessment_id).where(
                triage.status == "pending",
                triage.created_at < utils.utcnow() - SWEEP_AFTER,
            )
        ).all()
    for assessment_id in stale:
        triage_permission_change.send(assessment_id)
