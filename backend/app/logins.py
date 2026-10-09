"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""

import hashlib
import hmac
import json
import secrets
import time
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Annotated, cast
from urllib.parse import urlsplit

import httpx
import redis
from authlib.integrations.base_client.errors import OAuthError
from authlib.oauth2.base import OAuth2Error
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from github import Github
from github.AuthenticatedUser import AuthenticatedUser
from gitlab import Gitlab
from gitlab.exceptions import GitlabError
from pydantic import BaseModel, Field, StringConstraints, field_validator
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from starlette.middleware.sessions import SessionMiddleware
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import (
    bytes_to_base64url,
    options_to_json_dict,
    parse_authentication_credential_json,
    parse_client_data_json,
    parse_registration_credential_json,
)
from webauthn.helpers.exceptions import WebAuthnException
from webauthn.helpers.structs import (
    AttestationConveyancePreference,
    AuthenticatorSelectionCriteria,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from . import (
    apps,
    audit_log,
    cache,
    config,
    http_client,
    models,
    oauth_providers,
    utils,
)
from .database import get_db
from .email_login import (
    email_login_allowed,
    lock_email,
    normalize_login_email,
    oauth_email_exists,
    safe_locale,
    safe_return_to,
)
from .emails import EmailCategory
from .login_info import (
    LoggedInDep,
    LoginInformation,
    LoginState,
    LoginStatusDep,
    set_authenticated_session,
)
from .types import JSONValue


def _log_login_failure(
    request: Request,
    login: LoginInformation,
    method: str,
    error: str,
):
    """Record a failed login attempt without blocking the response."""
    audit_log.enqueue_audit_log(
        request,
        login.user.id if login.user else None,
        models.AuditEventType.LOGIN_FAILURE,
        provider=method,
        details={"error": error},
    )


class OauthLoginResponseSuccess(BaseModel):
    code: str
    state: str


class OauthLoginResponseFailure(BaseModel):
    state: str
    error: str
    error_description: str | None = None
    error_uri: str | None = None


OauthLoginResponse = OauthLoginResponseSuccess | OauthLoginResponseFailure


class UserDeleteRequest(BaseModel):
    token: str


OAUTH_STATE_TTL_SECONDS = 15 * 60


def _oauth_state_key(method: str) -> str:
    return f"_oauth_state_{method}"


def _get_oauth_state(request: Request, method: str) -> tuple[str, float] | None:
    stored = request.session.get(_oauth_state_key(method))
    if not isinstance(stored, dict):
        return None

    state = stored.get("state")
    created = stored.get("created")
    if not isinstance(state, str) or not isinstance(created, (int, float)):
        return None

    return state, float(created)


def _clear_oauth_session(request: Request, method: str | None = None):
    request.session.pop("active-login-flow", None)
    request.session.pop("active-login-flow-intermediate", None)

    if method is None:
        for provider in oauth_providers.PROVIDERS:
            request.session.pop(_oauth_state_key(provider), None)
        return

    request.session.pop(_oauth_state_key(method), None)


_OAuthRefreshableAccount = (
    models.GitlabAccount
    | models.GnomeAccount
    | models.GoogleAccount
    | models.KdeAccount
)


def refresh_repo_list(gh_access_token: str, accountId: int):
    from .worker.refresh_github_repo_list import refresh_github_repo_list

    refresh_github_repo_list.send(gh_access_token, accountId)


def _refresh_token(account: _OAuthRefreshableAccount, method: str) -> str:
    if account.token_expiry is None or account.token_expiry > utils.utcnow():
        return account.token

    provider = oauth_providers.get_provider_config(method)
    response = http_client.post(
        provider.token_url,
        data={
            "grant_type": "refresh_token",
            "refresh_token": account.refresh_token,
            "client_id": provider.client_id(),
            "client_secret": provider.client_secret(),
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh {method} token: {response.status_code}",
        )

    login_result = response.json()

    if (
        "token_type" not in login_result
        or login_result["token_type"].lower() != "bearer"
        or "access_token" not in login_result
    ):
        raise HTTPException(
            status_code=500,
            detail=f"{method} login flow did not return a bearer token",
        )

    account.token = login_result["access_token"]
    if "refresh_token" in login_result:
        account.refresh_token = login_result["refresh_token"]
        account.token_expiry = utils.utcnow() + timedelta(
            seconds=int(login_result.get("expires_in", "7200"))
        )

    return account.token


def refresh_oauth_token(account: models.ConnectedAccount) -> str:
    """Makes sure the account has an up to date access token, refreshing it with the refresh token if needed.
    If the token is updated, db.session.commit() is called to save the change."""

    with get_db("writer") as db:
        account = db.merge(account)
        return _refresh_token(
            cast("_OAuthRefreshableAccount", account), account.provider.value
        )


router = APIRouter(prefix="/auth")


_email_rate_store = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    db=config.settings.redis_db,
    decode_responses=True,
    socket_connect_timeout=0.2,
    socket_timeout=0.2,
)
_EMAIL_RATE_SCRIPT = """
local counts = {}
for i = 1, #KEYS do
    counts[i] = redis.call('INCR', KEYS[i])
    if counts[i] == 1 then
        redis.call('EXPIRE', KEYS[i], ARGV[i])
    end
end
return counts
"""
_EMAIL_REQUEST_RATE_SCRIPT = """
local ip = redis.call('INCR', KEYS[1])
if ip == 1 then redis.call('EXPIRE', KEYS[1], 3600) end
local minute = redis.call('EXISTS', KEYS[2])
local hour = tonumber(redis.call('GET', KEYS[3]) or '0')
if ip > 20 or minute == 1 or hour >= 5 then
    return {ip, minute + 1, hour + 1}
end
redis.call('SET', KEYS[2], ARGV[1], 'EX', 60)
hour = redis.call('INCR', KEYS[3])
if hour == 1 then redis.call('EXPIRE', KEYS[3], 3600) end
return {ip, 1, hour}
"""
_EMAIL_RELEASE_RATE_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    redis.call('DEL', KEYS[1])
    if tonumber(redis.call('GET', KEYS[2]) or '0') > 0 then
        redis.call('DECR', KEYS[2])
    end
end
"""


class EmailLinkRequest(BaseModel):
    email: str
    locale: str = "en"
    return_to: str | None = None


class EmailLinkAccepted(BaseModel):
    status: str = "accepted"


class EmailLoginConfig(BaseModel):
    enabled: bool


@router.get("/email/config", tags=["auth"])
@cache.no_store
def get_email_login_config(response: Response) -> EmailLoginConfig:
    response.headers["Cache-Control"] = "no-store"
    return EmailLoginConfig(enabled=config.settings.email_login_enabled)


@router.post("/email/request", status_code=202, tags=["auth"])
@cache.no_store
def request_email_login(
    body: EmailLinkRequest, request: Request, response: Response, login: LoginStatusDep
) -> EmailLinkAccepted:
    response.headers["Cache-Control"] = "no-store"
    if not config.settings.email_login_enabled:
        raise HTTPException(status_code=404, detail="email_login_disabled")
    if login.user is not None:
        raise HTTPException(status_code=409, detail="already_logged_in")
    if request.headers.get("origin") != config.settings.frontend_url.rstrip("/"):
        raise HTTPException(status_code=403, detail="invalid_origin")
    try:
        email = normalize_login_email(body.email)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="invalid_email_request") from exc

    address_key = hmac.new(
        config.settings.session_secret_key.encode(),
        email.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()
    ip = request.client.host if request.client else "unknown"
    keys = [
        f"email-login:ip:{ip}:hour",
        f"email-login:address:{address_key}:minute",
        f"email-login:address:{address_key}:hour",
    ]
    reservation = secrets.token_urlsafe(16)
    try:
        counts = cast(
            "list[int]",
            _email_rate_store.eval(
                _EMAIL_REQUEST_RATE_SCRIPT, len(keys), *keys, reservation
            ),
        )
    except (redis.RedisError, OSError) as exc:
        raise HTTPException(status_code=503, detail="email_login_unavailable") from exc
    if counts[0] > 20:
        raise HTTPException(
            status_code=429,
            detail="email_login_rate_limited",
            headers={"Retry-After": "3600"},
        )
    with get_db("writer") as db:
        account = db.session.query(models.EmailAccount).filter_by(email=email).first()
        user_id = account.user if account is not None else None
    if counts[1] > 1 or counts[2] > 5:
        return EmailLinkAccepted()
    from .worker.emails import send_email_login_link

    try:
        send_email_login_link.send(
            email,
            safe_locale(body.locale),
            safe_return_to(body.return_to),
            datetime.now(UTC).timestamp(),
            user_id,
        )
    except Exception as exc:
        try:
            _email_rate_store.eval(
                _EMAIL_RELEASE_RATE_SCRIPT, 2, keys[1], keys[2], reservation
            )
        except (redis.RedisError, OSError):
            pass
        raise HTTPException(status_code=503, detail="email_login_unavailable") from exc
    return EmailLinkAccepted()


class EmailConfirmRequest(BaseModel):
    token: str = Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]{43}$")


class EmailConfirmResult(BaseModel):
    status: str = "ok"
    return_to: str


def _limit_email_confirmation(request: Request) -> None:
    if not config.settings.email_login_enabled:
        raise HTTPException(status_code=404, detail="email_login_disabled")
    if request.headers.get("origin") != config.settings.frontend_url.rstrip("/"):
        raise HTTPException(status_code=403, detail="invalid_origin")
    ip = request.client.host if request.client else "unknown"
    try:
        count = cast(
            "list[int]",
            _email_rate_store.eval(
                _EMAIL_RATE_SCRIPT, 1, f"email-login:confirm:{ip}", 60
            ),
        )[0]
    except (redis.RedisError, OSError) as exc:
        raise HTTPException(status_code=503, detail="email_login_unavailable") from exc
    if count > 30:
        raise HTTPException(
            status_code=429,
            detail="email_login_rate_limited",
            headers={"Retry-After": "60"},
        )


@router.post(
    "/email/confirm",
    tags=["auth"],
    dependencies=[Depends(_limit_email_confirmation)],
)
@cache.no_store
def confirm_email_login(
    body: EmailConfirmRequest, request: Request, login: LoginStatusDep
) -> EmailConfirmResult:
    token_hash = hashlib.sha256(body.token.encode("ascii")).hexdigest()
    with get_db("writer") as db:
        initial = db.session.scalar(
            select(models.EmailLoginChallenge).where(
                models.EmailLoginChallenge.token_hash == token_hash
            )
        )
        if initial is None:
            _log_login_failure(request, login, "email", "invalid_email_link")
            raise HTTPException(status_code=400, detail="invalid_email_link")
        email = initial.email
        lock_email(db, email)
        account = db.session.scalar(
            select(models.EmailAccount).where(models.EmailAccount.email == email)
        )
        user = None
        if account is not None:
            user = db.session.scalar(
                select(models.FlathubUser)
                .where(models.FlathubUser.id == account.user)
                .with_for_update()
            )
        challenge = db.session.scalar(
            select(models.EmailLoginChallenge)
            .where(models.EmailLoginChallenge.token_hash == token_hash)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        now = utils.utcnow()
        if (
            challenge is None
            or challenge.consumed_at is not None
            or challenge.expires_at <= now
            or (
                challenge.user_id is not None
                and (account is None or challenge.user_id != account.user)
            )
            or (
                account is not None
                and (user is None or not email_login_allowed(db, user))
            )
            or (account is None and oauth_email_exists(db, email))
        ):
            audit_log.enqueue_audit_log(
                request,
                user.id if user is not None else None,
                models.AuditEventType.LOGIN_FAILURE,
                provider="email",
                details={"error": "invalid_email_link"},
            )
            raise HTTPException(status_code=400, detail="invalid_email_link")
        if login.user is not None and (user is None or login.user.id != user.id):
            _log_login_failure(request, login, "email", "email_session_conflict")
            raise HTTPException(status_code=409, detail="email_session_conflict")
        if user is None:
            user = models.FlathubUser(display_name=None, default_account="email")
            db.session.add(user)
            db.session.flush()
            account = models.EmailAccount(
                user=user.id, email=email, verified_at=now, last_used=now
            )
            db.session.add(account)
        else:
            account.last_used = now
        db.session.execute(
            update(models.EmailLoginChallenge)
            .where(
                models.EmailLoginChallenge.email == email,
                models.EmailLoginChallenge.consumed_at.is_(None),
            )
            .values(consumed_at=now)
        )
        user_id = user.id
        return_to = challenge.return_to
        db.commit()
    _clear_oauth_session(request)
    set_authenticated_session(request, user_id, "email")
    pending_oidc = request.session.get("oidc_authorize_params")
    if isinstance(pending_oidc, dict):
        pending_oidc["_login_flow_started"] = True
        request.session["oidc_authorize_params"] = pending_oidc
    audit_log.enqueue_audit_log(
        request, user_id, models.AuditEventType.LOGIN_SUCCESS, provider="email"
    )
    return EmailConfirmResult(return_to=return_to)


class LoginMethod(BaseModel):
    method: str
    name: str


@router.get(
    "/login",
    tags=["auth"],
    responses={
        200: {"description": "Available login methods"},
    },
)
def get_login_methods() -> list[LoginMethod]:
    """
    Retrieve the login methods available from the backend.

    For each method returned, flow starts with a `GET` to the endpoint
    `.../login/{method}` and upon completion from the user-agent, with a `POST`
    to that same endpoint name.

    Each method is also given a button icon and some text to use, though
    frontends with localisation may choose to render other text instead.
    """
    return [
        LoginMethod(method="github", name="GitHub"),
        LoginMethod(method="gitlab", name="GitLab"),
        LoginMethod(method="gnome", name="GNOME GitLab"),
        LoginMethod(method="kde", name="KDE GitLab"),
    ]


@router.get(
    "/login/github",
    tags=["auth"],
    responses={
        200: {"description": "OAuth flow started successfully"},
        400: {"description": "User already logged in with GitHub"},
    },
)
@cache.no_store
def start_github_flow(request: Request, login: LoginStatusDep):
    """
    Starts a github login flow.  This will set session cookie values and
    will return a redirect.  The frontend is expected to save the cookie
    for use later, and follow the redirect to Github

    Upon return from Github to the frontend, the frontend should POST to this
    endpoint with the relevant data from Github

    If the user is already logged in, and has a valid github token stored,
    then this will return an error instead.
    """
    return start_oauth_flow(
        request,
        login,
        "github",
        models.GithubAccount,
    )


@router.get(
    "/login/gitlab",
    tags=["auth"],
    responses={
        200: {"description": "OAuth flow started successfully"},
        400: {"description": "User already logged in with GitLab"},
    },
)
@cache.no_store
def start_gitlab_flow(request: Request, login: LoginStatusDep):
    """
    Starts a gitlab login flow.  This will set session cookie values and
    will return a redirect.  The frontend is expected to save the cookie
    for use later, and follow the redirect to Gitlab

    Upon return from Gitlab to the frontend, the frontend should POST to this
    endpoint with the relevant data from Gitlab

    If the user is already logged in, and has a valid gitlab token stored,
    then this will return an error instead.
    """
    return start_oauth_flow(
        request,
        login,
        "gitlab",
        models.GitlabAccount,
    )


@router.get(
    "/login/gnome",
    tags=["auth"],
    responses={
        200: {"description": "OAuth flow started successfully"},
        400: {"description": "User already logged in with GNOME GitLab"},
    },
)
@cache.no_store
def start_gnome_flow(request: Request, login: LoginStatusDep):
    """
    Starts a GNOME login flow.  This will set session cookie values and
    will return a redirect.  The frontend is expected to save the cookie
    for use later, and follow the redirect to GNOME Gitlab

    Upon return from GNOME to the frontend, the frontend should POST to this
    endpoint with the relevant data from GNOME Gitlab

    If the user is already logged in, and has a valid GNOME Gitlab token stored,
    then this will return an error instead.
    """
    return start_oauth_flow(
        request,
        login,
        "gnome",
        models.GnomeAccount,
    )


@router.get(
    "/login/kde",
    tags=["auth"],
    responses={
        200: {"description": "OAuth flow started successfully"},
        400: {"description": "User already logged in with KDE GitLab"},
    },
)
@cache.no_store
def start_kde_flow(request: Request, login: LoginStatusDep):
    return start_oauth_flow(
        request,
        login,
        "kde",
        models.KdeAccount,
    )


def start_oauth_flow(
    request: Request,
    login: LoginInformation,
    method: str,
    account_model: "_OAuthAccountModel",
):
    """
    Start an oauth login flow. This uses the session-backed flow state, the
    login state, and handles getting logins started assuming they follow a
    basic oauth model.

    Examples of oauth flows include Github and Gitlab.
    """
    if login["state"].logging_in():
        # Already logging in to something
        if login["method"] == method:
            # Already logging into correct method, so assume something went squiffy
            # and send them back with the same in-progress login
            pass
        else:
            request.session.pop("user-id", None)
            _clear_oauth_session(request)

    user = login["user"]
    if user:
        with get_db("replica") as db:
            account = account_model.by_user(db, user)
            if account is not None and account.token is not None:
                return JSONResponse(
                    {"state": "error", "error": f"User already logged into {method}"},
                    status_code=400,
                )

    provider = oauth_providers.get_provider_config(method)
    if provider.authorize_url is None:
        raise HTTPException(
            status_code=500, detail=f"{method} login flow is not configured"
        )

    state: str | None = None
    created = datetime.now(UTC).timestamp()
    existing_state = _get_oauth_state(request, method)
    if (
        login["state"].logging_in()
        and login["method"] == method
        and existing_state is not None
        and created - existing_state[1] <= OAUTH_STATE_TTL_SECONDS
    ):
        state, created = existing_state

    with oauth_providers.get_oauth_client(method) as client:
        url, state = client.create_authorization_url(
            provider.authorize_url,
            state=state,
            **provider.authorize_params,
        )

    request.session["active-login-flow"] = method
    request.session.pop("active-login-flow-intermediate", None)
    request.session[_oauth_state_key(method)] = {
        "state": state,
        "created": created,
    }
    pending_oidc = request.session.get("oidc_authorize_params")
    if isinstance(pending_oidc, dict):
        pending_oidc["_login_flow_started"] = True
        request.session["oidc_authorize_params"] = pending_oidc
    return {
        "state": "ok",
        "redirect": url,
    }


@dataclass
class ProviderInfo:
    id: str
    login: str
    name: str | None = None
    avatar_url: str | None = None
    email: str | None = None


@router.post(
    "/login/github",
    tags=["auth"],
    responses={
        200: {"description": "Login flow completed successfully"},
        400: {"description": "Invalid flow state or token expired"},
        500: {"description": "OAuth provider error or login failure"},
    },
)
@cache.no_store
def continue_github_flow(
    data: OauthLoginResponse, request: Request, login: LoginStatusDep
):
    """
    Process the result of the Github oauth flow

    This expects to have some JSON posted to it which (on success) contains:

    ```
    {
        "state": "the state code",
        "code": "the github oauth code",
    }
    ```

    On failure, the frontend should pass through the state and error so that
    the backend can clear the stored flow state

    ```
    {
        "state": "the state code",
        "error": "the error code returned from github",
    }
    ```

    This endpoint will either return an error, if something was wrong in the
    backend state machines; or it will return a success code with an indication
    of whether or not the login sequence completed OK.
    """

    def github_userdata(tokens) -> ProviderInfo:
        gh = Github(tokens["access_token"])
        ghuser = gh.get_user()
        assert isinstance(ghuser, AuthenticatedUser)

        email = next((e.email for e in ghuser.get_emails() if e.primary), None)

        return ProviderInfo(
            str(ghuser.id),
            ghuser.login,
            name=ghuser.name,
            avatar_url=ghuser.avatar_url,
            email=email,
        )

    def github_postlogin(tokens, account: models.GithubAccount):
        from .worker.refresh_github_repo_list import refresh_github_repo_list

        refresh_github_repo_list.send(tokens["access_token"], account.id)

    return continue_oauth_flow(
        request,
        login,
        data,
        "github",
        github_userdata,
        models.GithubAccount,
        github_postlogin,
    )


def _gitlab_provider_info(url, tokens) -> ProviderInfo:
    gl = Gitlab(url, oauth_token=tokens["access_token"])
    gl.auth()
    gluser = gl.user
    if gluser is None:
        raise HTTPException(status_code=401, detail="gitlab_auth_failed")
    return ProviderInfo(
        gluser.id,
        gluser.username,
        name=gluser.name,
        avatar_url=gluser.avatar_url,
        email=gluser.email,
    )


@router.post(
    "/login/gitlab",
    tags=["auth"],
    responses={
        200: {"description": "Login flow completed successfully"},
        400: {"description": "Invalid flow state or token expired"},
        500: {"description": "OAuth provider error or login failure"},
    },
)
@cache.no_store
def continue_gitlab_flow(
    data: OauthLoginResponse, request: Request, login: LoginStatusDep
):
    """
    Process the result of the Gitlab oauth flow

    This expects to have some JSON posted to it which (on success) contains:

    ```
    {
        "state": "the state code",
        "code": "the gitlab oauth code",
    }
    ```

    On failure, the frontend should pass through the state and error so that
    the backend can clear the stored flow state

    ```
    {
        "state": "the state code",
        "error": "the error code returned from gitlab",
    }
    ```

    This endpoint will either return an error, if something was wrong in the
    backend state machines; or it will return a success code with an indication
    of whether or not the login sequence completed OK.
    """

    def gitlab_userdata(tokens) -> ProviderInfo:
        return _gitlab_provider_info("https://gitlab.com", tokens)

    return continue_oauth_flow(
        request,
        login,
        data,
        "gitlab",
        gitlab_userdata,
        models.GitlabAccount,
    )


@router.post(
    "/login/gnome",
    tags=["auth"],
    responses={
        200: {"description": "Login flow completed successfully"},
        400: {"description": "Invalid flow state or token expired"},
        500: {"description": "OAuth provider error or login failure"},
    },
)
@cache.no_store
def continue_gnome_flow(
    data: OauthLoginResponse, request: Request, login: LoginStatusDep
):
    """
    Process the result of the GNOME oauth flow

    This expects to have some JSON posted to it which (on success) contains:

    ```
    {
        "state": "the state code",
        "code": "the gitlab oauth code",
    }
    ```

    On failure, the frontend should pass through the state and error so that
    the backend can clear the stored flow state

    ```
    {
        "state": "the state code",
        "error": "the error code returned from GNOME gitlab",
    }
    ```

    This endpoint will either return an error, if something was wrong in the
    backend state machines; or it will return a success code with an indication
    of whether or not the login sequence completed OK.
    """

    def gnome_userdata(tokens) -> ProviderInfo:
        return _gitlab_provider_info("https://gitlab.gnome.org", tokens)

    return continue_oauth_flow(
        request,
        login,
        data,
        "gnome",
        gnome_userdata,
        models.GnomeAccount,
    )


@router.post(
    "/login/google",
    tags=["auth"],
    responses={
        200: {"description": "Login flow completed successfully"},
        400: {"description": "Invalid flow state or token expired"},
        500: {"description": "OAuth provider error or login failure"},
    },
)
@cache.no_store
def continue_google_flow(
    data: OauthLoginResponse, request: Request, login: LoginStatusDep
):
    """
    Process the result of the Google oauth flow

    This expects to have some JSON posted to it which (on success) contains:

    ```
    {
        "state": "the state code",
        "code": "the google oauth code",
    }
    ```

    On failure, the frontend should pass through the state and error so that
    the backend can clear the stored flow state

    ```
    {
        "state": "the state code",
        "error": "the error code returned from google",
    }
    ```

    This endpoint will either return an error, if something was wrong in the
    backend state machines; or it will return a success code with an indication
    of whether or not the login sequence completed OK.
    """

    def google_userdata(tokens) -> ProviderInfo:
        userinfo_endpoint = "https://www.googleapis.com/oauth2/v3/userinfo"
        access_token = tokens["access_token"]
        gguser = http_client.get(
            userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"}
        ).json()
        sub = gguser["sub"]
        login = gguser.get("email", sub)
        return ProviderInfo(
            sub,
            login,
            name=gguser.get("name", login),
            avatar_url=gguser.get("picture"),
        )

    return continue_oauth_flow(
        request,
        login,
        data,
        "google",
        google_userdata,
        models.GoogleAccount,
    )


@router.post(
    "/login/kde",
    tags=["auth"],
    responses={
        200: {"description": "Login flow completed successfully"},
        400: {"description": "Invalid flow state or token expired"},
        500: {"description": "OAuth provider error or login failure"},
    },
)
@cache.no_store
def continue_kde_flow(
    data: OauthLoginResponse, request: Request, login: LoginStatusDep
):
    def kde_userdata(tokens) -> ProviderInfo:
        return _gitlab_provider_info("https://invent.kde.org", tokens)

    return continue_oauth_flow(
        request,
        login,
        data,
        "kde",
        kde_userdata,
        models.KdeAccount,
    )


def _upgrade_email_user(
    db,
    user: models.FlathubUser,
    method: str,
    provider_data: "ProviderInfo",
    login_result: dict[str, JSONValue],
    account_model: type[models.ConnectedAccount],
):
    from .email_login import lock_email, normalize_login_email

    email_account = models.EmailAccount.by_user(db, user)
    if email_account is None:
        return None
    provider_email = None
    if provider_data.email:
        try:
            provider_email = normalize_login_email(provider_data.email)
        except ValueError:
            provider_email = None
    emails = {email_account.email}
    if provider_email:
        emails.add(provider_email)
    for email in sorted(emails):
        lock_email(db, email)
    locked = db.session.scalar(
        select(models.FlathubUser)
        .where(models.FlathubUser.id == user.id)
        .with_for_update()
    )
    if locked is None or not email_login_allowed(db, locked):
        return None
    if provider_email and oauth_email_exists(db, provider_email):
        return None

    userid = {f"{method}_userid": provider_data.id}
    account = account_model(
        **userid,
        token=login_result["access_token"],
        last_used=utils.utcnow(),
        user=locked.id,
        login=provider_data.login,
        avatar_url=provider_data.avatar_url,
        display_name=provider_data.name,
        email=provider_data.email,
    )
    if "refresh_token" in login_result:
        refreshable = cast("_OAuthRefreshableAccount", account)
        refreshable.refresh_token = login_result["refresh_token"]
        expires_in = login_result.get("expires_in", "7200")
        if not isinstance(expires_in, (str, int, float)):
            raise TypeError("OAuth token expiry must be numeric or a string")
        refreshable.token_expiry = utils.utcnow() + timedelta(seconds=int(expires_in))
    db.add(account)
    email_account.disabled_at = utils.utcnow()
    db.session.execute(
        update(models.EmailLoginChallenge)
        .where(
            models.EmailLoginChallenge.email == email_account.email,
            models.EmailLoginChallenge.consumed_at.is_(None),
        )
        .values(consumed_at=utils.utcnow())
    )
    locked.default_account = method
    for table in (
        models.OidcAuthorizationCode,
        models.OidcAccessToken,
        models.OidcRefreshToken,
    ):
        table.delete_user(db, locked)
    return account


_OAuthAccountModel = (
    type[models.GithubAccount]
    | type[models.GitlabAccount]
    | type[models.GnomeAccount]
    | type[models.GoogleAccount]
    | type[models.KdeAccount]
)


def continue_oauth_flow(
    request: Request,
    login: LoginInformation,
    data: OauthLoginResponse,
    method: str,
    token_to_data: Callable[[dict[str, JSONValue]], ProviderInfo],
    account_model: "_OAuthAccountModel",
    postlogin_handler: Callable[..., object] | None = None,
):
    """
    Continue an oauth login flow.  This will complete the user's login using the
    ongoing authentication flow.  Upon completion the user will be logged in successfully.
    If any error occurs, we return that as a JSONResponse.  If the caller wishes to
    perform additional work post-login (e.g. retrieving github/gitlab user information)
    then they can do so if the return type of this function is simply `dict`.
    """
    if login.method != method:
        _log_login_failure(request, login, method, "Not mid-login flow")
        return JSONResponse(
            {
                "state": "error",
                "error": f"Not mid-{method} login flow. Try to resume a {login.method} login",
            },
            status_code=400,
        )
    stored = _get_oauth_state(request, method)
    _clear_oauth_session(request, method)

    if (
        stored is None
        or datetime.now(UTC).timestamp() - stored[1] > OAUTH_STATE_TTL_SECONDS
    ):
        _log_login_failure(request, login, method, "Login state expired or missing")
        return JSONResponse(
            {
                "state": "error",
                "error": "Login token has expired, please try again",
            },
            status_code=400,
        )

    if stored[0] != data.state:
        _log_login_failure(request, login, method, "OAuth state token mismatch")
        return JSONResponse(
            {
                "state": "error",
                "error": f"{method} authentication flow token does not match",
            },
            status_code=400,
        )

    if isinstance(data, OauthLoginResponseFailure):
        return {
            "status": "ok",
            "result": "flow_abandoned",
        }

    provider = oauth_providers.get_provider_config(method)
    try:
        with oauth_providers.get_oauth_client(method) as client:
            login_result = client.fetch_token(
                provider.token_url,
                code=data.code,
            )
    except (OAuth2Error, OAuthError) as e:
        detail = e.description or e.error or str(e)
        _log_login_failure(request, login, method, f"OAuth error: {detail!r}")
        return JSONResponse(
            {
                "state": "error",
                "error": f"{method} login flow had an error: {detail!r}",
            },
            status_code=500,
        )
    except httpx.HTTPError as e:
        _log_login_failure(request, login, method, f"HTTP error: {str(e)!r}")
        return JSONResponse(
            {
                "state": "error",
                "error": f"{method} login flow had an error: {str(e)!r}",
            },
            status_code=500,
        )

    if (
        login_result.get("token_type", "").lower() != "bearer"
        or "access_token" not in login_result
    ):
        _log_login_failure(
            request, login, method, "Provider did not return a bearer token"
        )
        return JSONResponse(
            {
                "state": "error",
                "error": f"{method} login flow did not return a bearer token",
            },
            status_code=500,
        )

    try:
        # We now have a logged in user, so let's do our best to do something useful
        provider_data = token_to_data(login_result)
    except GitlabError as err:
        if err.response_code in (
            401,
            403,
        ):
            _log_login_failure(request, login, method, f"Gitlab error: {err!s}")
            error = "login-failed-try-again"
            if (
                method in ("gitlab", "gnome", "kde")
                and err.response_code == 403
                and "must accept the terms of service" in str(err).lower()
            ):
                error = "gitlab-terms-not-accepted"
            return JSONResponse(
                {
                    "state": "error",
                    "error": error,
                },
                status_code=400,
            )
        raise

    with get_db("writer") as db:
        # Do we have a provider's user noted with this ID already?
        account = account_model.by_provider_id(db, provider_data.id)
        upgraded = None
        if account is None:
            # We've never seen this provider's user before, if we're not already logged
            # in then create a user
            user = login.user
            if user is None:
                user = models.FlathubUser(
                    display_name=provider_data.name,
                    default_account=account_model.provider,
                )
                db.add(user)
                db.flush()
            elif email_login_allowed(db, user):
                upgraded = _upgrade_email_user(
                    db, user, method, provider_data, login_result, account_model
                )
                if upgraded is not None:
                    pending_oidc = request.session.get("oidc_authorize_params")
                    request.session.clear()
                    if isinstance(pending_oidc, dict):
                        request.session["oidc_authorize_params"] = pending_oidc
                if upgraded is None:
                    db.commit()
                    _log_login_failure(
                        request, login, method, "Email upgrade no longer eligible"
                    )
                    return JSONResponse(
                        {"status": "error", "error": "error-already-logged-in"},
                        status_code=500,
                    )
                account = upgraded
            if account is None:
                # Now we have a user, create the local account model for it
                userid = {}
                userid[f"{method}_userid"] = provider_data.id
                account = account_model(
                    **userid,
                    token=login_result["access_token"],
                    last_used=utils.utcnow(),
                    user=user.id,
                    login=provider_data.login,
                    avatar_url=provider_data.avatar_url,
                    display_name=provider_data.name,
                    email=provider_data.email,
                )
                if "refresh_token" in login_result:
                    refreshable = cast("_OAuthRefreshableAccount", account)
                    refreshable.refresh_token = login_result["refresh_token"]
                    refreshable.token_expiry = utils.utcnow() + timedelta(
                        seconds=int(login_result.get("expires_in", "7200"))
                    )
                db.add(account)
        else:
            # The provider's user has been seen before, if we're logged in already and
            # things don't match then abort now
            user = login.user
            if user is not None:
                # Eventually we might do user-merge here?
                db.commit()
                # Distinct event type so it doesn't pollute failure-rate queries.
                audit_log.enqueue_audit_log(
                    request,
                    login.user.id if login.user else None,
                    models.AuditEventType.LOGIN_REJECTED_ALREADY_LOGGED_IN,
                    provider=method,
                    details={"error": "Already logged in"},
                )
                return JSONResponse(
                    {"status": "error", "error": "error-already-logged-in"},
                    status_code=500,
                )
            linked_user = db.session.get(models.FlathubUser, account.user)
            if linked_user is not None and linked_user.banned:
                audit_log.enqueue_audit_log(
                    request,
                    account.user,
                    models.AuditEventType.LOGIN_REJECTED_BANNED,
                    provider=method,
                    details={"login": provider_data.login},
                )
                return JSONResponse(
                    {"state": "error", "error": "account_banned"},
                    status_code=403,
                )
            if linked_user is None or linked_user.deleted:
                audit_log.enqueue_audit_log(
                    request,
                    account.user,
                    models.AuditEventType.LOGIN_FAILURE,
                    provider=method,
                    details={"error": "Account unavailable"},
                )
                return JSONResponse(
                    {"state": "error", "error": "account_unavailable"},
                    status_code=403,
                )
            account.token = login_result["access_token"]
            account.last_used = utils.utcnow()
            account.login = provider_data.login
            account.avatar_url = provider_data.avatar_url
            account.display_name = provider_data.name
            account.email = provider_data.email
            if "refresh_token" in login_result:
                refreshable = cast("_OAuthRefreshableAccount", account)
                refreshable.refresh_token = login_result["refresh_token"]
                refreshable.token_expiry = utils.utcnow() + timedelta(
                    seconds=int(login_result.get("expires_in", "7200"))
                )
            db.add(account)

        # The session is now ready
        db.commit()
        set_authenticated_session(request, account.user, method)

        audit_log.enqueue_audit_log(
            request,
            account.user,
            models.AuditEventType.LOGIN_SUCCESS,
            provider=method,
            details={"upgrade_from": "email"}
            if upgraded is not None
            else {"login": provider_data.login},
        )

        # Let's find the set of repos the user has write access to in the flathub
        # org since we have a functional token
        if postlogin_handler is not None:
            postlogin_handler(login_result, account)

        payload = {
            "messageId": f"{account.user}/login/{utils.utcnow().isoformat()}",
            "creation_timestamp": utils.utcnow().timestamp(),
            "userId": account.user,
            "subject": "New login to Flathub account",
            "previewText": "Flathub Login",
            "messageInfo": {
                "category": EmailCategory.SECURITY_LOGIN,
                "provider": method,
                "login": provider_data.login,
                "time": utils.utcnow().isoformat(),
                "ipAddress": request.client.host if request.client else "Unknown",
            },
        }

        from .worker.emails import send_email_new

        send_email_new.send(payload)

        return {
            "status": "ok",
            "result": "logged_in",
        }


class AuthInfo(BaseModel):
    login: str
    avatar: str | None = None
    provider: models.ConnectedAccountProvider | None = None


class Auths(BaseModel):
    github: AuthInfo | None = None
    gitlab: AuthInfo | None = None
    gnome: AuthInfo | None = None
    kde: AuthInfo | None = None
    google: AuthInfo | None = None
    email: AuthInfo | None = None


class EmailLoginInfo(BaseModel):
    email: str
    enabled: bool


class Permission(StrEnum):
    QUALITY_MODERATION = "quality-moderation"
    MODERATION = "moderation"
    PAYMENT = "payment"
    DIRECT_UPLOAD = "direct-upload"
    VIEW_USERS = "view-users"
    MODIFY_USERS = "modify-users"

    MANAGE_OIDC_CLIENTS = "manage-oidc-clients"


class UserInfo(BaseModel):
    displayname: str | None = None
    dev_flatpaks: list[str] = []
    permissions: list[Permission] = []
    owned_flatpaks: list[str] = []
    invited_flatpaks: list[str] = []
    invite_code: str
    accepted_publisher_agreement_at: datetime | None
    default_account: AuthInfo
    auths: Auths
    email_login: EmailLoginInfo | None = None


@router.get(
    "/userinfo",
    tags=["auth"],
    responses={
        200: {"description": "User information retrieved successfully"},
        204: {"description": "Not logged in"},
    },
)
@cache.private
def get_userinfo(login: LoginStatusDep, response: Response) -> UserInfo | None:
    """
    Retrieve the current login's user information.  If the user is not logged in
    you will get a `204` return.  Otherwise you will receive JSON describing the
    currently logged in user, for example:

    ```
    {
        "displayname": "Mx Human Person",
        "dev_flatpaks": [ "org.people.human.Appname" ],
        "owned_flatpaks": [ "org.foo.bar.Appname" ],
        "accepted_publisher-agreement_at": "2023-06-23T20:38:28.553028"
    }
    ```

    If the user has an active github login, you'll also get their github login
    name, and avatar.  If they have some other login, details for that login
    will be provided.

    dev_flatpaks is filtered against IDs available in AppStream
    """

    if not login.user or not login.state.logged_in():
        response.status_code = 204
        return None

    appstream = apps.get_appids(include_eol=True)

    with get_db("writer") as db:
        user = db.merge(login.user)  # Reattach user to current session

        if user.invite_code is None:
            # Confusing letter/number pairs removed.
            # This doesn't have to be super secure, it doesn't grant access to
            # anything, we just use a code instead of the user ID to avoid enumeration.
            # 56 available chars * 12 = ~69 bits of entropy
            chars = "AaBbCcDdEeFfGgHhJjKkLlMmNnPpQqRrSsTtUuVvWwXxYyZz23456789"
            user.invite_code = "".join(secrets.choice(chars) for _ in range(12))
            db.commit()

        default_account: models.ConnectedAccount = user.get_default_account(db)
        dev_flatpaks = user.dev_flatpaks(db)
        permissions = user.permissions()  # Now called within session context
        owned_flatpaks = {
            app.app_id
            for app in models.UserOwnedApp.all_owned_by_user(db, user)
            if app.app_id in appstream
        }
        invited_flatpaks = [
            app.app_id
            for _invite, app in models.DirectUploadAppInvite.by_developer(db, user)
        ]

        auths = {}
        for account in user.connected_accounts(db):
            auth_info = AuthInfo(
                login=account.login,
                avatar=account.avatar_url,
                provider=account.provider,
            )
            auths[account.provider] = auth_info

        default_display_name = (
            user.display_name
            if user.display_name_overridden
            else (default_account.display_name if default_account else None)
        )
        default_avatar_url = default_account.avatar_url if default_account else None
        default_login = default_account.login if default_account else None
        default_provider = default_account.provider if default_account else None
        invite_code = user.invite_code
        accepted_publisher_agreement_at = user.accepted_publisher_agreement_at
        email_login = None
        if email_account := models.EmailAccount.by_user(db, user):
            email_login = EmailLoginInfo(
                email=email_account.email,
                enabled=email_login_allowed(db, user),
            )

    defaultAccountInfo = AuthInfo(
        avatar=default_avatar_url, login=default_login or "", provider=default_provider
    )

    return UserInfo(
        displayname=default_display_name,
        dev_flatpaks=sorted(dev_flatpaks),
        permissions=sorted(permissions),
        owned_flatpaks=sorted(owned_flatpaks),
        invited_flatpaks=sorted(invited_flatpaks),
        invite_code=invite_code,
        accepted_publisher_agreement_at=accepted_publisher_agreement_at,
        default_account=defaultAccountInfo,
        auths=Auths(**auths),
        email_login=email_login,
    )


class RefreshDevFlatpaksReturn(BaseModel):
    dev_flatpaks: list[str]


@router.post(
    "/refresh-dev-flatpaks",
    tags=["auth"],
    responses={
        200: {"description": "Dev flatpaks refreshed successfully"},
        401: {"description": "No GitHub account linked"},
    },
)
def do_refresh_dev_flatpaks(
    login: LoggedInDep,
) -> RefreshDevFlatpaksReturn:
    with get_db("writer") as db:
        user = db.merge(login.user)  # Reattach user to current session
        account = models.GithubAccount.by_user(db, user)

        # We need to have a github account to refresh dev flatpaks
        if account is None:
            raise HTTPException(status_code=401, detail="no_github_account")

        refresh_repo_list(account.token, account.id)
        dev_flatpaks = {appid for appid in user.dev_flatpaks(db)}

    return RefreshDevFlatpaksReturn(dev_flatpaks=sorted(dev_flatpaks))


@router.post(
    "/logout",
    tags=["auth"],
    responses={
        200: {"description": "Logout successful"},
        500: {"description": "Session error"},
    },
)
def do_logout(request: Request, login: LoginStatusDep):
    """
    Clear the login state. This will discard tokens which access socials,
    and will clear the session cookie so that the user is not logged in.
    """
    try:
        request.session.pop("passkey-flow", None)
        if login.state == LoginState.LOGGED_OUT:
            return {}

        # Clear the login ID
        if "user-id" in request.session:
            del request.session["user-id"]
        request.session.pop("auth-method", None)
        request.session.pop("auth-time", None)
        request.session.pop("passkey-id", None)

        if login.state.logging_in():
            # Also clear any pending login-flow from the session
            _clear_oauth_session(request)

    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Session error: {e!s}")

    audit_log.enqueue_audit_log(
        request,
        login.user.id if login.user else None,
        models.AuditEventType.LOGOUT,
    )
    return {}


class GetDeleteUserResult(BaseModel):
    status: str
    token: str


@router.get(
    "/deleteuser",
    tags=["auth"],
    responses={
        200: {"description": "Delete user token generated"},
        403: {"description": "Not logged in"},
    },
)
@cache.no_store
def get_deleteuser(login: LoginStatusDep) -> GetDeleteUserResult:
    """
    Delete a user's login information.
    If they're not logged in, they'll get a `403` return.
    Otherwise they will get an option to delete their account
    and data.
    """
    if not login.user or not login.state.logged_in():
        raise HTTPException(status_code=403, detail="Not logged in")
    user = login.user

    with get_db("replica") as db:
        token = models.FlathubUser.generate_token(db, user)
    return GetDeleteUserResult(status="ok", token=token)


@router.delete(
    "/deleteuser",
    tags=["auth"],
    responses={
        200: {"description": "User deleted successfully"},
        400: {"description": "Invalid token or deletion failed"},
        403: {"description": "Not logged in"},
    },
)
def do_deleteuser(
    request: Request, data: UserDeleteRequest, login: LoginStatusDep
) -> models.DeleteUserResult:
    """
    Clear the login state. This will then delete the user's account
    and associated data. Unless there is an error.

    The input to this should be of the form:

    ```json
    {
        "token": "...",
    }
    ```
    """
    if not login.user or not login.state.logged_in():
        raise HTTPException(status_code=403, detail="Not logged in")
    user = login.user
    user_id = user.id

    with get_db("writer") as db:
        ret = models.FlathubUser.delete_user(db, user, data.token)

    if ret.status == "ok":
        request.session.clear()
        audit_log.enqueue_audit_log(
            request,
            user_id,
            models.AuditEventType.ACCOUNT_DELETED,
        )
    else:
        raise HTTPException(status_code=400, detail=ret.status)

    return ret


@router.post(
    "/accept-publisher-agreement",
    tags=["auth"],
    responses={
        200: {"description": "Publisher agreement accepted"},
        403: {"description": "Not logged in"},
    },
)
def do_agree_to_publisher_agreement(login: LoginStatusDep):
    if not login.user or not login.state.logged_in():
        raise HTTPException(status_code=403, detail="Not logged in")

    with get_db("writer") as db:
        user = db.merge(login.user)
        user.accepted_publisher_agreement_at = datetime.now(UTC)
        db.commit()


@router.post(
    "/change-default-account",
    status_code=204,
    tags=["auth"],
    responses={
        204: {"description": "Default account changed successfully"},
        403: {"description": "Not logged in"},
        404: {"description": "Account not found"},
    },
)
def do_change_default_account(
    provider: models.ConnectedAccountProvider,
    login: LoginStatusDep,
):
    """Changes the user's default account, which determines which display name and email we use."""

    if not login.user or not login.state.logged_in():
        raise HTTPException(status_code=403, detail="Not logged in")

    with get_db("writer") as db:
        user = db.session.merge(login.user)
        account = user.get_connected_account(db, provider)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")

        user.default_account = provider


class DisplayNameRequest(BaseModel):
    display_name: str

    @field_validator("display_name")
    @classmethod
    def _check_display_name(cls, value: str) -> str:
        value = value.strip()
        categories = [unicodedata.category(char) for char in value]
        if (
            not 1 <= len(value) <= 100
            or "Cc" in categories
            or any(
                "\u202a" <= char <= "\u202e" or "\u2066" <= char <= "\u2069"
                for char in value
            )
            or all(category in ("Cf", "Zs", "Zl", "Zp") for category in categories)
        ):
            raise ValueError("invalid_display_name")
        return value


@router.post(
    "/display-name",
    status_code=204,
    tags=["auth"],
    responses={
        204: {"description": "Display name changed successfully"},
        401: {"description": "Not logged in"},
    },
)
def do_change_display_name(body: DisplayNameRequest, login: LoggedInDep):
    with get_db("writer") as db:
        user = db.session.get(models.FlathubUser, login.user.id)
        if user is None or user.login_disabled:
            raise HTTPException(status_code=401, detail="not_logged_in")
        user.display_name = body.display_name
        user.display_name_overridden = True
        db.commit()


_PASSKEY_FRESHNESS_SECONDS = 300
_PASSKEY_CHALLENGE_TTL_SECONDS = 300
_PASSKEY_CONSUME_SCRIPT = """
local value = redis.call('GET', KEYS[1])
if value then redis.call('DEL', KEYS[1]) end
return value
"""
_PASSKEY_ERRORS = (WebAuthnException, ValueError, TypeError, KeyError)
_TOKEN_PATTERN = r"^[A-Za-z0-9_-]{43}$"

PasskeyChallengeId = Annotated[
    str, Field(min_length=43, max_length=43, pattern=_TOKEN_PATTERN)
]
PasskeyName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]


