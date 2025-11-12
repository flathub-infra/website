import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from app import main

    with TestClient(main.router) as client_:
        yield client_


def test_storefront_info_basic(client, snapshot):
    """Smoke test for GET /purchases/storefront-info"""
    response = client.get(
        "/purchases/storefront-info", params={"app_id": "org.sugarlabs.Maze"}
    )

    snapshot_data = snapshot("test_storefront_info_basic.json")
    assert snapshot_data == response.json()


def test_is_free_software_endpoint_returns_bool(client, snapshot):
    """Smoke test for GET /purchases/storefront-info/is-free-software"""
    response = client.get(
        "/purchases/storefront-info/is-free-software",
        params={"app_id": "org.sugarlabs.Maze"},
    )

    snapshot_data = snapshot("test_is_free_software_endpoint_returns_bool.json")
    assert snapshot_data == response.json()


def test_is_free_software_with_license_param(client, snapshot):
    response = client.get(
        "/purchases/storefront-info/is-free-software",
        params={"app_id": "com.example.Fake", "license": "GPL-3.0-only"},
    )

    snapshot_data = snapshot("test_is_free_software_with_license_param.json")
    assert snapshot_data == response.json()
