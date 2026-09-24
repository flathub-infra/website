import hashlib

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import text


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
