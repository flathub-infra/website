import base64
import importlib.resources
import json
from email.mime.text import MIMEText
from email.utils import formataddr
from enum import Enum
from smtplib import SMTP_SSL as SMTP
from typing import Any

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from github import Github
from gitlab import Gitlab
from jinja2 import Environment, PackageLoader, select_autoescape
from pydantic import BaseModel
from sqlalchemy import select

from . import models
from .config import settings
from .db import get_json_key

template_env = Environment(
    loader=PackageLoader("app", "email_templates"),
    autoescape=select_autoescape(default=True),
)


class EmailCategory(str, Enum):
    SECURITY_LOGIN = "security_login"
    DEVELOPER_INVITE = "developer_invite"
    DEVELOPER_INVITE_ACCEPTED = "developer_invite_accepted"
    DEVELOPER_INVITE_DECLINED = "developer_invite_declined"
    DEVELOPER_LEFT = "developer_left"
    MODERATION_HELD = "moderation_held"
    MODERATION_APPROVED = "moderation_approved"
    MODERATION_REJECTED = "moderation_rejected"
    BUILD_NOTIFICATION = "build_notification"


class EmailInfo(BaseModel):
    user_id: int | None = None
    app_id: str | None = None
    category: EmailCategory
    subject: str
    template_data: dict[str, Any]


def _get_gitlab_email(account, gitlab_url) -> str | None:
    from .logins import refresh_oauth_token

    access_token = refresh_oauth_token(account)
    with Gitlab(gitlab_url, oauth_token=access_token) as gl:
        gl.auth()
        return gl.user.public_email


def _get_email_address(user: models.FlathubUser, db) -> str | None:
    if gh_user := models.GithubAccount.by_user(db, user):
        gh = Github(gh_user.token)
        emails = gh.get_user().get_emails()
        primary = next((e for e in emails if e.primary), None)
        return primary.email if primary else None

    if gl_user := models.GitlabAccount.by_user(db, user):
        return _get_gitlab_email(gl_user, "https://gitlab.com")

    if gl_user := models.GnomeAccount.by_user(db, user):
        return _get_gitlab_email(gl_user, "https://gitlab.gnome.org")

    if gl_user := models.KdeAccount.by_user(db, user):
        return _get_gitlab_email(gl_user, "https://invent.kde.org")


def _create_html(info: EmailInfo, app_name: str, email: str, user_display_name: str):
    data = {
        "env": settings.env,
        "user_display_name": user_display_name,
        "user_email_address": email,
        "email_category": info.category,
        "email_subject": info.subject,
        "app_id": info.app_id,
        "app_name": app_name,
        "frontend_url": settings.frontend_url,
        **info.template_data,
    }

    return template_env.get_template(info.category + ".html").render(data)


def _create_message(
    user: models.FlathubUser, info: EmailInfo, db
) -> tuple[str, MIMEText]:
    email = _get_email_address(user, db)
    full_subject = info.subject

    app_name = None
    if info.app_id is not None:
        if app := get_json_key(f"apps:{info.app_id}"):
            app_name = app["name"]
        full_subject = f"{app_name or info.app_id} | {full_subject}"

    if settings.env != "production":
        full_subject = f"[{settings.env.upper()}] {full_subject}"

    text = _create_html(info, app_name, email, user.display_name)

    message = MIMEText(text, "html")
    message["Subject"] = full_subject
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = formataddr((user.display_name or False, email))

    return (email, message)


def send_email(info: EmailInfo, db):
    from . import worker

    messages: list[tuple[str, MIMEText]] = []

    if info.app_id is not None:
        # Get the developers of the app
        by_github_repo = (
            db.session.query(models.FlathubUser)
            .filter(
                models.FlathubUser.id.in_(
                    select(models.GithubAccount.user).where(
                        models.GithubAccount.id
                        == models.GithubRepository.github_account,
                        models.GithubRepository.reponame == info.app_id,
                    )
                )
            )
            .all()
        )
        for user in by_github_repo:
            messages.append(_create_message(user, info, db))

        direct_upload_app = models.DirectUploadApp.by_app_id(db, info.app_id)
        if direct_upload_app is not None:
            by_direct_upload = models.DirectUploadAppDeveloper.by_app(
                db, direct_upload_app
            )
            for _dev, user in by_direct_upload:
                messages.append(_create_message(user, info, db))

    if info.user_id is not None:
        # Get the user's email address
        if user := models.FlathubUser.by_id(db, info.user_id):
            messages.append(_create_message(user, info, db))
        else:
            # User doesn't exist anymore?
            pass

    for dest, message in messages:
        # Queue each message separately so that if one fails, the others won't be resent when the task is retried
        worker.send_one_email.send(message.as_string(), dest)


def send_one_email(message: str, dest: str):
    if not settings.smtp_host:
        print(f"Would send email to {dest}:\n{message}\n")
    else:
        with SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.sendmail(settings.email_from, [dest], message)


router = APIRouter(prefix="/emails")


class BuildNotificationRequest(BaseModel):
    app_id: str
    build_id: int
    build_repo: str
    diagnostics: list[Any]


@router.post("/build-notification")
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

    worker.send_email.send(
        EmailInfo(
            app_id=request.app_id,
            category=EmailCategory.BUILD_NOTIFICATION,
            subject=subject,
            template_data={
                "diagnostics": request.diagnostics,
                "any_warnings": any(d["is_warning"] for d in request.diagnostics),
                "any_errors": any(not d["is_warning"] for d in request.diagnostics),
                "build_id": request.build_id,
                "build_repo": request.build_repo,
            },
        ).dict()
    )


if settings.env != "production":

    def _get_preview_data():
        with importlib.resources.open_text(
            "app.email_templates", "preview_data.json"
        ) as f:
            return json.load(f)

    @router.get("/preview", response_class=HTMLResponse)
    def preview_templates():
        preview_data = _get_preview_data()
        previews = [
            f"<li><a href='preview/{name}'>{name}</a></li>"
            for name in preview_data.keys()
        ]
        return "<ul>" + "\n".join(previews) + "</ul>"

    @router.get("/preview/{name}", response_class=HTMLResponse)
    def preview_template(name: str):
        preview_data = _get_preview_data()
        if name not in preview_data:
            raise HTTPException(status_code=404)

        info = EmailInfo(
            category=preview_data[name]["category"],
            subject="Test email",
            app_id="com.example.Test",
            template_data=preview_data[name]["data"],
        )

        preview = _create_html(info, "Test App", "test@example.com", "Test User")

        return f"""
            {preview}

            <div style="margin-top: 5em"/>

            <a href="../preview">Back to list of templates</a>
        """


def register_to_app(app: FastAPI):
    app.include_router(router)
