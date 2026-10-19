import logging
from datetime import UTC, datetime, timedelta

import dramatiq
import jwt

from .. import config, http_client

logger = logging.getLogger(__name__)


@dramatiq.actor(max_retries=3, min_backoff=60000, max_backoff=60000)
def notify_permission_decision(
    source_repository: str, pull_request_number: int
) -> None:
    url = config.settings.permission_decision_webhook_url
    secret = config.settings.permission_assessment_shared_secret
    if not url or not secret:
        logger.info("Permission decision notification delivery is disabled")
        return
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": "permission-assessment",
            "scope": "notify",
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        secret,
        algorithm="HS256",
    )
    http_client.post(
        url,
        json={
            "source_repository": source_repository,
            "pull_request_number": pull_request_number,
        },
        headers={"Authorization": f"Bearer {token}"},
        timeout=http_client.LONG_READ_TIMEOUT,
    ).raise_for_status()
