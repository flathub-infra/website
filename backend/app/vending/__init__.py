"""
The /vending API is here to permit app authors to take donations and payments

The core vending behaviours are:

1. Onboarding / maintaining a Stripe account capable of receiving transfers
2. Accessing the express account onboarding/update flow and dashboard

TODO:

3. Configuring the donation / purchase settings for an application
4. For purchase apps, producing grant tokens which can be redeemed by other
   users so as to not need to pay money for access (e.g. beta testers)
"""


from typing import List, Tuple

import stripe
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import db
from pydantic import BaseModel

from ..config import settings
from ..logins import login_state
from ..models import ApplicationVendingConfig, StripeExpressAccount, Transaction
from ..vending import prices
from ..wallet import Wallet, WalletError


class VendingError(Exception):
    """
    Errors which can be yeeted out of any Vending API.
    """

    def __init__(self, error):
        super().__init__()
        self.error = error

    def as_jsonresponse(self):
        if self.error == "not found":
            return JSONResponse(
                {"status": "error", "error": self.error}, status_code=404
            )
        else:
            return JSONResponse(
                {"status": "error", "error": self.error}, status_code=400
            )


class VendingStatus(BaseModel):
    """
    The status object says whether the user is capable of receiving payments,
    and also whether or not there are pending onboarding operations to complete
    """

    status: str
    can_take_payments: bool
    needs_attention: bool
    details_submitted: bool


class VendingOnboardingRequest(BaseModel):
    """
    A request to begin/continue the onboarding process for a user.

    Any onboarding operation request a 'return' URL which we will tell Stripe
    to send us back to.
    """

    return_url: str


class VendingRedirect(BaseModel):
    """
    Any redirect the vending system needs to create will be returned like this.

    Status will be "ok" otherwise you cannot rely on target_url and instead
    something look for like error.
    """

    status: str
    target_url: str


class VendingDescriptor(BaseModel):
    """
    Vending descriptor for an application
    """

    status: str
    currency: str
    components: List[Tuple[str, int]]

    fee_fixed_cost: int
    fee_cost_percent: int
    fee_prefer_percent: int


class VendingSplit(BaseModel):
    """
    Vending split for a given app at a given amount of money
    """

    status: str
    currency: str
    splits: List[Tuple[str, int]]


class VendingSetup(BaseModel):
    """
    Configuration for a vended application
    """

    currency: str
    appshare: int
    recommended_donation: int
    minimum_payment: int


class ProposedPayment(BaseModel):
    """
    Proposed payment to be made for an application
    """

    currency: str
    amount: int


class VendingOutput(BaseModel):
    """
    Result from attempting to make a proposed payment
    """

    status: str
    transaction: str


# @app.exception_handler(VendingError) (done in register function below)
async def vendingerror_exception_handler(_request: Request, exc: VendingError):
    """
    Handle functions which yeet a VendingError at FastAPI by converting them to
    the JSONResponse needed.
    """
    if exc.__cause__ is not None:
        print("Wallet Error caused by:")
        print(exc.__cause__)
    return exc.as_jsonresponse()


router = APIRouter(prefix="/vending")


@router.get("/status")
def status(login=Depends(login_state)) -> VendingStatus:
    """
    Retrieve the vending status of the logged in user.

    This will return `201` if the logged in user has never begun the onboarding
    flow to be a vendor on Flathub.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    account = StripeExpressAccount.by_user(db, login["user"])
    if account is None:
        return Response(None, status_code=201)

    can_take_money = False
    try:
        acc = stripe.Account.retrieve(account.stripe_account)
        can_take_money = acc.get("capabilities", {}).get("transfers") == "active"
        needs_attention = (
            len(acc.get("requirements", {}).get("currently_due", ["..."])) > 0
        )
        details_submitted = acc.get("details_submitted")
    except Exception as error:
        raise VendingError("stripe-account-retrieval-failed") from error

    return VendingStatus(
        status="ok",
        can_take_payments=can_take_money,
        needs_attention=needs_attention,
        details_submitted=details_submitted,
    )


@router.post("/status/onboarding")
def start_onboarding(data: VendingOnboardingRequest, login=Depends(login_state)):
    """
    Start or continue the onboarding process.
    """

    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    account = StripeExpressAccount.by_user(db, login["user"])

    try:
        userid = login["user"].id
        if account is None:
            acc = stripe.Account.create(
                idempotency_key=f"account-{userid}",
                type="express",
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
            )
            account = StripeExpressAccount(user=userid, stripe_account=acc["id"])
            db.session.add(account)
            db.session.commit()
        else:
            acc = stripe.Account.retrieve(account.stripe_account)
        link = stripe.AccountLink.create(
            account=acc["id"],
            refresh_url=data.return_url,
            return_url=data.return_url,
            type="account_onboarding",
        )
        return VendingRedirect(status="ok", target_url=link["url"])
    except Exception as error:
        raise VendingError("stripe-account-create-failed") from error


@router.get("/status/dashboardlink")
def get_dashboard_link(login=Depends(login_state)) -> VendingRedirect:
    """
    Retrieve a link to the logged in user's Stripe express dashboard.

    The user must be logged in and must have onboarded.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    account = StripeExpressAccount.by_user(db, login["user"])
    if account is None:
        raise VendingError("not-onboarded")

    try:
        link = stripe.Account.create_login_link(account.stripe_account)
        return VendingRedirect(status="ok", target_url=link["url"])
    except Exception as error:
        raise VendingError("stripe-link-create-failed") from error


