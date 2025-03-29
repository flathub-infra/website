import base64
import itertools
import json
from datetime import datetime

import httpx
import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from github import Github
from pydantic import BaseModel, field_validator
from sqlalchemy import func, not_, or_

from . import config, models, summary, utils, worker
from .database import get_db, get_json_key
from .emails import EmailCategory
from .login_info import LoginStatusDep, moderator_only
from .types import ModerationRequestType

router = APIRouter(prefix="/moderation")


class ModerationAppItem(BaseModel):
    appid: str
    is_new_submission: bool
    updated_at: datetime | None = None
    request_types: list[ModerationRequestType]


class ModerationAppsResponse(BaseModel):
    apps: list[ModerationAppItem]
    apps_count: int


class RequestData(BaseModel):
    keys: dict[str, str | None | list | None | dict | None | bool | None]
    current_values: dict[str, str | None | list | None | dict | None | bool | None]


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


def create_github_build_rejection_issue(request: models.ModerationRequest):
    gh_token = config.settings.github_bot_token
    if not gh_token:
        return

    gh = Github(gh_token)

    app_id = request.appid
    build_id = request.build_id
    build_log_url = request.build_log_url
    comment = request.comment

    repo = gh.get_repo(f"flathub/{app_id}")
    if not repo:
        return

    title = f"Change in build {build_id} rejected"
    body = (
        f"A change in [build {build_id}]({build_log_url}) has been reviewed by the Flathub team (@flathub/build-moderation), and rejected for the following reason:\n"
        "\n"
        f"> {comment}"
        "\n"
        "## Changes\n"
        "| Field | Old value | New value |\n"
        "| --- | --- | --- |\n"
    )

    request_data = json.loads(request.request_data)
    for field in request_data["keys"]:
        old_val = request_data["current_values"][field]
        new_val = request_data["keys"][field]
        body += f"| {field} | {old_val} | {new_val} |\n"

    return repo.create_issue(title=title, body=body)


def sort_lists_in_dict(data: dict) -> dict:
    if isinstance(data, dict):
        for key, value in data.items():
            data[key] = sort_lists_in_dict(value)
    elif isinstance(data, list):
        data.sort()
    return data


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

    with get_db("replica") as db_session:
        is_new_submission = func.bool_or(
            models.ModerationRequest.is_new_submission
        ).label("is_new_submission")
        query = (
            db_session.session.query(
                models.ModerationRequest.appid,
                is_new_submission,
                func.max(models.ModerationRequest.created_at).label("updated_at"),
                func.array_agg(models.ModerationRequest.request_type.distinct()).label(
                    "request_types"
                ),
            )
            .filter(
                (
                    models.ModerationRequest.handled_at.is_(None)
                    if show_handled is False
                    else models.ModerationRequest.handled_at.isnot(None)
                ),
                models.ModerationRequest.is_outdated.is_(False),
            )
            .group_by(models.ModerationRequest.appid)
            .order_by(func.max(models.ModerationRequest.created_at).desc())
        )

        if new_submissions is not None:
            query = query.having(is_new_submission == new_submissions)

        total = query.count()
        query = query.offset(offset).limit(limit)

        results = [ModerationAppItem(**row._asdict()) for row in query]

    return ModerationAppsResponse(
        apps=results,
        apps_count=total,
    )


