import hashlib
import os
import secrets
import sys
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session
from starlette.requests import Request

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import cache, config, logins, models
from app.db_session import DBSession
from app.email_login import (
    email_login_allowed,
    normalize_login_email,
    oauth_email_exists,
    require_oauth_upgrade,
)
from app.login_info import LoginInformation, LoginState, LoginStatusDep
from app.utils import utcnow


@pytest.fixture
def isolated_email_db(monkeypatch):
    url = os.getenv("OIDC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("OIDC_TEST_DATABASE_URL is not configured")
    schema = f"email_login_{uuid4().hex}"
    admin = create_engine(url)
    tables = (
        "flathubuser",
        "emailaccount",
        "emailloginchallenge",
        "githubaccount",
        "gitlabaccount",
        "gnomeaccount",
        "googleaccount",
        "kdeaccount",
        "flathubuser_role",
        "directuploadappdeveloper",
        "appverification",
    )
    with admin.begin() as connection:
        connection.execute(text(f"CREATE SCHEMA {schema}"))
        for table in tables:
            connection.execute(
                text(
                    f"CREATE TABLE {schema}.{table} (LIKE public.{table} INCLUDING ALL)"
                )
            )
        for table in ("flathubuser", "emailaccount", "emailloginchallenge"):
            connection.execute(text(f"CREATE SEQUENCE {schema}.{table}_id_seq"))
            connection.execute(
                text(
                    f"ALTER TABLE {schema}.{table} ALTER COLUMN id SET DEFAULT "
                    f"nextval('{schema}.{table}_id_seq')"
                )
            )
    engine = create_engine(
        url, connect_args={"options": f"-c search_path={schema},public"}
    )

    @contextmanager
    def writer(_db_type="writer"):
        with Session(engine, expire_on_commit=False) as session:
            yield DBSession(session)
            session.commit()

    monkeypatch.setattr(logins, "get_db", writer)
    monkeypatch.setattr(config.settings, "email_login_enabled", True)
    yield writer, engine
    engine.dispose()
    with admin.begin() as connection:
        connection.execute(text(f"DROP SCHEMA {schema} CASCADE"))
    admin.dispose()


def issue(writer, email, user_id=None, expires_at=None):
    token = secrets.token_urlsafe(32)
    with writer() as db:
        db.session.add(
            models.EmailLoginChallenge(
                token_hash=hashlib.sha256(token.encode("ascii")).hexdigest(),
                email=email,
                user_id=user_id,
                created_at=utcnow(),
                expires_at=expires_at or utcnow() + timedelta(minutes=15),
                locale="en",
                return_to="/en/apps/org.example.App",
            )
        )
    return token


def request_for(session):
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "https",
            "path": "/auth/email/confirm",
            "raw_path": b"/auth/email/confirm",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 443),
            "session": session,
        }
    )


def test_explicit_signup_consumes_all_links_and_sets_cookie(
    isolated_email_db, monkeypatch
):
    writer, engine = isolated_email_db
    email = f"reader-{uuid4().hex}@example.com"
    first = issue(writer, email)
    second = issue(writer, email)
    monkeypatch.setattr("app.login_info.get_db", writer)
    monkeypatch.setattr(logins._email_rate_store, "eval", lambda *args: [1])
    app = FastAPI()
    logins.register_to_app(app)
    app.add_middleware(cache.CacheControlMiddleware)

    @app.get("/current")
    def current(login: LoginStatusDep):
        return {"user_id": login.user.id if login.user else None}

    with (
        patch.object(logins.audit_log, "enqueue_audit_log") as audit,
        TestClient(app, base_url="https://testserver") as client,
    ):
        assert client.get("/auth/email/confirm").status_code == 405
        assert client.get("/current").json() == {"user_id": None}
        with Session(engine) as session:
            assert session.scalar(select(models.EmailAccount.id)) is None
            assert session.scalar(select(models.FlathubUser.id)) is None
        hostile = client.post(
            "/auth/email/confirm",
            json={"token": first},
            headers={"origin": "https://attacker.example"},
        )
        assert hostile.status_code == 403
        assert client.get("/current").json() == {"user_id": None}
        response = client.post(
            "/auth/email/confirm",
            json={"token": first},
            headers={"origin": config.settings.frontend_url.rstrip("/")},
        )
        assert response.status_code == 200, response.text
        assert response.json() == {
            "status": "ok",
            "return_to": "/en/apps/org.example.App",
        }
        assert response.headers["cache-control"] == "no-store"
        user_id = client.get("/current").json()["user_id"]
        assert isinstance(user_id, int)
        later = issue(writer, email)
        same_user = client.post(
            "/auth/email/confirm",
            json={"token": later},
            headers={"origin": config.settings.frontend_url.rstrip("/")},
        )
        assert same_user.status_code == 200
        assert client.get("/current").json() == {"user_id": user_id}
        assert audit.call_args.kwargs["provider"] == "email"
        for used in (first, second):
            rejected = client.post(
                "/auth/email/confirm",
                json={"token": used},
                headers={"origin": config.settings.frontend_url.rstrip("/")},
            )
            assert rejected.status_code == 400
            assert rejected.json() == {"detail": "invalid_email_link"}
            assert used not in rejected.text
        malformed = client.post(
            "/auth/email/confirm",
            json={"token": "raw-secret"},
            headers={"origin": config.settings.frontend_url.rstrip("/")},
        )
        assert malformed.status_code == 400
        assert "raw-secret" not in malformed.text
        assert client.get("/current").json() == {"user_id": user_id}
    with Session(engine) as session:
        assert (
            session.scalar(
                select(models.EmailAccount.email).where(
                    models.EmailAccount.user == user_id
                )
            )
            == email
        )
        assert (
            session.scalar(
                select(models.FlathubUser.default_account).where(
                    models.FlathubUser.id == user_id
                )
            )
            == "email"
        )
        assert (
            session.scalar(
                select(models.FlathubUser.id).where(models.FlathubUser.id != user_id)
            )
            is None
        )


