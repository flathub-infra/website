import os
import sys
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.models import Transaction


def _transaction(status="success", kind="purchase"):
    return Transaction(
        id=1,
        user_id=42,
        value=100,
        currency="usd",
        kind=kind,
        status=status,
        created=datetime.now(UTC),
        updated=datetime.now(UTC),
    )


def test_successful_purchase_grants_ownership():
    transaction = _transaction()
    row = MagicMock(kind="purchase", recipient="org.example.App")
    db = MagicMock()

    with patch(
        "app.models.UserOwnedApp.user_owns_app", return_value=False
    ) as owns_app, patch.object(Transaction, "rows", return_value=[row]):
        transaction.update_app_ownership(db)

    owns_app.assert_called_once_with(db, 42, "org.example.App")
    added = db.session.add.call_args.args[0]
    assert added.app_id == "org.example.App"
    assert added.account == 42


@pytest.mark.parametrize("status", ["new", "retry", "pending", "cancelled"])
def test_non_success_transaction_does_not_grant_ownership(status):
    transaction = _transaction(status=status)
    db = MagicMock()

    with patch("app.models.UserOwnedApp.user_owns_app") as owns_app:
        transaction.update_app_ownership(db)

    owns_app.assert_not_called()
    db.session.add.assert_not_called()


def test_donation_does_not_grant_ownership():
    transaction = _transaction(kind="donation")
    row = MagicMock(kind="donation", recipient="org.example.App")
    db = MagicMock()

    with patch("app.models.UserOwnedApp.user_owns_app") as owns_app, patch.object(
        Transaction, "rows", return_value=[row]
    ):
        transaction.update_app_ownership(db)

    owns_app.assert_not_called()
    db.session.add.assert_not_called()


def test_successful_transaction_without_rows_is_ignored():
    transaction = _transaction()
    db = MagicMock()

    with patch("app.models.UserOwnedApp.user_owns_app") as owns_app, patch.object(
        Transaction, "rows", return_value=[]
    ):
        transaction.update_app_ownership(db)

    owns_app.assert_not_called()
    db.session.add.assert_not_called()
