"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""

import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

import httpx
from authlib.integrations.base_client.errors import OAuthError
from authlib.oauth2.base import OAuth2Error
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from github import Github
from gitlab import Gitlab
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from . import apps, config, http_client, models, oauth_providers
from .database import get_db
from .emails import EmailCategory
from .login_info import (
    LoginInformation,
    LoginState,
    LoginStatusDep,
    logged_in,
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


def refresh_repo_list(gh_access_token: str, accountId: int):
    from .worker.refresh_github_repo_list import refresh_github_repo_list

    refresh_github_repo_list.send(gh_access_token, accountId)


def _refresh_token(account, method: str) -> str:
    if account.token_expiry is None or account.token_expiry > datetime.now():
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
        account.token_expiry = datetime.now() + timedelta(
            seconds=int(login_result.get("expires_in", "7200"))
        )

    return account.token


def refresh_oauth_token(account) -> str:
    """Makes sure the account has an up to date access token, refreshing it with the refresh token if needed.
    If the token is updated, db.session.commit() is called to save the change."""

    with get_db("writer") as db:
        account = db.merge(account)
        return _refresh_token(account, account.provider.value)


router = APIRouter(prefix="/auth")


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
    account_model: type[models.Base],
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

        email = next((e.email for e in ghuser.get_emails() if e.primary), None)

        return ProviderInfo(
            ghuser.id,
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


def continue_oauth_flow(
    request: Request,
    login: LoginInformation,
    data: OauthLoginResponse,
    method: str,
    token_to_data: Callable[[dict], ProviderInfo],
    account_model: type[models.Base],
    postlogin_handler: Callable | None = None,
):
    """
    Continue an oauth login flow.  This will complete the user's login using the
    ongoing authentication flow.  Upon completion the user will be logged in successfully.
    If any error occurs, we return that as a JSONResponse.  If the caller wishes to
    perform additional work post-login (e.g. retrieving github/gitlab user information)
    then they can do so if the return type of this function is simply `dict`.
    """
    if login.method != method:
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
        return JSONResponse(
            {
                "state": "error",
                "error": "Login token has expired, please try again",
            },
            status_code=400,
        )

    if stored[0] != data.state:
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
        return JSONResponse(
            {
                "state": "error",
                "error": f"{method} login flow had an error: {repr(detail)}",
            },
            status_code=500,
        )
    except httpx.HTTPError as e:
        return JSONResponse(
            {
                "state": "error",
                "error": f"{method} login flow had an error: {repr(str(e))}",
            },
            status_code=500,
        )

    if (
        login_result.get("token_type", "").lower() != "bearer"
        or "access_token" not in login_result
    ):
        return JSONResponse(
            {
                "state": "error",
                "error": f"{method} login flow did not return a bearer token",
            },
            status_code=500,
        )

    # We now have a logged in user, so let's do our best to do something useful
    provider_data = token_to_data(login_result)

    with get_db("writer") as db:
        # Do we have a provider's user noted with this ID already?
        account = account_model.by_provider_id(db, provider_data.id)
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
            # Now we have a user, create the local account model for it
            userid = {}
            userid[f"{method}_userid"] = provider_data.id
            account = account_model(
                **userid,
                token=login_result["access_token"],
                last_used=datetime.now(),
                user=user.id,
                login=provider_data.login,
                avatar_url=provider_data.avatar_url,
                display_name=provider_data.name,
                email=provider_data.email,
            )
            if "refresh_token" in login_result:
                account.refresh_token = login_result["refresh_token"]
                account.token_expiry = datetime.now() + timedelta(
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
                return JSONResponse(
                    {"status": "error", "error": "error-already-logged-in"},
                    status_code=500,
                )
            account.token = login_result["access_token"]
            account.last_used = datetime.now()
            account.login = provider_data.login
            account.avatar_url = provider_data.avatar_url
            account.display_name = provider_data.name
            account.email = provider_data.email
            if "refresh_token" in login_result:
                account.refresh_token = login_result["refresh_token"]
                account.token_expiry = datetime.now() + timedelta(
                    seconds=int(login_result.get("expires_in", "7200"))
                )
            db.add(account)
        request.session["user-id"] = account.user

        # The session is now ready
        db.commit()

        # Let's find the set of repos the user has write access to in the flathub
        # org since we have a functional token
        if postlogin_handler is not None:
            postlogin_handler(login_result, account)

        payload = {
            "messageId": f"{account.user}/login/{datetime.now().isoformat()}",
            "creation_timestamp": datetime.now().timestamp(),
            "userId": account.user,
            "subject": "New login to Flathub account",
            "previewText": "Flathub Login",
            "messageInfo": {
                "category": EmailCategory.SECURITY_LOGIN,
                "provider": method,
                "login": provider_data.login,
                "time": datetime.now().isoformat(),
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


class Permission(StrEnum):
    QUALITY_MODERATION = "quality-moderation"
    MODERATION = "moderation"
    PAYMENT = "payment"
    DIRECT_UPLOAD = "direct-upload"
    VIEW_USERS = "view-users"
    MODIFY_USERS = "modify-users"


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


@router.get(
    "/userinfo",
    tags=["auth"],
    responses={
        200: {"description": "User information retrieved successfully"},
        204: {"description": "Not logged in"},
    },
)
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

        default_account: models.ConnectedAccount = user.get_default_account(db)  # type: ignore
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

        default_display_name = default_account.display_name if default_account else None
        default_avatar_url = default_account.avatar_url if default_account else None
        default_login = default_account.login if default_account else None
        default_provider = default_account.provider if default_account else None
        invite_code = user.invite_code
        accepted_publisher_agreement_at = user.accepted_publisher_agreement_at

    defaultAccountInfo = AuthInfo(
        avatar=default_avatar_url, login=default_login, provider=default_provider
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
    login=Depends(logged_in),
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
        if login.state == LoginState.LOGGED_OUT:
            return {}

        # Clear the login ID
        if "user-id" in request.session:
            del request.session["user-id"]

        if login.state.logging_in():
            # Also clear any pending login-flow from the session
            _clear_oauth_session(request)

    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Session error: {str(e)}")

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

    with get_db("writer") as db:
        ret = models.FlathubUser.delete_user(db, user, data.token)

    if ret.status == "ok":
        request.session.clear()
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
