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


import stripe
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import db
from pydantic import BaseModel

from ..config import settings
from ..logins import login_state
from ..models import StripeExpressAccount


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
    except Exception as error:
        raise VendingError("stripe-account-retrieval-failed") from error

    return VendingStatus(
        status="ok", can_take_payments=can_take_money, needs_attention=needs_attention
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