@router.get("app/{appid}")
def get_app_vending_status(appid: str) -> VendingDescriptor:
    """
    Retrieve the vending status for the given application.  Returns an error if
    the appid is not known, or is not set up for vending.
    """
    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend:
        raise VendingError(error="not-found")
    try:
        shares = prices.compute_shares(appid, vend.appshare)
    except ValueError as val_err:
        raise VendingError(error="bad-app-share") from val_err

    (
        fee_fixed_cost,
        fee_cost_percent,
        fee_prefer_percent,
    ) = prices.flathub_fee_parameters(vend.currency)

    return VendingDescriptor(
        status="ok",
        currency=vend.currency,
        components=shares,
        fee_fixed_cost=fee_fixed_cost,
        fee_cost_percent=fee_cost_percent,
        fee_prefer_percent=fee_prefer_percent,
    )


@router.post("app/{appid}/setup")
def post_app_vending_setup(
    appid: str, setup: VendingSetup, login=Depends(login_state)
) -> VendingDescriptor:
    """
    Create/update the vending status for a given application.  Returns an error
    if the appid is not known, or if it's already set up for vending with a
    user other than the one calling this API.

    If you do not have the right to set the vending status for this application
    then you will also be refused.

    In addition, if any of the currency or amount values constraints are violated
    then you will get an error
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend:
        # TODO: Check that the calling user owns the given appid
        # TODO: Verify that the calling user is onboarded with stripe
        vend = ApplicationVendingConfig(
            user=login["user"].id,
            appid=appid,
            currency=setup.currency,
            appshare=setup.appshare,
            recommended_donation=setup.recommended_donation,
            minimum_payment=setup.minimum_payment,
        )
    else:
        if vend.user != login["user"]:
            raise VendingError(error="user-mismatch")
        vend.currency = setup.currency
        vend.appshare = setup.appshare
        vend.recommended_donation = setup.recommended_donation
        vend.minimum_payment = setup.minimum_payment
    try:
        db.session.add(vend)
        db.session.commit()
    except Exception as base_exc:
        raise VendingError(error="bad-values") from base_exc

    return get_app_vending_status(appid)


@router.get("app/{appid}/{currency}/{value}")
def get_app_vending_split(appid: str, currency: str, value: int) -> VendingSplit:
    """
    Retrieve the actual split which would be invoked if the user specified that
    they wished to spend the given amount on the given appid.  Note this is not
    the exact shape that an invoice would have since donation vs. purchase may
    need to be taken into account.
    """
    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend:
        raise VendingError(error="not-found")
    if vend.currency != currency:
        raise VendingError(error="bad-currency")

    try:
        shares = prices.compute_app_shares(value, currency, appid, vend.appshare)
    except ValueError as val_err:
        raise VendingError(error="bad-app-share") from val_err

    if shares[0][1] < vend.minimum_payment:
        raise VendingError(error="bad-value")

    return VendingSplit(status="ok", currency=currency, splits=shares)


@router.post("app/{appid}")
def post_app_vending_status(
    request: Request, appid: str, data: ProposedPayment, login=Depends(login_state)
) -> VendingOutput:
    """
    Construct a transaction for the given application with the proposed payment.
    If the proposed payment is unacceptable then an error will be returned.
    If the user is not logged in, then an error will be returned.

    Otherwise a transaction will be created and the information about it will be
    returned in the output of the call.
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend:
        raise VendingError(error="not-found")

    split = get_app_vending_split(appid, data.currency, data.amount)

    try:
        txn = Transaction.create_from_split(
            db, login["user"], vend.minimum_payment > 0, split.currency, split.splits
        )
        db.session.flush()
        full_txn = Wallet().transaction(request, login["user"], txn.id)
    except WalletError:
        raise
    except Exception as base_exc:
        raise VendingError(error="bad-transaction") from base_exc

    return VendingOutput(status="ok", transaction=full_txn.summary.id)


def register_to_app(app: FastAPI):
    """
    Register the vending APIs with the FastAPI application

    This is reliant on session and DB middlewares, and the login support being registered.
    """

    # Refuse to load if stripe configuration unavailable

    if any(
        blank
        in [
            settings.stripe_secret_key,
            settings.stripe_public_key,
            settings.stripe_webhook_key,
        ]
        for blank in [None, ""]
    ):
        print("Stripe configuration is missing, refusing to add vending APIs")
        return
    else:
        stripe.api_key = settings.stripe_secret_key

    app.include_router(router)
    app.add_exception_handler(VendingError, vendingerror_exception_handler)
