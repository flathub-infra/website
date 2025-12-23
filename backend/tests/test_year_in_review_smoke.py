import datetime

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture
def client():
    with TestClient(main.router) as client_:
        yield client_


def test_year_in_review(client, snapshot):
    """Smoke test for GET /year-in-review/{year}"""
    response = client.get("/year-in-review/" + str(datetime.datetime.now().year))

    snapshot_data = snapshot("test_year_in_review.json")
    snapshot_data["year"] = datetime.datetime.now().year
    assert snapshot_data == response.json()


def test_year_in_review_with_locale(client, snapshot):
    """Test year in review with specific locale"""
    response = client.get(
        "/year-in-review/" + str(datetime.datetime.now().year), params={"locale": "de"}
    )

    snapshot_data = snapshot("test_year_in_review_with_locale.json")
    snapshot_data["year"] = datetime.datetime.now().year
    assert snapshot_data == response.json()


def test_year_in_review_invalid_year_too_old(client):
    """Test year in review with year before 2018"""
    response = client.get("/year-in-review/2017")

    assert response.status_code == 422


def test_year_in_review_invalid_year_future(client):
    """Test year in review with future year"""
    response = client.get("/year-in-review/" + str(datetime.datetime.now().year + 1))

    assert response.status_code == 422


def test_year_in_review_without_previous_year(client):
    """Test year in review when statistics not available"""
    response = client.get("/year-in-review/2018")

    assert response.status_code == 200