class PasskeyRegistrationOptionsRequest(BaseModel):
    pass


class PasskeyAuthenticationOptionsRequest(BaseModel):
    return_to: str | None = None


class PasskeyOptions(BaseModel):
    challenge_id: str
    options: dict[str, JSONValue]


class PasskeyRegistrationVerifyRequest(BaseModel):
    challenge_id: PasskeyChallengeId
    credential: dict[str, JSONValue]
    name: PasskeyName


class PasskeyAuthenticationVerifyRequest(BaseModel):
    challenge_id: PasskeyChallengeId
    credential: dict[str, JSONValue]


class PasskeyRenameRequest(BaseModel):
    name: PasskeyName


class PasskeySummary(BaseModel):
    id: int
    name: str
    created_at: datetime
    last_used_at: datetime | None


class PasskeyList(BaseModel):
    credentials: list[PasskeySummary]
    recent_authentication: bool


class PasskeyLoginResult(BaseModel):
    status: str = "ok"
    return_to: str


def _passkey_rp() -> tuple[str, str]:
    parts = urlsplit(config.settings.frontend_url)
    return cast("str", parts.hostname), f"{parts.scheme}://{parts.netloc}"


def _recently_authenticated(request: Request) -> bool:
    auth_time = request.session.get("auth-time")
    return (
        isinstance(auth_time, int | float)
        and not isinstance(auth_time, bool)
        and 0 <= time.time() - auth_time < _PASSKEY_FRESHNESS_SECONDS
    )


