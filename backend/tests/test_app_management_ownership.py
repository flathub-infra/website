import sys
from contextlib import nullcontext
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException


def test_cross_app_access_follows_role_permission_not_role_name(monkeypatch):
    from app import login_info, models

    app_id = "org.example.App"
    user = models.FlathubUser()
    role = models.Role(name="support")
    user.roles = [role]
    monkeypatch.setattr(user, "dev_flatpaks", lambda _: set())
    monkeypatch.setattr(models.App, "by_appid", lambda *_: object())

    role.permissions = [models.Permission(name="manage-apps")]
    assert login_info.can_manage_app(Mock(), user, app_id)
    role.name = "admin"
    role.permissions.clear()
    assert not login_info.can_manage_app(Mock(), user, app_id)


def test_unassigned_admin_does_not_satisfy_author_only_routes(monkeypatch):
    from app import login_info

    user = SimpleNamespace(
        permissions=lambda: {"manage-apps"}, dev_flatpaks=lambda db: set()
    )
    db = Mock()
    db.session.merge.return_value = user
    monkeypatch.setattr(login_info, "get_db", lambda _: nullcontext(db))
    with pytest.raises(HTTPException) as exc:
        login_info.app_author_only("org.example.App", SimpleNamespace(user=user))
    assert exc.value.detail == "not_app_author"


