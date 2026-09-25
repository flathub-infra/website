import os
import sys
from contextlib import contextmanager
from unittest.mock import patch
from uuid import uuid4

import pytest
import redis
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from app import cache, config, logins
from app.db_session import DBSession
from app.email_login import (
    email_login_allowed,
    normalize_login_email,
    safe_locale,
    safe_return_to,
)
from app.login_info import LoginInformation, LoginState, login_state
from app.models import EmailAccount, EmailLoginChallenge, FlathubUser
from app.utils import utcnow
from app.worker.emails import send_email_login_link


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


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (
            "/en/apps/org.example.App?source=oidc%3Aclient",
            "/en/apps/org.example.App?source=oidc%3Aclient",
        ),
        ("/en/oidc/authorize?client_id=test", "/en/oidc/authorize?client_id=test"),
        ("//evil.example", "/"),
        ("/%2Fattacker.example", "/"),
        ("/en/login/email/confirm", "/"),
        ("/login?next=%2F", "/"),
        ("/apps/x#secret", "/"),
        ("/apps\\\\evil", "/"),
        ("https://evil.example", "/"),
        ("/%0d%0a", "/"),
    ],
)
def test_safe_return_path(value, expected):
    assert safe_return_to(value) == expected


def test_locale_syntax():
    assert safe_locale("pt-BR") == "pt-BR"
    assert safe_locale("en/../../") == "en"


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
        assert email_login_allowed(db, user)
        assert user.get_default_account(db).login == f"user-{user.id}"
        assert user.to_result(db).default_account.email == email
        token = FlathubUser.generate_token(db, user)
        account.disabled_at = utcnow()
        session.flush()
        assert user.get_default_account(db) is None
        assert not email_login_allowed(db, user)
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


