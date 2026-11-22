import logging
from datetime import timedelta
from math import ceil

import dramatiq
import sentry_sdk
from dramatiq.common import compute_backoff
from sqlalchemy import or_, select, update

from .. import cron, models, utils
from ..database import get_db
from ..moderation import permission_assessment, permission_triage

logger = logging.getLogger(__name__)

QUEUE = "permission-triage"
MAX_ATTEMPTS = 5
MIN_BACKOFF_MS = 60_000
MAX_BACKOFF_MS = 600_000
MAX_DELAY_SECONDS = 60 * 60
SWEEP_AFTER = timedelta(minutes=30)
TIME_LIMIT = timedelta(minutes=30)
CLAIM_LEASE = TIME_LIMIT + timedelta(minutes=5)


def _store(assessment_id: int, attempt: int, **values) -> bool:
    triage = models.PermissionTriage
    with get_db("writer") as db:
        return (
            db.session.scalar(
                update(triage)
                .where(
                    triage.assessment_id == assessment_id,
                    triage.status == "pending",
                    triage.attempts == attempt,
                )
                .values(**values)
                .returning(triage.assessment_id)
            )
            is not None
        )


def _end(assessment_id: int, attempt: int, status: str, error: str) -> None:
    if not _store(assessment_id, attempt, status=status, error=error):
        return
    logger.info(
        "Permission triage ended without result",
        extra={"assessment_id": assessment_id, "status": status, "error": error},
    )


def _claim(
    assessment_id: int,
) -> tuple[models.PermissionAssessmentObservation, int] | None:
    with get_db("writer") as db:
        row = db.session.get(
            models.PermissionTriage, assessment_id, with_for_update=True
        )
        if row is None or row.status != "pending":
            return None
        now = utils.utcnow()
        if row.claimable_at is not None and row.claimable_at > now:
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
        row.claimable_at = now + CLAIM_LEASE
        db.session.expunge(observation)
        return observation, row.attempts


@dramatiq.actor(
    queue_name=QUEUE,
    max_retries=MAX_ATTEMPTS,
    min_backoff=MIN_BACKOFF_MS,
    max_backoff=MAX_BACKOFF_MS,
    time_limit=int(TIME_LIMIT.total_seconds() * 1000),
)
def triage_permission_change(assessment_id: int) -> None:
    claimed = _claim(assessment_id)
    if claimed is None:
        return
    observation, attempts = claimed
    try:
        values = permission_triage.triage(observation)
    except (permission_triage.RateLimited, permission_triage.TransientError) as exc:
        if attempts >= MAX_ATTEMPTS:
            _end(
                assessment_id,
                attempts,
                "failed",
                f"gave up after {attempts} attempts: {exc}",
            )
            return
        if isinstance(exc, permission_triage.RateLimited):
            delay_ms = 1000 * ceil(
                min(max(exc.retry_after or 0, 60 * 2**attempts), MAX_DELAY_SECONDS)
            )
        else:
            _, delay_ms = compute_backoff(
                attempts - 1, factor=MIN_BACKOFF_MS, max_backoff=MAX_BACKOFF_MS
            )
        if not _store(
            assessment_id,
            attempts,
            claimable_at=utils.utcnow() + timedelta(milliseconds=delay_ms),
        ):
            return
        logger.warning(
            "Permission triage will retry",
            extra={"assessment_id": assessment_id, "retry_in": delay_ms / 1000},
        )
        triage_permission_change.send_with_options(
            args=(assessment_id,), delay=delay_ms
        )
    except permission_triage.TriageFailed as exc:
        _end(assessment_id, attempts, "failed", repr(exc))
    except Exception as exc:
        sentry_sdk.capture_exception(exc)
        logger.exception(
            "Permission triage attempt failed",
            extra={"assessment_id": assessment_id, "attempt": attempts},
        )
        _end(assessment_id, attempts, "failed", repr(exc))
    else:
        _store(assessment_id, attempts, **values)


@cron.cron("*/30 * * * *")
@dramatiq.actor
def sweep_permission_triage() -> None:
    triage = models.PermissionTriage
    now = utils.utcnow()
    with get_db() as db:
        stale = db.session.scalars(
            select(triage.assessment_id).where(
                triage.status == "pending",
                triage.created_at < now - SWEEP_AFTER,
                or_(triage.claimable_at.is_(None), triage.claimable_at <= now),
            )
        ).all()
    for assessment_id in stale:
        triage_permission_change.send(assessment_id)
