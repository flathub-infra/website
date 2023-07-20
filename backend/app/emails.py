from email.mime.text import MIMEText
from email.utils import formataddr
from enum import Enum
from smtplib import SMTP_SSL as SMTP
from typing import Any

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
    MODERATION_HELD = "moderation_held"
    MODERATION_APPROVED = "moderation_approved"
    MODERATION_REJECTED = "moderation_rejected"


class EmailInfo(BaseModel):
    user_id: int | None
    app_id: str | None
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
        return gh.get_user().email

    if gl_user := models.GitlabAccount.by_user(db, user):
        return _get_gitlab_email(gl_user, "https://gitlab.com")

    if gl_user := models.GnomeAccount.by_user(db, user):
        return _get_gitlab_email(gl_user, "https://gitlab.gnome.org")

    if gl_user := models.KdeAccount.by_user(db, user):
        return _get_gitlab_email(gl_user, "https://invent.kde.org")


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

    data = {
        "env": settings.env,
        "user_display_name": user.display_name,
        "user_email_address": email,
        "email_category": info.category,
        "email_subject": info.subject,
        "app_id": info.app_id,
        "app_name": app_name,
        **info.template_data,
    }

    text = template_env.get_template(info.category + ".html").render(data)
    message = MIMEText(text, "html")
    message["Subject"] = full_subject
    message["From"] = formataddr((settings.email_from_name, settings.email_from))
    message["To"] = formataddr((user.display_name, email))

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
