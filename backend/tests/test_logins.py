from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_login_methods():
    response = client.get("/auth/login")
    assert response.status_code == 200
    data = response.json()
    assert any(m["method"] == "github" for m in data)
    assert any(m["method"] == "gitlab" for m in data)
    assert any(m["method"] == "gnome" for m in data)
    assert any(m["method"] == "kde" for m in data)


def test_userinfo_not_logged_in():
    response = client.get("/auth/userinfo")
    assert response.status_code == 204


def test_deleteuser_not_logged_in():
    response = client.get("/auth/deleteuser")
    assert response.status_code == 403


def test_logout_not_logged_in():
    response = client.post("/auth/logout")
    assert response.status_code == 200
    assert response.json() == {}
