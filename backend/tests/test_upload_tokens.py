import base64
import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

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

    def merge(self, user):
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
    display_name = "Test User"

    def __init__(self, permissions, dev_flatpaks):
        self._permissions = permissions
        self._dev_flatpaks = dev_flatpaks

    def permissions(self):
        return self._permissions

    def dev_flatpaks(self, db):
        return self._dev_flatpaks


class FakeLogin:
    state = FakeState()

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


def test_create_upload_token_requires_direct_upload_permission(
    monkeypatch, upload_token_config, upload_token_request
):
    user = FakeUser(permissions=set(), dev_flatpaks={"org.example.App"})
    set_fake_db(monkeypatch, user)

    with pytest.raises(HTTPException) as exc_info:
        upload_tokens.create_upload_token(
            "org.example.App", upload_token_request, login=FakeLogin(user)
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == upload_tokens.ErrorDetail.NOT_UPLOADER


def test_create_upload_token_still_requires_app_developer(
    monkeypatch, upload_token_config, upload_token_request
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks=set())
    set_fake_db(monkeypatch, user)

    with pytest.raises(HTTPException) as exc_info:
        upload_tokens.create_upload_token(
            "org.example.App", upload_token_request, login=FakeLogin(user)
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
        "org.example.App", upload_token_request, login=FakeLogin(user)
    )

    assert sent[0]["inform_admins"] is True


def _decode(token: str) -> dict:
    return jwt.decode(token, base64.b64decode(SECRET), algorithms=["HS256"])


def test_create_upload_token_non_runtime_uses_app_id_prefix(
    monkeypatch, upload_token_config
):
    user = FakeUser(permissions={"direct-upload"}, dev_flatpaks={"org.example.App"})
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
        "org.example.App", request, login=FakeLogin(user)
    )

    assert _decode(result.token)["prefixes"] == ["org.example.App"]


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
        "org.gnome.Platform", request, login=FakeLogin(user)
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
            "org.gnome.Platform", request, login=FakeLogin(user)
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == upload_tokens.ErrorDetail.FORBIDDEN_REPO
