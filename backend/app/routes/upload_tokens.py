import base64
import datetime
from enum import Enum

import httpx
import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel

from .. import config, http_client, models, utils, worker
from ..database import get_db, get_json_key
from ..emails import EmailCategory
from ..login_info import login_state
from ..utils import jti

router = APIRouter(prefix="/upload-tokens")


class ErrorDetail(str, Enum):
    # The flat-manager endpoint is not configured
    FLAT_MANAGER_NOT_CONFIGURED = "flat_manager_not_configured"
    # flat-manager returned an error
    FLAT_MANAGER_ERROR = "flat_manager_error"
    # The user is not logged in
    NOT_LOGGED_IN = "not_logged_in"
    # The user is not a developer of the app
    NOT_APP_DEVELOPER = "not_app_developer"
    # One or more of the requested scopes is not allowed
    FORBIDDEN_SCOPE = "forbidden_scope"
    # One or more of the requested repos is not allowed
    FORBIDDEN_REPO = "forbidden_repo"
    # May not create upload tokens for the stable repo for apps with a github.com/flathub repository
    NOT_DIRECT_UPLOAD_APP = "not_direct_upload_app"
    # The token was not found
    TOKEN_NOT_FOUND = "token_not_found"
    # The app has been archived
    APP_ARCHIVED = "app_archived"


class TokenResponse(BaseModel):
    id: int
    comment: str

    app_id: str
    scopes: list[str]
    repos: list[str]

    issued_at: int
    issued_to: str | None
    expires_at: int
    revoked: bool


class NewTokenResponse(BaseModel):
    token: str
    details: TokenResponse


class TokensResponse(BaseModel):
    tokens: list[TokenResponse]
    is_direct_upload_app: bool


def _token_response(token: models.UploadToken, issued_to: str | None) -> TokenResponse:
    return TokenResponse(
        id=token.id,
        comment=token.comment,
        app_id=token.app_id,
        scopes=token.scopes.split(" "),
        repos=token.repos.split(" "),
        issued_at=int(token.issued_at.timestamp()),
        issued_to=issued_to,
        expires_at=int(token.expires_at.timestamp()),
        revoked=token.revoked,
    )


@router.get(
    "/{app_id}",
    status_code=200,
    tags=["upload-tokens"],
    responses={
        200: {"description": "Upload tokens for the app"},
        401: {"description": "Not logged in"},
        403: {"description": "Not an app developer"},
    },
)
def get_upload_tokens(
    app_id: str, include_expired: bool = False, login=Depends(login_state)
) -> TokensResponse:
    """
    Get all upload tokens for the given app
    """

    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)
    with get_db("replica") as db:
        if app_id not in login.user.dev_flatpaks(db):
            raise HTTPException(status_code=403, detail=ErrorDetail.NOT_APP_DEVELOPER)

    with get_db("replica") as db:
        tokens = (
            db.session.query(models.UploadToken, models.FlathubUser.display_name)
            .join(models.FlathubUser)
            .filter(models.UploadToken.app_id == app_id)
        )

        if not include_expired:
            tokens = tokens.filter(
                models.UploadToken.expires_at >= datetime.datetime.utcnow()
            )

        tokens = tokens.order_by(models.UploadToken.issued_at.desc())
        token_list = [(t, display_name) for t, display_name in tokens]

        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)

    return TokensResponse(
        tokens=[_token_response(t, display_name) for t, display_name in token_list],
        is_direct_upload_app=(direct_upload_app is not None),
    )


ALLOWED_SCOPES = ["build", "upload", "publish", "jobs"]
ALLOWED_REPOS = ["stable", "beta"]


class UploadTokenRequest(BaseModel):
    comment: str
    scopes: list[str]
    repos: list[str]


