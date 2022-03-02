"""
Implementation details for a fake wallet.

This will be used if the app is started without Stripe credentials.

We "pretend" to have stripe credentials, but they'll always fail since
they're fake.
"""

from itertools import dropwhile
from typing import Optional, Union, List

from fastapi import Request

from app.models import FlathubUser

from .walletbase import (
    CardInfo,
    Transaction,
    TransactionRow,
    TransactionSortOrder,
    TransactionSummary,
    WalletBase,
    WalletError,
    WalletInfo,
)

FAKE_CARD_EXP = CardInfo.parse_obj(
    {
        "id": "fake_card_exp",
        "brand": "visa",
        "country": "US",
        "exp_month": 12,
        "exp_year": 2021,
        "last4": "1234",
    }
)

FAKE_CARD_OK = CardInfo.parse_obj(
    {
        "id": "fake_card_ok",
        "brand": "mastercard",
        "country": "US",
        "exp_month": 12,
        "exp_year": 2022,
        "last4": "5678",
    }
)

FAKE_TXNS = [
    Transaction.parse_obj(
        {
            "summary": TransactionSummary.parse_obj(
                {
                    "id": "45",
                    "value": 1000,
                    "currency": "usd",
                    "kind": "donation",
                    "status": "success",
                    "created": 1612119840,
                    "updated": 1612119600,
                }
            ),
            "card": FAKE_CARD_EXP,
            "details": [
                TransactionRow.parse_obj(
                    {
                        "recipient": "org.flathub.Flathub",
                        "amount": 1000,
                        "currency": "usd",
                        "kind": "donation",
                    }
                )
            ],
        }
    ),
    Transaction.parse_obj(
        {
            "summary": TransactionSummary.parse_obj(
                {
                    "id": "12",
                    "value": 1000,
                    "currency": "usd",
                    "kind": "donation",
                    "status": "cancelled",
                    "reason": "user",
                    "created": 1643655600,
                    "updated": 1643655840,
                }
            ),
            "details": [
                TransactionRow.parse_obj(
                    {
                        "recipient": "org.flathub.Flathub",
                        "amount": 1000,
                        "currency": "usd",
                        "kind": "donation",
                    }
                )
            ],
        }
    ),
]


class FakeWallet(WalletBase):
    """
    A fake wallet, without using Stripe
    """

    def info(
        self, request: Request, user: FlathubUser
    ) -> Union[WalletError, WalletInfo]:
        cards = []
        if not request.session.get("fake-card-exp-del", False):
            cards.append(FAKE_CARD_EXP)
        if not request.session.get("fake-card-ok-del", False):
            cards.append(FAKE_CARD_OK)
        return {
            "status": "ok",
            "cards": cards,
        }

    def remove_card(
        self, request: Request, user: FlathubUser, card: CardInfo
    ) -> Optional[WalletError]:
        to_del = None
        if card == FAKE_CARD_EXP:
            to_del = "exp"
        elif card == FAKE_CARD_OK:
            to_del = "ok"
        if to_del is not None:
            to_del = f"fake-card-{to_del}-del"
            if request.session.get(to_del, False):
                to_del = None
        if to_del is None:
            return WalletError(status="error", error="not found")
        request.session[to_del] = True
        return None

    def transactions(
        self,
        request: Request,
        user: FlathubUser,
        sort: TransactionSortOrder,
        since: Optional[str],
        limit: int,
    ) -> Union[WalletError, List[TransactionSummary]]:
        def txn_key(txn: Transaction):
            return txn.summary.created

        txns = sorted(FAKE_TXNS, key=txn_key)

        if sort == TransactionSortOrder.RECENT:
            txns = list(reversed(txns))

        if since is not None:

            def txn_not_since(txn: Transaction):
                return txn.summary.id != since

            txns = list(dropwhile(txn_not_since, txns))
            txns = txns[1:]

        if limit < len(txns):
            txns = txns[:limit]

        return [txn.summary for txn in txns]

    def transaction(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> Union[WalletError, Transaction]:
        txdict = {str(txn.summary.id): txn for txn in FAKE_TXNS}
        txn = txdict.get(transaction)

        if txn is None:
            return WalletError(status="error", error="not found")

        return txn
