import os
import sys
from unittest.mock import MagicMock, patch

from starlette.requests import Request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.login_info import LoginState, login_state
from app.models import FlathubUser


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
