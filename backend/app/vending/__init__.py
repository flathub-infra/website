"""
The /vending API is here to permit app authors to take donations and payments

The core vending behaviours are:

1. Onboarding / maintaining a Stripe account capable of receiving transfers
2. Accessing the express account onboarding/update flow and dashboard
3. Configuring the donation / purchase settings for an application
4. For purchased apps, producing grant tokens which can be redeemed by other
   users so as to not need to pay money for access (e.g. beta testers)
"""

from typing import Dict, List, Literal, Optional, Tuple

import gi
import stripe
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import db
from pydantic import BaseModel

from ..config import settings
from ..db import get_json_key
from ..logins import login_state
from ..models import (
    ApplicationVendingConfig,
    RedeemableAppToken,
    RedeemableAppTokenState,
    StripeExpressAccount,
    Transaction,
)
from ..utils import PLATFORMS, Platform
from ..vending import prices
from ..wallet import Wallet, WalletError

gi.require_version("AppStream", "1.0")

from gi.repository import AppStream


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


class VendingConfig(BaseModel):
    """
    Global vending environment configuration values
    """

    status: str
    platforms: Dict[str, Platform]
    fee_fixed_cost: int
    fee_cost_percent: int
    fee_prefer_percent: int


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


class VendingApplicationInformation(BaseModel):
    """
    Information about an app, including tax code etc
    """

    appid: str
    kind: Literal["GAME", "PRODUCTIVITY", "GENERIC"]
    kind_reason: str
    foss: bool
    foss_reason: str


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


@router.get("/config")
def get_global_vending_config() -> VendingConfig:
    """
    Retrieve the configuration values needed to calculate application
    vending splits client-side.

    Configuration includes:
    - Fee values
    - Platform values
    """
    (
        fee_fixed_cost,
        fee_cost_percent,
        fee_prefer_percent,
    ) = prices.flathub_fee_parameters("usd")

    return VendingConfig(
        status="ok",
        platforms=PLATFORMS,
        fee_fixed_cost=fee_fixed_cost,
        fee_cost_percent=fee_cost_percent,
        fee_prefer_percent=fee_prefer_percent,
    )


@router.get("app/{appid}/setup")
def get_app_vending_setup(appid: str, login=Depends(login_state)) -> VendingDescriptor:
    """
    Retrieve the vending status for a given application.  Returns a no
    content response if the appid has no vending setup.
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend:
        return Response(status_code=204)

    return VendingSetup(
        status="ok",
        currency=vend.currency,
        appshare=vend.appshare,
        recommended_donation=vend.recommended_donation,
        minimum_payment=vend.minimum_payment,
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

    if appid not in login["user"].dev_flatpaks(db):
        raise VendingError(error="permission-denied")

    stripe_account = StripeExpressAccount.by_user(db, login["user"])
    if not stripe_account:
        raise VendingError(error="not-onboarded")

    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend and setup.recommended_donation > 0:
        vend = ApplicationVendingConfig(
            user=login["user"].id,
            appid=appid,
            currency=setup.currency,
            appshare=setup.appshare,
            recommended_donation=setup.recommended_donation,
            minimum_payment=setup.minimum_payment,
        )
    elif setup.recommended_donation > 0:
        if vend.user != login["user"].id:
            raise VendingError(error="user-mismatch")
        vend.currency = setup.currency
        vend.appshare = setup.appshare
        vend.recommended_donation = setup.recommended_donation
        vend.minimum_payment = setup.minimum_payment
    try:
        if setup.recommended_donation > 0:
            db.session.add(vend)
        elif vend:
            db.session.delete(vend)
        db.session.commit()
    except Exception as base_exc:
        raise VendingError(error="bad-values") from base_exc

    return get_app_vending_setup(appid, login)


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
    if vend.currency != data.currency:
        raise VendingError(error="bad-currency")
    if data.amount < vend.minimum_payment:
        raise VendingError(error="bad-value")

    try:
        shares = prices.compute_app_shares(
            data.amount, data.currency, appid, vend.appshare
        )
    except ValueError as val_err:
        raise VendingError(error="bad-app-share") from val_err

    try:
        txn = Transaction.create_from_split(
            db, login["user"], vend.minimum_payment > 0, data.currency, shares
        )
        db.session.flush()
        full_txn = Wallet().transaction(request, login["user"], txn.id)
    except WalletError:
        raise
    except Exception as base_exc:
        raise VendingError(error="bad-transaction") from base_exc

    return VendingOutput(status="ok", transaction=full_txn.summary.id)


# Redeemable token APIs


class TokenModel(BaseModel):
    id: str
    state: str
    name: str
    token: Optional[str]
    created: str
    changed: str


class TokenList(BaseModel):
    status: str
    total: int
    tokens: List[TokenModel]


@router.get("app/{appid}/tokens")
def get_redeemable_tokens(
    request: Request, appid: str, login=Depends(login_state)
) -> TokenList:
    """
    Retrieve the redeemable tokens for the given application.

    The caller must have control of the app at some level

    For now, there is no pagination or filtering, all tokens will be returned
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    if appid not in login["user"].dev_flatpaks(db):
        raise VendingError(error="permission-denied")

    tokens = []
    for token in RedeemableAppToken.by_appid(db, appid, True):
        tokens.append(
            TokenModel(
                id=str(token.id),
                state=token.state,
                name=token.name,
                created=str(token.created),
                changed=str(token.changed),
                token=token.token,
            )
        )

    return TokenList(status="ok", total=len(tokens), tokens=tokens)


