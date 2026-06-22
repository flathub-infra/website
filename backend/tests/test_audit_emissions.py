"""Per-emission assertion tests for audit log instrumentation.

These tests capture the kwargs passed to ``audit_log.enqueue_audit_log`` and
assert the event_type, user_id, target_user_id, and details for each wired
handler. They also cover the MF2 no-op case (role grant/revoke that doesn't
change anything must NOT emit).
"""

import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

from app import audit_log  # noqa: E402
from app.routes import upload_tokens  # noqa: E402


@pytest.fixture
def recorded_calls(monkeypatch):
    """Capture every enqueue_audit_log call as a kwargs dict."""
    calls: list[dict] = []
    monkeypatch.setattr(
        audit_log,
        "enqueue_audit_log",
        lambda request, user_id, event_type, **k: calls.append(
            {"request": request, "user_id": user_id, "event_type": event_type, **k}
        ),
    )
    return calls


class FakeRequest:
    class _Client:
        host = "127.0.0.1"

    client = _Client()

    def __init__(self):
        self.headers = {"user-agent": "test-ua"}


def _setup_users_fakes(monkeypatch, *, changed: bool):
    """Wire fakes for the role grant/revoke path in app.users.

    ``changed`` controls whether the model reports a role change happened
    (True → emit; False → no-op, no emit). This directly stubs
    FlathubUser.add_role/remove_role so the handler's conditional-emit logic
    is exercised without the DB layer.
    """
    from app import models, users

    fake_user = SimpleNamespace(
        id=42,
        display_name="Alice",
        to_result=lambda db: SimpleNamespace(),
        add_role=lambda db, role: changed,
        remove_role=lambda db, role: changed,
    )

    monkeypatch.setattr(
        models.FlathubUser,
        "by_id",
        staticmethod(lambda db, uid: fake_user if uid == 42 else None),
    )

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield SimpleNamespace()

    monkeypatch.setattr(users, "get_db", fake_get_db)
    return fake_user


def test_role_granted_emits_audit(monkeypatch, recorded_calls):
    from app import models, users

    _setup_users_fakes(monkeypatch, changed=True)

    users.add_user_role(
        42,
        models.RoleName("moderator"),
        http_request=FakeRequest(),
        login=SimpleNamespace(user=SimpleNamespace(id=1)),
    )

    assert len(recorded_calls) == 1
    call = recorded_calls[0]
    assert call["event_type"] == models.AuditEventType.ROLE_GRANTED
    assert call["user_id"] == 1
    assert call["target_user_id"] == 42
    assert call["details"] == {"role": "moderator"}


def test_role_grant_noop_does_not_emit(monkeypatch, recorded_calls):
    """MF2: granting a role the user already has is a no-op → no audit record."""
    from app import models, users

    _setup_users_fakes(monkeypatch, changed=False)

    users.add_user_role(
        42,
        models.RoleName("moderator"),
        http_request=FakeRequest(),
        login=SimpleNamespace(user=SimpleNamespace(id=1)),
    )

    assert recorded_calls == [], "no audit event should be emitted for a no-op grant"


def test_role_revoked_emits_audit(monkeypatch, recorded_calls):
    from app import models, users

    _setup_users_fakes(monkeypatch, changed=True)

    users.delete_user_role(
        42,
        models.RoleName("moderator"),
        http_request=FakeRequest(),
        login=SimpleNamespace(user=SimpleNamespace(id=1)),
    )

    assert len(recorded_calls) == 1
    call = recorded_calls[0]
    assert call["event_type"] == models.AuditEventType.ROLE_REVOKED
    assert call["target_user_id"] == 42
    assert call["details"] == {"role": "moderator"}


def test_role_revoke_noop_does_not_emit(monkeypatch, recorded_calls):
    """MF2: revoking a role the user doesn't have is a no-op → no audit record."""
    from app import models, users

    _setup_users_fakes(monkeypatch, changed=False)

    users.delete_user_role(
        42,
        models.RoleName("moderator"),
        http_request=FakeRequest(),
        login=SimpleNamespace(user=SimpleNamespace(id=1)),
    )

    assert recorded_calls == [], "no audit event should be emitted for a no-op revoke"


