import os
import sys
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from app.db_session import DBSession
from app.email_login import normalize_login_email
from app.models import EmailAccount, EmailLoginChallenge, FlathubUser
from app.utils import utcnow


@pytest.mark.parametrize(
    ("value", "canonical"),
    [
        (" Reader+News@Example.COM ", "reader+news@example.com"),
        ("reader.news@example.com", "reader.news@example.com"),
        ("Reader@bücher.example", "reader@xn--bcher-kva.example"),
    ],
)
def test_normalize_email(value, canonical):
    assert normalize_login_email(value) == canonical


@pytest.mark.parametrize("value", ["", "not-an-email", "é@example.com", "reader@"])
def test_reject_invalid_email(value):
    with pytest.raises(ValueError, match="invalid_email_request"):
        normalize_login_email(value)


def test_email_identity_and_deletion():
    url = os.getenv("OIDC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("OIDC_TEST_DATABASE_URL is not configured")
    engine = create_engine(url)
    with Session(engine) as session:
        db = DBSession(session)
        email = f"reader-{uuid4().hex}@example.com"
        user = FlathubUser(display_name=None, default_account="email")
        session.add(user)
        session.flush()
        account = EmailAccount(user=user.id, email=email, verified_at=utcnow())
        session.add(account)
        session.flush()
        challenge = EmailLoginChallenge(
            token_hash=uuid4().hex.ljust(64, "0"),
            email=email,
            user_id=user.id,
            created_at=utcnow(),
            expires_at=utcnow(),
            locale="en",
            return_to="/",
        )
        session.add(challenge)
        session.flush()
        assert user.get_default_account(db).login == f"user-{user.id}"
        assert user.to_result(db).default_account.email == email
        token = FlathubUser.generate_token(db, user)
        account.disabled_at = utcnow()
        session.flush()
        assert user.get_default_account(db) is None
        assert FlathubUser.generate_token(db, user) != token
        EmailAccount.delete_user(db, user)
        session.flush()
        assert (
            session.scalar(
                select(EmailLoginChallenge).where(EmailLoginChallenge.email == email)
            )
            is None
        )
        assert (
            session.scalar(select(EmailAccount).where(EmailAccount.email == email))
            is None
        )
        session.rollback()
    engine.dispose()
