import os
import sys
from unittest.mock import MagicMock, patch

import pytest
from starlette.requests import Request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.login_info import LoginState, login_state, set_authenticated_session
from app.models import FlathubUser, PasskeyCredential


def test_login_state_handles_missing_legacy_intermediate_key():
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "session": {"active-login-flow": "github"},
        }
    )

    info = login_state(request)

    assert info.state == LoginState.LOGGING_IN
    assert info.method == "github"


def test_login_state_clears_banned_user_session():
    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "session": {"user-id": 42},
        }
    )
    user = FlathubUser(id=42, deleted=False, banned=True)
    db = MagicMock()
    db.session.get.return_value = user
    db_context = MagicMock()
    db_context.__enter__.return_value = db

    with patch("app.login_info.get_db", return_value=db_context):
        info = login_state(request)

    assert info.state == LoginState.LOGGED_OUT
    assert info.user is None
    assert "user-id" not in request.session


def _session_request(session):
    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
            "session": session,
        }
    )


def _replica_with_user(user):
    db = MagicMock()
    db.session.get.return_value = user
    db_context = MagicMock()
    db_context.__enter__.return_value = db
    return db_context


def test_login_state_skips_email_checks_for_oauth_session():
    request = _session_request({"user-id": 42, "auth-method": "github"})
    user = FlathubUser(id=42, deleted=False, banned=False)

    with (
        patch("app.login_info.get_db", return_value=_replica_with_user(user)),
        patch("app.models.EmailAccount.by_user") as by_user,
        patch("app.email_login.email_login_allowed") as allowed,
    ):
        info = login_state(request)

    assert info.state == LoginState.LOGGED_IN
    by_user.assert_not_called()
    allowed.assert_not_called()


def test_login_state_tags_legacy_oauth_session():
    request = _session_request({"user-id": 42})
    user = FlathubUser(id=42, deleted=False, banned=False)

    with (
        patch("app.login_info.get_db", return_value=_replica_with_user(user)),
        patch("app.models.EmailAccount.by_user", return_value=None),
    ):
        info = login_state(request)

    assert info.state == LoginState.LOGGED_IN
    assert request.session["auth-method"] == "oauth"


def test_login_state_revokes_disabled_email_session():
    request = _session_request({"user-id": 42, "auth-method": "email"})
    user = FlathubUser(id=42, deleted=False, banned=False)

    with (
        patch("app.login_info.get_db", return_value=_replica_with_user(user)),
        patch(
            "app.models.EmailAccount.by_user",
            return_value=MagicMock(disabled_at=object()),
        ),
    ):
        info = login_state(request)

    assert info.state == LoginState.LOGGED_OUT
    assert request.session == {}


def _writer_with(user, credential):
    db = MagicMock()
    db.session.get.side_effect = lambda model, _id: (
        user if model is FlathubUser else credential
    )
    db_context = MagicMock()
    db_context.__enter__.return_value = db
    return db_context


@pytest.mark.parametrize(
    ("passkey_id", "owner", "banned", "logged_in"),
    [
        (7, 42, False, True),
        (7, 43, False, False),
        (None, 42, False, False),
        (True, 42, False, False),
        (7, 42, True, False),
        (7, None, False, False),
    ],
)
def test_login_state_binds_passkey_session_to_credential(
    passkey_id, owner, banned, logged_in
):
    session = {"user-id": 42, "auth-method": "passkey", "auth-time": 1}
    if passkey_id is not None:
        session["passkey-id"] = passkey_id
    request = _session_request(session)
    user = FlathubUser(id=42, deleted=False, banned=banned)
    credential = PasskeyCredential(id=7, user=owner) if owner is not None else None

    with patch(
        "app.login_info.get_db", return_value=_writer_with(user, credential)
    ) as get_db:
        info = login_state(request)

    assert (info.state == LoginState.LOGGED_IN) is logged_in
    assert (request.session == {}) is not logged_in
    if logged_in:
        get_db.assert_called_once_with("writer")


def test_set_authenticated_session_replaces_passkey_binding():
    request = _session_request(
        {"passkey-id": 7, "passkey-flow": "nonce", "oidc_authorize_params": {}}
    )

    set_authenticated_session(request, 42, "passkey", 9)
    assert request.session["passkey-id"] == 9
    assert "passkey-flow" not in request.session

    with patch("app.login_info.time.time", return_value=1000.5):
        set_authenticated_session(request, 42, "email")
    assert request.session == {
        "user-id": 42,
        "auth-method": "email",
        "auth-time": 1000,
        "oidc_authorize_params": {},
    }