def test_request_hides_membership_and_worker_skips_disabled(monkeypatch):
    url = os.getenv("OIDC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("OIDC_TEST_DATABASE_URL is not configured")
    engine = create_engine(url)
    blocked_email = f"blocked-{uuid4().hex}@example.com"
    new_email = f"new-{uuid4().hex}@example.com"
    with Session(engine) as session:
        user = FlathubUser(display_name=None, default_account="email")
        session.add(user)
        session.flush()
        session.add(
            EmailAccount(
                user=user.id,
                email=blocked_email,
                verified_at=utcnow(),
                disabled_at=utcnow(),
            )
        )
        session.commit()
        user_id = user.id

    @contextmanager
    def writer(_db_type="writer"):
        with Session(engine) as session:
            yield DBSession(session)
            session.commit()

    class RateStore:
        def __init__(self):
            self.counts = [1, 1, 1]
            self.unavailable = False

        def eval(self, *args):
            if self.unavailable:
                raise redis.ConnectionError("redis down")
            return self.counts

    app = FastAPI()
    app.dependency_overrides[login_state] = lambda: LoginInformation(
        LoginState.LOGGED_OUT, None, None
    )
    logins.register_to_app(app)
    app.add_middleware(cache.CacheControlMiddleware)
    sent = []
    monkeypatch.setattr(config.settings, "email_login_enabled", True)
    monkeypatch.setattr(logins, "get_db", writer)
    rate = RateStore()
    monkeypatch.setattr(logins, "_email_rate_store", rate)
    with (
        patch.object(
            send_email_login_link, "send", side_effect=lambda *args: sent.append(args)
        ),
        TestClient(app) as client,
    ):
        responses = [
            client.post(
                "/auth/email/request",
                json={"email": email, "return_to": "/en/apps/org.example.App"},
                headers={"origin": config.settings.frontend_url.rstrip("/")},
            )
            for email in (new_email, blocked_email)
        ]
        assert [response.status_code for response in responses] == [202, 202]
        assert responses[0].json() == responses[1].json() == {"status": "accepted"}
        assert all(
            response.headers["cache-control"] == "no-store" for response in responses
        )
        invalid = client.post(
            "/auth/email/request",
            json={"email": "secret-invalid"},
            headers={"origin": config.settings.frontend_url.rstrip("/")},
        )
        assert invalid.status_code == 422
        assert "secret-invalid" not in invalid.text
        hostile = client.post(
            "/auth/email/request",
            json={"email": new_email},
            headers={"origin": "https://attacker.example"},
        )
        assert hostile.status_code == 403
        assert hostile.json() == {"detail": "invalid_origin"}
        assert client.get("/auth/email/config").json() == {"enabled": True}
        rate.counts = [1, 2, 1]
        throttled_address = client.post(
            "/auth/email/request",
            json={"email": new_email},
            headers={"origin": config.settings.frontend_url.rstrip("/")},
        )
        assert throttled_address.status_code == 202
        assert throttled_address.json() == responses[0].json()
        rate.counts = [21, 1, 1]
        throttled_ip = client.post(
            "/auth/email/request",
            json={"email": new_email},
            headers={"origin": config.settings.frontend_url.rstrip("/")},
        )
        assert throttled_ip.status_code == 429
        assert throttled_ip.headers["Retry-After"] == "3600"
        rate.unavailable = True
        unavailable = client.post(
            "/auth/email/request",
            json={"email": new_email},
            headers={"origin": config.settings.frontend_url.rstrip("/")},
        )
        assert unavailable.status_code == 503
        assert unavailable.json() == {"detail": "email_login_unavailable"}
        assert len(sent) == 2
    assert sent[0][-1] is None
    assert sent[1][-1] == user_id

    with (
        patch("app.worker.emails.get_db", writer),
        patch("app.worker.emails.emails.send_one_email_new") as mail,
    ):
        send_email_login_link.fn(*sent[1])
        mail.assert_not_called()
        send_email_login_link.fn(*sent[0])
        assert mail.call_count == 1
        payload, destination = mail.call_args.args
        assert destination == new_email
        link = payload["messageInfo"]["signInUrl"]
        assert "/en/login/email/confirm#token=" in link
        assert payload["messageInfo"]["category"] == "email_login"
        with Session(engine) as session:
            challenge = session.scalar(
                select(EmailLoginChallenge).where(
                    EmailLoginChallenge.email == new_email
                )
            )
            assert challenge is not None
            assert challenge.token_hash not in link
            assert (
                session.scalar(
                    select(FlathubUser.id)
                    .join(EmailAccount, EmailAccount.user == FlathubUser.id)
                    .where(EmailAccount.email == new_email)
                )
                is None
            )
        mail.reset_mock()
        send_email_login_link.fn(*sent[0][:3], sent[0][3] - 901, None)
        mail.assert_not_called()
    with Session(engine) as session:
        session.query(EmailLoginChallenge).filter_by(email=new_email).delete()
        session.query(EmailAccount).filter_by(user=user_id).delete()
        session.query(FlathubUser).filter_by(id=user_id).delete()
        session.commit()
    engine.dispose()


def test_failed_enqueue_releases_address_reservation(monkeypatch):
    url = os.getenv("OIDC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("OIDC_TEST_DATABASE_URL is not configured")
    store = redis.Redis(
        host=config.settings.redis_host,
        port=config.settings.redis_port,
        db=config.settings.redis_db,
        decode_responses=True,
    )
    try:
        store.ping()
    except redis.RedisError:
        pytest.skip("Redis is not available")
    engine = create_engine(url)
    email = f"retry-{uuid4().hex}@example.com"
    ip = f"test-{uuid4().hex}"

    @contextmanager
    def writer(_db_type="writer"):
        with Session(engine) as session:
            yield DBSession(session)

    app = FastAPI()
    app.dependency_overrides[login_state] = lambda: LoginInformation(
        LoginState.LOGGED_OUT, None, None
    )
    logins.register_to_app(app)
    monkeypatch.setattr(config.settings, "email_login_enabled", True)
    monkeypatch.setattr(logins, "get_db", writer)
    monkeypatch.setattr(logins, "_email_rate_store", store)
    with (
        patch.object(
            send_email_login_link,
            "send",
            side_effect=[RuntimeError("queue down"), None],
        ) as enqueue,
        TestClient(app, client=(ip, 12345)) as client,
    ):
        try:
            responses = [
                client.post(
                    "/auth/email/request",
                    json={"email": email},
                    headers={"origin": config.settings.frontend_url.rstrip("/")},
                )
                for _ in range(2)
            ]
            assert [response.status_code for response in responses] == [503, 202]
            assert enqueue.call_count == 2
            assert store.get(f"email-login:ip:{ip}:hour") == "2"
        finally:
            address_key = logins.hmac.new(
                config.settings.session_secret_key.encode(),
                email.encode("ascii"),
                logins.hashlib.sha256,
            ).hexdigest()
            store.delete(
                f"email-login:ip:{ip}:hour",
                f"email-login:address:{address_key}:minute",
                f"email-login:address:{address_key}:hour",
            )
            engine.dispose()
