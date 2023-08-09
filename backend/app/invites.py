from enum import Enum

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi_sqlalchemy import db as sqldb
from pydantic import BaseModel

from . import worker
from .db import get_json_key
from .emails import EmailCategory, EmailInfo
from .logins import LoginStatusDep
from .models import (
    DirectUploadApp,
    DirectUploadAppDeveloper,
    DirectUploadAppInvite,
    FlathubUser,
)

router = APIRouter(prefix="/invites")


class ErrorDetail(str, Enum):
    APP_NOT_FOUND = "app_not_found"
    NOT_LOGGED_IN = "not_logged_in"
    # You must be a developer of the app to perform this action.
    NOT_APP_DEVELOPER = "not_app_developer"
    # You must be the primary developer of the app to perform this action.
    NOT_PRIMARY_APP_DEVELOPER = "not_primary_app_developer"
    # No user was found with the given invite code.
    USER_NOT_FOUND = "user_not_found"
    # The user has already been invited to be a developer of this app.
    ALREADY_INVITED = "already_invited"
    # The user is already a developer of this app.
    ALREADY_DEVELOPER = "already_developer"
    # The invite could not be found (it was declined by the recipient, or retracted by the sender).
    INVITE_NOT_FOUND = "invite_not_found"
    # You must accept the Publisher Agreement in order to accept an invite.
    MUST_ACCEPT_PUBLISHER_AGREEMENT = "must_accept_publisher_agreement"
    # You cannot leave an app if you are the primary developer.
    CANNOT_ABANDON_APP = "cannot_abandon_app"
    # The developer could not be found.
    DEVELOPER_NOT_FOUND = "developer_not_found"


def _get_app(app_id: str) -> DirectUploadApp:
    if app := DirectUploadApp.by_app_id(sqldb, app_id):
        return app
    else:
        raise HTTPException(status_code=404, detail=ErrorDetail.APP_NOT_FOUND)


def _check_permission(
    app: DirectUploadApp, user: FlathubUser, require_primary: bool = False
) -> DirectUploadAppDeveloper:
    current_dev = DirectUploadAppDeveloper.by_developer_and_app(sqldb, user, app)
    if current_dev is None:
        raise HTTPException(status_code=403, detail=ErrorDetail.NOT_APP_DEVELOPER)
    if require_primary and not current_dev.is_primary:
        raise HTTPException(
            status_code=403, detail=ErrorDetail.NOT_PRIMARY_APP_DEVELOPER
        )
    return current_dev


class InviteStatus(BaseModel):
    is_pending: bool


@router.get("/{app_id}")
def get_invite_status(
    app_id: str,
    login: LoginStatusDep,
) -> InviteStatus:
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    app = _get_app(app_id)

    invite = DirectUploadAppInvite.by_developer_and_app(sqldb, login.user, app)
    if invite is not None:
        return InviteStatus(is_pending=True)

    developer = DirectUploadAppDeveloper.by_developer_and_app(sqldb, login.user, app)
    if developer is not None:
        return InviteStatus(is_pending=False)

    raise HTTPException(status_code=404, detail=ErrorDetail.INVITE_NOT_FOUND)


@router.post("/{app_id}/invite", status_code=204)
def invite_developer(
    app_id: str,
    invite_code: str,
    login: LoginStatusDep,
):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    app = _get_app(app_id)
    _check_permission(app, login.user, require_primary=True)

    invited_user = FlathubUser.by_invite_code(sqldb, invite_code.replace("-", ""))
    if invited_user is None:
        raise HTTPException(status_code=404, detail=ErrorDetail.USER_NOT_FOUND)

    existing_dev = DirectUploadAppDeveloper.by_developer_and_app(
        sqldb, invited_user, app
    )
    if existing_dev is not None:
        raise HTTPException(status_code=400, detail=ErrorDetail.ALREADY_DEVELOPER)

    existing_invite = DirectUploadAppInvite.by_developer_and_app(
        sqldb, invited_user, app
    )
    if existing_invite is not None:
        raise HTTPException(status_code=400, detail=ErrorDetail.ALREADY_INVITED)

    invite = DirectUploadAppInvite(
        app_id=app.id,
        developer_id=invited_user.id,
    )

    sqldb.session.add(invite)
    sqldb.session.commit()

    if app_metadata := get_json_key(f"apps:{app.app_id}"):
        app_name = app_metadata["name"]
        subject = (
            f"You have been invited to be a developer of {app_name} ({app.app_id})"
        )
    else:
        app_name = None
        subject = f"You have been invited to be a developer of {app.app_id}"

    worker.send_email.send(
        EmailInfo(
            user_id=invited_user.id,
            category=EmailCategory.DEVELOPER_INVITE,
            subject=subject,
            template_data={
                "app_id": app.app_id,
                "app_name": app_name,
                "inviter": login.user.display_name,
            },
        ).dict()
    )