def test_concurrent_redemption_has_one_winner(isolated_email_db):
    writer, engine = isolated_email_db
    email = f"reader-{uuid4().hex}@example.com"
    token = issue(writer, email)
    login = LoginInformation(LoginState.LOGGED_OUT, None, None)

    def redeem(_):
        try:
            result = logins.confirm_email_login(
                logins.EmailConfirmRequest(token=token), request_for({}), login
            )
            return result.status
        except HTTPException as exc:
            return exc.status_code

    with (
        patch.object(logins.audit_log, "enqueue_audit_log"),
        ThreadPoolExecutor(max_workers=2) as pool,
    ):
        assert sorted(pool.map(redeem, range(2)), key=str) == [400, "ok"]
    with Session(engine) as session:
        assert session.scalar(select(models.EmailAccount.email)) == email
        assert (
            session.scalar(select(func.count()).select_from(models.EmailAccount)) == 1
        )


def test_conflict_and_expiry_keep_proof_usable(isolated_email_db):
    writer, engine = isolated_email_db
    email = f"reader-{uuid4().hex}@example.com"
    token = issue(writer, email)
    with writer() as db:
        other = models.FlathubUser(display_name=None, default_account=None)
        db.session.add(other)
        db.session.flush()
        other_id = other.id
    with patch.object(logins.audit_log, "enqueue_audit_log"):
        with pytest.raises(HTTPException) as conflict:
            logins.confirm_email_login(
                logins.EmailConfirmRequest(token=token),
                request_for({"user-id": other_id}),
                LoginInformation(LoginState.LOGGED_IN, other, None),
            )
        assert conflict.value.status_code == 409
        fresh_session = {}
        result = logins.confirm_email_login(
            logins.EmailConfirmRequest(token=token),
            request_for(fresh_session),
            LoginInformation(LoginState.LOGGED_OUT, None, None),
        )
        assert result.status == "ok"
        assert fresh_session["auth-method"] == "email"
        expired = issue(
            writer,
            f"expired-{uuid4().hex}@example.com",
            expires_at=utcnow() - timedelta(seconds=1),
        )
        with pytest.raises(HTTPException) as invalid:
            logins.confirm_email_login(
                logins.EmailConfirmRequest(token=expired),
                request_for({}),
                LoginInformation(LoginState.LOGGED_OUT, None, None),
            )
        assert invalid.value.status_code == 400
    with Session(engine) as session:
        assert (
            session.scalar(
                select(models.EmailLoginChallenge.consumed_at).where(
                    models.EmailLoginChallenge.token_hash
                    == hashlib.sha256(token.encode()).hexdigest()
                )
            )
            is not None
        )


def test_require_oauth_upgrade_guards_privileged_state(isolated_email_db):
    writer, _engine = isolated_email_db
    email = f"developer-{uuid4().hex}@example.com"
    with writer() as db:
        user = models.FlathubUser(display_name=None, default_account="email")
        db.session.add(user)
        db.session.flush()
        db.session.add(
            models.EmailAccount(user=user.id, email=email, verified_at=utcnow())
        )
        db.session.flush()
        with pytest.raises(HTTPException) as guard:
            require_oauth_upgrade(db, user)
        assert guard.value.status_code == 403
        assert guard.value.detail == "oauth_upgrade_required"
        legacy = models.FlathubUser(display_name=None, default_account=None)
        db.session.add(legacy)
        db.session.flush()
        user_id = user.id
        legacy_id = legacy.id
    with writer() as db:
        upgraded_user = db.session.get(models.FlathubUser, user_id)
        db.session.add(
            models.GithubAccount(
                user=user_id,
                github_userid=1,
                login="dev",
                avatar_url=None,
                email=None,
            )
        )
        upgraded = models.EmailAccount.by_user(db, upgraded_user)
        upgraded.disabled_at = utcnow()
        db.session.flush()
        require_oauth_upgrade(db, upgraded_user)
        require_oauth_upgrade(db, db.session.get(models.FlathubUser, legacy_id))


