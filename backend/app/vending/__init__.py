"""
The /vending API is here to permit app authors to take donations and payments

The core vending behaviours are:

1. Onboarding / maintaining a Stripe account capable of receiving transfers
2. Accessing the express account onboarding/update flow and dashboard
3. Configuring the donation / purchase settings for an application
4. For purchased apps, producing grant tokens which can be redeemed by other
   users so as to not need to pay money for access (e.g. beta testers)
"""

import datetime
from math import ceil
from typing import Literal

import gi
import stripe
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .. import worker
from ..config import settings
from ..database import get_db, get_json_key
from ..logins import login_state
from ..models import (
    ApplicationVendingConfig,
    Pagination,
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
        elif self.error == "republish failed":
            return JSONResponse(
                {"status": "error", "error": self.error}, status_code=500
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

    status: Literal["ok"]
    platforms: dict[str, Platform]
    fee_fixed_cost: int
    fee_cost_percent: int
    fee_prefer_percent: int


class VendingDescriptor(BaseModel):
    """
    Vending descriptor for an application
    """

    status: str
    currency: str
    components: list[tuple[str, int]]

    fee_fixed_cost: int
    fee_cost_percent: int
    fee_prefer_percent: int


class VendingSplit(BaseModel):
    """
    Vending split for a given app at a given amount of money
    """

    status: str
    currency: str
    splits: list[tuple[str, int]]


class VendingSetupRequest(BaseModel):
    """
    Configuration for a vended application
    """

    currency: str
    appshare: int
    recommended_donation: int
    minimum_payment: int


class VendingSetup(BaseModel):
    """
    Configuration for a vended application
    """

    status: Literal["ok", "no-config"]
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

    app_id: str
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
        print("Vending Error caused by:")
        print(exc.__cause__)
    return exc.as_jsonresponse()


router = APIRouter(prefix="/vending")


@router.get(
    "/status",
    tags=["vending"],
    responses={
        200: {"model": VendingStatus},
        201: {"description": "User never began onboarding"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in"},
        500: {"description": "Internal server error"},
    },
)
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
    with get_db("replica") as db:
        account = StripeExpressAccount.by_user(db, login["user"])
        if account is None:
            return VendingStatus(
                status="no-stripe-account",
                can_take_payments=False,
                needs_attention=False,
                details_submitted=False,
            )

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


@router.post(
    "/status/onboarding",
    tags=["vending"],
    responses={
        200: {"description": "Onboarding completed successfully"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def start_onboarding(
    data: VendingOnboardingRequest, login=Depends(login_state)
) -> VendingRedirect:
    """
    Start or continue the onboarding process.
    """

    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    with get_db("writer") as db:
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
                db.add(account)
                db.commit()
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


@router.get(
    "/status/dashboardlink",
    tags=["vending"],
    responses={
        200: {"model": VendingRedirect},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in"},
        404: {"description": "Not onboarded"},
        500: {"description": "Internal server error"},
    },
)
def get_dashboard_link(login=Depends(login_state)) -> VendingRedirect:
    """
    Retrieve a link to the logged in user's Stripe express dashboard.

    The user must be logged in and must have onboarded.
    """
    if not login["state"].logged_in():
        return JSONResponse(
            {"status": "error", "error": "not logged in"}, status_code=403
        )
    with get_db("replica") as db:
        account = StripeExpressAccount.by_user(db, login["user"])
        if account is None:
            raise VendingError("not-onboarded")

        try:
            link = stripe.Account.create_login_link(account.stripe_account)
            return VendingRedirect(status="ok", target_url=link["url"])
        except Exception as error:
            raise VendingError("stripe-link-create-failed") from error


@router.get(
    "/config",
    tags=["vending"],
    responses={
        200: {"model": VendingConfig},
        500: {"description": "Internal server error"},
    },
)
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


@router.get(
    "app/{app_id}/setup",
    tags=["vending"],
    responses={
        200: {"model": VendingSetup},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_app_vending_setup(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    login=Depends(login_state),
) -> VendingSetup:
    """
    Retrieve the vending status for a given application.
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    with get_db("replica") as db:
        vend = ApplicationVendingConfig.by_appid(db, app_id)
        if not vend:
            return VendingSetup(
                status="no-config",
                currency="usd",
                appshare=50,
                recommended_donation=0,
                minimum_payment=0,
            )

    return VendingSetup(
        status="ok",
        currency=vend.currency,
        appshare=vend.appshare,
        recommended_donation=vend.recommended_donation,
        minimum_payment=vend.minimum_payment,
    )


@router.post(
    "app/{app_id}/setup",
    tags=["vending"],
    responses={
        200: {"model": VendingSetup},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in or permission denied"},
        404: {"description": "App not found or not onboarded"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def post_app_vending_setup(
    setup: VendingSetupRequest,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    login=Depends(login_state),
) -> VendingSetup:
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

    with get_db("writer") as db:
        if app_id not in login["user"].dev_flatpaks(db):
            raise VendingError(error="permission-denied")

        stripe_account = StripeExpressAccount.by_user(db, login["user"])
        if not stripe_account:
            raise VendingError(error="not-onboarded")

        vend = ApplicationVendingConfig.by_appid(db, app_id)
        if not vend and setup.recommended_donation > 0:
            vend = ApplicationVendingConfig(
                user=login["user"].id,
                appid=app_id,
                currency=setup.currency,
                appshare=setup.appshare,
                recommended_donation=setup.recommended_donation,
                minimum_payment=setup.minimum_payment,
            )
        elif setup.recommended_donation > 0:
            if vend.user != login["user"].id:
                raise VendingError(error="user-mismatch")
            if vend:
                vend.currency = setup.currency
                vend.appshare = setup.appshare
                vend.recommended_donation = setup.recommended_donation
                vend.minimum_payment = setup.minimum_payment
        try:
            if setup.recommended_donation > 0:
                db.add(vend)
            elif vend:
                db.delete(vend)
            db.commit()
        except Exception as base_exc:
            raise VendingError(error="bad-values") from base_exc

    worker.republish_app.send(app_id)
    return get_app_vending_setup(app_id, login)


@router.post(
    "app/{app_id}",
    tags=["vending"],
    responses={
        200: {"model": VendingOutput},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def post_app_vending_status(
    request: Request,
    data: ProposedPayment,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    login=Depends(login_state),
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

    with get_db("replica") as db:
        vend = ApplicationVendingConfig.by_appid(db, app_id)
        if not vend:
            raise VendingError(error="not-found")
        if vend.currency != data.currency:
            raise VendingError(error="bad-currency")
        if data.amount < vend.minimum_payment:
            raise VendingError(error="bad-value")

    try:
        shares = prices.compute_app_shares(
            data.amount, data.currency, app_id, vend.appshare
        )
    except ValueError as val_err:
        raise VendingError(error="bad-app-share") from val_err

    try:
        with get_db("writer") as db:
            txn = Transaction.create_from_split(
                db, login["user"], vend.minimum_payment > 0, data.currency, shares
            )
            db.commit()
            full_txn = Wallet().transaction(request, login["user"], txn.id)
    except WalletError:
        raise
    except Exception as base_exc:
        raise VendingError(error="bad-transaction") from base_exc

    return VendingOutput(status="ok", transaction=full_txn.summary.id)


# Redeemable token APIs


class TokenModel(BaseModel):
    id: str
    state: Literal["unredeemed", "redeemed", "cancelled"]
    name: str
    token: str | None = None
    created: datetime.datetime
    changed: datetime.datetime


class TokenList(BaseModel):
    status: str
    tokens: list[TokenModel]
    pagination: Pagination


@router.get(
    "app/{app_id}/tokens",
    tags=["vending"],
    responses={
        200: {"model": TokenList},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in or permission denied"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_redeemable_tokens(
    request: Request,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    page: int = 1,
    page_size: int = 10,
    login=Depends(login_state),
) -> TokenList:
    """
    Retrieve the redeemable tokens for the given application.

    The caller must have control of the app at some level

    Tokens are paginated with default page_size of 10
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    with get_db("replica") as db:
        if app_id not in login["user"].dev_flatpaks(db):
            raise VendingError(error="permission-denied")

    tokens = []
    with get_db("replica") as db:
        offset = (page - 1) * page_size
        query = RedeemableAppToken.by_appid(db, app_id, True)

        total_count = len(query)

        paginated_tokens = query[offset : offset + page_size]

        for token in paginated_tokens:
            tokens.append(
                TokenModel(
                    id=str(token.id),
                    state=token.state,
                    name=token.name,
                    created=token.created,
                    changed=token.changed,
                    token=token.token,
                )
            )

    return TokenList(
        status="ok",
        tokens=tokens,
        pagination=Pagination(
            page=page,
            page_size=page_size,
            total=total_count,
            total_pages=ceil(total_count / page_size) if total_count > 0 else 0,
        ),
    )


@router.post(
    "app/{app_id}/tokens",
    tags=["vending"],
    responses={
        200: {"model": list[TokenModel]},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in or permission denied"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def create_tokens(
    request: Request,
    data: list[str],
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    login=Depends(login_state),
) -> list[TokenModel]:
    """
    Create some tokens for the given appid.

    The calling user must own the vending config for this application
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    with get_db("replica") as db:
        vend = ApplicationVendingConfig.by_appid(db, app_id)
        if not vend:
            raise VendingError(error="invalid-appid")
        if vend.user != login["user"].id:
            raise VendingError(error="permission-denied")

    tokens = []
    with get_db("writer") as db:
        for name in data:
            token = RedeemableAppToken.create(db, app_id, name)
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

        db.commit()
    return tokens


class TokenCancellation(BaseModel):
    token: str
    status: Literal["invalid", "cancelled", "error"]


@router.post(
    "app/{app_id}/tokens/cancel",
    tags=["vending"],
    responses={
        200: {"model": list[TokenCancellation]},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in or permission denied"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def cancel_tokens(
    request: Request,
    data: list[str],
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    login=Depends(login_state),
) -> list[TokenCancellation]:
    """
    Cancel a set of tokens
    """

    if not login["state"].logged_in():
        raise VendingError(error="not-logged-in")

    with get_db("replica") as db:
        vend = ApplicationVendingConfig.by_appid(db, app_id)
        if not vend:
            raise VendingError(error="invalid-appid")
        if vend.user != login["user"].id:
            raise VendingError(error="permission-denied")

    ret = []
    with get_db("writer") as db:
        for token_str in data:
            token = RedeemableAppToken.by_appid_and_token(db, app_id, token_str)
            if token is None:
                ret.append(TokenCancellation(token=token_str, status="invalid"))
            else:
                try:
                    token.cancel(db)
                    db.commit()
                    ret.append(TokenCancellation(token=token_str, status="cancelled"))
                except Exception as base_exc:
                    print(f"Failure cancelling {token_str} for {app_id}: {base_exc}")
                    ret.append(TokenCancellation(token=token_str, status="error"))

    return ret


class RedemptionResult(BaseModel):
    status: str
    reason: str


@router.post(
    "app/{app_id}/tokens/redeem/{token}",
    tags=["vending"],
    responses={
        200: {"model": RedemptionResult},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not logged in or permission denied"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def redeem_token(
    request: Request,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    token: str = Path(min_length=6, examples=["abc123"]),
    login=Depends(login_state),
) -> RedemptionResult:
    """
    This redeems the given token for the logged in user.

    If the logged in user already owns the app then the token will not be redeemed
    """

    if not login["state"].logged_in():
        return RedemptionResult(status="failure", reason="not-logged-in")

    with get_db("replica") as db:
        dbtoken = RedeemableAppToken.by_appid_and_token(db, app_id, token)
        if dbtoken is not None and dbtoken.state == RedeemableAppTokenState.UNREDEEMED:
            with get_db("writer") as db:
                if dbtoken.redeem(db, login["user"]):
                    db.commit()
                    return RedemptionResult(status="success", reason="redeemed")
                else:
                    return RedemptionResult(status="failure", reason="already-owned")

    return RedemptionResult(status="failure", reason="invalid")


# Tax and other real-world problems are associated with things like an
# application's type, licence, etc.
# This heuristic tries to tell us about the app, and why we made that decision
@router.get(
    "app/{app_id}/info",
    tags=["vending"],
    responses={
        200: {"model": VendingApplicationInformation},
        401: {"description": "Unauthorized"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def app_info(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
) -> VendingApplicationInformation:
    """
    This determines the vending info for the app and returns it
    """

    appstream = get_json_key(f"apps:{app_id}")
    if appstream is None:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    print(f"Found {app_id}: {repr(appstream)}")

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
        app_id=app_id,
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

    stripe.api_key = settings.stripe_secret_key

    app.include_router(router)
    app.add_exception_handler(VendingError, vendingerror_exception_handler)
