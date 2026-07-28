import logging
from datetime import timedelta

import dramatiq
from sqlalchemy import delete, exists, or_, select

from .. import config, cron, models, utils
from ..database import get_db

logger = logging.getLogger(__name__)


def _authorization_code_cleanup_condition(now):
    has_derived_tokens = exists(
        select(1).where(
            or_(
                models.OidcAccessToken.authorization_code_id
                == models.OidcAuthorizationCode.id,
                models.OidcRefreshToken.authorization_code_id
                == models.OidcAuthorizationCode.id,
            )
        )
    )
    return or_(
        models.OidcAuthorizationCode.expires_at < now,
        models.OidcAuthorizationCode.consumed_at.is_not(None),
    ), ~has_derived_tokens


@cron.cron("45 3 * * *")
@dramatiq.actor
def prune_oidc_tokens():
    """Delete expired OIDC credentials and authorization-code records."""
    now = utils.utcnow()
    token_cutoff = now - timedelta(
        seconds=config.settings.oidc_token_cleanup_grace_seconds
    )

    with get_db("writer") as db:
        deleted_access_tokens = db.session.execute(
            delete(models.OidcAccessToken).where(
                models.OidcAccessToken.expires_at < token_cutoff
            )
        ).rowcount
        deleted_refresh_tokens = db.session.execute(
            delete(models.OidcRefreshToken).where(
                models.OidcRefreshToken.expires_at < token_cutoff
            )
        ).rowcount
        code_expired, no_derived_tokens = _authorization_code_cleanup_condition(now)
        deleted_codes = db.session.execute(
            delete(models.OidcAuthorizationCode).where(
                code_expired,
                no_derived_tokens,
            )
        ).rowcount

    if deleted_codes or deleted_access_tokens or deleted_refresh_tokens:
        logger.info(
            "Pruned OIDC credentials: %d authorization codes, %d access tokens, %d refresh tokens",
            deleted_codes,
            deleted_access_tokens,
            deleted_refresh_tokens,
        )
