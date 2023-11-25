import base64
import itertools
import json
from datetime import datetime
from enum import Enum
from typing import Optional

import jwt
import requests as req
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi_sqlalchemy import db as sqldb
from pydantic import BaseModel, field_validator
from sqlalchemy import func, not_, or_

from . import config, models, utils, worker
from .db import get_json_key
from .emails import EmailCategory, EmailInfo
from .login_info import moderator_only, moderator_or_app_author_only
from .logins import LoginStatusDep

router = APIRouter(prefix="/moderation")


class ModerationRequestType(str, Enum):
    APPDATA = "appdata"


class ModerationAppItem(BaseModel):
    appid: str
    is_new_submission: bool
    updated_at: datetime | None = None
    request_types: list[ModerationRequestType]


class ModerationAppsResponse(BaseModel):
    apps: list[ModerationAppItem]
    apps_count: int


class RequestData(BaseModel):
    keys: dict[str, Optional[str]]
    current_values: dict[str, Optional[str]]


class ModerationRequestResponse(BaseModel):
    id: int
    app_id: str
    created_at: datetime

    build_id: int
    job_id: int
    is_outdated: bool

    request_type: ModerationRequestType
    request_data: RequestData | None = None
    is_new_submission: bool

    handled_by: str | None = None
    handled_at: datetime | None = None
    is_approved: bool | None = None
    comment: str | None = None


class ModerationApp(BaseModel):
    requests: list[ModerationRequestResponse]
    requests_count: int


@router.get(
    "/apps", status_code=200, response_model_exclude_none=True, tags=["moderation"]
)
def get_moderation_apps(
    new_submissions: bool | None = None,
    show_handled: bool = False,
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
        .filter(
            models.ModerationRequest.handled_at.is_(None)
            if show_handled is False
            else models.ModerationRequest.handled_at.isnot(None),
            models.ModerationRequest.is_outdated.is_(False),
        )
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


@router.get(
    "/apps/{app_id}",
    status_code=200,
    response_model_exclude_none=True,
    tags=["moderation"],
)
def get_moderation_app(
    _login=Depends(moderator_or_app_author_only),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    include_outdated: bool = False,
    include_handled: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> ModerationApp:
    """Get a list of moderation requests for an app."""
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
                app_id=row.appid,
                request_type=row.request_type,
                request_data=json.loads(row.request_data),
                build_id=row.build_id,
                job_id=row.job_id,
                is_approved=row.is_approved,
                handled_by=handled_by_name,
                handled_at=row.handled_at if row.handled_at else None,
                comment=row.comment,
                is_outdated=row.is_outdated,
                is_new_submission=row.is_new_submission,
                created_at=row.created_at,
            )
            for row, handled_by_name in query
        ],
        requests_count=total,
    )


class ReviewItem(BaseModel):
    name: str | None = None
    summary: str | None = None
    developer_name: str | None = None
    project_license: str | None = None
    project_group: str | None = None
    compulsory_for_desktop: bool | None = None


class ReviewRequest(BaseModel):
    build_id: int
    job_id: int


class ReviewRequestResponse(BaseModel):
    requires_review: bool