@router.post(
    "/{app_id}",
    status_code=200,
    tags=["upload-tokens"],
    responses={
        200: {"description": "Upload token created successfully"},
        400: {"description": "Invalid request parameters"},
        401: {"description": "Not logged in"},
        403: {"description": "Not an app developer"},
        500: {"description": "Flat manager not configured or server error"},
    },
)
def create_upload_token(
    app_id: str,
    request: UploadTokenRequest,
    login=Depends(login_state),
) -> NewTokenResponse:
    if not (
        config.settings.flat_manager_api and config.settings.flat_manager_build_secret
    ):
        raise HTTPException(
            status_code=500,
            detail=ErrorDetail.FLAT_MANAGER_NOT_CONFIGURED,
        )

    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)
    with get_db("replica") as db:
        if app_id not in login.user.dev_flatpaks(db):
            raise HTTPException(status_code=403, detail=ErrorDetail.NOT_APP_DEVELOPER)

    with get_db("replica") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app and direct_upload_app.archived:
            raise HTTPException(status_code=403, detail=ErrorDetail.APP_ARCHIVED)

    if "stable" in request.repos:
        # Only direct upload apps may create tokens for the stable repo.
        if direct_upload_app is None:
            raise HTTPException(
                status_code=403,
                detail=ErrorDetail.NOT_DIRECT_UPLOAD_APP,
            )

    if not all(s in ALLOWED_SCOPES for s in request.scopes):
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail.FORBIDDEN_SCOPE,
        )

    if not all(r in ALLOWED_REPOS for r in request.repos):
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail.FORBIDDEN_REPO,
        )

    issued_at = datetime.datetime.utcnow()
    issued_to = login.user
    expires_at = issued_at + datetime.timedelta(days=180)

    token = models.UploadToken(
        comment=request.comment,
        app_id=app_id,
        scopes=" ".join(request.scopes),
        repos=" ".join(request.repos),
        issued_at=issued_at,
        issued_to=issued_to.id,
        expires_at=expires_at,
    )

    with get_db("writer") as db:
        db.session.add(token)
        db.session.commit()
        token_details = _token_response(token, issued_to.display_name)

    encoded = jwt.encode(
        {
            "jti": f"backend_{token_details.id}",
            "sub": "build",
            "scope": request.scopes,
            "repos": request.repos,
            "prefixes": [app_id],
            "iat": issued_at,
            "exp": expires_at,
            "token_type": "app",
        },
        base64.b64decode(config.settings.flat_manager_build_secret),
        algorithm="HS256",
    )

    if config.settings.flat_manager_build_token_prefix is not None:
        encoded = config.settings.flat_manager_build_token_prefix + encoded

    if app_metadata := get_json_key(f"apps:{app_id}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    payload = {
        "messageId": f"{app_id}/{token_details.id}/issued",
        "creation_timestamp": datetime.datetime.now().timestamp(),
        "subject": "New upload token issued",
        "previewText": "New upload token issued",
        "messageInfo": {
            "category": EmailCategory.UPLOAD_TOKEN_CREATED,
            "appId": app_id,
            "appName": app_name,
            "issuedTo": issued_to.display_name,
            "comment": request.comment,
            "expiresAt": expires_at.strftime("%-d %B %Y"),
            "scopes": request.scopes,
            "repos": request.repos,
        },
    }

    worker.send_email_new.send(payload)

    return NewTokenResponse(
        token=encoded,
        details=token_details,
    )


@router.delete(
    "/{token_id}/revoke",
    status_code=204,
    tags=["upload-tokens"],
    responses={
        204: {"description": "Upload token revoked successfully"},
        401: {"description": "Not logged in"},
        403: {"description": "Not authorized to revoke this token"},
        404: {"description": "Token not found"},
        500: {"description": "Flat manager not configured or server error"},
    },
)
def revoke_upload_token(token_id: int, login=Depends(login_state)):
    if config.settings.flat_manager_api is None:
        raise HTTPException(
            status_code=500,
            detail=ErrorDetail.FLAT_MANAGER_NOT_CONFIGURED,
        )

    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    with get_db("replica") as db:
        token = models.UploadToken.by_id(db, token_id)
    if token is None:
        raise HTTPException(status_code=404, detail=ErrorDetail.TOKEN_NOT_FOUND)

    with get_db("replica") as db:
        if token.app_id not in login.user.dev_flatpaks(db):
            raise HTTPException(
                status_code=403,
                detail=ErrorDetail.NOT_APP_DEVELOPER,
            )

    flat_manager_jwt = utils.create_flat_manager_token(
        "revoke_upload_token", ["tokenmanagement"], sub=""
    )

    # Tell flat-manager to revoke the token
    response = http_client.post(
        config.settings.flat_manager_api + "/api/v1/tokens/revoke",
        headers={"Authorization": flat_manager_jwt},
        json={"token_ids": [jti(token)]},
    )
    if not response.ok:
        raise HTTPException(
            status_code=500,
            detail=ErrorDetail.FLAT_MANAGER_ERROR,
        )

    token.revoked = True
    with get_db("writer") as db:
        db.session.add(token)
        db.session.commit()


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application
    """
    app.include_router(router)