def test_only_authorized_management_reads_use_writer_setup(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app import vending
    from app.login_info import LoginInformation, LoginState, login_state

    user = SimpleNamespace(
        id=1,
        permissions=lambda: set(),
        login_disabled=False,
        dev_flatpaks=lambda _: set(),
    )
    login = LoginInformation(LoginState.LOGGED_IN, user, None)
    db = Mock()
    db.session.get.return_value = user
    roles = []

    def get_db(role):
        roles.append(role)
        return nullcontext(db)

    monkeypatch.setattr(vending, "get_db", get_db)
    monkeypatch.setattr(vending.ApplicationVendingConfig, "by_appid", lambda *_: None)
    app_id = "org.example.App"
    app = FastAPI()
    app.include_router(vending.router)
    app.dependency_overrides[login_state] = lambda: login
    path = f"/vendingapp/{app_id}/management-setup"
    with TestClient(app) as client:
        assert client.get(f"/vendingapp/{app_id}/setup").json()["status"] == "no-config"
        response = client.get(path)
        assert response.status_code == 403
        assert response.json() == {"detail": "permission-denied"}
        user.dev_flatpaks = lambda _: {app_id}
        assert client.get(path).json()["status"] == "no-config"
        assert roles == ["replica", "writer", "writer"]
        for current in (SimpleNamespace(login_disabled=True), None):
            db.session.get.return_value = current
            response = client.get(path)
            assert response.status_code == 401
            assert response.json() == {"detail": "not-logged-in"}
        login = LoginInformation(LoginState.LOGGED_OUT, None, None)
        assert client.get(path).status_code == 401
    db.session.merge.assert_not_called()


@pytest.mark.parametrize("donation", [0, 500])
def test_non_owner_cannot_update_or_disable_payments(monkeypatch, donation):
    from app import vending
    from app.login_info import LoginInformation, LoginState

    app_id = "org.example.App"
    user = SimpleNamespace(id=2, dev_flatpaks=lambda db: {app_id})
    login = LoginInformation(LoginState.LOGGED_IN, user, None)
    db = Mock()
    monkeypatch.setattr(vending, "get_db", lambda _: nullcontext(db))
    monkeypatch.setattr(vending.StripeExpressAccount, "by_user", lambda *_: object())
    monkeypatch.setattr(
        vending.ApplicationVendingConfig, "by_appid", lambda *_: SimpleNamespace(user=1)
    )
    setup = vending.VendingSetupRequest(
        currency="usd", appshare=50, recommended_donation=donation, minimum_payment=0
    )
    with pytest.raises(vending.VendingError) as exc:
        vending.post_app_vending_setup(setup, Mock(), app_id, login=login)
    assert exc.value.error == "user-mismatch"
    db.delete.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.parametrize("donation", [0, 500])
def test_save_returns_writer_state_without_reading_replica(monkeypatch, donation):
    from app import vending
    from app.login_info import LoginInformation, LoginState

    app_id = "org.example.App"
    user = SimpleNamespace(id=1, dev_flatpaks=lambda _: {app_id})
    db = Mock()

    def get_db(role):
        assert role == "writer"
        return nullcontext(db)

    monkeypatch.setattr(vending, "get_db", get_db)
    monkeypatch.setattr(vending.StripeExpressAccount, "by_user", lambda *_: object())
    monkeypatch.setattr(
        vending.ApplicationVendingConfig, "by_appid", lambda *_: SimpleNamespace(user=1)
    )
    monkeypatch.setattr(vending.audit_log, "enqueue_audit_log", Mock())
    monkeypatch.setitem(
        sys.modules, "app.worker", SimpleNamespace(republish_app=Mock())
    )
    setup = vending.VendingSetupRequest(
        currency="usd", appshare=50, recommended_donation=donation, minimum_payment=0
    )
    result = vending.post_app_vending_setup(
        setup, Mock(), app_id, login=LoginInformation(LoginState.LOGGED_IN, user, None)
    )
    assert result.status == ("ok" if donation else "no-config")
    assert result.recommended_donation == donation
    assert result.is_owner == bool(donation)


@pytest.mark.parametrize(
    "member,owner,show_code",
    [(False, False, False), (True, False, True), (False, True, True)],
)
def test_admin_token_list_preserves_code_ownership(
    monkeypatch, member, owner, show_code
):
    from app import vending
    from app.login_info import LoginInformation, LoginState

    app_id = "org.example.App"
    user = SimpleNamespace(
        id=2,
        permissions=lambda: {"manage-apps"},
        login_disabled=False,
        dev_flatpaks=lambda _: {app_id} if member else set(),
    )
    db = Mock()
    db.session.get.return_value = user

    def get_db(role):
        assert role == "writer"
        return nullcontext(db)

    monkeypatch.setattr(vending, "get_db", get_db)
    monkeypatch.setattr(vending, "can_manage_app", lambda *_: True)
    monkeypatch.setattr(
        vending.ApplicationVendingConfig,
        "by_appid",
        lambda *_: SimpleNamespace(user=2 if owner else 1),
    )
    now = datetime.now(UTC)
    token = SimpleNamespace(
        id=1,
        state="unredeemed",
        name="Preview",
        created=now,
        changed=now,
        token="test-code",
    )
    monkeypatch.setattr(vending.RedeemableAppToken, "by_appid", lambda *_: [token])
    response = vending.get_redeemable_tokens(
        Mock(),
        app_id,
        login=LoginInformation(
            LoginState.LOGGED_IN,
            SimpleNamespace(id=2, dev_flatpaks=lambda _: {app_id}),
            None,
        ),
    )
    assert response.tokens[0].name == "Preview"
    assert response.tokens[0].token == ("test-code" if show_code else None)


def test_demoted_admin_cannot_read_redemption_metadata(monkeypatch):
    from app import vending
    from app.login_info import LoginInformation, LoginState

    stale = SimpleNamespace(
        id=1, permissions=lambda: {"manage-apps"}, login_disabled=False
    )
    current = SimpleNamespace(
        id=1,
        permissions=lambda: set(),
        login_disabled=False,
        dev_flatpaks=lambda _: set(),
    )
    db = Mock()
    db.session.get.return_value = current

    def get_db(role):
        assert role == "writer"
        return nullcontext(db)

    monkeypatch.setattr(vending, "get_db", get_db)
    read_tokens = Mock()
    monkeypatch.setattr(vending.RedeemableAppToken, "by_appid", read_tokens)
    with pytest.raises(vending.VendingError) as denied:
        vending.get_redeemable_tokens(
            Mock(),
            "org.example.App",
            login=LoginInformation(LoginState.LOGGED_IN, stale, None),
        )
    assert denied.value.error == "permission-denied"
    read_tokens.assert_not_called()
