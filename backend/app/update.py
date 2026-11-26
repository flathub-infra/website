from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config, worker


def _authenticate(
    authorization: Annotated[
        HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))
    ],
) -> None:
    secret = config.settings.update_shared_secret
    if not secret:
        raise HTTPException(status_code=500, detail="update_not_configured")
    if authorization is None:
        raise HTTPException(
            status_code=401,
            detail="invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = jwt.decode(
            authorization.credentials,
            secret,
            algorithms=["HS256"],
            options={"require": ["sub"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401,
            detail="invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if claims["sub"] != "update":
        raise HTTPException(status_code=403, detail="invalid_subject")


router = APIRouter(prefix="/update", dependencies=[Depends(_authenticate)])


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.post(
    "",
    tags=["update"],
    responses={
        200: {"description": "Update completed successfully"},
        500: {"description": "Internal server error"},
    },
)
async def update():
    worker.update.send()
    worker.update_quality_moderation.send()
    worker.refresh_cache.send()


@router.post(
    "/stats",
    tags=["update"],
    responses={
        200: {"description": "Stats updated successfully"},
        500: {"description": "Internal server error"},
    },
)
async def update_stats():
    worker.update_stats.send()


@router.post(
    "/app-picks",
    tags=["update"],
    responses={
        200: {"description": "App picks updated successfully"},
        500: {"description": "Internal server error"},
    },
)
async def update_app_picks():
    worker.update_app_picks.send()