@router.get(
    "/apps/{app_id}",
    status_code=200,
    response_model_exclude_none=True,
    tags=["moderation"],
)
def get_moderation_app(
    login: LoginStatusDep,
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
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "moderation" not in user.permissions():
            # Check if user is app author
            if app_id not in user.dev_flatpaks(db):
                raise HTTPException(status_code=403, detail="forbidden")

        query = (
            db.session.query(models.ModerationRequest, models.FlathubUser.display_name)
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

        # Execute the query and process results within the session
        results = []
        for row, handled_by_name in query:
            results.append(
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
            )

    return ModerationApp(
        requests=results,
        requests_count=total,
    )


class ReviewItem(BaseModel):
    name: str | None = None
    summary: str | None = None
    developer_name: str | None = None
    project_license: str | None = None


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
    r = httpx.get(build_extended_url, headers=build_extended_headers)
    r.raise_for_status()

    # Skip beta and test builds
    build_extended = r.json()
    build_metadata = build_extended.get("build")
    build_target_repo = build_metadata.get("repo")
    if build_target_repo in ("beta", "test"):
        return ReviewRequestResponse(requires_review=False)
    build_log_url = build_metadata.get("build_log_url")

    build_refs = build_extended.get("build_refs")
    build_ref_arches = {
        build_ref.get("ref_name").split("/")[2]
        for build_ref in build_refs
        if len(build_ref.get("ref_name").split("/")) == 4
    }

    new_requests: list[models.ModerationRequest] = []

    try:
        build_ref_arch = build_ref_arches.pop()
        build_appstream = utils.appstream2dict(
            f"https://dl.flathub.org/build-repo/{review_request.build_id}/appstream/{build_ref_arch}/appstream.xml.gz"
        )
    except KeyError:
        # if build_ref_arches has no elements, something went terribly wrong with the build in general
        raise HTTPException(status_code=500, detail="invalid_build")

    r = httpx.get(
        f"https://dl.flathub.org/build-repo/{review_request.build_id}/summary"
    )
    r.raise_for_status()
    if not isinstance(r.content, bytes):
        # If the summary file is not a binary file, something also went wrong
        raise HTTPException(status_code=500, detail="invalid_summary_file")
    with get_db("writer") as db:
        build_summary, _, _ = summary.parse_summary(r.content, db)

    sentry_context = {"build_summary": build_summary}

    for app_id, app_data in build_appstream.items():
        is_new_submission = True

        keys = {
            "name": app_data.get("name"),
            "summary": app_data.get("summary"),
            "developer_name": app_data.get("developer_name"),
            "project_license": app_data.get("project_license"),
        }
        current_values = {}

        # Check if the app data matches the current appstream
        if app := get_json_key(f"apps:{app_id}"):
            is_new_submission = False

            current_values["name"] = app.get("name")
            current_values["summary"] = app.get("summary")
            current_values["developer_name"] = app.get("developer_name")
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

        if app_id in (
            "org.freedesktop.Platform",
            "org.freedesktop.Sdk",
            "org.gnome.Platform",
            "org.gnome.Sdk",
            "org.kde.Platform",
            "org.kde.Sdk",
            "org.flatpak.Builder",
        ):
            continue

        if "keys" not in locals():
            keys = {}
        if "current_values" not in locals():
            current_values = {}

        with get_db("writer") as db:
            if direct_upload_app := models.DirectUploadApp.by_app_id(db, app_id):
                if not direct_upload_app.first_seen_at:
                    direct_upload_app.first_seen_at = datetime.utcnow()
                    db.session.commit()
                    is_new_submission = True
                    current_values = {"direct upload": False}
                    keys = {"direct upload": True}

        with get_db("replica") as db:
            current_summary = None
            current_permissions = None
            current_extradata = False

            app = models.App.by_appid(db, app_id)
            if app and app.summary:
                current_summary = app.summary
                sentry_context[f"summary:{app_id}:stable"] = current_summary

                if current_metadata := current_summary.get("metadata", {}):
                    current_permissions = current_metadata.get("permissions")
                    current_extradata = bool(current_metadata.get("extra-data"))
            elif current_summary := get_json_key(f"summary:{app_id}:stable"):
                sentry_context[f"summary:{app_id}:stable"] = current_summary

                if current_metadata := current_summary.get("metadata", {}):
                    current_permissions = current_metadata.get("permissions")
                    current_extradata = bool(current_metadata.get("extra-data"))

            if current_summary:
                build_summary_app = build_summary.get(app_id) or {}
                build_summary_metadata = build_summary_app.get("metadata") or {}
                build_permissions = build_summary_metadata.get("permissions") or {}
                build_extradata = bool(build_summary_metadata.get("extra-data", False))

                if current_extradata != build_extradata:
                    current_values["extra-data"] = current_extradata
                    keys["extra-data"] = build_extradata

                if current_permissions and build_permissions:
                    if current_permissions != build_permissions:
                        for perm in current_permissions:
                            current_perm = current_permissions[perm]
                            build_perm = build_permissions.get(perm)

                            if isinstance(current_perm, list):
                                if current_perm != build_perm:
                                    current_values[perm] = current_perm
                                    keys[perm] = build_perm

                            if isinstance(current_perm, dict):
                                if build_perm is None:
                                    build_perm = {}

                                dict_keys = current_perm.keys() | build_perm.keys()
                                for key in dict_keys:
                                    if current_perm.get(key) != build_perm.get(key):
                                        current_values[f"{key}-{perm}"] = (
                                            current_perm.get(key)
                                        )
                                        keys[f"{key}-{perm}"] = build_perm.get(key)

        if len(keys) > 0:
            keys = sort_lists_in_dict(keys)
            current_values = sort_lists_in_dict(current_values)

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
                build_log_url=build_log_url,
            )
            new_requests.append(request)

    # Mark previous requests as outdated, to avoid flooding the moderation queue with requests that probably aren't
    # relevant anymore. Outdated requests can still be viewed and approved, but they're hidden by default.
    with get_db("writer") as db:
        app_ids = set(request.appid for request in new_requests)
        for app_id in app_ids:
            db.session.query(models.ModerationRequest).filter_by(
                appid=app_id, is_outdated=False
            ).update({"is_outdated": True})

        if len(new_requests) == 0:
            return ReviewRequestResponse(requires_review=False)
        else:
            for request in new_requests:
                db.session.add(request)
            db.session.commit()

        if config.settings.moderation_observe_only:
            return ReviewRequestResponse(requires_review=False)
        else:
            apps = itertools.groupby(new_requests, lambda r: r.appid)
            for app_id, requests in apps:
                requests = list(requests)

                if app_metadata := get_json_key(f"apps:{app_id}"):
                    app_name = app_metadata["name"]
                else:
                    app_name = None

                payload = {
                    "messageId": f"{app_id}/{review_request.build_id}/held",
                    "creation_timestamp": datetime.now().timestamp(),
                    "subject": f"Build #{review_request.build_id} held for review",
                    "previewText": f"Build #{review_request.build_id} held for review",
                    "inform_moderators": True,
                    "messageInfo": {
                        "category": EmailCategory.MODERATION_HELD,
                        "appId": request.appid,
                        "appName": app_name,
                        "buildId": review_request.build_id,
                        "buildLogUrl": request.build_log_url,
                        "requests": [
                            {
                                "requestType": request.request_type,
                                "requestData": json.loads(request.request_data),
                                "isNewSubmission": request.is_new_submission,
                            }
                            for request in requests
                        ],
                    },
                }

                worker.send_email_new.send(payload)

            return ReviewRequestResponse(requires_review=True)


class Review(BaseModel):
    approve: bool
    comment: str | None = None

    @field_validator("comment")
    def reject_requires_comment(cls, v, values):
        if v is None and not values["approve"]:
            raise ValueError("rejecting a request requires a comment")
        return v


class ReviewResponse(BaseModel):
    github_issue_url: str


@router.post("/requests/{id}/review", status_code=200, tags=["moderation"])
def submit_review(
    id: int,
    review: Review,
    login: LoginStatusDep,
    _moderator=Depends(moderator_only),
) -> ReviewResponse | None:
    """Approve or reject the moderation request with a comment. If all requests for a job are approved, the job is
    marked as successful in flat-manager."""

    with get_db("writer") as db:
        request = (
            db.session.query(models.ModerationRequest)
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

        # Store values we need after session close
        job_id = request.job_id
        build_id = request.build_id
        is_approved = review.approve
        appid = request.appid
        build_log_url = request.build_log_url
        request_type = request.request_type
        request_data = request.request_data
        is_new_submission = request.is_new_submission
        comment = review.comment

        db.session.commit()

    if is_approved:
        # Check if all requests for the job are approved
        with get_db("replica") as db:
            remaining = (
                db.session.query(models.ModerationRequest)
                .filter_by(job_id=job_id)
                .filter(models.ModerationRequest.is_approved.is_(None))
                .count()
            )
        if remaining == 0:
            # Tell flat-manager that the job is approved
            worker.review_check.send(job_id, "Passed", None, build_id)
    else:
        # If any request is rejected, the job is rejected
        worker.review_check.send(
            job_id, "Failed", "The review was rejected by a moderator."
        )

    inform_only_moderators = False

    issue = None
    if is_approved:
        category = EmailCategory.MODERATION_APPROVED
        subject = f"Change in build #{build_id} approved"
    else:
        category = EmailCategory.MODERATION_REJECTED
        subject = f"Change in build #{build_id} rejected"

        with get_db("replica") as db:
            if not models.DirectUploadApp.by_app_id(db, appid):
                inform_only_moderators = True
                with get_db("writer") as db:
                    request = (
                        db.session.query(models.ModerationRequest)
                        .filter_by(id=id)
                        .first()
                    )
                    issue = create_github_build_rejection_issue(request)

    if app_metadata := get_json_key(f"apps:{appid}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    payload = {
        "messageId": f"{appid}/{build_id}/{'approved' if is_approved else 'rejected'}",
        "creation_timestamp": datetime.now().timestamp(),
        "subject": subject,
        "previewText": subject,
        "inform_moderators": True,
        "inform_only_moderators": inform_only_moderators,
        "messageInfo": {
            "category": category,
            "appId": appid,
            "appName": app_name,
            "buildId": build_id,
            "buildLogUrl": build_log_url,
            "request": {
                "requestType": request_type,
                "requestData": json.loads(request_data),
                "isNewSubmission": is_new_submission,
            },
            "references": f"{appid}/{build_id}/held",
        },
    }

    if comment is not None:
        payload["messageInfo"]["comment"] = comment

    worker.send_email_new.send(payload)

    return ReviewResponse(github_issue_url=issue.url) if issue else None


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application
    """
    app.include_router(router)
