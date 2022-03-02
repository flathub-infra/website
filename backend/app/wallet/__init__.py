"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""

from typing import List, Union

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..config import settings
from ..logins import login_state
from .walletbase import (
    CardInfo,
    Transaction,
    TransactionSaveCard,
    TransactionSortOrder,
    TransactionSummary,
    WalletError,
)

# Utilities and types

try:
    from .stripewallet import StripeWallet as Wallet
except ImportError:
    from .fakewallet import FakeWallet as Wallet

# Routes

router = APIRouter(prefix="/wallet")


@router.get("/walletinfo")
def get_walletinfo(request: Request, login=Depends(login_state)):
    """
    Retrieve the wallet for the currently logged in user.

    This will return a list of cards which the user has saved to their account.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    ret = Wallet().info(request, login["user"])
    if isinstance(ret, WalletError):
        return ret.as_jsonresponse()
    else:
        return ret


@router.post("/removecard")
def post_removecard(request: Request, card: CardInfo, login=Depends(login_state)):
    """
    Remove a card from a user's wallet.

    The provided information must exactly match a card as would be returned from the
    wallet info endpoint.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    ret = Wallet().remove_card(request, login["user"], card)
    if ret is not None:
        return ret.as_jsonresponse()

    return Response(None, status_code=201)


@router.get("/transactions")
def get_transactions(
    request: Request,
    login=Depends(login_state),
    sort: TransactionSortOrder = TransactionSortOrder.RECENT,
    since: str = None,
    limit: int = 100,
) -> Union[JSONResponse, List[TransactionSummary]]:
    """
    Return a list of transactions associated with this user.

    If anything goes wrong, an error will be returned, otherwise a list of transaction
    summaries will be returned.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    limit = min(limit, 100)

    ret = Wallet().transactions(request, login["user"], sort, since, limit)
    if isinstance(ret, WalletError):
        return ret.as_jsonresponse()
    return ret


@router.get("/transactions/{id}")
def get_transaction_by_id(
    id: str, request: Request, login=Depends(login_state)
) -> Transaction:
    """
    Retrieve a transaction by its ID

    If the transaction ID is valid, and owned by the calling user, then this will
    retrieve the whole transaction, including card details and disbursement information
    if available.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )

    ret = Wallet().transaction(request, login["user"], transaction=id)
    if isinstance(ret, WalletError):
        return ret.as_jsonresponse()
    else:
        return ret


def register_to_app(app: FastAPI):
    """
    Register the wallet APIs with the FastAPI application

    This is reliant on session and DB middlewares, and the login support being registered.
    """
    app.include_router(router)
