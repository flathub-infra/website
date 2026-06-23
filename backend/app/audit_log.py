"""
Audit logging.

Records audit events (login success/failure, logout, account deletion) to
the ``auditlog`` table without blocking the HTTP response path.

Events are dispatched to a Dramatiq actor that performs the database write,
matching the pattern used for email notifications.
"""

import logging

import dramatiq
from fastapi import Request

from . import models
from .database import get_db
from .dramatiq_broker import broker

logger = logging.getLogger(__name__)


@dramatiq.actor(broker=broker)
def log_audit_event(
    user_id: int | None,
    event_type: str,
    provider: str | None = None,
    target_user_id: int | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    details: dict | None = None,
) -> None:
    """Persist an audit event. Runs on the Dramatiq worker."""
    try:
        with get_db("writer") as db:
            models.AuditLog.create(
                db,
                user_id=user_id,
                event_type=models.AuditEventType(event_type),
                target_user_id=target_user_id,
                provider=provider,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details,
            )
    except Exception:
        # Audit logging must never break unrelated work. Swallow the error
        # after recording it so the worker can move on to the next message.
        logger.exception("Failed to persist audit log event %s", event_type)


def enqueue_audit_log(
    request: Request | None,
    user_id: int | None,
    event_type: models.AuditEventType,
    *,
    provider: str | None = None,
    target_user_id: int | None = None,
    details: dict | None = None,
) -> None:
    """Enqueue an audit log event for asynchronous persistence.

    Extracts the client IP and User-Agent from the request when available so
    callers don't have to. Safe to call from request handlers; the enqueue
    itself does not touch the database.
    """
    ip_address = None
    user_agent = None
    if request is not None:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

    log_audit_event.send(
        user_id=user_id,
        event_type=str(event_type),
        provider=provider,
        target_user_id=target_user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
    )
