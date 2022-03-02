"""
The base class for wallet interaction

Wallets, be they fake or Stripey, support a number of operations which are
common.  This class provides the basis for wallet operations
"""

from enum import Enum
from typing import List, Optional, Union

from fastapi import Request
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


class TransactionSummary(BaseModel):
    id: str
    value: int
    currency: str
    kind: str
    status: str
    reason: Optional[str]
    created: Optional[int]
    updated: Optional[int]


class TransactionRow(BaseModel):
    recipient: str
    amount: int
    currency: str
    kind: str


class Transaction(BaseModel):
    summary: TransactionSummary
    card: Optional[CardInfo]
    details: List[TransactionRow]


class WalletError(BaseModel):
    status: str
    error: str

    def as_jsonresponse(self):
        if self.error == "not found":
            return JSONResponse(jsonable_encoder(self), status_code=404)
        else:
            return JSONResponse(self, status_code=400)


class WalletInfo(BaseModel):
    status: str
    cards: List[CardInfo]


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
