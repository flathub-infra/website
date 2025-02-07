from dataclasses import dataclass
from enum import Enum
from typing import Annotated

from fastapi import Depends, HTTPException, Request

from . import models
from .database import get_db


class LoginState(str, Enum):
    """Login state, used to track state machine for login flows etc."""

    LOGGED_OUT = "logged-out"
    LOGGING_IN = "logging-in"
    LOGGED_IN = "logged-in"
    LOGGING_IN_AGAIN = "logging-in-again"

    def logged_in(self):
        """Returns whether this LoginState suggests the user is logged in at all"""
        return self == LoginState.LOGGED_IN or self == LoginState.LOGGING_IN_AGAIN

    def logging_in(self):
        """Returns whether this LoginState indicates a login flow is in action right now"""
        return self == LoginState.LOGGING_IN or self == LoginState.LOGGING_IN_AGAIN


@dataclass
class LoginInformation:
    state: LoginState
    user: models.FlathubUser | None
    method: str | None
    method_intermediate: int | None

    def __getitem__(self, key):
        return getattr(self, key)


def login_state(request: Request) -> LoginInformation:
    """
    A dependency which can be used to inject login status into endpoints.

    Returns a dictionary of:

    {
        state: LoginState,
        user: Optional[models.FlathubUser],
        method: Optional[str],
        method_intermediate: Optional[int],
    }

    where the `user` value will be present if logged in at all
    And the method related values will be present if a login flow is in progress
    """

    state: LoginState = LoginState.LOGGED_OUT
    user: models.FlathubUser | None = None
    method: str | None = None
    method_intermediate: int | None = None

    user_id = request.session.get("user-id", None)
    user = None
    if user_id is not None:
        with get_db("replica") as db:
            user = db.session.get(models.FlathubUser, user_id)
    if user is not None and user.deleted:
        user = None
        del request.session["user-id"]
    if user is not None:
        state = LoginState.LOGGED_IN
    active_flow = request.session.get("active-login-flow", None)
    if active_flow is not None:
        method = active_flow
        method_intermediate = request.session["active-login-flow-intermediate"]
        if state == LoginState.LOGGED_IN:
            state = LoginState.LOGGING_IN_AGAIN
        else:
            state = LoginState.LOGGING_IN
    return LoginInformation(state, user, method, method_intermediate)


LoginStatusDep = Annotated[LoginInformation, Depends(login_state)]


def logged_in(login: LoginStatusDep):
    if login.state == LoginState.LOGGED_OUT or login.user is None:
        raise HTTPException(status_code=401, detail="not_logged_in")

    return login


def quality_moderator_only(login=Depends(logged_in)):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "quality-moderation" not in user.permissions():
            raise HTTPException(status_code=403, detail="not_quality_moderator")
        login.user = user
        return login


def view_users_only(login=Depends(logged_in)):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "view-users" not in user.permissions():
            raise HTTPException(status_code=403, detail="no_permission_to_view_users")
        login.user = user
        return login


def modify_users_only(login=Depends(logged_in)):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "modify-users" not in user.permissions():
            raise HTTPException(status_code=403, detail="no_permission_to_modify_users")
        login.user = user
        return login


def moderator_only(login=Depends(logged_in)):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "moderation" not in user.permissions():
            raise HTTPException(status_code=403, detail="not_moderator")
        login.user = user
        return login


def moderator_or_app_author_only(app_id: str, login=Depends(logged_in)):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "moderation" not in user.permissions():
            if app_id not in user.dev_flatpaks(db):
                raise HTTPException(status_code=403, detail="not_app_developer")
        login.user = user
        return login


def app_author_only(app_id: str, login=Depends(logged_in)):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if app_id in user.dev_flatpaks(db):
            login.user = user
            return login

    raise HTTPException(status_code=403, detail="not_app_author")


def quality_moderator_or_app_author_only(app_id: str, login=Depends(logged_in)):
    if login.user:
        with get_db("replica") as db:
            user = db.session.merge(login.user)
            if "quality-moderation" in user.permissions():
                login.user = user
                return login
            if app_id in user.dev_flatpaks(db):
                login.user = user
                return login

    raise HTTPException(status_code=403, detail="not_quality_moderator_or_app_author")
