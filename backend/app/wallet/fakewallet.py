"""
Implementation details for a fake wallet.

This will be used if the app is started without Stripe credentials.

We "pretend" to have stripe credentials, but they'll always fail since
they're fake.
"""

from itertools import dropwhile
from time import time
from typing import Iterable, List, Optional

from fastapi import Request, Response

from app.models import FlathubUser

from .walletbase import (
    CardInfo,
    NascentTransaction,
    StripeKeys,
    Transaction,
    TransactionRow,
    TransactionSortOrder,
    TransactionStripeData,
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

FAKE_TXN_DICT = {txn.summary.id: txn for txn in FAKE_TXNS}


class FakeWallet(WalletBase):
    """
    A fake wallet, without using Stripe
    """

    @classmethod
    def webhook_name(cls):
        return "fakewallet"

    def info(self, request: Request, user: FlathubUser) -> WalletInfo:
        cards = []
        if not request.session.get("fake-card-exp-del", False):
            cards.append(FAKE_CARD_EXP)
        if not request.session.get("fake-card-ok-del", False):
            cards.append(FAKE_CARD_OK)
        return {
            "status": "ok",
            "cards": cards,
        }

    def remove_card(self, request: Request, user: FlathubUser, card: CardInfo):
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
            raise WalletError(error="not found")
        request.session[to_del] = True
        return None

    def _get_user_transactions(self, request: Request) -> dict[str, Transaction]:
        """
        Retrieve the transactions cached in the request session
        """
        raw = request.session.get("txns", [])
        ret = {}
        for txn in raw:
            txn = Transaction.parse_obj(txn)
            ret[txn.summary.id] = txn
        return ret

    def _set_user_transactions(self, request: Request, txns: Iterable[Transaction]):
        """
        Set the transactions cached in the request session
        """
        raw = list(txn.dict() for txn in txns)
        request.session["txns"] = raw

    def transactions(
        self,
        request: Request,
        user: FlathubUser,
        sort: TransactionSortOrder,
        since: Optional[str],
        limit: int,
    ) -> List[TransactionSummary]:
        def txn_key(txn: Transaction):
            return txn.summary.created

        txns = list(FAKE_TXNS)
        txns.extend(self._get_user_transactions(request).values())

        txns = sorted(txns, key=txn_key)

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
    ) -> Transaction:
        txdict = self._get_user_transactions(request)
        txdict.update({str(txn.summary.id): txn for txn in FAKE_TXNS})
        txn = txdict.get(transaction)

        if txn is None:
            raise WalletError(error="not found")

        return txn

    def create_transaction(
        self, request: Request, user: FlathubUser, transaction: NascentTransaction
    ) -> str:
        self._check_transaction_consistency(transaction)
        # Transaction is consistent, we're fairly "easy" so create it in the
        # session
        txns = self._get_user_transactions(request)
        txnum = len(txns)
        txid = f"USER-TXN-{txnum}"
        now = int(time())
        summary = TransactionSummary(
            id=txid,
            value=transaction.summary.value,
            currency=transaction.summary.currency,
            kind=transaction.summary.kind,
            status="new",
            reason=None,
            created=now,
            updated=now,
        )
        txn = Transaction(summary=summary, card=None, details=transaction.details)
        txns[id] = txn
        self._set_user_transactions(request, txns.values())
        return id

    def set_transaction_card(
        self, request: Request, user: FlathubUser, transaction: str, card: CardInfo
    ):
        txns = self._get_user_transactions(request)
        transaction = txns.get(transaction, FAKE_TXN_DICT.get(transaction))
        if transaction is None:
            raise WalletError(error="not found")
        if transaction.summary.status not in ["new", "retry"]:
            raise WalletError(error="transaction not changeable")
        cards = self.info(request, user)["cards"]
        if card not in cards:
            raise WalletError(error="bad or unknown card")
        transaction.card = card
        self._set_user_transactions(request, txns.values())

    def stripedata(self) -> StripeKeys:
        raise WalletError(error="not found")

    def get_transaction_stripedata(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> TransactionStripeData:
        txns = self._get_user_transactions(request)
        transaction = txns.get(transaction, FAKE_TXN_DICT.get(transaction))
        if transaction is None:
            raise WalletError(error="not found")
        if transaction.summary.status not in ["new", "retry"]:
            raise WalletError(error="transaction not changeable")
        txnid = transaction.summary.id
        return TransactionStripeData(
            status="ok", client_secret=f"stripe-secret-{txnid}", card=transaction.card
        )

    def cancel_transaction(self, request: Request, user: FlathubUser, transaction: str):
        txns = self._get_user_transactions(request)
        transaction = txns.get(transaction, FAKE_TXN_DICT.get(transaction))
        if transaction is None:
            raise WalletError(error="not found")
        if transaction.summary.status not in ["new", "retry"]:
            raise WalletError(error="transaction not changeable")
        transaction.summary.status = "cancelled"
        transaction.summary.reason = "user"
        self._set_user_transactions(request, txns.values())

    async def webhook(self, request: Request) -> Response:
        return Response(None, status_code=201)
