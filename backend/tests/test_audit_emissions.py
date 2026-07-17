"""Per-emission assertion tests for audit log instrumentation.

These tests capture the kwargs passed to ``audit_log.enqueue_audit_log`` and
assert the event_type, user_id, target_user_id, and details for each wired
handler. They also cover the MF2 no-op case (role grant/revoke that doesn't
change anything must NOT emit).
"""

import json
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


def _setup_ban_fakes(monkeypatch, *, banned: bool):
    from app import models, users

    role = SimpleNamespace(name="admin")
    provider_account = SimpleNamespace(github_userid=123, login="alice")

    class FakeBannableUser:
        id = 42
        display_name = "Alice"
        roles = [role]
        githubAccount = provider_account

        def __init__(self):
            self.banned = banned

        def set_banned(self, db, value):
            changed = self.banned != value
            self.banned = value
            return changed

        def to_result(self, db):
            return SimpleNamespace(banned=self.banned)

    fake_user = FakeBannableUser()
    monkeypatch.setattr(
        models.FlathubUser,
        "by_id",
        staticmethod(lambda db, uid: fake_user if uid == 42 else None),
    )

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield SimpleNamespace()

    monkeypatch.setattr(users, "get_db", fake_get_db)
    return fake_user, role, provider_account


@pytest.mark.parametrize(
    ("operation", "initial_banned", "expected_banned", "expected_event_name"),
    [
        ("ban_user", False, True, "USER_BANNED"),
        ("ban_user", True, True, None),
        ("unban_user", True, False, "USER_UNBANNED"),
        ("unban_user", False, False, None),
    ],
)
def test_user_ban_mutations_are_idempotent_and_audited(
    monkeypatch,
    recorded_calls,
    operation,
    initial_banned,
    expected_banned,
    expected_event_name,
):
    from app import models, users

    fake_user, role, provider_account = _setup_ban_fakes(
        monkeypatch, banned=initial_banned
    )

    result = getattr(users, operation)(
        42,
        http_request=FakeRequest(),
        login=SimpleNamespace(user=SimpleNamespace(id=1)),
    )

    assert result.banned is expected_banned
    assert fake_user.roles == [role]
    assert fake_user.githubAccount is provider_account
    if expected_event_name is None:
        assert recorded_calls == []
    else:
        assert len(recorded_calls) == 1
        call = recorded_calls[0]
        assert call["event_type"] == getattr(models.AuditEventType, expected_event_name)
        assert call["user_id"] == 1
        assert call["target_user_id"] == 42
        assert "details" not in call


