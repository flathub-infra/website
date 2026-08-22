import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)
sys.modules["app.search"] = SimpleNamespace()

from app.routes import invites


class FakeSession:
    def merge(self, user):
        return user


class FakeDb:
    session = FakeSession()


@contextmanager
def fake_get_db(db_type="replica"):
    yield FakeDb()


def test_invite_developer_requires_direct_upload_permission(monkeypatch):
    app = SimpleNamespace()
    user = SimpleNamespace(permissions=lambda: set())
    login = SimpleNamespace(user=user)

    monkeypatch.setattr(invites, "_get_app", lambda _app_id: app)
    monkeypatch.setattr(invites, "get_db", fake_get_db)
    monkeypatch.setattr(
        invites.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda _db, _user, _app: SimpleNamespace(is_primary=True),
    )

    with pytest.raises(HTTPException) as exc_info:
        invites.invite_developer(
            invite_code="invite-code",
            http_request=None,
            login=login,
            app_id="org.example.App",
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == invites.ErrorDetail.NOT_UPLOADER