def _require_recent_authentication(request: Request) -> None:
    if not _recently_authenticated(request):
        raise HTTPException(status_code=403, detail="reauthentication_required")


def _require_passkey_origin(request: Request) -> None:
    if request.headers.get("origin") != _passkey_rp()[1]:
        raise HTTPException(status_code=403, detail="invalid_origin")


def _limit_passkey_ceremony(request: Request) -> None:
    _require_passkey_origin(request)
    ip = request.client.host if request.client else "unknown"
    try:
        count = cast(
            "list[int]",
            _email_rate_store.eval(_EMAIL_RATE_SCRIPT, 1, f"passkey:rate:{ip}", 60),
        )[0]
    except (redis.RedisError, OSError) as exc:
        raise HTTPException(status_code=503, detail="passkey_unavailable") from exc
    if count > 30:
        raise HTTPException(
            status_code=429,
            detail="passkey_rate_limited",
            headers={"Retry-After": "60"},
        )


def _invalid_passkey_response() -> HTTPException:
    return HTTPException(status_code=400, detail="invalid_passkey_response")


def _passkey_challenge_key(purpose: str, nonce: str, challenge_id: str) -> str:
    return f"passkey:challenge:{purpose}:{nonce}:{challenge_id}"


def _store_passkey_challenge(
    request: Request, purpose: str, challenge: bytes, **values: JSONValue
) -> str:
    nonce = request.session.get("passkey-flow")
    if not isinstance(nonce, str):
        nonce = secrets.token_urlsafe(32)
        request.session["passkey-flow"] = nonce
    challenge_id = secrets.token_urlsafe(32)
    payload = {
        "challenge": bytes_to_base64url(challenge),
        "purpose": purpose,
        **values,
    }
    try:
        _email_rate_store.set(
            _passkey_challenge_key(purpose, nonce, challenge_id),
            json.dumps(payload),
            ex=_PASSKEY_CHALLENGE_TTL_SECONDS,
        )
    except (redis.RedisError, OSError) as exc:
        raise HTTPException(status_code=503, detail="passkey_unavailable") from exc
    return challenge_id


