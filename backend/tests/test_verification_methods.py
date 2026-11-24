from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from test_verification_dns import _load_verification_module


@pytest.mark.parametrize("is_admin", [True, False])
def test_available_methods_for_unassigned_user(monkeypatch, is_admin):
    from app.login_info import logged_in

    verification = _load_verification_module(monkeypatch)
    app_id = "org.duckstation.DuckStation"
    user = SimpleNamespace(
        id=1,
        dev_flatpaks=lambda db: set(),
        permissions=lambda: {"manage-apps"} if is_admin else {"modify-users"},
    )

    @contextmanager
    def get_db(_role):
        yield SimpleNamespace(session=SimpleNamespace(merge=lambda value: value))

    monkeypatch.setattr(verification, "get_db", get_db)
    monkeypatch.setattr(verification, "require_oauth_upgrade", lambda *_: None)
    monkeypatch.setattr(
        verification.models.App,
        "by_appid",
        lambda db, id: object() if id == app_id else None,
    )
    monkeypatch.setattr(
        verification.models.AppVerification, "by_app_and_user", lambda *_: None
    )
    monkeypatch.setattr(verification, "_get_existing_verification", lambda _: None)
    app = FastAPI()
    verification.register_to_app(app)
    app.dependency_overrides[logged_in] = lambda: SimpleNamespace(user=user)

    with TestClient(app) as client:
        response = client.get(f"/verification/{app_id}/available-methods?new_app=false")
        if is_admin:
            assert response.status_code == 200
            assert [method["method"] for method in response.json()["methods"]] == [
                "website",
                "dns",
            ]
        else:
            assert response.status_code == 403
            assert response.json()["detail"] == "not_app_developer"

        response = client.post(f"/verification/{app_id}/confirm-website-verification")
        if is_admin:
            assert response.status_code == 400
            assert response.json()["detail"] == "must_set_up_first"
        else:
            assert response.status_code == 403
            assert response.json()["detail"] == "not_app_developer"
