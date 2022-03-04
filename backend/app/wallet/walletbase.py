"""
The base class for wallet interaction

Wallets, be they fake or Stripey, support a number of operations which are
common.  This class provides the basis for wallet operations
"""

from enum import Enum
from typing import List, Literal, Optional, Union

from fastapi import Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..models import FlathubUser


class CardInfo(BaseModel):
    id: str
    brand: str
    country: str
    exp_month: int
    exp_year: int
    last4: str


TransactionKind = Literal["donation", "purchase"]


class TransactionSummary(BaseModel):
    id: str
    value: int
    currency: str
    kind: TransactionKind
    status: str
    reason: Optional[str]
    created: Optional[int]
    updated: Optional[int]


class TransactionRow(BaseModel):
    recipient: str
    amount: int
    currency: str
    kind: TransactionKind


class Transaction(BaseModel):
    summary: TransactionSummary
    card: Optional[CardInfo]
    details: List[TransactionRow]


class NascentTransactionSummary(BaseModel):
    value: int
    currency: str
    kind: TransactionKind


class NascentTransaction(BaseModel):
    summary: NascentTransactionSummary
    details: List[TransactionRow]


class WalletError(BaseModel):
    status: str
    error: str

    def as_jsonresponse(self):
        if self.error == "not found":
            return JSONResponse(jsonable_encoder(self), status_code=404)
        else:
            return JSONResponse(jsonable_encoder(self), status_code=400)


class WalletInfo(BaseModel):
    status: str
    cards: List[CardInfo]


class StripeKeys(BaseModel):
    status: str
    public_key: str


class TransactionStripeData(BaseModel):
    status: str
    client_secret: str
    card: Optional[CardInfo]


class TransactionSortOrder(Enum):
    """
    Sorting of transactions, either most-recent first, or oldest first
    """

    RECENT = "recent"
    OLDEST = "oldest"


class WalletBase:
    """
    Abstract base class for wallets
    """

    def __init__(self):
        """
        Initialise this wallet
        """

    @classmethod
    def webhook_name(cls):
        """
        Retrieve the suffix for the webhooks for this wallet kind.
        """
        raise NotImplementedError

    def info(
        self, request: Request, user: FlathubUser
    ) -> Union[WalletError, WalletInfo]:
        """
        Retrieve the wallet information to be returned to the user.  If there
        are any errors while retrieving the wallet then this returns an
        instance of WalletError, otherwise a WalletInfo is returned.
        """
        raise NotImplementedError

    def remove_card(
        self, request: Request, user: FlathubUser, card: CardInfo
    ) -> Optional[WalletError]:
        """
        Attempt to remove `card` from the user's wallet.  If it's present then
        it is removed and if it's not present, or something else goes wrong then
        a WalletError is returned.
        """
        raise NotImplementedError

    def transactions(
        self,
        request: Request,
        user: FlathubUser,
        sort: TransactionSortOrder,
        since: Optional[str],
        limit: int,
    ) -> Union[WalletError, List[TransactionSummary]]:
        """
        List the transactions this user has performed.
        """
        raise NotImplementedError

    def transaction(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> Union[WalletError, Transaction]:
        """
        Retrieve a specific transaction
        """
        raise NotImplementedError

    def _check_transaction_consistency(
        self, transaction: NascentTransaction
    ) -> Optional[WalletError]:
        """
        Some basic consistency checks which all nascent transactions have to meet.

        As we relax the transaction rules, we can relax them here first.

        Meeting these checks does not guarantee that a transaction can be created.
        """
        if transaction.summary.kind == "donation":
            if any(row.kind == "purchase" for row in transaction.details):
                return WalletError(status="error", error="inconsistent details")
        if transaction.summary.currency != "usd" or any(
            row.currency != "usd" for row in transaction.details
        ):
            return WalletError(status="error", error="must be usd")
        if transaction.summary.value < 200:
            return WalletError(status="error", error="transaction too small")
        if sum(row.amount for row in transaction.details) != transaction.summary.value:
            return WalletError(status="error", error="detail sum does not match value")
        if not any(
            row.recipient == "org.flathub.Flathub" for row in transaction.details
        ):
            return WalletError(status="error", error="nothing for flathub")
        if transaction.details[-1].recipient != "org.flathub.Flathub":
            return WalletError(status="error", error="flathub must be last")
        if transaction.details[-1].amount < 100:
            return WalletError(
                status="error", error="flathub amount less than 1 usd minimum"
            )
        if transaction.details[-1].kind != "donation":
            return WalletError(status="error", error="flathub row must be donation")

    def create_transaction(
        self, request: Request, user: FlathubUser, transaction: NascentTransaction
    ) -> Union[WalletError, str]:
        """
        Create a new transaction, the input is a nascent transaction and the
        output should either be an error, or a successful creation with an ID
        """
        raise NotImplementedError

    def set_transaction_card(
        self, request: Request, user: FlathubUser, transaction: str, card: CardInfo
    ) -> Optional[WalletError]:
        """
        Set the card associated with a transaction.  The card should match one
        returned by the `info()` function otherwise it's not guaranteed to work.

        Returns a WalletError on error, otherwise None.
        """
        raise NotImplementedError

    def stripedata(self) -> Union[WalletError, StripeKeys]:
        """
        Return the public/publishable keys for this wallet
        """
        raise NotImplementedError

    def get_transaction_stripedata(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> Union[WalletError, TransactionStripeData]:
        """
        Return the stripe data associated with the given transaction, if there is some.
        """
        raise NotImplementedError

    def cancel_transaction(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> Optional[WalletError]:
        """
        Cancel the named transaction if possible.
        """
        raise NotImplementedError

    def webhook(self, request: Request) -> Response:
        """
        Handle an incoming webhook POST request.

        Note, this **must** return something which can be directly returned
        from the fastapi call point.
        """
        raise NotImplementedError
