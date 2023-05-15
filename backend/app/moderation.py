import base64
import json
import typing as T
from datetime import datetime
from enum import Enum

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi_sqlalchemy import db as sqldb
from pydantic import BaseModel, validator
from sqlalchemy import func, not_, or_

from . import config, logins, models, worker
from .db import get_json_key

router = APIRouter(prefix="/moderation")


class ModerationRequestType(str, Enum):
    APPDATA = "appdata"


def moderator_only(login=Depends(logins.login_state)):
    if not login["state"].logged_in():
        raise HTTPException(status_code=401, detail="not_logged_in")
    if not login["user"].is_moderator:
        raise HTTPException(status_code=403, detail="not_moderator")


class ModerationAppItem(BaseModel):
    appid: str
    is_new_submission: bool
    updated_at: datetime | None
    request_types: list[ModerationRequestType]


class ModerationAppsResponse(BaseModel):
    apps: list[ModerationAppItem]
    apps_count: int


class ModerationRequestResponse(BaseModel):
    id: int
    appid: str
    created_at: int

    build_id: int
    job_id: int
    is_outdated: bool

    request_type: ModerationRequestType
    request_data: T.Any | None
    is_new_submission: bool

    handled_by: str | None
    handled_at: int | None
    is_approved: bool | None
    comment: str | None


class ModerationApp(BaseModel):
    requests: list[ModerationRequestResponse]
    requests_count: int


@router.get("/apps", status_code=200, response_model_exclude_none=True)
def get_moderation_apps(
    new_submissions: bool | None = None,
    limit: int = 100,
    offset: int = 0,
    _moderator=Depends(moderator_only),
) -> ModerationAppsResponse:
    """Get a list of apps with unhandled moderation requests."""

    is_new_submission = func.bool_or(models.ModerationRequest.is_new_submission).label(
        "is_new_submission"
    )
    query = (
        sqldb.session.query(
            models.ModerationRequest.appid,
            is_new_submission,
            func.max(models.ModerationRequest.created_at).label("updated_at"),
            func.array_agg(models.ModerationRequest.request_type.distinct()).label(
                "request_types"
            ),
        )
        .filter_by(handled_at=None, is_outdated=False)
        .group_by(models.ModerationRequest.appid)
    )

    if new_submissions is not None:
        query = query.having(is_new_submission == new_submissions)

    total = query.count()
    query = query.offset(offset).limit(limit)

    return ModerationAppsResponse(
        apps=[ModerationAppItem(**row._asdict()) for row in query],
        apps_count=total,
    )


@router.get("/apps/{app_id}", status_code=200, response_model_exclude_none=True)
def get_moderation_app(
    app_id: str,
    include_outdated: bool = False,
    include_handled: bool = False,
    limit: int = 100,
    offset: int = 0,
    login=Depends(logins.login_state),
) -> ModerationApp:
    """Get a list of moderation requests for an app."""

    if not login["state"].logged_in():
        raise HTTPException(status_code=401, detail="not_logged_in")
    if not login["user"].is_moderator and app_id not in login["user"].dev_flatpaks(
        sqldb
    ):
        raise HTTPException(status_code=403, detail="not_app_developer")

    query = (
        sqldb.session.query(models.ModerationRequest, models.FlathubUser.display_name)
        .filter_by(appid=app_id)
        .order_by(models.ModerationRequest.created_at.desc())
    )

    # include_handled should include outdated+handled requests
    if include_handled:
        if not include_outdated:
            query = query.filter(
                or_(
                    models.ModerationRequest.handled_at.isnot(None),
                    not_(models.ModerationRequest.is_outdated),
                )
            )
    else:
        query = query.filter_by(handled_at=None)
        if not include_outdated:
            query = query.filter_by(is_outdated=False)

    query = query.join(models.FlathubUser, isouter=True)

    total = query.count()
    query = query.offset(offset).limit(limit)

    return ModerationApp(
        requests=[
            ModerationRequestResponse(
                id=row.id,
                appid=row.appid,
                request_type=row.request_type,
                request_data=json.loads(row.request_data),
                build_id=row.build_id,
                job_id=row.job_id,
                is_approved=row.is_approved,
                handled_by=handled_by_name,
                handled_at=row.handled_at.timestamp() if row.handled_at else None,
                comment=row.comment,
                is_outdated=row.is_outdated,
                is_new_submission=row.is_new_submission,
                created_at=row.created_at.timestamp(),
            )
            for row, handled_by_name in query
        ],
        requests_count=total,
    )


