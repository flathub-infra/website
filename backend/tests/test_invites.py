import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import Mock

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


def test_demoted_admin_cannot_read_team_or_pending_invites(monkeypatch):
    login = SimpleNamespace(
        user=SimpleNamespace(
            id=1, permissions=lambda: {"manage-apps"}, login_disabled=False
        )
    )
    current = SimpleNamespace(id=1, permissions=lambda: set(), login_disabled=False)
    app = SimpleNamespace()

    @contextmanager
    def get_db(role):
        db = Mock()
        db.session.get.return_value = current if role == "writer" else login.user
        yield db

    monkeypatch.setattr(invites, "get_db", get_db)
    monkeypatch.setattr(invites.DirectUploadApp, "by_app_id", lambda *_: app)
    for model in (invites.DirectUploadAppDeveloper, invites.DirectUploadAppInvite):
        monkeypatch.setattr(model, "by_developer_and_app", lambda *_: None)
        monkeypatch.setattr(
            model, "by_app", lambda *_: pytest.fail("unauthorized roster read")
        )
    with pytest.raises(HTTPException) as status:
        invites.get_invite_status(login, "org.example.App")
    assert status.value.status_code == 404
    with pytest.raises(HTTPException) as team:
        invites.get_app_developers(login, "org.example.App")
    assert team.value.status_code == 403


def test_unassigned_admin_can_manage_invites_without_becoming_a_developer(monkeypatch):
    user = SimpleNamespace(
        id=1, login_disabled=False, permissions=lambda: {"manage-apps"}
    )
    monkeypatch.setattr(FakeSession, "get", lambda *_: user, raising=False)
    login = SimpleNamespace(user=user)
    app = SimpleNamespace()
    monkeypatch.setattr(invites, "get_db", fake_get_db)
    monkeypatch.setattr(invites.DirectUploadApp, "by_app_id", lambda *_: app)
    for model in (invites.DirectUploadAppDeveloper, invites.DirectUploadAppInvite):
        monkeypatch.setattr(model, "by_developer_and_app", lambda *_: None)
        monkeypatch.setattr(model, "by_app", lambda *_: [])

    status = invites.get_invite_status(login, "org.example.App")
    assert status.is_direct_upload_app and not status.is_pending
    assert invites.get_app_developers(login, "org.example.App").developers == []
    assert (
        invites._check_permission(
            FakeDb(), app, user, require_primary=True, require_uploader=True
        )
        is user
    )
    with pytest.raises(HTTPException) as denied:
        invites.leave_team(None, login, "org.example.App")
    assert denied.value.detail == "not_app_developer"


@pytest.mark.parametrize("is_admin", [True, False])
def test_check_permission_returns_authorized_user(monkeypatch, is_admin):
    membership = SimpleNamespace(is_primary=False)
    monkeypatch.setattr(
        invites.DirectUploadAppDeveloper, "by_developer_and_app", lambda *_: membership
    )
    user = SimpleNamespace(
        id=1,
        permissions=lambda: {"manage-apps"} if is_admin else set(),
        login_disabled=False,
    )
    db = Mock()
    db.session.get.return_value = user
    assert invites._check_permission(db, SimpleNamespace(), user) is user


@pytest.mark.parametrize("current", [None, SimpleNamespace(login_disabled=True)])
def test_disabled_or_deleted_admin_cannot_authorize_an_invite(current):
    db = Mock()
    db.session.get.return_value = current
    stale_user = SimpleNamespace(
        id=1, permissions=lambda: {"manage-apps"}, login_disabled=False
    )
    with pytest.raises(HTTPException) as denied:
        invites._check_permission(db, SimpleNamespace(), stale_user)
    assert denied.value.status_code == 401
    db.session.merge.assert_not_called()


def test_invite_developer_requires_direct_upload_permission(monkeypatch):
    app = SimpleNamespace()
    user = SimpleNamespace(id=1, login_disabled=False, permissions=lambda: set())
    monkeypatch.setattr(FakeSession, "get", lambda *_: user, raising=False)
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


@pytest.mark.parametrize("is_admin", [True, False])
@pytest.mark.parametrize("has_invite", [True, False])
def test_personal_invite_status_without_team_membership(
    monkeypatch, is_admin, has_invite
):
    user = SimpleNamespace(
        id=1,
        login_disabled=False,
        permissions=lambda: {"manage-apps"} if is_admin else {"modify-users"},
    )
    monkeypatch.setattr(FakeSession, "get", lambda *_: user, raising=False)
    monkeypatch.setattr(invites, "get_db", fake_get_db)
    monkeypatch.setattr(invites.DirectUploadApp, "by_app_id", lambda *_: object())
    monkeypatch.setattr(
        invites.DirectUploadAppDeveloper, "by_developer_and_app", lambda *_: None
    )
    monkeypatch.setattr(
        invites.DirectUploadAppInvite,
        "by_developer_and_app",
        lambda *_: object() if has_invite else None,
    )

    login = SimpleNamespace(user=user)
    if has_invite or is_admin:
        status = invites.get_invite_status(login, "org.example.App")
        assert status.is_pending == has_invite
    else:
        with pytest.raises(HTTPException) as missing:
            invites.get_invite_status(login, "org.example.App")
        assert missing.value.status_code == 404
        assert missing.value.detail == "invite_not_found"
