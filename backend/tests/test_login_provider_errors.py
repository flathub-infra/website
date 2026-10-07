import os
import sys
from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from gitlab.exceptions import GitlabGetError
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session
from starlette.requests import Request

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.modules["app.search"] = SimpleNamespace()

from app import logins, models
from app.db_session import DBSession
from app.login_info import LoginInformation, LoginState


@pytest.mark.parametrize(
    ("method", "message", "expected_error"),
    [
        (
            "gitlab",
            (
                "403 Forbidden - You (@example) must accept the Terms of Service "
                "in order to perform this action."
            ),
            "gitlab-terms-not-accepted",
        ),
        (
            "gnome",
            (
                "403 Forbidden - You (@example) must accept the Terms of Service "
                "in order to perform this action."
            ),
            "gitlab-terms-not-accepted",
        ),
        (
            "kde",
            (
                "403 Forbidden - You (@example) must accept the Terms of Service "
                "in order to perform this action."
            ),
            "gitlab-terms-not-accepted",
        ),
        (
            "gitlab",
            "403 Forbidden - Access denied for @example",
            "login-failed-try-again",
        ),
    ],
)
def test_gitlab_provider_failure_returns_actionable_error(
    method, message, expected_error
):
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": f"/auth/login/{method}",
            "headers": [],
            "session": {
                "active-login-flow": method,
                f"_oauth_state_{method}": {
                    "state": "expected-state",
                    "created": datetime.now(UTC).timestamp(),
                },
            },
        }
    )
    login = LoginInformation(LoginState.LOGGING_IN, None, method)

    class OAuthClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def fetch_token(self, *args, **kwargs):
            return {"token_type": "Bearer", "access_token": "test-token"}

    def provider_data(tokens):
        raise GitlabGetError(message, response_code=403)

    with (
        patch.object(
            logins.oauth_providers, "get_oauth_client", return_value=OAuthClient()
        ),
        patch.object(logins, "_log_login_failure"),
    ):
        response = logins.continue_oauth_flow(
            request,
            login,
            logins.OauthLoginResponseSuccess(code="test-code", state="expected-state"),
            method,
            provider_data,
            {
                "gitlab": models.GitlabAccount,
                "gnome": models.GnomeAccount,
                "kde": models.KdeAccount,
            }[method],
        )

    assert response.status_code == 400
    assert response.body.decode() == (f'{{"state":"error","error":"{expected_error}"}}')


@pytest.mark.parametrize("existing_method", ["email", "github", None])
def test_oauth_signup_checks_existing_accounts_by_normalized_email(
    monkeypatch,
    existing_method,
):
    locked = []
    engine = create_engine("sqlite://")
    models.Base.metadata.create_all(
        engine,
        tables=[
            table.__table__
            for table in (
                models.FlathubUser,
                models.EmailAccount,
                models.GithubAccount,
                models.GitlabAccount,
                models.GnomeAccount,
                models.GoogleAccount,
                models.KdeAccount,
            )
        ],
    )

    @contextmanager
    def fake_get_db(_db_type="writer"):
        with Session(engine) as session:
            yield DBSession(session)
            session.commit()

    if existing_method is not None:
        with fake_get_db() as db:
            user = models.FlathubUser(default_account=existing_method)
            db.add(user)
            db.flush()
            if existing_method == "email":
                account = models.EmailAccount(
                    user=user.id,
                    email="reader@example.com",
                    verified_at=datetime.now(UTC),
                    last_used=datetime.now(UTC),
                )
            else:
                account = models.GithubAccount(
                    user=user.id,
                    github_userid=123,
                    login="reader",
                    email="reader@example.com",
                )
            db.add(account)

    class OAuthClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def fetch_token(self, *args, **kwargs):
            return {"token_type": "Bearer", "access_token": "test-token"}

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/auth/login/gitlab",
            "headers": [],
            "session": {
                "active-login-flow": "gitlab",
                "_oauth_state_gitlab": {
                    "state": "expected-state",
                    "created": datetime.now(UTC).timestamp(),
                },
            },
        }
    )
    monkeypatch.setattr(logins, "get_db", fake_get_db)
    monkeypatch.setattr(logins, "lock_email", lambda _db, email: locked.append(email))
    monkeypatch.setattr(
        logins.oauth_providers, "get_oauth_client", lambda _method: OAuthClient()
    )
    monkeypatch.setitem(
        sys.modules,
        "app.worker.emails",
        SimpleNamespace(send_email_new=SimpleNamespace(send=lambda *_args: None)),
    )
    monkeypatch.setattr(
        logins.audit_log, "enqueue_audit_log", lambda *_args, **_kwargs: None
    )

    response = logins.continue_oauth_flow(
        request,
        LoginInformation(LoginState.LOGGING_IN, None, "gitlab"),
        logins.OauthLoginResponseSuccess(code="test-code", state="expected-state"),
        "gitlab",
        lambda _tokens: logins.ProviderInfo(
            id="456", login="new-login", email=" Reader@Example.COM "
        ),
        models.GitlabAccount,
    )

    if existing_method is not None:
        assert response.status_code == 409
        assert response.body.decode() == (
            '{"state":"error","error":"oauth-account-email-already-used"}'
        )
        assert "user-id" not in request.session
    else:
        assert response == {"status": "ok", "result": "logged_in"}
        assert "user-id" in request.session
    assert locked == ["reader@example.com"]
    with fake_get_db() as db:
        assert db.scalar(select(func.count()).select_from(models.FlathubUser)) == 1
        assert db.scalar(select(func.count()).select_from(models.GitlabAccount)) == (
            0 if existing_method is not None else 1
        )
    engine.dispose()
