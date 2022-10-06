import base64
from datetime import datetime, timedelta
from typing import List
from uuid import uuid4

import jwt
from fastapi import APIRouter, Body, Depends, FastAPI
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import db as sqldb

from . import config, logins, models

router = APIRouter(prefix="/purchases")


@router.get("/storefront-info", status_code=200)
def get_storefront_info(app_id: str):
    """
    This endpoint is used by flat-manager's storefront-info-endpoint config option. It returns the proper token-type
    for the commit (1 if payment is requested or required, 0 if it is not), some settings to validate the appstream
    file provided by the app, and some data to add to that appstream file.

    See storefront.rs in flat-manager for the available values.
    """

    token_type = 0
    if app := models.ApplicationVendingConfig.by_appid(sqldb, app_id):
        if app.recommended_donation > 0:
            token_type = 1

    return {
        "token_type": token_type,
    }


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


def _check_purchases(appids: List[str], user_id: int):
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
def check_purchases(appids: List[str], login=Depends(logins.login_state)):
    """
    Checks whether the logged in user is able to download all of the given app refs.

    App IDs should be in the form of full refs, e.g. "app/org.gnome.Maps/x86_64/stable".
    """

    if not login["state"].logged_in():
        return JSONResponse({"detail": "not_logged_in"}, status_code=401)

    # We get full ref names, e.g. app/org.gnome.Maps/x86_64/master, but we just want the app ID part.
    try:
        appids = [app_id.split("/")[1] for app_id in appids]
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
def get_download_token(appids: List[str], update_token: str = Body(None)):
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
