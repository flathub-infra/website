"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""

from fastapi import APIRouter, Depends, FastAPI, Request, Response
from pydantic import BaseModel

from ..config import settings
from ..login_info import logged_in
from .walletbase import (
    NascentTransaction,
    PaymentCardInfo,
    StripeKeys,
    Transaction,
    TransactionSaveCard,
    TransactionSortOrder,
    TransactionStripeData,
    TransactionSummary,
    WalletError,
    WalletInfo,
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


@router.get(
    "/walletinfo",
    tags=["wallet"],
    responses={
        200: {"model": WalletInfo},
        401: {"description": "Unauthorized"},
        500: {"description": "Internal server error"},
    },
)
def get_walletinfo(request: Request, login=Depends(logged_in)) -> WalletInfo:
    """
    Retrieve the wallet for the currently logged in user.

    This will return a list of cards which the user has saved to their account.
    """
    return Wallet().info(request, login["user"])


@router.post(
    "/removecard",
    tags=["wallet"],
    responses={
        201: {"description": "Card removed successfully"},
        401: {"description": "Unauthorized"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def post_removecard(request: Request, card: PaymentCardInfo, login=Depends(logged_in)):
    """
    Remove a card from a user's wallet.

    The provided information must exactly match a card as would be returned from the
    wallet info endpoint.
    """
    Wallet().remove_card(request, login["user"], card)

    return Response(None, status_code=201)


@router.get(
    "/transactions",
    response_model=list[TransactionSummary],
    tags=["wallet"],
    responses={
        200: {"model": list[TransactionSummary]},
        401: {"description": "Unauthorized"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_transactions(
    request: Request,
    login=Depends(logged_in),
    sort: TransactionSortOrder = TransactionSortOrder.RECENT,
    since: str | None = None,
    limit: int = 100,
) -> list[TransactionSummary]:
    """
    Return a list of transactions associated with this user.

    If anything goes wrong, an error will be returned, otherwise a list of transaction
    summaries will be returned.
    """
    limit = min(limit, 100)

    return Wallet().transactions(request, login["user"], sort, since, limit)


@router.get(
    "/transactions/{txn}",
    tags=["wallet"],
    responses={
        200: {"model": Transaction},
        401: {"description": "Unauthorized"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_transaction_by_id(
    txn: str, request: Request, login=Depends(logged_in)
) -> Transaction:
    """
    Retrieve a transaction by its ID

    If the transaction ID is valid, and owned by the calling user, then this will
    retrieve the whole transaction, including card details and disbursement information
    if available.
    """

    return Wallet().transaction(request, login["user"], transaction=txn)


class PostTransactionResponse(BaseModel):
    status: str
    id: str


@router.post(
    "/transactions",
    tags=["wallet"],
    responses={
        200: {"model": PostTransactionResponse},
        401: {"description": "Unauthorized"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def create_transaction(
    request: Request, data: NascentTransaction, login=Depends(logged_in)
) -> PostTransactionResponse:
    """
    Create a new transaction, return the ID.

    If the passed in nascent transaction is valid, this will create a transaction and
    return the ID of the newly created wallet, otherwise it'll return an error
    """
    ret = Wallet().create_transaction(request, login["user"], data)
    return PostTransactionResponse(status="ok", id=ret)


@router.post(
    "/transactions/{txn}/setcard",
    tags=["wallet"],
    responses={
        200: {"description": "Card set successfully"},
        401: {"description": "Unauthorized"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def set_transaction_card(
    txn: str, data: PaymentCardInfo, request: Request, login=Depends(logged_in)
):
    """
    Set the card associated with a transaction.

    The posted card must exactly match one of the cards returned by the wallet
    info endpoint or else the update may not succeed
    """
    Wallet().set_transaction_card(request, login["user"], txn, data)
    return {"status": "ok"}


@router.post(
    "/transactions/{txn}/cancel",
    tags=["wallet"],
    responses={
        201: {"description": "Transaction cancelled successfully"},
        401: {"description": "Unauthorized"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def cancel_transaction(txn: str, request: Request, login=Depends(logged_in)):
    """
    Cancel a transaction in the `new` or `retry` states.

    Note that this may actually not cancel if a webhook fires asynchronously
    and updates the transaction.  This API will not attempt to prevent stripe
    payments from completing.
    """
    Wallet().cancel_transaction(request, login["user"], txn)
    return Response(None, status_code=201)


# Stripe specific endpoints which are necessary


@router.get(
    "/stripedata",
    tags=["wallet"],
    responses={
        200: {"model": StripeKeys},
        500: {"description": "Internal server error"},
    },
)
def get_stripedata() -> StripeKeys:
    """
    Return the stripe public key to use in the frontend.  Since this is not
    considered secret, we don't need a login or anything for this
    """
    return Wallet().stripedata()


@router.get(
    "/transactions/{txn}/stripe",
    tags=["wallet"],
    responses={
        200: {"model": TransactionStripeData},
        401: {"description": "Unauthorized"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_txn_stripedata(
    txn: str, request: Request, login=Depends(logged_in)
) -> TransactionStripeData:
    """
    Return the Stripe data associated with the given transaction.

    This is only applicable to transactions in the `new` or `retry` state and
    will only work for transactions which *are* Stripe transactions.
    """

    return Wallet().get_transaction_stripedata(request, login["user"], txn)


@router.post(
    "/transactions/{txn}/savecard",
    tags=["wallet"],
    responses={
        201: {"description": "Save card status set successfully"},
        401: {"description": "Unauthorized"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def set_savecard(
    txn: str, data: TransactionSaveCard, request: Request, login=Depends(logged_in)
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

    Wallet().set_savecard(request, login["user"], txn, data.save_card)
    return Response(None, status_code=201)


@router.post(
    "/transactions/{txn}/setpending",
    tags=["wallet"],
    responses={
        201: {"description": "Transaction set as pending successfully"},
        401: {"description": "Unauthorized"},
        404: {"description": "Transaction not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def set_pending(txn: str, request: Request, login=Depends(logged_in)):
    """
    Set the transaction as 'pending' so that we can recover if Stripe
    flows don't quite work (e.g. webhook goes missing)
    """
    Wallet().set_transaction_pending(request, login["user"], txn)
    return Response(None, status_code=201)


# Finally a fake-wallet-only endpoint which is used to clean up for testing.

if settings.stripe_public_key in [None, ""]:

    @router.post(
        "/clearfake",
        tags=["wallet"],
        responses={
            201: {"description": "Fake wallet cleared successfully"},
            500: {"description": "Internal server error"},
        },
    )
    def clear_fake(request: Request):
        "Clear the fake wallet details"
        for key in ["txns", "fake-card-ok-del", "fake-card-exp-del"]:
            if key in request.session:
                del request.session[key]
        return Response(None, status_code=201)


@router.post(
    "/webhook/" + Wallet.webhook_name(),
    tags=["wallet"],
    responses={
        200: {"description": "Webhook processed successfully"},
        400: {"description": "Invalid webhook payload"},
        500: {"description": "Internal server error"},
    },
)
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