@router.post("app/{appid}/tokens")
def create_tokens(
    request: Request, appid: str, data: List[str], login=Depends(login_state)
) -> List[TokenModel]:
    """
    Create some tokens for the given appid.

    The calling user must own the vending config for this application
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend:
        raise VendingError(error="invalid-appid")
    if vend.user != login["user"].id:
        raise VendingError(error="permission-denied")

    tokens = []
    for name in data:
        token = RedeemableAppToken.create(db, appid, name)
        tokens.append(
            TokenModel(
                id=str(token.id),
                state=token.state,
                name=token.name,
                created=str(token.created),
                changed=str(token.changed),
                token=token.token,
            )
        )
    db.session.commit()
    return tokens


class TokenCancellation(BaseModel):
    token: str
    status: str


@router.post("app/{appid}/tokens/cancel")
def cancel_tokens(
    request: Request, appid: str, data: List[str], login=Depends(login_state)
) -> List[TokenCancellation]:
    """
    Cancel a set of tokens
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    vend = ApplicationVendingConfig.by_appid(db, appid)
    if not vend:
        raise VendingError(error="invalid-appid")
    if vend.user != login["user"].id:
        raise VendingError(error="permission-denied")

    ret = []
    for token_str in data:
        token = RedeemableAppToken.by_appid_and_token(db, appid, token_str)
        if token is None:
            ret.append(TokenCancellation(token=token_str, status="invalid"))
        else:
            try:
                token.cancel(db)
                db.session.commit()
                ret.append(TokenCancellation(token=token_str, status="cancelled"))
            except Exception as base_exc:
                print(f"Failure cancelling {token_str} for {appid}: {base_exc}")
                ret.append(TokenCancellation(token=token_str, status="error"))

    return ret


class RedemptionResult(BaseModel):
    status: str
    reason: str


@router.post("app/{appid}/tokens/redeem/{token}")
def redeem_token(
    request: Request, appid: str, token: str, login=Depends(login_state)
) -> RedemptionResult:
    """
    This redeems the given token for the logged in user.

    If the logged in user already owns the app then the token will not be redeemed
    """

    if not login["state"].logged_in():
        return RedemptionResult(status="failure", reason="not-logged-in")

    dbtoken = RedeemableAppToken.by_appid_and_token(db, appid, token)
    if dbtoken is not None:
        if dbtoken.state == RedeemableAppTokenState.UNREDEEMED:
            if dbtoken.redeem(db, login["user"]):
                db.session.commit()
                return RedemptionResult(status="success", reason="redeemed")
            else:
                return RedemptionResult(status="failure", reason="already-owned")

    return RedemptionResult(status="failure", reason="invalid")


# Tax and other real-world problems are associated with things like an
# application's type, licence, etc.
# This heuristic tries to tell us about the app, and why we made that decision
@router.get("app/{appid}/info")
def app_info(appid: str) -> VendingApplicationInformation:
    """
    This determines the vending info for the app and returns it
    """

    appstream = get_json_key(f"apps:{appid}")
    if appstream is None:
        raise HTTPException(status_code=404, detail=f"Application {appid} not found")
    print(f"Found {appid}: {repr(appstream)}")

    kind = "GENERIC"
    kind_reason = "unknown"
    foss = False
    foss_reason = "unknown"

    app_licence = appstream.get("project_license", "")
    if app_licence:
        foss = AppStream.license_is_free_license(app_licence)
        foss_reason = "According to AppStream.license_is_free_license"
    else:
        foss = False
        foss_reason = "Application does not have licence terms in appstream"

    app_cats = [cat.lower() for cat in appstream.get("categories", [])]
    if "game" in app_cats:
        kind = "GAME"
        kind_reason = "Found 'Game' in application categories"
    elif "office" in app_cats:
        kind = "PRODUCTIVITY"
        kind_reason = "Found 'Office' in application categories"
    else:
        kind = "GENERIC"
        kind_reason = f"Unable to categorise based on {repr(app_cats)}"

    return VendingApplicationInformation(
        appid=appid,
        kind=kind,
        kind_reason=kind_reason,
        foss=foss,
        foss_reason=foss_reason,
    )


# Registration


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
