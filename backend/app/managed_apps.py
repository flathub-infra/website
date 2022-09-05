import base64
import typing as T
from datetime import datetime, timedelta
from enum import Enum

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import db as sqldb
from pydantic import BaseModel, validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func

from . import config, models, verification
from .logins import login_state


class ErrorDetail(str, Enum):
    # You must be logged in
    NOT_LOGGED_IN = "not_logged_in"
    # The app ID is not syntactically correct
    MALFORMED_APP_ID = "malformed_app_id"
    # The app is already registered on github.com/flathub
    APP_ALREADY_EXISTS = "app_already_exists"
    # The app has already been registered as a managed app
    MANAGED_APP_ALREADY_EXISTS = "managed_app_already_exists"
    # The server could not connect to GitHub.
    ERROR_CONNECTING_TO_GITHUB = "error_connecting_to_github"
    # The app ID couldn't be verified.
    COULD_NOT_VERIFY = "could_not_verify"
    # The requested expiration date for the token is too far in the future (or is <= 0)
    BAD_TOKEN_EXPIRATION = "bad_token_expiration"
    # The current user is not permitted to access this app
    FORBIDDEN = "forbidden"
    # The app doesn't exist or isn't a managed app
    APP_DOES_NOT_EXIST = "app_does_not_exist"
    # The .well-known/org.flathub.VerifiedApps.txt file for website verification needs to have the user's ID as well
    # as the app ID, e.g. for user #1:
    # org.flatpak.Hello,1
    WEBSITE_VERIFICATION_REQUIRES_USER_ID = "website_verification_requires_user_id"
    # The .well-known/org.flathub.VerifiedApps.txt file for website verification lists a different user ID for the
    # app than the current user's ID.
    WEBSITE_VERIFICATION_WRONG_USER_ID = "website_verification_wrong_user_id"


# Routes
router = APIRouter(prefix="/managed_apps", tags=["managed_apps"])


@router.get("/", status_code=200)
def get_managed_apps(login=Depends(login_state)):
    """
    Gets the list of apps managed by this user. Managed apps are those that are uploaded by this user, not community
    repos from github.com/flathub.

    Note: if an app was recently created, it may not be in the appstream data yet.
    """

    if not login["state"].logged_in():
        raise HTTPException(status_code=403, detail="not_logged_in")

    apps = models.ManagedApp.all_by_user(sqldb, login["user"])

    return JSONResponse({"apps": [{"app_id": app.app_id} for app in apps]})


@router.post("/")
def create_managed_app(appid: str, login=Depends(login_state)):
    """
    Creates a new managed app.
    """

    if not login["state"].logged_in():
        raise HTTPException(status_code=401, detail="not_logged_in")

    # Make sure the app ID is valid and the app doesn't already exist
    if not verification.is_valid_app_id(appid):
        raise HTTPException(status_code=403, detail=ErrorDetail.MALFORMED_APP_ID)
    elif models.ManagedApp.by_app_id(sqldb, appid) is not None:
        raise HTTPException(
            status_code=403, detail=ErrorDetail.MANAGED_APP_ALREADY_EXISTS
        )
    elif verification.is_github_app(appid):
        raise HTTPException(status_code=403, detail=ErrorDetail.APP_ALREADY_EXISTS)

    # Verify the app ID, same as verifying a github.com/flathub app
    if (verify_info := verification.check_website_verification(appid)).verified:
        if verify_info.user_id is None:
            raise HTTPException(
                status_code=403,
                detail=ErrorDetail.WEBSITE_VERIFICATION_REQUIRES_USER_ID,
            )
        elif verify_info.user_id != login["user"].id:
            raise HTTPException(
                status_code=403, detail=ErrorDetail.WEBSITE_VERIFICATION_WRONG_USER_ID
            )

    elif verification.is_verifiable_by_account(appid):
        verification.verify_by_account(appid, login)

        verified_app = models.UserVerifiedApp(
            app_id=appid, account=login["user"].id, created=func.now()
        )

        try:
            sqldb.session.add(verified_app)
            sqldb.session.commit()
        except IntegrityError:
            raise HTTPException(status_code=400, detail=ErrorDetail.APP_ALREADY_EXISTS)

    else:
        raise HTTPException(status_code=403, detail=ErrorDetail.COULD_NOT_VERIFY)

    managed_app = models.ManagedApp(
        app_id=appid, owner=login["user"].id, created=func.now()
    )
    try:
        sqldb.session.add(managed_app)
        sqldb.session.commit()
    except IntegrityError:
        raise HTTPException(
            status_code=400, detail=ErrorDetail.MANAGED_APP_ALREADY_EXISTS
        )

    return Response(status_code=204)


class BuildTokenRequest(BaseModel):
    display_name: T.Optional[str] = None
    expiration: int = 90

    @validator("expiration")
    def expires_soon_enough(cls, val):
        if val <= 0 or val > 180:
            raise HTTPException(
                status_code=400, detail=ErrorDetail.BAD_TOKEN_EXPIRATION
            )
        return val


def _check_managed_app_access(appid: str, login):
    if not login["state"].logged_in():
        raise HTTPException(status_code=401, detail="not_logged_in")

    managed_app = models.ManagedApp.by_app_id(sqldb, appid)
    if managed_app is None:
        raise HTTPException(status_code=404, detail=ErrorDetail.APP_DOES_NOT_EXIST)
    elif managed_app.owner != login["user"].id:
        raise HTTPException(status_code=403, detail=ErrorDetail.FORBIDDEN)


@router.get("/{appid}/build-tokens", status_code=200)
def list_build_tokens(appid: str, login=Depends(login_state)):
    """
    Lists metadata for all build tokens for the given app. This doesn't give access to the tokens themselves, just the
    metadata.
    """

    _check_managed_app_access(appid, login)

    tokens = models.BuildToken.by_app_id(sqldb, appid)
    return {
        "tokens": [
            {
                "id": token.id,
                "display_name": token.display_name,
                "user_id": token.user_id,
                "app_id": token.app_id,
                "scopes": token.scopes,
                "repos": token.repos,
                "created": token.created,
                "expires": token.expires,
            }
            for token in tokens
        ]
    }


@router.post("/{appid}/build-tokens", status_code=200)
def create_build_token(
    appid: str, request: BuildTokenRequest, login=Depends(login_state)
):
    """
    Creates a build token for the given app.
    """

    _check_managed_app_access(appid, login)

    created = datetime.utcnow()
    expires = created + timedelta(days=request.expiration)

    models.BuildToken.housekeeping(sqldb)

    build_token_row = models.BuildToken(
        user_id=login["user"].id,
        app_id=appid,
        display_name=request.display_name,
        scopes="build upload publish",
        repos="stable",
        created=created,
        expires=expires,
    )

    sqldb.session.add(build_token_row)
    sqldb.session.commit()

    encoded = jwt.encode(
        {
            "jti": str(build_token_row.id),
            "sub": "build",
            "name": build_token_row.display_name,
            "prefixes": [build_token_row.app_id],
            "scope": build_token_row.scopes.split(" "),
            "repos": build_token_row.repos.split(" "),
            "iat": build_token_row.created,
            "exp": build_token_row.expires,
        },
        base64.b64decode(config.settings.flat_manager_build_secret),
        algorithm="HS256",
    )

    return {
        "token": encoded,
    }


def register_to_app(app: FastAPI):
    app.include_router(router)
