import base64
from enum import Enum
from typing import Any

import jwt
import requests
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select

from . import models
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


class EmailInfo(BaseModel):
    message_id: str
    user_id: int | None = None
    app_id: str | None = None
    subject: str
    template_data: dict[str, Any]
    references: str | None = None
    # Only works when app_id is set and email is not user specific
    inform_moderators: bool = False
    inform_only_moderators: bool = False


def _get_message_destination(
    user: models.FlathubUser, payload: dict, db
) -> tuple[str, dict] | None:
    user_default_account = user.get_default_account(db)

    email = user_default_account.email
    if email is None:
        print(f"Could not find email address for user #{user.id}")
        return None

    return (email, payload)


def send_email(payload: dict, db):
    from . import worker

    messages: list[tuple[str, dict]] = []

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
                message = _get_message_destination(user, payload, db)
                if message and message[0] not in dict(messages):
                    messages.append(message)

            direct_upload_app = models.DirectUploadApp.by_app_id(
                db, payload["messageInfo"]["appId"]
            )
            if direct_upload_app is not None:
                by_direct_upload = models.DirectUploadAppDeveloper.by_app(
                    db, direct_upload_app
                )
                for _dev, user in by_direct_upload:
                    message = _get_message_destination(user, payload, db)
                    if message and message[0] not in dict(messages):
                        messages.append(message)

    if "inform_only_moderators" in payload or "inform_moderators" in payload:
        moderators = db.session.query(models.FlathubUser).filter_by(is_moderator=True)
        for user in moderators:
            message = _get_message_destination(user, payload, db)
            if message and message[0] not in dict(messages):
                messages.append(message)

    if "userId" in payload and payload["userId"] is not None:
        # Get the user's email address
        if user := models.FlathubUser.by_id(db, payload["userId"]):
            message = _get_message_destination(user, payload, db)
            if message and message[0] not in dict(messages):
                messages.append(message)
        else:
            # User doesn't exist anymore?
            pass

    messages = [m for m in messages if m is not None]

    for dest, message in messages:
        # Queue each message separately so that if one fails, the others won't be resent when the task is retried
        worker.send_one_email.send(message, dest)


def send_one_email(payload: dict, dest: str):
    payload["to"] = dest

    try:
        requests.post(
            f"{settings.backend_node_url}/emails",
            json=payload,
        )
    except Exception as e:
        print("Unable to send email: %s\n" % e)


router = APIRouter(prefix="/emails")


class BuildNotificationRequest(BaseModel):
    app_id: str
    build_id: int
    build_repo: str
    diagnostics: list[Any]


@router.post("/build-notification", tags=["email"])
def build_notification(
    request: BuildNotificationRequest,
    authorization: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
):
    from . import worker

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

    worker.send_email.send(payload)


def register_to_app(app: FastAPI):
    app.include_router(router)
