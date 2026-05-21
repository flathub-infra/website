import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.worker"] = SimpleNamespace(
    send_email_new=SimpleNamespace(send=lambda payload: None)
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
        upload_tokens.config.settings, "flat_manager_build_secret", "dGVzdC1zZWNyZXQ="
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
