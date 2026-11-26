import base64
import os
import sys
import time
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock

import jwt
import pytest
from fastapi import HTTPException

SECRET = "dGVzdC1zZWNyZXQ="

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.worker"] = SimpleNamespace(
    send_email_new=SimpleNamespace(send=lambda payload: None),
    republish_app=SimpleNamespace(send=lambda *a, **k: None),
)

from app.routes import upload_tokens


class FakeState:
    def logged_in(self):
        return True


class FakeSession:
    def __init__(self, user):
        self.user = user

    def get(self, model, user_id):
        return self.user

    def add(self, token):
        token.id = 1
        token.revoked = False

    def commit(self):
        pass


class FakeDb:
    def __init__(self, user):
        self.session = FakeSession(user)


class FakeUser:
    id = 1
    login_disabled = False
    display_name = "Test User"

    def __init__(self, permissions, dev_flatpaks, is_admin=False):
        self._permissions = permissions | ({"manage-apps"} if is_admin else set())
        self._dev_flatpaks = dev_flatpaks

    def permissions(self):
        return self._permissions

    def dev_flatpaks(self, db):
        return self._dev_flatpaks


class FakeLogin:
    state = FakeState()

    def __init__(self, user):
        self.user = user


class FakeRequest:
    """Minimal stand-in for fastapi.Request for audit log IP/UA extraction."""

    class _Client:
        host = "127.0.0.1"

    client = _Client()

    def __init__(self, user_agent="test-ua"):
        self.headers = {"user-agent": user_agent}
        self.session = {"auth-time": int(time.time())}


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


@pytest.fixture
def upload_token_request():
    return upload_tokens.UploadTokenRequest(
        comment="test token", scopes=["build"], repos=["beta"]
    )


def set_fake_db(monkeypatch, user):
    @contextmanager
    def fake_get_db(db_type="replica"):
        yield FakeDb(user)

    monkeypatch.setattr(upload_tokens, "get_db", fake_get_db)
    monkeypatch.setattr(
        upload_tokens.worker.send_email_new, "send", lambda payload: None
    )
    # Audit log emission must not escape into a real broker during unit tests.
    monkeypatch.setattr(
        upload_tokens.audit_log, "enqueue_audit_log", lambda *a, **k: None
    )


