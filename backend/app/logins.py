"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""

import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional
from urllib.parse import urlencode
from uuid import uuid4

import requests
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from github import Github
from gitlab import Gitlab
from pydantic import BaseModel
from sqlalchemy import func
from starlette.middleware.sessions import SessionMiddleware

from . import apps, config, models, worker
from .database import DBSessionMiddleware, get_db
from .emails import EmailCategory
from .login_info import (
    LoginInformation,
    LoginState,
    LoginStatusDep,
    logged_in,
    login_state,
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


def refresh_repo_list(gh_access_token: str, accountId: int):
    gh = Github(gh_access_token)
    ghuser = gh.get_user()
    user_repos = [
        repo.full_name.removeprefix("flathub/")
        for repo in ghuser.get_repos(affiliation="collaborator")
        if repo.full_name.startswith("flathub/")
        and repo.permissions.push
        and not repo.archived
    ]

    gh_teams = [
        team for team in ghuser.get_teams() if team.organization.login == "flathub"
    ]
    gh_team_repos = [
        repo.full_name.removeprefix("flathub/")
        for team in gh_teams
        for repo in team.get_repos()
        if repo.permissions.push and not repo.archived
    ]

    repos = list(set(user_repos + gh_team_repos))
    with get_db("writer") as db:
        models.GithubRepository.unify_repolist(db, accountId, repos)


def _refresh_token(
    account, method: str, token_endpoint: str, client_id: str, client_secret: str
) -> str:
    if account.token_expiry is None or account.token_expiry > datetime.now():
        return account.token

    response = requests.post(
        token_endpoint,
        data={
            "grant_type": "refresh_token",
            "refresh_token": account.refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
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

    with get_db("writer") as db:
        db.add(account)
        db.commit()

    return account.token


def refresh_oauth_token(account) -> str:
    """Makes sure the account has an up to date access token, refreshing it with the refresh token if needed.
    If the token is updated, db.session.commit() is called to save the change."""

    match account:
        case models.GitlabAccount():
            return _refresh_token(
                account,
                "gitlab",
                "https://gitlab.com/oauth/token",
                config.settings.gitlab_client_id,
                config.settings.gitlab_client_secret,
            )
        case models.GnomeAccount():
            return _refresh_token(
                account,
                "gnome",
                "https://gitlab.gnome.org/oauth/token",
                config.settings.gnome_client_id,
                config.settings.gnome_client_secret,
            )
        case models.KdeAccount():
            return _refresh_token(
                account,
                "gnome",
                "https://invent.kde.org/oauth/token",
                config.settings.kde_client_id,
                config.settings.kde_client_secret,
            )
        case _:
            raise ValueError(f"Unsupported account type: {type(account)}")


router = APIRouter(prefix="/auth")


class LoginMethod(BaseModel):
    method: str
    name: str


@router.get("/login", tags=["auth"])
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


@router.get("/login/github", tags=["auth"])
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
        models.GithubFlowToken,
        "https://github.com/login/oauth/authorize",
        {
            "client_id": config.settings.github_client_id,
            "redirect_uri": config.settings.github_return_url,
            "allow_signup": "false",
            "scope": "read:user read:org user:email",
        },
    )


@router.get("/login/gitlab", tags=["auth"])
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
        models.GitlabFlowToken,
        "https://gitlab.com/oauth/authorize",
        {
            "client_id": config.settings.gitlab_client_id,
            "redirect_uri": config.settings.gitlab_return_url,
            "scope": "read_user openid",
            "response_type": "code",
        },
    )


@router.get("/login/gnome", tags=["auth"])
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
        models.GnomeFlowToken,
        "https://gitlab.gnome.org/oauth/authorize",
        {
            "client_id": config.settings.gnome_client_id,
            "redirect_uri": config.settings.gnome_return_url,
            "scope": "read_user openid",
            "response_type": "code",
        },
    )