def test_account_deleted_emits_audit_after_delete_commit(monkeypatch, recorded_calls):
    from app import logins, models

    class ExpiringUser:
        expired = False

        @property
        def id(self):
            if self.expired:
                raise AssertionError("user id was read after commit")
            return 123

    def fake_delete_user(db, user, token):
        user.expired = True
        return models.DeleteUserResult(status="ok", message="deleted")

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield SimpleNamespace()

    user = ExpiringUser()
    request = FakeRequest()
    request.session = {}

    monkeypatch.setattr(logins, "get_db", fake_get_db)
    monkeypatch.setattr(
        models.FlathubUser, "delete_user", staticmethod(fake_delete_user)
    )

    ret = logins.do_deleteuser(
        request,
        logins.UserDeleteRequest(token="tok"),
        FakeLogin(user),
    )

    assert ret.status == "ok"
    assert recorded_calls[0]["event_type"] == models.AuditEventType.ACCOUNT_DELETED
    assert recorded_calls[0]["user_id"] == 123


SECRET = "dGVzdC1zZWNyZXQ="


class FakeSession:
    def __init__(self, user):
        self.user = user
        self.added = None

    def merge(self, user):
        return self.user

    def add(self, token):
        self.added = token
        token.id = 99
        token.revoked = False

    def commit(self):
        if self.added is not None and hasattr(self.added, "expired"):
            self.added.expired = True
        pass


class FakeDb:
    def __init__(self, user):
        self.session = FakeSession(user)


class FakeUser:
    id = 1
    display_name = "Test User"

    def __init__(self, permissions, dev_flatpaks):
        self._permissions = permissions
        self._dev_flatpaks = dev_flatpaks

    def permissions(self):
        return self._permissions

    def dev_flatpaks(self, db):
        return self._dev_flatpaks


class FakeLogin:
    class _State:
        def logged_in(self):
            return True

    state = _State()

    def __init__(self, user):
        self.user = user


@pytest.fixture
def upload_token_config(monkeypatch):
    monkeypatch.setattr(
        upload_tokens.config.settings,
        "flat_manager_api",
        "https://flat-manager.example",
    )
    monkeypatch.setattr(
        upload_tokens.config.settings, "flat_manager_build_secret", SECRET
    )
    monkeypatch.setattr(
        upload_tokens.config.settings, "flat_manager_build_token_prefix", None
    )


def _set_fake_db(monkeypatch, user):
    @contextmanager
    def fake_get_db(db_type="replica"):
        yield FakeDb(user)

    monkeypatch.setattr(upload_tokens, "get_db", fake_get_db)
    monkeypatch.setattr(
        upload_tokens.worker.send_email_new, "send", lambda payload: None
    )


def test_upload_token_issued_emits_audit(
    monkeypatch, upload_token_config, recorded_calls
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks={"org.example.App"})
    _set_fake_db(monkeypatch, user)
    monkeypatch.setattr(
        upload_tokens.models.DirectUploadApp, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        upload_tokens.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(upload_tokens, "get_json_key", lambda key: None)

    request = upload_tokens.UploadTokenRequest(
        comment="test token", scopes=["build"], repos=["beta"]
    )
    upload_tokens.create_upload_token(
        "org.example.App", request, http_request=FakeRequest(), login=FakeLogin(user)
    )

    assert len(recorded_calls) == 1
    call = recorded_calls[0]
    assert call["event_type"] == upload_tokens.models.AuditEventType.UPLOAD_TOKEN_ISSUED
    assert call["user_id"] == 1
    assert call["details"]["app_id"] == "org.example.App"
    assert call["details"]["token_id"] == 99
    assert call["details"]["scopes"] == ["build"]
    assert call["details"]["repos"] == ["beta"]


def test_upload_token_revoked_emits_audit(
    monkeypatch, upload_token_config, recorded_calls
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks={"org.example.App"})
    _set_fake_db(monkeypatch, user)

    class ExpiringToken:
        id = 5
        revoked = False
        comment = "t"
        scopes = "build"
        repos = "beta"
        expired = False

        @property
        def app_id(self):
            if self.expired:
                raise AssertionError("token app_id was read after commit")
            return "org.example.App"

    fake_token = ExpiringToken()
    monkeypatch.setattr(
        upload_tokens.models.UploadToken,
        "by_id",
        staticmethod(lambda db, tid: fake_token),
    )

    class FakeResponse:
        is_success = True

    monkeypatch.setattr(
        upload_tokens.http_client, "post", lambda *a, **k: FakeResponse()
    )
    monkeypatch.setattr(
        upload_tokens.utils, "create_flat_manager_token", lambda *a, **k: "jwt"
    )

    upload_tokens.revoke_upload_token(
        5, http_request=FakeRequest(), login=FakeLogin(user)
    )

    assert len(recorded_calls) == 1
    call = recorded_calls[0]
    assert (
        call["event_type"] == upload_tokens.models.AuditEventType.UPLOAD_TOKEN_REVOKED
    )
    assert call["user_id"] == 1
    assert call["details"]["app_id"] == "org.example.App"
    assert call["details"]["token_id"] == 5
