import time
from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated, cast

from fastapi import Depends, HTTPException, Request

from . import models
from .database import get_db

REAUTH_FRESHNESS_SECONDS = 300


def mark_recently_authenticated(request: Request) -> None:
    request.session["auth-time"] = int(time.time())


def recently_authenticated(request: Request) -> bool:
    auth_time = request.session.get("auth-time")
    return (
        isinstance(auth_time, int | float)
        and not isinstance(auth_time, bool)
        and 0 <= time.time() - auth_time < REAUTH_FRESHNESS_SECONDS
    )


def require_recent_authentication(request: Request) -> None:
    if not recently_authenticated(request):
        raise HTTPException(status_code=403, detail="reauthentication_required")


class LoginState(StrEnum):
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

    def __getitem__(self, key):
        return getattr(self, key)


@dataclass
class LoggedInInformation(LoginInformation):
    user: models.FlathubUser


def set_authenticated_session(
    request: Request, user_id: int, method: str, passkey_id: int | None = None
) -> None:
    request.session["user-id"] = user_id
    request.session["auth-method"] = method
    mark_recently_authenticated(request)
    if method == "passkey":
        request.session["passkey-id"] = passkey_id
    else:
        request.session.pop("passkey-id", None)
    request.session.pop("passkey-flow", None)


def _passkey_session_user(request: Request, user_id) -> models.FlathubUser | None:
    passkey_id = request.session.get("passkey-id")
    if type(passkey_id) is int:
        with get_db("writer") as db:
            user = db.session.get(models.FlathubUser, user_id)
            credential = db.session.get(models.PasskeyCredential, passkey_id)
            if (
                user is not None
                and not user.login_disabled
                and credential is not None
                and credential.user == user.id
            ):
                db.session.expunge(user)
                return user
    request.session.clear()
    return None


def _email_session_revoked(request: Request, db, user: models.FlathubUser) -> bool:
    from .email_login import has_oauth_account

    auth_method = request.session.get("auth-method")
    if auth_method is None:
        # Sessions created before auth-method was recorded; tag them once so
        # OAuth sessions stop paying for the email account lookup.
        if models.EmailAccount.by_user(db, user) is None or has_oauth_account(db, user):
            request.session["auth-method"] = "oauth"
            return False
        request.session["auth-method"] = auth_method = "email"
    if auth_method != "email":
        return False
    account = models.EmailAccount.by_user(db, user)
    return account is None or account.disabled_at is not None


def login_state(request: Request) -> LoginInformation:
    """
    A dependency which can be used to inject login status into endpoints.

    Returns a dictionary of:

    {
        state: LoginState,
        user: Optional[models.FlathubUser],
        method: Optional[str],
    }

    where the `user` value will be present if logged in at all
    And the method value will be present if a login flow is in progress
    """

    state: LoginState = LoginState.LOGGED_OUT
    user: models.FlathubUser | None = None
    method: str | None = None

    user_id = request.session.get("user-id", None)
    user = None
    if user_id is not None and request.session.get("auth-method") == "passkey":
        user = _passkey_session_user(request, user_id)
    elif user_id is not None:
        with get_db("replica") as db:
            user = db.session.get(models.FlathubUser, user_id)
            if user is not None and user.login_disabled:
                user = None
                del request.session["user-id"]
            elif user is not None and _email_session_revoked(request, db, user):
                user = None
                request.session.clear()
    if user is not None:
        state = LoginState.LOGGED_IN
    active_flow = request.session.get("active-login-flow", None)
    if active_flow is not None:
        method = active_flow
        if state == LoginState.LOGGED_IN:
            state = LoginState.LOGGING_IN_AGAIN
        else:
            state = LoginState.LOGGING_IN
    return LoginInformation(state, user, method)


LoginStatusDep = Annotated[LoginInformation, Depends(login_state)]


def logged_in(login: LoginStatusDep) -> LoggedInInformation:
    if login.state == LoginState.LOGGED_OUT or login.user is None:
        raise HTTPException(status_code=401, detail="not_logged_in")

    return cast("LoggedInInformation", login)


LoggedInDep = Annotated[LoggedInInformation, Depends(logged_in)]


def quality_moderator_only(login: LoggedInDep):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "quality-moderation" not in user.permissions():
            raise HTTPException(status_code=403, detail="not_quality_moderator")
        login.user = user
        return login


def view_users_only(login: LoggedInDep):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "view-users" not in user.permissions():
            raise HTTPException(status_code=403, detail="no_permission_to_view_users")
        login.user = user
        return login


def modify_users_only(login: LoggedInDep):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "modify-users" not in user.permissions():
            raise HTTPException(status_code=403, detail="no_permission_to_modify_users")
        login.user = user
        return login


def manage_oidc_clients_only(login: LoggedInDep):
    with get_db("replica") as db:
        user = db.session.get(models.FlathubUser, login.user.id)
        if user is None or "manage-oidc-clients" not in user.permissions():
            raise HTTPException(
                status_code=403, detail="no_permission_to_manage_oidc_clients"
            )
        login.user = user
        return login


def moderator_only(login: LoggedInDep):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "moderation" not in user.permissions():
            raise HTTPException(status_code=403, detail="not_moderator")
        login.user = user
        return login


def moderator_or_app_author_only(app_id: str, login: LoggedInDep):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "moderation" not in user.permissions() and app_id not in user.dev_flatpaks(
            db
        ):
            raise HTTPException(status_code=403, detail="not_app_developer")
        login.user = user
        return login


def app_author_only(app_id: str, login: LoggedInDep):
    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if app_id in user.dev_flatpaks(db):
            login.user = user
            return login

    raise HTTPException(status_code=403, detail="not_app_author")


def quality_moderator_or_app_author_only(app_id: str, login: LoggedInDep):
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


QualityModeratorDep = Annotated[LoggedInInformation, Depends(quality_moderator_only)]
ViewUsersDep = Annotated[LoggedInInformation, Depends(view_users_only)]
ModifyUsersDep = Annotated[LoggedInInformation, Depends(modify_users_only)]
ManageOidcClientsDep = Annotated[LoggedInInformation, Depends(manage_oidc_clients_only)]
ModeratorDep = Annotated[LoggedInInformation, Depends(moderator_only)]
ModeratorOrAppAuthorDep = Annotated[
    LoggedInInformation, Depends(moderator_or_app_author_only)
]
AppAuthorDep = Annotated[LoggedInInformation, Depends(app_author_only)]
QualityModeratorOrAppAuthorDep = Annotated[
    LoggedInInformation, Depends(quality_moderator_or_app_author_only)
]