def test_oauth_upgrade_disables_email_and_retains_user(isolated_email_db):
    writer, _engine = isolated_email_db
    email = f"reader-{uuid4().hex}@example.com"
    token = issue(writer, email)
    session = {}
    request = request_for(session)
    with patch.object(logins.audit_log, "enqueue_audit_log"):
        logins.confirm_email_login(
            logins.EmailConfirmRequest(token=token),
            request,
            LoginInformation(LoginState.LOGGED_OUT, None, None),
        )
        user_id = session["user-id"]
    with writer() as db:
        user = db.session.get(models.FlathubUser, user_id)
        db.session.add(
            models.GithubAccount(
                user=user_id,
                github_userid=77,
                login="reader",
                avatar_url=None,
                email=email,
                token="token",
                last_used=utcnow(),
            )
        )
        models.EmailAccount.by_user(db, user).disabled_at = utcnow()
        db.session.flush()
        with patch.object(logins.audit_log, "enqueue_audit_log"):
            assert not email_login_allowed(db, user)
            request = request_for({"user-id": user_id, "auth-method": "email"})
            with pytest.raises(HTTPException) as expired:
                logins.confirm_email_login(
                    logins.EmailConfirmRequest(token=token),
                    request_for({}),
                    LoginInformation(LoginState.LOGGED_OUT, None, None),
                )
            assert expired.value.status_code == 400


def test_oauth_upgrade_helper_sets_locked_switch(isolated_email_db):
    writer, _engine = isolated_email_db
    email = f"upgrader-{uuid4().hex}@example.com"
    with writer() as db:
        user = models.FlathubUser(display_name=None, default_account="email")
        db.session.add(user)
        db.session.flush()
        db.session.add(
            models.EmailAccount(user=user.id, email=email, verified_at=utcnow())
        )
        db.session.flush()
        pending = models.EmailLoginChallenge(
            token_hash=hashlib.sha256(b"pending").hexdigest(),
            email=email,
            user_id=user.id,
            created_at=utcnow(),
            expires_at=utcnow() + timedelta(minutes=15),
            locale="en",
            return_to="/",
        )
        db.session.add(pending)
        db.session.flush()
        user_id = user.id
    with writer() as db:
        account = logins._upgrade_email_user(
            db,
            db.session.get(models.FlathubUser, user_id),
            "gitlab",
            SimpleNamespace(
                id=42, login="reader", avatar_url=None, name=None, email=email
            ),
            {"access_token": "token"},
            models.GitlabAccount,
        )
        assert account is not None
        upgraded = db.session.get(models.FlathubUser, user_id)
        assert upgraded.default_account == "gitlab"
        assert models.EmailAccount.by_user(db, upgraded).disabled_at is not None
        challenge = db.session.scalar(
            select(models.EmailLoginChallenge).where(
                models.EmailLoginChallenge.token_hash
                == hashlib.sha256(b"pending").hexdigest()
            )
        )
        assert challenge.consumed_at is not None
    with writer() as db:
        collision_email = f"taken-{uuid4().hex}@example.com"
        collided = models.FlathubUser(display_name=None, default_account="email")
        oauth_owner = models.FlathubUser(display_name=None, default_account="gitlab")
        db.session.add_all((collided, oauth_owner))
        db.session.flush()
        db.session.add(
            models.EmailAccount(
                user=collided.id,
                email=f"email-only-{uuid4().hex}@example.com",
                verified_at=utcnow(),
            )
        )
        db.session.add(
            models.GitlabAccount(
                user=oauth_owner.id,
                gitlab_userid=99,
                login="other",
                avatar_url=None,
                email=collision_email,
            )
        )
        db.session.flush()
        assert email_login_allowed(db, collided)
        assert (
            logins._upgrade_email_user(
                db,
                db.session.get(models.FlathubUser, collided.id),
                "gitlab",
                SimpleNamespace(
                    id=43,
                    login="reader2",
                    avatar_url=None,
                    name=None,
                    email=collision_email,
                ),
                {"access_token": "token"},
                models.GitlabAccount,
            )
            is None
        )
        assert models.EmailAccount.by_user(db, collided).disabled_at is None


def test_internationalized_oauth_email_blocks_email_signup(isolated_email_db):
    writer, engine = isolated_email_db
    unicode_email = f"reader-{uuid4().hex}@bücher.de"
    ascii_email = normalize_login_email(unicode_email)
    with writer() as db:
        user = models.FlathubUser(display_name=None, default_account="gitlab")
        db.session.add(user)
        db.session.flush()
        db.session.add(
            models.GitlabAccount(
                user=user.id,
                gitlab_userid=99,
                login="reader",
                avatar_url=None,
                email=unicode_email,
            )
        )
    token = issue(writer, ascii_email)
    with (
        writer() as db,
        patch.object(logins.audit_log, "enqueue_audit_log"),
    ):
        assert oauth_email_exists(db, ascii_email)
        with pytest.raises(HTTPException) as blocked:
            logins.confirm_email_login(
                logins.EmailConfirmRequest(token=token),
                request_for({}),
                LoginInformation(LoginState.LOGGED_OUT, None, None),
            )
        assert blocked.value.status_code == 400
    with Session(engine) as session:
        assert session.scalar(select(models.EmailAccount.id)) is None
