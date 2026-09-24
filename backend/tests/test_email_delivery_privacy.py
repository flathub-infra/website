import json
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT_DIR))

from app import emails


def test_email_login_category_is_registered():
    assert emails.EmailCategory.EMAIL_LOGIN.value == "email_login"


def test_delivery_error_excludes_payload_and_response_body(monkeypatch):
    secret = "token-secret"
    response_body = f"upstream echoed {secret}"
    payload = {
        "messageInfo": {
            "category": emails.EmailCategory.EMAIL_LOGIN.value,
            "signInUrl": f"https://example.test/confirm#token={secret}",
        }
    }
    monkeypatch.setattr(
        emails.http_client,
        "post",
        lambda *args, **kwargs: SimpleNamespace(status_code=503, text=response_body),
    )

    try:
        emails.send_one_email_new(payload, "reader@example.test")
    except RuntimeError as error:
        assert "HTTP 503" in str(error)
        assert "Failed to send email" in str(error)
        assert secret not in repr(error)
        assert response_body not in repr(error)
        assert "reader@example.test" not in repr(error)
    else:
        raise AssertionError("send_one_email_new did not report the failed delivery")


def test_sentry_filter_removes_email_auth_request_data():
    token = "bearer-secret"
    event = {
        "request": {
            "url": "https://api.example.test/auth/email/confirm",
            "data": {"token": token},
        },
        "extra": {"input": token},
        "breadcrumbs": {"values": [{"data": {"token": token}}]},
        "exception": {
            "values": [
                {
                    "value": f"invalid token: {token}",
                    "stacktrace": {"frames": [{"vars": {"token": token}}]},
                }
            ]
        },
    }

    filtered = emails.sentry_before_send(event, {})

    serialized = json.dumps(filtered)
    assert token not in serialized
    assert "data" not in filtered["request"]
    assert filtered["request"] == {"url": "/auth/email"}
    assert "extra" not in filtered
    assert "breadcrumbs" not in filtered


def test_sentry_filter_removes_email_login_worker_args():
    token = "mail-link-secret"
    event = {
        "extra": {
            "actor_name": "send_email_login_link",
            "args": ["reader@example.test", token],
        },
        "contexts": {"dramatiq": {"args": ["reader@example.test", token]}},
        "breadcrumbs": {
            "values": [
                {
                    "data": {
                        "messageInfo": {
                            "category": "email_login",
                            "signInUrl": f"https://example.test/#token={token}",
                        }
                    }
                }
            ]
        },
        "exception": {"values": [{"value": f"failed with {token}"}]},
    }

    filtered = emails.sentry_before_send(event, {})

    serialized = json.dumps(filtered)
    assert token not in serialized
    assert "reader@example.test" not in serialized
    assert "extra" not in filtered
    assert "contexts" not in filtered
    assert "breadcrumbs" not in filtered


def test_sentry_breadcrumb_filter_drops_email_auth_and_mail_payloads():
    auth_breadcrumb = {
        "category": "http",
        "data": {
            "url": "https://api.example.test/auth/email/request",
            "body": "email",
        },
    }
    mail_breadcrumb = {
        "data": {"messageInfo": {"category": "email_login", "signInUrl": "secret"}}
    }
    serialized_mail_breadcrumb = {
        "data": {
            "body": json.dumps(
                {
                    "messageInfo": {
                        "category": "email_login",
                        "signInUrl": "secret",
                    }
                }
            )
        }
    }
    direct_link_breadcrumb = {
        "data": {
            "url": "https://example.test/en/login/email/confirm#token=secret",
        }
    }
    unrelated_breadcrumb = {
        "category": "http",
        "data": {"url": "https://example.test/"},
    }

    assert emails.sentry_before_breadcrumb(auth_breadcrumb, {}) is None
    assert emails.sentry_before_breadcrumb(mail_breadcrumb, {}) is None
    assert emails.sentry_before_breadcrumb(serialized_mail_breadcrumb, {}) is None
    assert emails.sentry_before_breadcrumb(direct_link_breadcrumb, {}) is None
    assert (
        emails.sentry_before_breadcrumb(unrelated_breadcrumb, {})
        is unrelated_breadcrumb
    )
