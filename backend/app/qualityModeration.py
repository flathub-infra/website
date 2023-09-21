from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import ORJSONResponse
from fastapi_sqlalchemy import db
from pydantic import BaseModel

from . import models
from .logins import LoginStatusDep

router = APIRouter(prefix="/quality-moderation", default_response_class=ORJSONResponse)


class UpsertQualityModeration(BaseModel):
    guideline_key: str
    passed: bool


def register_to_app(app: FastAPI):
    app.include_router(router)


def quality_moderator_only(login: LoginStatusDep):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail="not_logged_in")
    if not login.user.is_quality_moderator:
        raise HTTPException(status_code=403, detail="not_quality_moderator")

    return login


@router.get("/{app_id}")
def get_quality_moderation_for_app(
    app_id: str, _moderator=Depends(quality_moderator_only)
):
    return models.QualityModeration.by_appid(db, app_id)


@router.post("/{app_id}")
def set_quality_moderation_for_app(
    app_id: str,
    body: UpsertQualityModeration,
    moderator=Depends(quality_moderator_only),
):
    models.QualityModeration.upsert(
        db, app_id, body.guideline_key, body.passed, moderator.user.id
    )
