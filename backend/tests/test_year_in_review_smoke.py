import datetime
from collections.abc import Callable, Generator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture
def client():
    with TestClient(main.router) as client_:
        yield client_


@pytest.fixture
def mock_date() -> Callable[[int, int, int], Generator[MagicMock]]:
    @contextmanager
    def _mock_date(year: int, month: int, day: int) -> Generator[MagicMock]:
        with patch("app.routes.year_in_review.datetime") as mock_dt:
            mock_dt.datetime.now.return_value = datetime.datetime(year, month, day)
            mock_dt.datetime.side_effect = lambda *args, **kw: datetime.datetime(
                *args, **kw
            )
            yield mock_dt

    return _mock_date


def test_year_in_review(client, snapshot, mock_date):
    """Smoke test for GET /year-in-review/{year}"""
    current_year = 2024

    with mock_date(current_year, 12, 20):
        response = client.get("/year-in-review/" + str(current_year))
        snapshot_data = snapshot("test_year_in_review.json")
        snapshot_data["year"] = current_year
        assert snapshot_data == response.json()


def test_year_in_review_with_locale(client, snapshot, mock_date):
    """Test year in review with specific locale"""
    current_year = 2024

    with mock_date(current_year, 12, 20):
        response = client.get(
            "/year-in-review/" + str(current_year), params={"locale": "de"}
        )
        snapshot_data = snapshot("test_year_in_review_with_locale.json")
        snapshot_data["year"] = current_year
        assert snapshot_data == response.json()


def test_year_in_review_invalid_year_too_old(client):
    """Test year in review with year before 2018"""
    response = client.get("/year-in-review/2017")
    assert response.status_code == 422


def test_year_in_review_invalid_year_future(client, mock_date):
    """Test year in review with future year"""
    with mock_date(2026, 1, 3):
        response = client.get("/year-in-review/2027")
        assert response.status_code == 422


def test_year_in_review_without_previous_year(client):
    """Test year in review when statistics not available"""
    response = client.get("/year-in-review/2018")
    assert response.status_code == 200


def test_year_in_review_current_year_blocked_before_dec_15(client, mock_date):
    with mock_date(2026, 12, 14):
        response = client.get("/year-in-review/2026")
        assert response.status_code == 422


def test_year_in_review_current_year_allowed_after_dec_15(client, mock_date):
    with mock_date(2026, 12, 15):
        response = client.get("/year-in-review/2026")
        assert response.status_code == 200
