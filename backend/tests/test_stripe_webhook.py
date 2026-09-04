import asyncio
import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.wallet import stripewallet


class FakeRequest:
    def __init__(self, event):
        self.event = event
        self.headers = {"stripe-signature": "valid-signature"}

    async def body(self):
        return b"event"


def _event(transfer_group):
    return {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": "pi-1",
                "transfer_group": transfer_group,
            }
        },
    }


def _db_for(*, stripe_transaction=None, transaction=None):
    query = MagicMock()
    query.get.side_effect = [stripe_transaction, transaction]
    session = MagicMock()
    session.query.return_value = query
    db = SimpleNamespace(session=session)

    @contextmanager
    def get_db(_db_type):
        yield db

    return get_db, db


@pytest.mark.parametrize("transfer_group", ["flathub-txn-not-an-integer", "other-1"])
def test_webhook_ignores_unusable_transfer_groups(monkeypatch, transfer_group):
    wallet = stripewallet.StripeWallet()
    monkeypatch.setattr(
        stripewallet.stripe.Webhook,
        "construct_event",
        lambda *_args, **_kwargs: _event(transfer_group),
    )
    get_db, db = _db_for()
    monkeypatch.setattr(stripewallet, "get_db", get_db)

    response = asyncio.run(wallet.webhook(FakeRequest(_event(transfer_group))))

    assert response.status_code == 201
    db.session.commit.assert_not_called()


def test_webhook_ignores_stripe_transaction_for_different_payment_intent(monkeypatch):
    wallet = stripewallet.StripeWallet()
    monkeypatch.setattr(
        stripewallet.stripe.Webhook,
        "construct_event",
        lambda *_args, **_kwargs: _event("flathub-txn-1"),
    )
    stripe_transaction = SimpleNamespace(stripe_pi="pi-other", transaction=42)
    get_db, db = _db_for(stripe_transaction=stripe_transaction)
    monkeypatch.setattr(stripewallet, "get_db", get_db)

    response = asyncio.run(wallet.webhook(FakeRequest(_event("flathub-txn-1"))))

    assert response.status_code == 201
    db.session.commit.assert_not_called()