def test_user_cannot_ban_self(recorded_calls):
    from fastapi import HTTPException

    from app import users

    with pytest.raises(HTTPException) as exc_info:
        users.ban_user(
            1,
            http_request=FakeRequest(),
            login=SimpleNamespace(user=SimpleNamespace(id=1)),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "cannot_ban_self"
    assert recorded_calls == []


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


def test_already_logged_in_emits_distinct_event(monkeypatch, recorded_calls):
    """A returning OAuth account whose user differs from the currently
    logged-in user is rejected. This is a session conflict, not a failed
    credential, so it must be recorded under a distinct event type that
    brute-force / failure-rate queries can filter out."""
    from datetime import datetime

    from app import logins, models
    from app.login_info import LoginInformation, LoginState

    fake_user = SimpleNamespace(id=777)

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield SimpleNamespace(commit=lambda: None)

    @contextmanager
    def fake_oauth_client(method):
        class _FakeClient:
            def fetch_token(self, token_url, code):
                return {"token_type": "bearer", "access_token": "tok"}

        yield _FakeClient()

    fake_account_model = SimpleNamespace(
        by_provider_id=lambda db, provider_id: SimpleNamespace(existing=True),
    )

    def token_to_data(tokens):
        return logins.ProviderInfo(id="provider-123", login="someone")

    monkeypatch.setattr(logins, "get_db", fake_get_db)
    monkeypatch.setattr(logins.oauth_providers, "get_oauth_client", fake_oauth_client)

    request = FakeRequest()
    state = "matching-state"
    request.session = {
        "_oauth_state_github": {
            "state": state,
            "created": datetime.now().timestamp(),
        },
    }

    login = LoginInformation(
        state=LoginState.LOGGED_IN,
        user=fake_user,
        method="github",
    )
    data = logins.OauthLoginResponseSuccess(code="code", state=state)

    ret = logins.continue_oauth_flow(
        request,
        login,
        data,
        "github",
        token_to_data,
        fake_account_model,
        None,
    )

    assert ret.status_code == 500
    assert len(recorded_calls) == 1
    assert recorded_calls[0]["event_type"] == (
        models.AuditEventType.LOGIN_REJECTED_ALREADY_LOGGED_IN
    )
    assert recorded_calls[0]["event_type"] != models.AuditEventType.LOGIN_FAILURE
    assert recorded_calls[0]["user_id"] == 777


def _run_returning_oauth(monkeypatch, linked_user):
    from datetime import datetime

    from app import logins
    from app.login_info import LoginInformation, LoginState

    account = SimpleNamespace(
        user=42,
        token="old-token",
        last_used=datetime(2020, 1, 1),
        login="old-login",
        avatar_url="old-avatar",
        display_name="Old Name",
        email="old@example.com",
    )
    added = []
    commits = []
    session = SimpleNamespace(get=lambda model, user_id: linked_user)
    fake_db = SimpleNamespace(
        session=session,
        add=added.append,
        commit=lambda: commits.append(True),
    )

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield fake_db

    @contextmanager
    def fake_oauth_client(method):
        class _FakeClient:
            def fetch_token(self, token_url, code):
                return {"token_type": "bearer", "access_token": "new-token"}

        yield _FakeClient()

    monkeypatch.setattr(logins, "get_db", fake_get_db)
    monkeypatch.setattr(logins.oauth_providers, "get_oauth_client", fake_oauth_client)

    email_calls = []
    monkeypatch.setitem(
        sys.modules,
        "app.worker.emails",
        SimpleNamespace(
            send_email_new=SimpleNamespace(send=email_calls.append),
        ),
    )
    callback_calls = []

    request = FakeRequest()
    state = "matching-state"
    request.session = {
        "_oauth_state_github": {
            "state": state,
            "created": datetime.now().timestamp(),
        },
    }
    login = LoginInformation(
        state=LoginState.LOGGING_IN,
        user=None,
        method="github",
    )
    provider_data = logins.ProviderInfo(
        id="provider-123",
        login="new-login",
        name="New Name",
        avatar_url="new-avatar",
        email="new@example.com",
    )

    response = logins.continue_oauth_flow(
        request,
        login,
        logins.OauthLoginResponseSuccess(code="code", state=state),
        "github",
        lambda tokens: provider_data,
        SimpleNamespace(by_provider_id=lambda db, provider_id: account),
        lambda tokens, connected_account: callback_calls.append(
            (tokens, connected_account)
        ),
    )
    return response, request, account, added, commits, callback_calls, email_calls


@pytest.mark.parametrize(
    ("linked_user", "expected_error", "expected_event"),
    [
        (
            SimpleNamespace(id=42, banned=True, deleted=False),
            "account_banned",
            "LOGIN_REJECTED_BANNED",
        ),
        (
            SimpleNamespace(id=42, banned=False, deleted=True),
            "account_unavailable",
            "LOGIN_FAILURE",
        ),
        (None, "account_unavailable", "LOGIN_FAILURE"),
    ],
)
def test_disabled_returning_oauth_user_is_rejected_before_side_effects(
    monkeypatch,
    recorded_calls,
    linked_user,
    expected_error,
    expected_event,
):
    from app import models

    response, request, account, added, commits, callback_calls, email_calls = (
        _run_returning_oauth(monkeypatch, linked_user)
    )

    assert response.status_code == 403
    assert json.loads(response.body) == {"state": "error", "error": expected_error}
    assert "user-id" not in request.session
    assert account.token == "old-token"
    assert account.login == "old-login"
    assert account.avatar_url == "old-avatar"
    assert account.display_name == "Old Name"
    assert account.email == "old@example.com"
    assert added == []
    assert commits == []
    assert callback_calls == []
    assert email_calls == []
    assert len(recorded_calls) == 1
    assert recorded_calls[0]["event_type"] == getattr(
        models.AuditEventType, expected_event
    )
    assert recorded_calls[0]["user_id"] == 42
    assert recorded_calls[0]["provider"] == "github"
    expected_details = (
        {"login": "new-login"}
        if expected_error == "account_banned"
        else {"error": "Account unavailable"}
    )
    assert recorded_calls[0]["details"] == expected_details


def test_active_returning_oauth_user_keeps_success_path(monkeypatch, recorded_calls):
    from app import models

    linked_user = SimpleNamespace(id=42, banned=False, deleted=False)
    response, request, account, added, commits, callback_calls, email_calls = (
        _run_returning_oauth(monkeypatch, linked_user)
    )

    assert response == {"status": "ok", "result": "logged_in"}
    assert request.session["user-id"] == 42
    assert account.token == "new-token"
    assert account.login == "new-login"
    assert added == [account]
    assert commits == [True]
    assert len(callback_calls) == 1
    assert len(email_calls) == 1
    assert len(recorded_calls) == 1
    assert recorded_calls[0]["event_type"] == models.AuditEventType.LOGIN_SUCCESS
    assert recorded_calls[0]["user_id"] == 42


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
