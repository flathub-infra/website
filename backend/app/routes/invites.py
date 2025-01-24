from datetime import datetime
from enum import Enum

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path
from pydantic import BaseModel

from .. import worker
from ..database import get_db
from ..db import get_json_key
from ..emails import EmailCategory
from ..login_info import logged_in
from ..logins import LoginStatusDep
from ..models import (
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
    with get_db("replica") as db_session:
        if app := DirectUploadApp.by_app_id(db_session, app_id):
            return app
        else:
            raise HTTPException(status_code=404, detail=ErrorDetail.APP_NOT_FOUND)


def _check_permission(
    app: DirectUploadApp, user: FlathubUser, require_primary: bool = False
) -> DirectUploadAppDeveloper:
    with get_db("replica") as db_session:
        current_dev = DirectUploadAppDeveloper.by_developer_and_app(
            db_session, user, app
        )
        if current_dev is None:
            raise HTTPException(status_code=403, detail=ErrorDetail.NOT_APP_DEVELOPER)
        if require_primary and not current_dev.is_primary:
            raise HTTPException(
                status_code=403, detail=ErrorDetail.NOT_PRIMARY_APP_DEVELOPER
            )
        return current_dev


class InviteStatus(BaseModel):
    is_pending: bool
    is_direct_upload_app: bool = True


@router.get("/{app_id}", tags=["invite"])
def get_invite_status(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
) -> InviteStatus:
    with get_db("replica") as db_session:
        app = DirectUploadApp.by_app_id(db_session, app_id)
        if app is None:
            return InviteStatus(is_pending=False, is_direct_upload_app=False)

        invite = DirectUploadAppInvite.by_developer_and_app(db_session, login.user, app)
        if invite is not None:
            return InviteStatus(is_pending=True)

        developer = DirectUploadAppDeveloper.by_developer_and_app(
            db_session, login.user, app
        )
        if developer is not None:
            return InviteStatus(is_pending=False)

        raise HTTPException(status_code=404, detail=ErrorDetail.INVITE_NOT_FOUND)


@router.post("/{app_id}/invite", status_code=204, tags=["invite"])
def invite_developer(
    invite_code: str,
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    app = _get_app(app_id)
    _check_permission(app, login.user, require_primary=True)

    with get_db("writer") as db_session:
        invited_user = FlathubUser.by_invite_code(
            db_session, invite_code.replace("-", "")
        )
        if invited_user is None:
            raise HTTPException(status_code=404, detail=ErrorDetail.USER_NOT_FOUND)

        existing_dev = DirectUploadAppDeveloper.by_developer_and_app(
            db_session, invited_user, app
        )
        if existing_dev is not None:
            raise HTTPException(status_code=400, detail=ErrorDetail.ALREADY_DEVELOPER)

        existing_invite = DirectUploadAppInvite.by_developer_and_app(
            db_session, invited_user, app
        )
        if existing_invite is not None:
            raise HTTPException(status_code=400, detail=ErrorDetail.ALREADY_INVITED)

        invite = DirectUploadAppInvite(
            app_id=app.id,
            developer_id=invited_user.id,
        )

        db_session.add(invite)
        db_session.commit()

    if app_metadata := get_json_key(f"apps:{app.app_id}"):
        app_name = app_metadata["name"]
        subject = (
            f"You have been invited to be a developer of {app_name} ({app.app_id})"
        )
    else:
        app_name = None
        subject = f"You have been invited to be a developer of {app.app_id}"

    payload = {
        "messageId": f"{app.app_id}/{invite.id}/invited",
        "creation_timestamp": datetime.now().timestamp(),
        "userId": invited_user.id,
        "subject": subject,
        "previewText": subject,
        "messageInfo": {
            "category": EmailCategory.DEVELOPER_INVITE,
            "appId": app.app_id,
            "appName": app_name,
            "inviter": login.user.display_name,
        },
    }

    worker.send_email_new.send(payload)


@router.post("/{app_id}/accept", status_code=204, tags=["invite"])
def accept_invite(
    login: LoginStatusDep,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    if not login.user or not login.state.logged_in():
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_LOGGED_IN)
    elif login.user.accepted_publisher_agreement_at is None:
        raise HTTPException(
            status_code=403, detail=ErrorDetail.MUST_ACCEPT_PUBLISHER_AGREEMENT
        )

    app = _get_app(app_id)

    with get_db("writer") as db_session:
        invite = DirectUploadAppInvite.by_developer_and_app(db_session, login.user, app)
        if invite is None:
            raise HTTPException(status_code=404, detail=ErrorDetail.INVITE_NOT_FOUND)

        developer = DirectUploadAppDeveloper(
            app_id=app.id,
            developer_id=login.user.id,
            is_primary=False,
        )

        db_session.add(developer)
        db_session.delete(invite)
        db_session.commit()

    username = login.user.display_name

    if app_metadata := get_json_key(f"apps:{app.app_id}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    payload = {
        "messageId": f"{app_id}/{invite.id}/success",
        "creation_timestamp": datetime.now().timestamp(),
        "subject": f"{username} is now a developer",
        "previewText": f"{username} is now a developer",
        "messageInfo": {
            "category": EmailCategory.DEVELOPER_INVITE_ACCEPTED,
            "appId": app_id,
            "appName": app_name,
            "references": f"{app_id}/{invite.id}/invited",
            "login": username,
        },
    }

    worker.send_email_new.send(payload)


@router.post("/{app_id}/decline", status_code=204, tags=["invite"])
def decline_invite(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    app = _get_app(app_id)

    with get_db("writer") as db_session:
        invite = DirectUploadAppInvite.by_developer_and_app(db_session, login.user, app)
        if invite is None:
            raise HTTPException(status_code=404, detail=ErrorDetail.INVITE_NOT_FOUND)

        db_session.delete(invite)
        db_session.commit()

        primary_dev = DirectUploadAppDeveloper.primary_for_app(db_session, app)

    if app_metadata := get_json_key(f"apps:{app.app_id}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    payload = {
        "messageId": f"{app.app_id}/{invite.id}/decline",
        "creation_timestamp": datetime.now().timestamp(),
        "subject": f"{login.user.display_name} declined their invite",
        "previewText": f"{login.user.display_name} declined their invite",
        "messageInfo": {
            "category": EmailCategory.DEVELOPER_INVITE_DECLINED,
            "userId": primary_dev.developer_id,
            "appId": app.app_id,
            "appName": app_name,
            "references": f"{app_id}/{invite.id}/invited",
            "login": login.user.display_name,
        },
    }

    worker.send_email_new.send(payload)


@router.post("/{app_id}/leave", status_code=204, tags=["invite"])
def leave_team(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    app = _get_app(app_id)
    developer = _check_permission(app, login.user)

    with get_db("writer") as db_session:
        db_session.delete(developer)
        db_session.commit()

    if app_metadata := get_json_key(f"apps:{app.app_id}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    payload = {
        "messageId": f"{app_id}/{login.user.id}/{datetime.now().isoformat()}/left",
        "creation_timestamp": datetime.now().timestamp(),
        "subject": f"{login.user.display_name} left the developer team",
        "previewText": f"{login.user.display_name} left the developer team",
        "messageInfo": {
            "category": EmailCategory.DEVELOPER_LEFT,
            "appId": app.app_id,
            "appName": app_name,
            "login": login.user.display_name,
        },
    }

    worker.send_email_new.send(payload)


class Developer(BaseModel):
    id: int
    is_self: bool
    name: str | None
    is_primary: bool | None = None


class DevelopersResponse(BaseModel):
    developers: list[Developer]
    invites: list[Developer]


@router.get("/{app_id}/developers", tags=["invite"])
def get_app_developers(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
) -> DevelopersResponse:
    app = _get_app(app_id)
    _check_permission(app, login.user)

    with get_db("replica") as db_session:
        invites = DirectUploadAppInvite.by_app(db_session, app)
        developers = DirectUploadAppDeveloper.by_app(db_session, app)

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


@router.post("/{app_id}/remove-developer", status_code=204, tags=["invite"])
def remove_developer(
    developer_id: int,
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    app = _get_app(app_id)
    _check_permission(app, login.user, require_primary=True)

    with get_db("writer") as db_session:
        developer = DirectUploadAppDeveloper.by_id(db_session, developer_id)
        if developer is None or developer.app_id != app.id:
            raise HTTPException(status_code=404, detail=ErrorDetail.DEVELOPER_NOT_FOUND)
        if developer.is_primary:
            raise HTTPException(status_code=400, detail=ErrorDetail.CANNOT_ABANDON_APP)

        db_session.delete(developer)
        db_session.commit()


@router.post("/{app_id}/revoke", status_code=204, tags=["invite"])
def revoke_invite(
    invite_id: int,
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    app = _get_app(app_id)
    _check_permission(app, login.user, require_primary=True)

    with get_db("writer") as db_session:
        invite = DirectUploadAppInvite.by_id(db_session, invite_id)
        if invite is None or invite.app_id != app.id:
            raise HTTPException(status_code=404, detail=ErrorDetail.DEVELOPER_NOT_FOUND)

        db_session.delete(invite)
        db_session.commit()


def register_to_app(app: FastAPI):
    app.include_router(router)