class ReviewItem(BaseModel):
    name: str | None
    summary: str | None
    developer_name: str | None
    project_license: str | None
    project_group: str | None
    compulsory_for_desktop: bool | None


class ReviewRequest(BaseModel):
    build_id: int
    job_id: int
    app_metadata: dict[str, ReviewItem]


class ReviewRequestResponse(BaseModel):
    requires_review: bool


@router.post(
    "/submit_review_request", status_code=200, response_model_exclude_none=True
)
def submit_review_request(
    appdata: ReviewRequest,
    authorization: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
) -> ReviewRequestResponse:
    try:
        claims = jwt.decode(
            authorization.credentials,
            base64.b64decode(config.settings.flat_manager_build_secret),
            algorithms=["HS256"],
        )
        if "reviewcheck" not in claims["scope"]:
            raise HTTPException(status_code=403, detail="invalid_scope")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid_token")

    new_requests = []

    for app_id, item in appdata.app_metadata.items():
        is_new_submission = True

        keys = {
            "name": item.name,
            "summary": item.summary,
            "developer_name": item.developer_name,
            "project_group": item.project_group,
            "project_license": item.project_license,
            "compulsory_for_desktop": item.compulsory_for_desktop,
        }
        current_values = {}

        # Check if the app data matches the current appstream
        if app := get_json_key(f"apps:{app_id}"):
            is_new_submission = False

            current_values["name"] = app["name"]
            current_values["summary"] = app["summary"]
            current_values["developer_name"] = app["developer_name"]
            current_values["project_group"] = app["project_group"]
            current_values["project_license"] = app["project_license"]
            current_values["compulsory_for_desktop"] = app["compulsory_for_desktop"]

            for key, value in current_values.items():
                if value == keys[key]:
                    keys.pop(key, None)

        if len(keys) > 0:
            # Create a moderation request
            request = models.ModerationRequest(
                appid=app_id,
                request_type=ModerationRequestType.APPDATA,
                request_data=json.dumps(
                    {"keys": keys, "current_values": current_values}
                ),
                is_new_submission=is_new_submission,
                is_outdated=False,
                build_id=appdata.build_id,
                job_id=appdata.job_id,
            )
            new_requests.append(request)

    if len(new_requests) > 0:
        # Mark previous requests as outdated, to avoid flooding the moderation queue with requests that probably aren't
        # relevant anymore. Outdated requests can still be viewed and approved, but they're hidden by default.
        sqldb.session.query(models.ModerationRequest).filter_by(
            appid=request.appid
        ).update({"is_outdated": True})

        for request in new_requests:
            sqldb.session.add(request)
        sqldb.session.commit()

        return ReviewRequestResponse(
            requires_review=not config.settings.moderation_observe_only
        )
    else:
        return ReviewRequestResponse(requires_review=False)


class Review(BaseModel):
    approve: bool
    comment: str | None

    @validator("comment", always=True)
    def reject_requires_comment(cls, v, values):
        if v is None and not values["approve"]:
            raise ValueError("rejecting a request requires a comment")
        return v


@router.post("/requests/{id}/review", status_code=204)
def submit_review(
    id: int,
    review: Review,
    login=Depends(logins.login_state),
    _moderator=Depends(moderator_only),
):
    """Approve or reject the moderation request with a comment. If all requests for a job are approved, the job is
    marked as successful in flat-manager."""

    request = (
        sqldb.session.query(models.ModerationRequest)
        .filter_by(id=id)
        .with_for_update()
        .first()
    )

    if request is None:
        raise HTTPException(status_code=404, detail="not_found")
    elif request.handled_at is not None:
        raise HTTPException(status_code=400, detail="already_handled")

    request.is_approved = review.approve
    request.handled_by = login["user"].id
    request.handled_at = func.now()
    request.comment = review.comment

    sqldb.session.commit()

    if request.is_approved:
        # Check if all requests for the job are approved
        remaining = (
            sqldb.session.query(models.ModerationRequest)
            .filter_by(job_id=request.job_id)
            .filter(models.ModerationRequest.is_approved is not True)
            .count()
        )
        if remaining == 0:
            # Tell flat-manager that the job is approved
            worker.review_check.send(request.job_id, "Passed", None)
    else:
        # If any request is rejected, the job is rejected
        worker.review_check.send(
            request.job_id, "Failed", "The review was rejected by a moderator."
        )

    # TODO: Notify developer


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application
    """
    app.include_router(router)
