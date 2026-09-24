import hashlib
import re
from urllib.parse import unquote, urlsplit

from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException
from sqlalchemy import func, select, text

from . import models
from .db_session import DBSession


def normalize_login_email(value: str) -> str:
    try:
        result = validate_email(
            value.strip(), check_deliverability=False, allow_smtputf8=False
        )
    except (EmailNotValidError, AttributeError) as exc:
        raise ValueError("invalid_email_request") from exc
    if result.ascii_email is None:
        raise ValueError("invalid_email_request")
    return result.ascii_email.lower()


def lock_email(db, email: str) -> None:
    digest = hashlib.sha256(email.encode("ascii")).digest()
    key = int.from_bytes(digest[:8], "big", signed=True)
    db.session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})


def has_oauth_account(db: DBSession, user: models.FlathubUser) -> bool:
    return any(
        db.session.scalar(select(table.id).where(table.user == user.id).limit(1))
        is not None
        for table in (
            models.GithubAccount,
            models.GitlabAccount,
            models.GnomeAccount,
            models.GoogleAccount,
            models.KdeAccount,
        )
    )


def oauth_email_exists(db: DBSession, email: str) -> bool:
    for table in (
        models.GithubAccount,
        models.GitlabAccount,
        models.GnomeAccount,
        models.GoogleAccount,
        models.KdeAccount,
    ):
        if (
            db.session.scalar(
                select(table.id)
                .where(func.lower(func.trim(table.email)) == email)
                .limit(1)
            )
            is not None
        ):
            return True
    return (
        db.session.scalar(
            select(models.GoogleAccount.id)
            .where(func.lower(func.trim(models.GoogleAccount.login)) == email)
            .limit(1)
        )
        is not None
    )


def email_login_allowed(db: DBSession, user: models.FlathubUser) -> bool:
    account = models.EmailAccount.by_user(db, user)
    if (
        account is None
        or account.disabled_at is not None
        or user.login_disabled
        or has_oauth_account(db, user)
        or oauth_email_exists(db, account.email)
    ):
        return False
    return not any(
        db.session.scalar(query.limit(1)) is not None
        for query in (
            select(models.flathubuser_role.id).where(
                models.flathubuser_role.flathubuser_id == user.id
            ),
            select(models.DirectUploadAppDeveloper.id).where(
                models.DirectUploadAppDeveloper.developer_id == user.id
            ),
            select(models.AppVerification.app_id).where(
                models.AppVerification.account == user.id,
                models.AppVerification.verified.is_(True),
            ),
        )
    )


def require_oauth_upgrade(db: DBSession, user: models.FlathubUser) -> None:
    db.session.execute(
        select(models.FlathubUser.id)
        .where(models.FlathubUser.id == user.id)
        .with_for_update()
    )
    account = models.EmailAccount.by_user(db, user)
    if account and (account.disabled_at is None or not has_oauth_account(db, user)):
        raise HTTPException(status_code=403, detail="oauth_upgrade_required")


_LOCALE = re.compile(r"[a-z]{2,3}(?:-[A-Za-z]{2,4})?\Z")


def safe_locale(value: str) -> str:
    return value if _LOCALE.fullmatch(value) else "en"


def safe_return_to(value: str | None) -> str:
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/"
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        return "/"
    decoded = value
    for _ in range(8):
        candidate = unquote(decoded)
        if candidate == decoded:
            break
        decoded = candidate
    if (
        "\\" in decoded
        or "#" in decoded
        or decoded.startswith("//")
        or any(ord(char) < 32 or ord(char) == 127 for char in decoded)
    ):
        return "/"
    parts = urlsplit(decoded)
    if parts.scheme or parts.netloc or not parts.path.startswith("/"):
        return "/"
    if re.match(
        r"^/(?:[a-z]{2,3}(?:-[A-Za-z]{2,4})?/)?login(?:/|$)",
        parts.path,
        re.IGNORECASE,
    ):
        return "/"
    return value
