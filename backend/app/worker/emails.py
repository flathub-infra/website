import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import dramatiq
from sqlalchemy import select

from .. import config, emails, models, utils
from ..database import get_db
from ..email_login import email_login_allowed, lock_email, oauth_email_exists


@dramatiq.actor
def send_email_new(email):
    with get_db("writer") as db:
        emails.send_email_new(dict(**email), db)


@dramatiq.actor
def send_one_email_new(message: dict, dest: str):
    emails.send_one_email_new(message, dest)


@dramatiq.actor(max_retries=3, min_backoff=60000, max_backoff=60000)
def send_email_login_link(
    email: str, locale: str, return_to: str, requested_at: float, user_id: int | None
):
    if (datetime.now(UTC).timestamp() - requested_at) >= 900:
        return

    with get_db("writer") as db:
        lock_email(db, email)
        account = db.session.scalar(
            select(models.EmailAccount).where(models.EmailAccount.email == email)
        )
        if user_id is not None:
            user = db.session.scalar(
                select(models.FlathubUser)
                .where(models.FlathubUser.id == user_id)
                .with_for_update()
            )
            if (
                user is None
                or account is None
                or account.user != user_id
                or not email_login_allowed(db, user)
            ):
                return
        elif account is not None or oauth_email_exists(db, email):
            return

        if (
            db.session.scalar(
                select(models.EmailLoginChallenge.id).where(
                    models.EmailLoginChallenge.email == email,
                    models.EmailLoginChallenge.consumed_at.is_not(None),
                    models.EmailLoginChallenge.consumed_at
                    >= datetime.fromtimestamp(requested_at, UTC).replace(tzinfo=None),
                )
            )
            is not None
        ):
            return

        token = secrets.token_urlsafe(32)
        now = utils.utcnow()
        expires_at = now + timedelta(seconds=900)
        challenge = models.EmailLoginChallenge(
            token_hash=hashlib.sha256(token.encode("ascii")).hexdigest(),
            email=email,
            user_id=user_id,
            created_at=now,
            expires_at=expires_at,
            locale=locale,
            return_to=return_to,
        )
        db.session.add(challenge)
        db.session.flush()
        challenge_id = challenge.id

    if utils.utcnow() >= expires_at:
        return
    url = (
        f"{config.settings.frontend_url.rstrip('/')}/{locale}/login/email/confirm"
        f"#token={token}"
    )
    emails.send_one_email_new(
        {
            "messageId": f"email-login-{challenge_id}",
            "creation_timestamp": now.replace(tzinfo=UTC).timestamp(),
            "subject": "Sign in to Flathub",
            "previewText": "Sign in to Flathub",
            "messageInfo": {
                "category": emails.EmailCategory.EMAIL_LOGIN,
                "signInUrl": url,
                "expiresAt": expires_at.replace(tzinfo=UTC).isoformat(),
            },
        },
        email,
    )
