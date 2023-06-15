import base64
from datetime import datetime, timedelta
from uuid import uuid4

import gi
import jwt
from fastapi import APIRouter, Body, Depends, FastAPI
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import db as sqldb
from gi.repository import AppStream  # type: ignore
from pydantic import BaseModel

from . import config, logins, models, summary
from .db import get_json_key
from .verification import VerificationStatus, get_verification_status, is_appid_runtime

gi.require_version("AppStream", "1.0")


router = APIRouter(prefix="/purchases")


class PricingInfo(BaseModel):
    recommended_donation: int | None
    minimum_payment: int | None


class StorefrontInfo(BaseModel):
    verification: VerificationStatus | None
    pricing: PricingInfo | None
    is_free_software: bool | None


@router.get("/storefront-info", status_code=200, response_model_exclude_none=True)
def get_storefront_info(app_id: str) -> StorefrontInfo:
    """
    This endpoint is used by the flathub-hooks scripts to get information about an app to insert into the appstream
    file and commit metadata.
    """

    result = StorefrontInfo()

    if parent_id := summary.get_parent_id(app_id):
        app_id = parent_id

    verification = get_verification_status(app_id)
    if verification.verified:
        result.verification = verification

    if is_appid_runtime(app_id):
        result.is_free_software = True
        return result

    appstream = get_json_key(f"apps:{app_id}")
    if appstream is None:
        return result

    if app := models.ApplicationVendingConfig.by_appid(sqldb, app_id):
        result.pricing = PricingInfo()
        if app.recommended_donation > 0:
            result.pricing.recommended_donation = app.recommended_donation
        if app.minimum_payment > 0:
            result.pricing.minimum_payment = app.minimum_payment

    # Determine whether the app is FOSS
    app_licence = appstream.get("project_license", "")
    result.is_free_software = app_licence and AppStream.license_is_free_license(
        app_licence
    )

    return result


@router.get("/storefront-info/is-free-software", status_code=200)
def get_is_free_software(app_id: str, license: str | None = None) -> bool:
    """
    Gets whether the app is Free Software based on the app ID and license, even if the app is not in the appstream
    database yet. This is needed in flat-manager-hooks to run validations the first time an app is uploaded.
    """
    if is_appid_runtime(app_id):
        return True
    if license and AppStream.license_is_free_license(license):
        return True
    return False


@router.post("/generate-update-token", status_code=200)
def get_update_token(login=Depends(logins.login_state)):
    """
    Generates an update token for a user account. This token allows the user to generate download tokens for apps they
    already own, but does not grant permission to do anything else. By storing this token, flathub-authenticator is
    able to update apps without user interaction.
    """

    if not login["state"].logged_in():
        return JSONResponse({"detail": "not_logged_in"}, status_code=401)
    user = login["user"]

    encoded = jwt.encode(
        {
            "token-id": str(uuid4()),
            "user-id": user.id,
            "exp": datetime.utcnow() + timedelta(days=180),
        },
        base64.b64decode(config.settings.update_token_secret),
        algorithm="HS256",
    )

    return {
        "token": encoded,
    }


def _check_purchases(appids: list[str], user_id: int):
    def canon_app_id(app_id: str):
        # For .Locale, .Debug, etc. refs, we only check the base app ID. However, when we generate the token, we still
        # need to include the suffixed version.
        auto_suffixes = ["Locale", "Debug"]

        for suffix in auto_suffixes:
            if app_id.endswith("." + suffix):
                return app_id.removesuffix("." + suffix)
        return app_id

    canon_appids = list(set([canon_app_id(app_id) for app_id in appids]))

    unowned = [
        app_id
        for app_id in canon_appids
        if not models.UserOwnedApp.user_owns_app(sqldb, user_id, app_id)
    ]

    if len(unowned) != 0:
        return JSONResponse(
            {
                "detail": "purchase_necessary",
                "missing_appids": unowned,
            },
            status_code=403,
        )


@router.post("/check-purchases", status_code=200)
def check_purchases(appids: list[str], login=Depends(logins.login_state)):
    """
    Checks whether the logged in user is able to download all of the given app refs.

    App IDs can be in the form of full refs, e.g. "app/org.gnome.Maps/x86_64/stable", or just the app ID, e.g.
    "org.gnome.Maps".
    """

    if not login["state"].logged_in():
        return JSONResponse({"detail": "not_logged_in"}, status_code=401)

    # We get full ref names, e.g. app/org.gnome.Maps/x86_64/master, but we just want the app ID part.
    try:
        appids = [
            app_id.split("/")[1] if "/" in app_id else app_id for app_id in appids
        ]
    except IndexError:
        return JSONResponse(
            {
                "detail": "invalid_app_id",
            },
            status_code=400,
        )

    if error := _check_purchases(appids, login["user"].id):
        return error

    return JSONResponse({"status": "ok"})


@router.post("/generate-download-token", status_code=200)
def get_download_token(appids: list[str], update_token: str = Body(None)):
    """
    Generates a download token for the given app IDs. App IDs should be in the form of full refs, e.g.
    "app/org.gnome.Maps/x86_64/stable".
    """

    try:
        claims = jwt.decode(
            update_token,
            base64.b64decode(config.settings.update_token_secret),
            algorithms=["HS256"],
        )
    except jwt.PyJWTError:
        return JSONResponse(
            {
                "detail": "invalid_token",
            },
            status_code=401,
        )

    try:
        appids = [app_id.split("/")[1] for app_id in appids]
    except IndexError:
        return JSONResponse(
            {
                "detail": "invalid_app_id",
            },
            status_code=400,
        )

    if error := _check_purchases(appids, claims["user-id"]):
        return error

    encoded = jwt.encode(
        {
            "sub": "download",
            "exp": datetime.utcnow() + timedelta(hours=24),
            "apps": appids,
        },
        base64.b64decode(config.settings.flat_manager_secret),
        algorithm="HS256",
    )

    # Generate a new update token so the client can continue updating apps non-interactively.
    new_update_token = jwt.encode(
        {
            # re-use the token id, just set a new expiration date
            "token-id": claims["token-id"],
            "user-id": claims["user-id"],
            "exp": datetime.utcnow() + timedelta(days=180),
        },
        base64.b64decode(config.settings.update_token_secret),
        algorithm="HS256",
    )

    return {
        "token": encoded,
        "update-token": new_update_token,
    }


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application
    """
    app.include_router(router)