@router.post(
    "/submit_review_request",
    status_code=200,
    response_model_exclude_none=True,
    tags=["moderation"],
)
def submit_review_request(
    review_request: ReviewRequest,
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

    flat_manager_token = utils.create_flat_manager_token(
        "process_review_request",
        ["build"],
        repos=["stable", "beta", "test"],
    )
    build_extended_url = f"{config.settings.flat_manager_api}/api/v1/build/{review_request.build_id}/extended"
    build_extended_headers = {
        "Authorization": f"{flat_manager_token}",
        "Content-Type": "application/json",
    }
    r = req.get(build_extended_url, headers=build_extended_headers)
    r.raise_for_status()

    # Skip beta and test builds
    build_extended = r.json()
    build_metadata = build_extended.get("build")
    build_target_repo = build_metadata.get("repo")
    if build_target_repo in ("beta", "test"):
        return ReviewRequestResponse(requires_review=False)
    build_refs = build_extended.get("build_refs")
    build_ref_arches = {
        build_ref.get("ref_name").split("/")[2]
        for build_ref in build_refs
        if len(build_ref.get("ref_name").split("/")) == 4
    }

    new_requests: list[models.ModerationRequest] = []

    try:
        build_ref_arch = build_ref_arches.pop()
        appstream = utils.appstream2dict(
            f"https://dl.flathub.org/build-repo/{review_request.build_id}/appstream/{build_ref_arch}/appstream.xml.gz"
        )
    except KeyError:
        # if build_ref_arches has no elements, something went terribly wrong with the build in general
        return ReviewRequestResponse(requires_review=True)

    for app_id, app_data in appstream.items():
        is_new_submission = True

        keys = {
            "name": app_data.get("name"),
            "summary": app_data.get("summary"),
            "developer_name": app_data.get("developer_name"),
            "project_group": app_data.get("project_group"),
            "project_license": app_data.get("project_license"),
        }
        current_values = {}

        # Check if the app data matches the current appstream
        if app := get_json_key(f"apps:{app_id}"):
            is_new_submission = False

            current_values["name"] = app.get("name")
            current_values["summary"] = app.get("summary")
            current_values["developer_name"] = app.get("developer_name")
            current_values["project_group"] = app.get("project_group")
            current_values["project_license"] = app.get("project_license")

            for key, value in current_values.items():
                if value == keys[key]:
                    keys.pop(key, None)

        # Don't consider the first "official" buildbot build as a new submission
        # as it has been already reviewed manually on GitHub
        if is_new_submission and build_metadata.get("token_name") in (
            "default",
            "flathub-ci",
            "buildbot",
        ):
            continue

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
                build_id=review_request.build_id,
                job_id=review_request.job_id,
            )
            new_requests.append(request)

    if len(new_requests) == 0:
        return ReviewRequestResponse(requires_review=False)
    else:
        # Mark previous requests as outdated, to avoid flooding the moderation queue with requests that probably aren't
        # relevant anymore. Outdated requests can still be viewed and approved, but they're hidden by default.
        app_ids = set(request.appid for request in new_requests)
        for app_id in app_ids:
            sqldb.session.query(models.ModerationRequest).filter_by(
                appid=app_id, is_outdated=False
            ).update({"is_outdated": True})

        for request in new_requests:
            sqldb.session.add(request)
        sqldb.session.commit()

        if config.settings.moderation_observe_only:
            return ReviewRequestResponse(requires_review=False)
        else:
            apps = itertools.groupby(new_requests, lambda r: r.appid)
            for app_id, requests in apps:
                requests = list(requests)
                worker.send_email.send(
                    EmailInfo(
                        user_id=None,
                        app_id=app_id,
                        category=EmailCategory.MODERATION_HELD,
                        subject=f"Build #{review_request.build_id} held for review",
                        template_data={
                            "build_id": review_request.build_id,
                            "job_id": review_request.job_id,
                            "requests": [
                                {
                                    "request_type": request.request_type,
                                    "request_data": json.loads(request.request_data),
                                    "is_new_submission": request.is_new_submission,
                                }
                                for request in requests
                            ],
                        },
                    ).dict()
                )

            return ReviewRequestResponse(requires_review=True)


class Review(BaseModel):
    approve: bool
    comment: str | None = None

    @field_validator("comment")
    def reject_requires_comment(cls, v, values):
        if v is None and not values["approve"]:
            raise ValueError("rejecting a request requires a comment")
        return v


@router.post("/requests/{id}/review", status_code=204, tags=["moderation"])
def submit_review(
    id: int,
    review: Review,
    login: LoginStatusDep,
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
    request.handled_by = login.user.id
    request.handled_at = func.now()
    request.comment = review.comment

    sqldb.session.commit()

    if request.is_approved:
        # Check if all requests for the job are approved
        remaining = (
            sqldb.session.query(models.ModerationRequest)
            .filter_by(job_id=request.job_id)
            .filter(models.ModerationRequest.is_approved is None)
            .count()
        )
        if remaining == 0:
            # Tell flat-manager that the job is approved
            worker.review_check.send(request.job_id, "Passed", None, request.build_id)
    else:
        # If any request is rejected, the job is rejected
        worker.review_check.send(
            request.job_id, "Failed", "The review was rejected by a moderator."
        )

    worker.send_email.send(
        EmailInfo(
            user_id=None,
            app_id=request.appid,
            category=EmailCategory.MODERATION_APPROVED
            if request.is_approved
            else EmailCategory.MODERATION_REJECTED,
            subject=f"Change in build #{request.build_id} approved"
            if request.is_approved
            else f"Change in build #{request.build_id} rejected",
            template_data={
                "build_id": request.build_id,
                "job_id": request.job_id,
                "request": {
                    "request_type": request.request_type,
                    "request_data": json.loads(request.request_data),
                    "is_new_submission": request.is_new_submission,
                },
                "comment": request.comment,
            },
        ).dict()
    )


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application
    """
    app.include_router(router)
