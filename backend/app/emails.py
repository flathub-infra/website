import base64
import datetime
from enum import Enum
from typing import Any

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select

from . import http_client, models
from .config import settings


class EmailCategory(str, Enum):
    BUILD_NOTIFICATION = "build_notification"
    DEVELOPER_INVITE = "developer_invite"
    DEVELOPER_INVITE_ACCEPTED = "developer_invite_accepted"
    DEVELOPER_INVITE_DECLINED = "developer_invite_declined"
    DEVELOPER_LEFT = "developer_left"
    MODERATION_APPROVED = "moderation_approved"
    MODERATION_HELD = "moderation_held"
    MODERATION_REJECTED = "moderation_rejected"
    SECURITY_LOGIN = "security_login"
    UPLOAD_TOKEN_CREATED = "upload_token_created"


def _get_destination_and_append(
    payload: dict, db, messages: list, user: models.FlathubUser
):
    message = _get_message_destination(user, payload, db)
    if message and message[0] not in dict(messages):
        messages.append(message)


def _get_message_destination(
    user: models.FlathubUser, payload: dict, db
) -> tuple[str, dict] | None:
    user_default_account = user.get_default_account(db)

    email = user_default_account.email
    if email is None:
        print(f"Could not find email address for user #{user.id}")
        return None

    return (email, payload)


def send_email_new(payload: dict, db):
    from . import worker

    messages: list[tuple[str, dict]] = []

    if (
        "messageInfo" in payload
        and "appName" in payload["messageInfo"]
        and payload["messageInfo"]["appName"] is not None
    ):
        payload["subject"] = (
            payload["messageInfo"]["appName"] + " | " + payload["subject"]
        )

    if (
        "messageInfo" in payload
        and "appId" in payload["messageInfo"]
        and payload["messageInfo"]["appId"] is not None
    ):
        if (
            "inform_only_moderators" not in payload["messageInfo"]
            or not payload["messageInfo"]["inform_only_moderators"]
        ):
            # Get the developers of the app
            by_github_repo = (
                db.session.query(models.FlathubUser)
                .filter(
                    models.FlathubUser.id.in_(
                        select(models.GithubAccount.user).where(
                            models.GithubAccount.id
                            == models.GithubRepository.github_account,
                            models.GithubRepository.reponame
                            == payload["messageInfo"]["appId"],
                        )
                    )
                )
                .all()
            )
            for user in by_github_repo:
                _get_destination_and_append(payload, db, messages, user)

            direct_upload_app = models.DirectUploadApp.by_app_id(
                db, payload["messageInfo"]["appId"]
            )
            if direct_upload_app is not None:
                by_direct_upload = models.DirectUploadAppDeveloper.by_app(
                    db, direct_upload_app
                )
                for _dev, user in by_direct_upload:
                    _get_destination_and_append(payload, db, messages, user)

    if "inform_only_moderators" in payload or "inform_moderators" in payload:
        users_with_moderator_permissions = models.FlathubUser.by_permission(
            db, "moderation"
        )
        for user in users_with_moderator_permissions:
            _get_destination_and_append(payload, db, messages, user)

    if "userId" in payload and payload["userId"] is not None:
        # Get the user's email address
        if user := models.FlathubUser.by_id(db, payload["userId"]):
            _get_destination_and_append(payload, db, messages, user)
        else:
            # User doesn't exist anymore?
            pass

    messages = [m for m in messages if m is not None]

    for dest, message in messages:
        # Queue each message separately so that if one fails, the others won't be resent when the task is retried
        worker.send_one_email_new.send(message, dest)


def send_one_email_new(payload: dict, dest: str):
    payload["to"] = dest

    result = http_client.post(f"{settings.backend_node_url}/emails", json=payload)

    if result.status_code != 200:
        raise Exception(
            "Failed to send email",
            result.json(),
            payload,
        )


router = APIRouter(prefix="/emails")


class BuildNotificationRequest(BaseModel):
    app_id: str
    build_id: int
    build_repo: str
    diagnostics: list[Any]


@router.post(
    "/build-notification",
    tags=["email"],
    responses={
        200: {"description": "Build notification sent successfully"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def build_notification(
    request: BuildNotificationRequest,
    authorization: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
):
    from . import worker

    if settings.flat_manager_build_secret is None:
        raise HTTPException(
            status_code=500,
            detail="flat_manager_not_configured",
        )

    try:
        claims = jwt.decode(
            authorization.credentials,
            base64.b64decode(settings.flat_manager_build_secret),
            algorithms=["HS256"],
        )
        if "reviewcheck" not in claims["scope"]:
            raise HTTPException(status_code=403, detail="invalid_scope")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid_token")

    is_failure = any(not d["is_warning"] for d in request.diagnostics)
    subject = (
        f"Build #{request.build_id} failed"
        if is_failure
        else f"Build #{request.build_id} passed with warnings"
    )

    payload = {
        "messageId": f"{request.build_repo}/{request.build_id}",
        "creation_timestamp": datetime.datetime.now().timestamp(),
        "subject": subject,
        "previewText": subject,
        "messageInfo": {
            "category": EmailCategory.BUILD_NOTIFICATION,
            "appId": request.app_id,
            "appName": request.app_id,  # todo get app name
            "diagnostics": request.diagnostics,
            "anyWarnings": any(d["is_warning"] for d in request.diagnostics),
            "anyErrors": any(not d["is_warning"] for d in request.diagnostics),
            "buildId": request.build_id,
            "buildRepo": request.build_repo,
        },
    }
    worker.send_email_new.send(payload)


def register_to_app(app: FastAPI):
    app.include_router(router)
