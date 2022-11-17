"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""

from typing import List, Union

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse

from ..config import settings
from ..logins import login_state
from .walletbase import (
    CardInfo,
    NascentTransaction,
    Transaction,
    TransactionSaveCard,
    TransactionSortOrder,
    TransactionSummary,
    WalletError,
)

try:
    from .stripewallet import StripeWallet as Wallet
except ImportError:
    from .fakewallet import FakeWallet as Wallet

# Utilities and types

# @app.exception_handler(WalletError) (done in register function below)
async def walleterror_exception_handler(_request: Request, exc: WalletError):
    """
    Handle functions which yeet a WalletError at FastAPI by converting them to
    the JSONResponse needed.
    """
    if exc.__cause__ is not None:
        print("Wallet Error caused by:")
        print(exc.__cause__)
    return exc.as_jsonresponse()


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
    return Wallet().info(request, login["user"])


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
    Wallet().remove_card(request, login["user"], card)

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

    return Wallet().transactions(request, login["user"], sort, since, limit)


@router.get("/transactions/{txn}")
def get_transaction_by_id(
    txn: str, request: Request, login=Depends(login_state)
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

    return Wallet().transaction(request, login["user"], transaction=txn)


@router.post("/transactions")
def create_transaction(
    request: Request, data: NascentTransaction, login=Depends(login_state)
):
    """
    Create a new transaction, return the ID.

    If the passed in nascent transaction is valid, this will create a transaction and
    return the ID of the newly created wallet, otherwise it'll return an error
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    ret = Wallet().create_transaction(request, login["user"], data)
    return {
        "status": "ok",
        "id": ret,
    }


@router.post("/transactions/{txn}/setcard")
def set_transaction_card(
    txn: str, data: CardInfo, request: Request, login=Depends(login_state)
):
    """
    Set the card associated with a transaction.

    The posted card must exactly match one of the cards returned by the wallet
    info endpoint or else the update may not succeed
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    Wallet().set_transaction_card(request, login["user"], txn, data)
    return {"status": "ok"}


@router.post("/transactions/{txn}/cancel")
def cancel_transaction(txn: str, request: Request, login=Depends(login_state)):
    """
    Cancel a transaction in the `new` or `retry` states.

    Note that this may actually not cancel if a webhook fires asynchronously
    and updates the transaction.  This API will not attempt to prevent stripe
    payments from completing.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    Wallet().cancel_transaction(request, login["user"], txn)
    return Response(None, status_code=201)


@router.post("/process-pending-transfers")
def process_transfers():
    """
    Process any pending transfers which may be in the system
    """
    Wallet().perform_pending_transfers()
    return Response(None, status_code=200)


# Stripe specific endpoints which are necessary


@router.get("/stripedata")
def get_stripedata():
    """
    Return the stripe public key to use in the frontend.  Since this is not
    considered secret, we don't need a login or anything for this
    """
    return Wallet().stripedata()


@router.get("/transactions/{txn}/stripe")
def get_txn_stripedata(txn: str, request: Request, login=Depends(login_state)):
    """
    Return the Stripe data associated with the given transaction.

    This is only applicable to transactions in the `new` or `retry` state and
    will only work for transactions which *are* Stripe transactions.
    """

    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    return Wallet().get_transaction_stripedata(request, login["user"], txn)


@router.post("/transactions/{txn}/savecard")
def set_savecard(
    txn: str, data: TransactionSaveCard, request: Request, login=Depends(login_state)
):
    """
    Set the save-card status.

    This is only applicable to transactions in the `new` or `retry` state
    and will only work for transactions which are backed by stripe or similar.

    If the `save_card` parameter is null, then the card will not be saved,
    otherwise it will be saved.  If it's set to `off_session` then an attempt
    will be made to create a saved method which can be used without the user
    re-authenticating
    """

    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    Wallet().set_savecard(request, login["user"], txn, data.save_card)
    return Response(None, status_code=201)


@router.post("/transactions/{txn}/setpending")
def set_pending(txn: str, request: Request, login=Depends(login_state)):
    """
    Set the transaction as 'pending' so that we can recover if Stripe
    flows don't quite work (e.g. webhook goes missing)
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    Wallet().set_transaction_pending(request, login["user"], txn)
    return Response(None, status_code=201)


# Finally a fake-wallet-only endpoint which is used to clean up for testing.

if settings.stripe_public_key in [None, ""]:

    @router.post("/clearfake")
    def clear_fake(request: Request):
        "Clear the fake wallet details"
        for key in ["txns", "fake-card-ok-del", "fake-card-exp-del"]:
            if key in request.session:
                del request.session[key]
        return Response(None, status_code=201)


@router.post("/webhook/" + Wallet.webhook_name())
async def webhook(request: Request):
    """
    This endpoint is intended to deal with webhooks coming back from payment
    mechanisms etc.  It exists only for the deployed wallet, so its name
    will vary with the deployed wallet kind.

    The exact form of the content posted to the webhook will vary from wallet
    kind to wallet kind.
    """

    return await Wallet().webhook(request)


def register_to_app(app: FastAPI):
    """
    Register the wallet APIs with the FastAPI application

    This is reliant on session and DB middlewares, and the login support being registered.
    """
    app.include_router(router)
    app.add_exception_handler(WalletError, walleterror_exception_handler)