def test_create_upload_token_requires_direct_upload_permission(
    monkeypatch, upload_token_config, upload_token_request
):
    user = FakeUser(permissions=set(), dev_flatpaks={"org.example.App"})
    set_fake_db(monkeypatch, user)

    with pytest.raises(HTTPException) as exc_info:
        upload_tokens.create_upload_token(
            "org.example.App",
            upload_token_request,
            login=FakeLogin(user),
            http_request=FakeRequest(),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == upload_tokens.ErrorDetail.NOT_UPLOADER


@pytest.mark.parametrize("action", ["list", "create", "revoke"])
@pytest.mark.parametrize("disabled", [False, True])
def test_token_access_checks_current_writer_account(
    monkeypatch, upload_token_config, upload_token_request, action, disabled
):
    stale = FakeUser(set(), set(), is_admin=True)
    current = FakeUser({"direct-upload"}, set(), is_admin=disabled)
    current.login_disabled = disabled
    writer = FakeDb(current)
    writer.session.add = MagicMock()
    monkeypatch.setattr(
        upload_tokens.models.UploadToken,
        "by_id",
        lambda *_: SimpleNamespace(app_id="org.example.App"),
    )
    contact_manager = MagicMock()
    monkeypatch.setattr(upload_tokens.http_client, "post", contact_manager)

    @contextmanager
    def get_db(role):
        yield writer if role == "writer" else FakeDb(stale)

    monkeypatch.setattr(upload_tokens, "get_db", get_db)
    login = FakeLogin(stale)
    with pytest.raises(HTTPException) as denied:
        if action == "list":
            upload_tokens.get_upload_tokens("org.example.App", login=login)
        elif action == "create":
            upload_tokens.create_upload_token(
                "org.example.App", upload_token_request, FakeRequest(), login
            )
        else:
            upload_tokens.revoke_upload_token(1, FakeRequest(), login)
    assert denied.value.status_code == (401 if disabled else 403)
    writer.session.add.assert_not_called()
    contact_manager.assert_not_called()


def test_create_upload_token_still_requires_app_developer(
    monkeypatch, upload_token_config, upload_token_request
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks=set())
    set_fake_db(monkeypatch, user)

    with pytest.raises(HTTPException) as exc_info:
        upload_tokens.create_upload_token(
            "org.example.App",
            upload_token_request,
            login=FakeLogin(user),
            http_request=FakeRequest(),
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == upload_tokens.ErrorDetail.NOT_APP_DEVELOPER


def test_create_upload_token_informs_admins(
    monkeypatch, upload_token_config, upload_token_request
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks={"org.example.App"})
    sent = []
    set_fake_db(monkeypatch, user)
    monkeypatch.setattr(
        upload_tokens.models.DirectUploadApp, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        upload_tokens.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(upload_tokens, "get_json_key", lambda key: None)
    monkeypatch.setattr(upload_tokens.worker.send_email_new, "send", sent.append)

    upload_tokens.create_upload_token(
        "org.example.App",
        upload_token_request,
        login=FakeLogin(user),
        http_request=FakeRequest(),
    )

    assert sent[0]["inform_admins"] is True


def _decode(token: str) -> dict:
    return jwt.decode(token, base64.b64decode(SECRET), algorithms=["HS256"])


@pytest.mark.parametrize("is_admin", [False, True])
def test_create_upload_token_non_runtime_uses_app_id_prefix(
    monkeypatch, upload_token_config, is_admin
):
    user = (
        FakeUser(set(), set(), is_admin=True)
        if is_admin
        else FakeUser({"direct-upload"}, {"org.example.App"})
    )
    monkeypatch.setattr(
        upload_tokens.models.App, "by_appid", lambda db, app_id: object()
    )
    set_fake_db(monkeypatch, user)
    monkeypatch.setattr(
        upload_tokens.models.DirectUploadApp, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        upload_tokens.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(upload_tokens, "get_json_key", lambda key: None)

    request = upload_tokens.UploadTokenRequest(
        comment="app", scopes=["build"], repos=["beta"]
    )
    result = upload_tokens.create_upload_token(
        "org.example.App", request, login=FakeLogin(user), http_request=FakeRequest()
    )

    assert _decode(result.token)["prefixes"] == ["org.example.App"]


@pytest.mark.parametrize(
    "permissions,is_admin,expected",
    [
        (set(), True, 200),
        ({"modify-users", "direct-upload"}, False, 403),
        ({"direct-upload"}, False, 403),
    ],
)
def test_list_upload_tokens_for_unassigned_user(
    monkeypatch, permissions, is_admin, expected
):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.login_info import login_state

    app_id = "org.duckstation.DuckStation"
    user = FakeUser(permissions, set(), is_admin)
    set_fake_db(monkeypatch, user)
    monkeypatch.setattr(FakeSession, "query", MagicMock(), raising=False)
    monkeypatch.setattr(
        upload_tokens.models.App,
        "by_appid",
        lambda db, id: object() if id == app_id else None,
    )
    monkeypatch.setattr(
        upload_tokens.models.DirectUploadApp, "by_app_id", lambda *_: None
    )
    monkeypatch.setattr(upload_tokens.models.RuntimeScope, "by_app_id", lambda *_: None)
    monkeypatch.setattr(
        upload_tokens.models.GithubRepository,
        "exists_by_name",
        lambda db, name: name == "org.example.Unpublished",
    )
    app = FastAPI()
    upload_tokens.register_to_app(app)
    app.dependency_overrides[login_state] = lambda: FakeLogin(user)
    with TestClient(app) as client:
        response = client.get(f"/upload-tokens/{app_id}")
        assert response.status_code == expected
        if expected == 200:
            assert response.json() == {
                "tokens": [],
                "is_direct_upload_app": False,
                "allowed_repos": ["beta"],
            }
        else:
            assert response.json()["detail"] == "not_app_developer"
        assert client.get("/upload-tokens/org.example.Missing").status_code == 403
        assert (
            client.get("/upload-tokens/org.example.Unpublished").status_code == expected
        )


def test_create_upload_token_runtime_uses_scope_prefixes(
    monkeypatch, upload_token_config
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks={"org.gnome.Platform"})
    set_fake_db(monkeypatch, user)
    monkeypatch.setattr(
        upload_tokens.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: SimpleNamespace(archived=False),
    )
    monkeypatch.setattr(
        upload_tokens.models.RuntimeScope,
        "by_app_id",
        lambda db, app_id: SimpleNamespace(
            prefixes="org.gnome.Platform org.gnome.Sdk",
            extra_ids="org.gnome.Sdk.Docs",
            repos="stable beta",
        ),
    )
    monkeypatch.setattr(upload_tokens, "get_json_key", lambda key: None)

    request = upload_tokens.UploadTokenRequest(
        comment="rt", scopes=["build"], repos=["stable"]
    )
    result = upload_tokens.create_upload_token(
        "org.gnome.Platform", request, login=FakeLogin(user), http_request=FakeRequest()
    )

    assert set(_decode(result.token)["prefixes"]) == {
        "org.gnome.Platform",
        "org.gnome.Sdk",
        "org.gnome.Sdk.Docs",
    }


def test_create_upload_token_runtime_rejects_repo_outside_scope(
    monkeypatch, upload_token_config
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks={"org.gnome.Platform"})
    set_fake_db(monkeypatch, user)
    monkeypatch.setattr(
        upload_tokens.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: SimpleNamespace(archived=False),
    )
    monkeypatch.setattr(
        upload_tokens.models.RuntimeScope,
        "by_app_id",
        lambda db, app_id: SimpleNamespace(
            prefixes="org.gnome.Platform", extra_ids="", repos="beta"
        ),
    )
    monkeypatch.setattr(upload_tokens, "get_json_key", lambda key: None)

    request = upload_tokens.UploadTokenRequest(
        comment="rt", scopes=["build"], repos=["stable"]
    )

    with pytest.raises(HTTPException) as exc_info:
        upload_tokens.create_upload_token(
            "org.gnome.Platform",
            request,
            login=FakeLogin(user),
            http_request=FakeRequest(),
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == upload_tokens.ErrorDetail.FORBIDDEN_REPO


def test_create_upload_token_requires_recent_authentication(
    monkeypatch, upload_token_config, upload_token_request
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks={"org.example.App"})
    writer = FakeDb(user)
    writer.session.add = MagicMock()

    @contextmanager
    def get_db(role):
        yield writer

    monkeypatch.setattr(upload_tokens, "get_db", get_db)
    request = FakeRequest()
    request.session = {"auth-time": int(time.time()) - 301}

    with pytest.raises(HTTPException) as exc_info:
        upload_tokens.create_upload_token(
            "org.example.App", upload_token_request, request, FakeLogin(user)
        )

    assert exc_info.value.detail == "reauthentication_required"
    writer.session.add.assert_not_called()


@pytest.mark.parametrize("success", [True, False])
def test_revoke_user_upload_tokens(monkeypatch, upload_token_config, success):
    tokens = [
        SimpleNamespace(id=3, revoked=False),
        SimpleNamespace(id=7, revoked=False),
    ]
    db = MagicMock()
    db.session.query.return_value.filter.return_value.filter.return_value.all.return_value = tokens
    post = MagicMock(return_value=SimpleNamespace(is_success=success))

    @contextmanager
    def get_db(role):
        assert role == "writer"
        yield db

    monkeypatch.setattr(upload_tokens, "get_db", get_db)
    monkeypatch.setattr(upload_tokens.http_client, "post", post)

    if success:
        upload_tokens.revoke_user_upload_tokens(1, "org.example.App")
    else:
        with pytest.raises(HTTPException):
            upload_tokens.revoke_user_upload_tokens(1, "org.example.App")

    assert post.call_args.kwargs["json"] == {"token_ids": ["backend_3", "backend_7"]}
    assert [token.revoked for token in tokens] == [success, success]
    assert db.session.commit.called is success
