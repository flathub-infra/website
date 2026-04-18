import datetime
from collections.abc import Callable, Generator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app import main
from app.login_info import LoginInformation, LoginState, login_state


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


@pytest.fixture
def admin_client(mock_date):
    """Client with admin (quality-moderation) permissions."""

    @contextmanager
    def _admin_client(year: int, month: int, day: int):
        mock_user = MagicMock()
        mock_user.permissions.return_value = {"quality-moderation"}
        mock_user.deleted = False

        def mock_login_state(request: Request):
            return LoginInformation(
                state=LoginState.LOGGED_IN,
                user=mock_user,
                method=None,
            )

        mock_db = MagicMock()
        mock_db.session.merge.return_value = mock_user

        @contextmanager
        def mock_get_db(*args, **kwargs):
            yield mock_db

        main.router.dependency_overrides[login_state] = mock_login_state
        try:
            with (
                mock_date(year, month, day),
                patch("app.routes.year_in_review.get_db", mock_get_db),
            ):
                with TestClient(main.router) as client_:
                    yield client_
        finally:
            main.router.dependency_overrides.pop(login_state, None)

    return _admin_client


@pytest.fixture
def non_admin_client(mock_date):
    """Client with a logged-in user who has no admin permissions."""

    @contextmanager
    def _non_admin_client(year: int, month: int, day: int):
        mock_user = MagicMock()
        mock_user.permissions.return_value = set()
        mock_user.deleted = False

        def mock_login_state(request: Request):
            return LoginInformation(
                state=LoginState.LOGGED_IN,
                user=mock_user,
                method=None,
            )

        mock_db = MagicMock()
        mock_db.session.merge.return_value = mock_user

        @contextmanager
        def mock_get_db(*args, **kwargs):
            yield mock_db

        main.router.dependency_overrides[login_state] = mock_login_state
        try:
            with (
                mock_date(year, month, day),
                patch("app.routes.year_in_review.get_db", mock_get_db),
            ):
                with TestClient(main.router) as client_:
                    yield client_
        finally:
            main.router.dependency_overrides.pop(login_state, None)

    return _non_admin_client


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


def test_year_in_review_admin_can_access_current_year_before_dec_15(admin_client):
    """Admin with quality-moderation permission can preview current year before Dec 15."""
    with admin_client(2026, 6, 1) as client:
        response = client.get("/year-in-review/2026")
        assert response.status_code in (200, 404)  # 200 if stats exist, 404 if not


def test_year_in_review_admin_cannot_access_future_year(admin_client):
    """Even admins cannot access years beyond the current year."""
    with admin_client(2026, 6, 1) as client:
        response = client.get("/year-in-review/2027")
        assert response.status_code == 422


def test_year_in_review_non_admin_blocked_before_dec_15(non_admin_client):
    """Logged-in user without admin permissions is still blocked before Dec 15."""
    with non_admin_client(2026, 6, 1) as client:
        response = client.get("/year-in-review/2026")
        assert response.status_code == 422
