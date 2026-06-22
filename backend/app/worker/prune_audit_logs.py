import logging
from datetime import UTC, datetime, timedelta

import dramatiq

from .. import config, cron, models
from ..database import get_db

logger = logging.getLogger(__name__)


@cron.cron("30 3 * * *")  # every day at 3:30am
@dramatiq.actor
def prune_audit_logs():
    """Delete audit log entries older than the configured retention window."""
    retention_days = config.settings.audit_log_retention_days
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)
    with get_db("writer") as db:
        deleted = (
            db.query(models.AuditLog)
            .filter(models.AuditLog.created_at < cutoff)
            .delete(synchronize_session=False)
        )
        if deleted:
            logger.info(
                "Pruned %d audit log entries older than %d days",
                deleted,
                retention_days,
            )
