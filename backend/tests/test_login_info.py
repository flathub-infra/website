import os
import sys

from starlette.requests import Request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.login_info import LoginState, login_state


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
