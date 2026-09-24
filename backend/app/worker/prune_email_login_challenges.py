from datetime import timedelta

import dramatiq
from sqlalchemy import delete

from .. import cron, models, utils
from ..database import get_db


@cron.cron("50 3 * * *")
@dramatiq.actor
def prune_email_login_challenges():
    with get_db("writer") as db:
        db.session.execute(
            delete(models.EmailLoginChallenge).where(
                models.EmailLoginChallenge.expires_at
                < utils.utcnow() - timedelta(hours=24)
            )
        )