@router.post("/{app_id}/accept", status_code=204)
def accept_invite(
    app_id: str,
    login: LoginStatusDep,
):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)
    elif login.user.accepted_publisher_agreement_at is None:
        raise HTTPException(
            status_code=403, detail=ErrorDetail.MUST_ACCEPT_PUBLISHER_AGREEMENT
        )

    app = _get_app(app_id)

    invite = DirectUploadAppInvite.by_developer_and_app(sqldb, login.user, app)
    if invite is None:
        raise HTTPException(status_code=404, detail=ErrorDetail.INVITE_NOT_FOUND)

    developer = DirectUploadAppDeveloper(
        app_id=app.id,
        developer_id=login.user.id,
        is_primary=False,
    )

    sqldb.session.add(developer)
    sqldb.session.delete(invite)
    sqldb.session.commit()

    username = login.user.display_name

    worker.send_email.send(
        EmailInfo(
            app_id=app_id,
            category=EmailCategory.DEVELOPER_INVITE_ACCEPTED,
            subject=f"{username} is now a developer",
            template_data={
                "username": username,
            },
        ).dict()
    )


@router.post("/{app_id}/decline", status_code=204)
def decline_invite(
    app_id: str,
    login: LoginStatusDep,
):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    app = _get_app(app_id)
    invite = DirectUploadAppInvite.by_developer_and_app(sqldb, login.user, app)
    if invite is None:
        raise HTTPException(status_code=404, detail=ErrorDetail.INVITE_NOT_FOUND)

    sqldb.session.delete(invite)
    sqldb.session.commit()

    primary_dev = DirectUploadAppDeveloper.primary_for_app(sqldb, app)
    if app_metadata := get_json_key(f"apps:{app.app_id}"):
        app_name = app_metadata["name"]
    else:
        app_name = None
    worker.send_email.send(
        EmailInfo(
            user_id=primary_dev.developer_id,
            category=EmailCategory.DEVELOPER_INVITE_DECLINED,
            subject=f"{login.user.display_name} declined their invite",
            template_data={
                "app_id": app.app_id,
                "app_name": app_name,
                "username": login.user.display_name,
            },
        ).dict()
    )


@router.post("/{app_id}/leave", status_code=204)
def leave_team(
    app_id: str,
    login: LoginStatusDep,
):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    app = _get_app(app_id)
    developer = _check_permission(app, login.user)

    if developer.is_primary:
        raise HTTPException(status_code=400, detail=ErrorDetail.CANNOT_ABANDON_APP)

    sqldb.session.delete(developer)
    sqldb.session.commit()

    worker.send_email.send(
        EmailInfo(
            app_id=app_id,
            category=EmailCategory.DEVELOPER_LEFT,
            subject=f"{login.user.display_name} left the developer team",
            template_data={
                "username": login.user.display_name,
            },
        ).dict()
    )


class Developer(BaseModel):
    id: int
    is_self: bool
    name: str | None
    is_primary: bool | None = None


class DevelopersResponse(BaseModel):
    developers: list[Developer]
    invites: list[Developer]


@router.get("/{app_id}/developers")
def get_developers(
    app_id: str,
    login: LoginStatusDep,
) -> DevelopersResponse:
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    app = _get_app(app_id)
    _check_permission(app, login.user)

    invites = DirectUploadAppInvite.by_app(sqldb, app)
    developers = DirectUploadAppDeveloper.by_app(sqldb, app)

    return DevelopersResponse(
        developers=[
            Developer(
                id=dev.id,
                is_self=user.id == login.user.id,
                name=user.display_name,
                is_primary=dev.is_primary,
            )
            for dev, user in developers
        ],
        invites=[
            Developer(
                id=invite.id,
                is_self=user.id == login.user.id,
                name=user.display_name,
            )
            for invite, user in invites
        ],
    )


@router.post("/{app_id}/remove-developer", status_code=204)
def remove_developer(
    app_id: str,
    developer_id: int,
    login: LoginStatusDep,
):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    app = _get_app(app_id)
    _check_permission(app, login.user, require_primary=True)

    developer = DirectUploadAppDeveloper.by_id(sqldb, developer_id)
    if developer is None or developer.app_id != app.id:
        raise HTTPException(status_code=404, detail=ErrorDetail.DEVELOPER_NOT_FOUND)
    if developer.is_primary:
        raise HTTPException(status_code=400, detail=ErrorDetail.CANNOT_ABANDON_APP)

    sqldb.session.delete(developer)
    sqldb.session.commit()


@router.post("/{app_id}/revoke", status_code=204)
def revoke_invite(
    app_id: str,
    invite_id: int,
    login: LoginStatusDep,
):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)

    app = _get_app(app_id)
    _check_permission(app, login.user, require_primary=True)

    invite = DirectUploadAppInvite.by_id(sqldb, invite_id)
    if invite is None or invite.app_id != app.id:
        raise HTTPException(status_code=404, detail=ErrorDetail.DEVELOPER_NOT_FOUND)

    sqldb.session.delete(invite)
    sqldb.session.commit()


def register_to_app(app: FastAPI):
    app.include_router(router)
