from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from gitlab.exceptions import GitlabGetError
from starlette.requests import Request

from app import logins, models
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