def _consume_passkey_challenge(
    request: Request, purpose: str, challenge_id: str
) -> dict[str, JSONValue]:
    nonce = request.session.get("passkey-flow")
    if not isinstance(nonce, str):
        raise _invalid_passkey_response()
    try:
        raw = _email_rate_store.eval(
            _PASSKEY_CONSUME_SCRIPT,
            1,
            _passkey_challenge_key(purpose, nonce, challenge_id),
        )
    except (redis.RedisError, OSError) as exc:
        raise HTTPException(status_code=503, detail="passkey_unavailable") from exc
    if not isinstance(raw, str):
        raise _invalid_passkey_response()
    stored = json.loads(raw)
    if stored.get("purpose") != purpose:
        raise _invalid_passkey_response()
    return stored


def _lock_passkey_user(db, request: Request, user_id: int) -> models.FlathubUser:
    user = db.session.scalar(
        select(models.FlathubUser)
        .where(models.FlathubUser.id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None or user.login_disabled:
        raise HTTPException(status_code=401, detail="not_logged_in")
    if request.session.get("auth-method") == "passkey":
        current = db.session.scalar(
            select(models.PasskeyCredential)
            .where(
                models.PasskeyCredential.id == request.session.get("passkey-id"),
                models.PasskeyCredential.user == user.id,
            )
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if current is None:
            request.session.clear()
            raise HTTPException(status_code=401, detail="not_logged_in")
    return user


def _lock_owned_passkey(
    db, user: models.FlathubUser, passkey_id: int
) -> models.PasskeyCredential:
    credential = db.session.scalar(
        select(models.PasskeyCredential)
        .where(
            models.PasskeyCredential.id == passkey_id,
            models.PasskeyCredential.user == user.id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if credential is None:
        raise HTTPException(status_code=404, detail="passkey_not_found")
    return credential


def _passkey_summary(credential: models.PasskeyCredential) -> PasskeySummary:
    return PasskeySummary(
        id=credential.id,
        name=credential.name,
        created_at=credential.created_at,
        last_used_at=credential.last_used_at,
    )


@router.get("/passkeys", tags=["passkeys"])
@cache.no_store
def list_passkeys(request: Request, login: LoggedInDep) -> PasskeyList:
    with get_db("writer") as db:
        credentials = models.PasskeyCredential.all_by_user(db, login.user)
        return PasskeyList(
            credentials=[_passkey_summary(credential) for credential in credentials],
            recent_authentication=_recently_authenticated(request),
        )


@router.post(
    "/passkeys/registration/options",
    tags=["passkeys"],
    dependencies=[Depends(_limit_passkey_ceremony)],
)
@cache.no_store
def passkey_registration_options(
    body: PasskeyRegistrationOptionsRequest, request: Request, login: LoggedInDep
) -> PasskeyOptions:
    _require_recent_authentication(request)
    rp_id, _origin = _passkey_rp()
    with get_db("writer") as db:
        user = _lock_passkey_user(db, request, login.user.id)
        if user.webauthn_user_handle is None:
            user.webauthn_user_handle = secrets.token_bytes(64)
        account = user.get_default_account(db)
        if isinstance(account, models.EmailAccount):
            user_name = account.email
        else:
            user_name = (account.login if account else None) or f"user-{user.id}"
        options = generate_registration_options(
            rp_id=rp_id,
            rp_name="Flathub",
            user_name=user_name,
            user_id=user.webauthn_user_handle,
            user_display_name=user.display_name or user_name,
            attestation=AttestationConveyancePreference.NONE,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.REQUIRED,
                user_verification=UserVerificationRequirement.REQUIRED,
            ),
            exclude_credentials=[
                PublicKeyCredentialDescriptor(
                    id=credential.credential_id,
                    transports=[
                        AuthenticatorTransport(transport)
                        for transport in credential.transports
                    ],
                )
                for credential in models.PasskeyCredential.all_by_user(db, user)
            ],
        )
        user_id = user.id
        db.commit()
    challenge_id = _store_passkey_challenge(
        request, "registration", options.challenge, user_id=user_id
    )
    return PasskeyOptions(
        challenge_id=challenge_id, options=options_to_json_dict(options)
    )


@router.post(
    "/passkeys/registration/verify",
    status_code=201,
    tags=["passkeys"],
    dependencies=[Depends(_limit_passkey_ceremony)],
)
@cache.no_store
def passkey_registration_verify(
    body: PasskeyRegistrationVerifyRequest, request: Request, login: LoggedInDep
) -> PasskeySummary:
    stored = _consume_passkey_challenge(request, "registration", body.challenge_id)
    if stored.get("user_id") != login.user.id:
        raise _invalid_passkey_response()
    rp_id, origin = _passkey_rp()
    with get_db("writer") as db:
        user = _lock_passkey_user(db, request, login.user.id)
        _require_recent_authentication(request)
        try:
            parsed = parse_registration_credential_json(body.credential)
            client_data = parse_client_data_json(parsed.response.client_data_json)
            verified = verify_registration_response(
                credential=parsed,
                expected_challenge=base64url_to_bytes(cast("str", stored["challenge"])),
                expected_rp_id=rp_id,
                expected_origin=origin,
                require_user_verification=True,
            )
        except _PASSKEY_ERRORS as exc:
            raise _invalid_passkey_response() from exc
        if client_data.cross_origin:
            raise _invalid_passkey_response()
        credential = models.PasskeyCredential(
            user=user.id,
            credential_id=verified.credential_id,
            public_key=verified.credential_public_key,
            sign_count=verified.sign_count,
            transports=[
                transport.value for transport in parsed.response.transports or []
            ],
            name=body.name,
            created_at=utils.utcnow(),
        )
        db.session.add(credential)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="passkey_already_registered"
            ) from exc
        return _passkey_summary(credential)


@router.post(
    "/passkeys/authentication/options",
    tags=["passkeys"],
    dependencies=[Depends(_limit_passkey_ceremony)],
)
@cache.no_store
def passkey_authentication_options(
    body: PasskeyAuthenticationOptionsRequest,
    request: Request,
    login: LoginStatusDep,
) -> PasskeyOptions:
    if login.user is not None:
        raise HTTPException(status_code=409, detail="already_logged_in")
    options = generate_authentication_options(
        rp_id=_passkey_rp()[0],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    challenge_id = _store_passkey_challenge(
        request,
        "authentication",
        options.challenge,
        user_id=None,
        return_to=safe_return_to(body.return_to),
    )
    return PasskeyOptions(
        challenge_id=challenge_id, options=options_to_json_dict(options)
    )


@router.post(
    "/passkeys/authentication/verify",
    tags=["passkeys"],
    dependencies=[Depends(_limit_passkey_ceremony)],
)
@cache.no_store
def passkey_authentication_verify(
    body: PasskeyAuthenticationVerifyRequest,
    request: Request,
    login: LoginStatusDep,
) -> PasskeyLoginResult:
    if login.user is not None:
        raise HTTPException(status_code=409, detail="already_logged_in")
    stored = _consume_passkey_challenge(request, "authentication", body.challenge_id)
    rp_id, origin = _passkey_rp()
    with get_db("writer") as db:
        try:
            parsed = parse_authentication_credential_json(body.credential)
            client_data = parse_client_data_json(parsed.response.client_data_json)
            initial = db.session.scalar(
                select(models.PasskeyCredential).where(
                    models.PasskeyCredential.credential_id == parsed.raw_id
                )
            )
            user = None
            credential = None
            if initial is not None:
                user = db.session.scalar(
                    select(models.FlathubUser)
                    .where(models.FlathubUser.id == initial.user)
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
                credential = db.session.scalar(
                    select(models.PasskeyCredential)
                    .where(models.PasskeyCredential.id == initial.id)
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
            user_handle = parsed.response.user_handle
            if (
                client_data.cross_origin
                or user is None
                or credential is None
                or credential.user != user.id
                or user.login_disabled
                or user.webauthn_user_handle is None
                or user_handle is None
                or not hmac.compare_digest(user_handle, user.webauthn_user_handle)
            ):
                raise _invalid_passkey_response()
            verified = verify_authentication_response(
                credential=parsed,
                expected_challenge=base64url_to_bytes(cast("str", stored["challenge"])),
                expected_rp_id=rp_id,
                expected_origin=origin,
                credential_public_key=credential.public_key,
                credential_current_sign_count=credential.sign_count,
                require_user_verification=True,
            )
        except (*_PASSKEY_ERRORS, HTTPException) as exc:
            db.rollback()
            _log_login_failure(request, login, "passkey", "invalid_passkey_response")
            raise _invalid_passkey_response() from exc
        credential.sign_count = verified.new_sign_count
        credential.last_used_at = utils.utcnow()
        user_id = user.id
        passkey_id = credential.id
        db.commit()
    _clear_oauth_session(request)
    set_authenticated_session(request, user_id, "passkey", passkey_id)
    pending_oidc = request.session.get("oidc_authorize_params")
    if isinstance(pending_oidc, dict):
        pending_oidc["_login_flow_started"] = True
        request.session["oidc_authorize_params"] = pending_oidc
    audit_log.enqueue_audit_log(
        request, user_id, models.AuditEventType.LOGIN_SUCCESS, provider="passkey"
    )
    return PasskeyLoginResult(return_to=cast("str", stored["return_to"]))


@router.patch(
    "/passkeys/{passkey_id}",
    tags=["passkeys"],
    dependencies=[Depends(_require_passkey_origin)],
)
@cache.no_store
def rename_passkey(
    passkey_id: int, body: PasskeyRenameRequest, request: Request, login: LoggedInDep
) -> PasskeySummary:
    with get_db("writer") as db:
        user = _lock_passkey_user(db, request, login.user.id)
        credential = _lock_owned_passkey(db, user, passkey_id)
        credential.name = body.name
        db.commit()
        return _passkey_summary(credential)


@router.delete(
    "/passkeys/{passkey_id}",
    status_code=204,
    tags=["passkeys"],
    dependencies=[Depends(_require_passkey_origin)],
)
@cache.no_store
def delete_passkey(passkey_id: int, request: Request, login: LoggedInDep) -> None:
    with get_db("writer") as db:
        user = _lock_passkey_user(db, request, login.user.id)
        _require_recent_authentication(request)
        db.session.delete(_lock_owned_passkey(db, user, passkey_id))
        db.commit()
    if (
        request.session.get("auth-method") == "passkey"
        and request.session.get("passkey-id") == passkey_id
    ):
        request.session.clear()


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application

    This also enables session middleware
    """
    app.add_middleware(
        SessionMiddleware,
        secret_key=config.settings.session_secret_key,
        max_age=86400,
        https_only=True,
    )
    app.include_router(router)
    app.add_exception_handler(RequestValidationError, _email_validation_error)


async def _email_validation_error(request: Request, exc: Exception) -> Response:
    if not isinstance(exc, RequestValidationError):
        raise exc
    if request.url.path.endswith("/auth/email/request"):
        return JSONResponse(
            {"detail": "invalid_email_request"},
            status_code=422,
            headers={"Cache-Control": "no-store"},
        )
    if request.url.path.endswith("/auth/email/confirm"):
        audit_log.enqueue_audit_log(
            request,
            None,
            models.AuditEventType.LOGIN_FAILURE,
            provider="email",
            details={"error": "invalid_email_link"},
        )
        return JSONResponse(
            {"detail": "invalid_email_link"},
            status_code=400,
            headers={"Cache-Control": "no-store"},
        )
    if request.url.path.endswith(
        ("/auth/passkeys/registration/verify", "/auth/passkeys/authentication/verify")
    ):
        errors = exc.errors()
        if errors and all(
            tuple(error["loc"][:2]) == ("body", "name") for error in errors
        ):
            return JSONResponse(
                {"detail": "invalid_passkey_name"},
                status_code=422,
                headers={"Cache-Control": "no-store"},
            )
        return JSONResponse(
            {"detail": "invalid_passkey_response"},
            status_code=400,
            headers={"Cache-Control": "no-store"},
        )
    return await request_validation_exception_handler(request, exc)