@router.get("/login/kde", tags=["auth"])
def start_kde_flow(request: Request, login=Depends(login_state)):
    return start_oauth_flow(
        request,
        login,
        "kde",
        models.KdeAccount,
        models.KdeFlowToken,
        "https://invent.kde.org/oauth/authorize",
        {
            "client_id": config.settings.kde_client_id,
            "redirect_uri": config.settings.kde_return_url,
            "scope": "read_user openid",
            "response_type": "code",
        },
    )


def start_oauth_flow(
    request: Request,
    login: LoginInformation,
    method: str,
    account_model: models.Base,
    flowtoken_model: models.Base,
    oauth_endpoint: str,
    oauth_args: dict,
):
    """
    Start an oauth login flow.  This uses the database flow tokens, the login
    state, and handles getting logins started assuming they follow a basic oauth model.

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
            request.session.pop("active-login-flow", None)
            request.session.pop("active-login-flow-intermediate", None)
            with get_db("writer") as db:
                flowtoken_model.housekeeping(db)

    user = login["user"]
    if user:
        with get_db("replica") as db:
            account = account_model.by_user(db, user)
            if account is not None and account.token is not None:
                return JSONResponse(
                    {"state": "error", "error": f"User already logged into {method}"},
                    status_code=400,
                )

    # Create new intermediate token within a single database session
    with get_db("writer") as db:
        flowtoken_model.housekeeping(db)
        intermediate = login["method_intermediate"]

        if intermediate:
            intermediate = db.get(flowtoken_model, intermediate)

        if not intermediate:
            randomtoken = uuid4().hex
            intermediate = flowtoken_model(
                state=randomtoken,
                created=datetime.now(),
            )
            db.add(intermediate)
            db.flush()  # Ensure the intermediate object is created in the database

        # Get the state while the session is still open
        state = intermediate.state
        intermediate_id = intermediate.id
        db.commit()

    # Copy the oauth arguments so we can add our state to them
    args = oauth_args.copy()
    args["state"] = state
    args = urlencode(args)
    request.session["active-login-flow"] = method
    request.session["active-login-flow-intermediate"] = intermediate_id
    return {
        "state": "ok",
        "redirect": f"{oauth_endpoint}?{args}",
    }


@dataclass
class ProviderInfo:
    id: str
    login: str
    name: str | None = None
    avatar_url: str | None = None
    email: str | None = None


@router.post("/login/github", tags=["auth"])
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
    the backend can clear the flow tokens

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
        worker.refresh_github_repo_list.send(tokens["access_token"], account.id)

    return continue_oauth_flow(
        request,
        login,
        data,
        "github",
        models.GithubFlowToken,
        "https://github.com/login/oauth/access_token",
        {
            "client_id": config.settings.github_client_id,
            "client_secret": config.settings.github_client_secret,
        },
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


@router.post("/login/gitlab", tags=["auth"])
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
    the backend can clear the flow tokens

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

    def gitlab_postlogin(tokens, account):
        pass

    return continue_oauth_flow(
        request,
        login,
        data,
        "gitlab",
        models.GitlabFlowToken,
        "https://gitlab.com/oauth/token",
        {
            "client_id": config.settings.gitlab_client_id,
            "client_secret": config.settings.gitlab_client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": config.settings.gitlab_return_url,
        },
        gitlab_userdata,
        models.GitlabAccount,
        gitlab_postlogin,
    )


@router.post("/login/gnome", tags=["auth"])
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
    the backend can clear the flow tokens

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

    def gnome_postlogin(tokens, account):
        pass

    return continue_oauth_flow(
        request,
        login,
        data,
        "gnome",
        models.GnomeFlowToken,
        "https://gitlab.gnome.org/oauth/token",
        {
            "client_id": config.settings.gnome_client_id,
            "client_secret": config.settings.gnome_client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": config.settings.gnome_return_url,
        },
        gnome_userdata,
        models.GnomeAccount,
        gnome_postlogin,
    )


@router.post("/login/google", tags=["auth"])
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
    the backend can clear the flow tokens

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
        gguser = requests.get(
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

    def google_postlogin(tokens, account):
        pass

    return continue_oauth_flow(
        request,
        login,
        data,
        "google",
        models.GoogleFlowToken,
        "https://www.googleapis.com/oauth2/v4/token",
        {
            "client_id": config.settings.google_client_id,
            "client_secret": config.settings.google_client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": config.settings.google_return_url,
        },
        google_userdata,
        models.GoogleAccount,
        google_postlogin,
    )


@router.post("/login/kde", tags=["auth"])
def continue_kde_flow(
    data: OauthLoginResponse, request: Request, login: LoginStatusDep
):
    def kde_userdata(tokens) -> ProviderInfo:
        return _gitlab_provider_info("https://invent.kde.org", tokens)

    def kde_postlogin(tokens, account):
        pass

    return continue_oauth_flow(
        request,
        login,
        data,
        "kde",
        models.KdeFlowToken,
        "https://invent.kde.org/oauth/token",
        {
            "client_id": config.settings.kde_client_id,
            "client_secret": config.settings.kde_client_secret,
            "grant_type": "authorization_code",
            "redirect_uri": config.settings.kde_return_url,
        },
        kde_userdata,
        models.KdeAccount,
        kde_postlogin,
    )


def continue_oauth_flow(
    request: Request,
    login: LoginInformation,
    data: OauthLoginResponse,
    method: str,
    flowtoken_model: models.Base,
    token_endpoint: str,
    oauth_args: dict,
    token_to_data: Callable[[dict], ProviderInfo],
    account_model: models.Base,
    postlogin_handler: Callable,
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
    with get_db("writer") as db:
        flowtoken_model.housekeeping(db)
        flowtokens = db.get(flowtoken_model, login.method_intermediate)
        del request.session["active-login-flow"]
        del request.session["active-login-flow-intermediate"]

        if flowtokens is None:
            return JSONResponse(
                {
                    "state": "error",
                    "error": "Login token has expired, please try again",
                },
                status_code=400,
            )

        if flowtokens.state != data.state:
            return JSONResponse(
                {
                    "state": "error",
                    "error": f"{method} authentication flow token does not match",
                },
                status_code=400,
            )

        # Token is present and good, let's clean up the flowtokens
        db.delete(flowtokens)
        if isinstance(data, OauthLoginResponseFailure):
            # We are dealing with a login failure, we've cleared the flow out of
            # the session cookie, and we're ready to clear from the database session
            # so just return a 'successfully not logged in' return
            db.commit()
            return {
                "status": "ok",
                "result": "flow_abandoned",
            }
        # And acquire the bearer info from the oauth provider
        args = oauth_args.copy()
        args["code"] = data.code
        args = urlencode(args)
        login_result = requests.post(
            token_endpoint,
            data=args,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
        ).json()

        if "error" in login_result:
            return JSONResponse(
                {
                    "state": "error",
                    "error": (
                        f"{method} login flow had an error: "
                        + repr(
                            login_result.get("error_description", login_result["error"])
                        )
                    ),
                },
                status_code=500,
            )
        if login_result["token_type"].lower() != "bearer":
            return JSONResponse(
                {
                    "state": "error",
                    "error": f"{method} login flow did not return a bearer token",
                },
                status_code=500,
            )
        # We now have a logged in user, so let's do our best to do something useful
        provider_data = token_to_data(login_result)
        # Do we have a provider's user noted with this ID already?
        account = account_model.by_provider_id(db, provider_data.id)
        if account is None:
            # We've never seen this provider's user before, if we're not already logged
            # in then create a user
            user = login.user
            if user is None:
                user = models.FlathubUser(display_name=provider_data.name)
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

        worker.send_email_new.send(payload)

        return {
            "status": "ok",
            "result": "logged_in",
        }


class AuthInfo(BaseModel):
    login: str
    avatar: Optional[str] = None


class Auths(BaseModel):
    github: Optional[AuthInfo] = None
    gitlab: Optional[AuthInfo] = None
    gnome: Optional[AuthInfo] = None
    kde: Optional[AuthInfo] = None


class Permission(str, Enum):
    QUALITY_MODERATION = "quality-moderation"
    MODERATION = "moderation"
    PAYMENT = "payment"
    DIRECT_UPLOAD = "direct-upload"
    VIEW_USERS = "view-users"
    MODIFY_USERS = "modify-users"


class UserInfo(BaseModel):
    displayname: Optional[str] = None
    dev_flatpaks: list[str] = []
    permissions: list[Permission] = []
    owned_flatpaks: list[str] = []
    invited_flatpaks: list[str] = []
    invite_code: str
    accepted_publisher_agreement_at: Optional[datetime]
    default_account: AuthInfo
    auths: Auths


@router.get("/userinfo", tags=["auth"])
def get_userinfo(login: LoginStatusDep) -> UserInfo:
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
        raise HTTPException(status_code=204, detail="Not logged in")

    appstream = apps.get_appids()

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
            auths[account.provider] = {}
            if account.login:
                auths[account.provider]["login"] = account.login
            if account.avatar_url:
                auths[account.provider]["avatar"] = account.avatar_url

        default_display_name = default_account.display_name if default_account else None
        default_avatar_url = default_account.avatar_url if default_account else None
        default_login = default_account.login if default_account else None
        invite_code = user.invite_code
        accepted_publisher_agreement_at = user.accepted_publisher_agreement_at

    defaultAccountInfo = AuthInfo(avatar=default_avatar_url, login=default_login)

    return UserInfo(
        displayname=default_display_name,
        dev_flatpaks=sorted(dev_flatpaks),
        permissions=sorted(permissions),
        owned_flatpaks=sorted(owned_flatpaks),
        invited_flatpaks=sorted(invited_flatpaks),
        invite_code=invite_code,
        accepted_publisher_agreement_at=accepted_publisher_agreement_at,
        default_account=defaultAccountInfo,
        auths=auths,
    )


class RefreshDevFlatpaksReturn(BaseModel):
    dev_flatpaks: list[str]


@router.post("/refresh-dev-flatpaks", tags=["auth"])
def do_refresh_dev_flatpaks(
    login=Depends(logged_in),
) -> RefreshDevFlatpaksReturn:
    user = login.user

    with get_db("writer") as db:
        account = models.GithubAccount.by_user(db, user)

        # We need to have a github account to refresh dev flatpaks
        if account is None:
            raise HTTPException(status_code=401, detail="no_github_account")

        refresh_repo_list(account.token, account.id)
        dev_flatpaks = {appid for appid in user.dev_flatpaks(db)}

    return RefreshDevFlatpaksReturn(dev_flatpaks=sorted(dev_flatpaks))


@router.post("/logout", tags=["auth"])
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
            if "active-login-flow" in request.session:
                del request.session["active-login-flow"]
            if "active-login-flow-intermediate" in request.session:
                del request.session["active-login-flow-intermediate"]

    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Session error: {str(e)}")

    return {}


class GetDeleteUserResult(BaseModel):
    status: str
    token: str


@router.get("/deleteuser", tags=["auth"])
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


@router.post("/deleteuser", tags=["auth"])
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


@router.post("/accept-publisher-agreement", tags=["auth"])
def do_agree_to_publisher_agreement(login: LoginStatusDep):
    if not login.user or not login.state.logged_in():
        raise HTTPException(status_code=403, detail="Not logged in")

    login.user.accepted_publisher_agreement_at = func.now()
    with get_db("writer") as db:
        db.commit()


@router.post("/change-default-account", status_code=204, tags=["auth"])
def do_change_default_account(
    provider: models.ConnectedAccountProvider,
    login: LoginStatusDep,
):
    """Changes the user's default account, which determines which display name and email we use."""

    if not login.user or not login.state.logged_in():
        raise HTTPException(status_code=403, detail="Not logged in")

    with get_db("replica") as db:
        account = login.user.get_connected_account(db, provider)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found")

        login.user.default_account = provider
        with get_db("writer") as db:
            db.commit()


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application

    This also enables session middleware and the database middleware
    """
    app.add_middleware(
        SessionMiddleware,
        secret_key=config.settings.session_secret_key,
        max_age=86400,
        https_only=True,
    )
    app.add_middleware(DBSessionMiddleware)
    app.include_router(router)
