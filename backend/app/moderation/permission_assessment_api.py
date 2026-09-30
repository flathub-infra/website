from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .. import config
from .permission_assessment import (
    CandidateAssessmentRequest,
    CandidateAssessmentResponse,
    assess_candidate,
    get_assessment,
)


def _authenticate(
    authorization: Annotated[
        HTTPAuthorizationCredentials | None, Depends(HTTPBearer(auto_error=False))
    ],
) -> None:
    secret = config.settings.permission_assessment_shared_secret
    if not secret:
        raise HTTPException(
            status_code=500, detail="permission_assessment_not_configured"
        )
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
        if claims["sub"] != "permission-assessment":
            raise jwt.InvalidTokenError("Invalid assessment subject")
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=401,
            detail="invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    scope = claims.get("scope")
    scopes = scope.split() if isinstance(scope, str) else scope
    if not isinstance(scopes, list) or "assess" not in scopes:
        raise HTTPException(status_code=403, detail="invalid_scope")


router = APIRouter(
    prefix="/moderation/permissions",
    tags=["moderation"],
    dependencies=[Depends(_authenticate)],
)


@router.post("/assess")
def post_assessment(request: CandidateAssessmentRequest) -> CandidateAssessmentResponse:
    return assess_candidate(request)


@router.get("/{assessment_id}")
def read_assessment(assessment_id: int) -> CandidateAssessmentResponse:
    return get_assessment(assessment_id)


def register_to_app(app: FastAPI) -> None:
    app.include_router(router)
