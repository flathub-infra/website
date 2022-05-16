"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""


from datetime import datetime, timedelta
from enum import Enum
from typing import Callable, Optional, Union
from urllib.parse import urlencode
from uuid import uuid4

import requests
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import DBSessionMiddleware, db
from github import Github
from gitlab import Gitlab
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from . import apps, config, models


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


class OauthLoginResponseSuccess(BaseModel):
    code: str
    state: str


class OauthLoginResponseFailure(BaseModel):
    state: str
    error: str
    error_description: Optional[str]
    error_uri: Optional[str]


OauthLoginResponse = Union[OauthLoginResponseSuccess, OauthLoginResponseFailure]


class UserDeleteRequest(BaseModel):
    token: str


# Routers etc.


router = APIRouter(prefix="/auth")


def login_state(request: Request):
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
    ret = {
        "state": LoginState.LOGGED_OUT,
        "user": None,
        "method": None,
        "method_intermediate": None,
    }
    user = request.session.get("user-id", None)
    if user is not None:
        user = db.session.get(models.FlathubUser, user)
    if user is not None:
        if user.deleted:
            user = None
            del request.session["user-id"]
    if user is not None:
        ret["state"] = LoginState.LOGGED_IN
        ret["user"] = user
    active_flow = request.session.get("active-login-flow", None)
    if active_flow is not None:
        ret["method"] = active_flow
        ret["method_intermediate"] = request.session["active-login-flow-intermediate"]
        if ret["state"] == LoginState.LOGGED_IN:
            ret["state"] = LoginState.LOGGING_IN_AGAIN
        else:
            ret["state"] = LoginState.LOGGING_IN
    return ret


@router.get("/login")
def get_login_kinds():
    """
    Retrieve the login methods available from the backend.

    For each method returned, flow starts with a `GET` to the endpoint
    `.../login/{method}` and upon completion from the user-agent, with a `POST`
    to that same endpoint name.

    Each method is also given a button icon and some text to use, though
    frontends with localisation may choose to render other text instead.
    """
    return [
        {
            "method": "github",
            "name": "GitHub",
        },
        {
            "method": "gitlab",
            "name": "GitLab",
        },
        {
            "method": "gnome",
            "name": "GNOME",
        },
        {
            "method": "google",
            "name": "Google",
        },
    ]


@router.get("/login/github")
def start_github_flow(request: Request, login=Depends(login_state)):
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
            "scope": "read:user read:org",
        },
    )


@router.get("/login/gitlab")
def start_gitlab_flow(request: Request, login=Depends(login_state)):
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
            "scope": "read_user",
            "response_type": "code",
        },
    )


@router.get("/login/gnome")
def start_gnome_flow(request: Request, login=Depends(login_state)):
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
            "scope": "read_user",
            "response_type": "code",
        },
    )


@router.get("/login/google")
def start_google_flow(request: Request, login=Depends(login_state)):
    """
    Starts a google login flow.  This will set session cookie values and
    will return a redirect.  The frontend is expected to save the cookie
    for use later, and follow the redirect to Google

    Upon return from Google to the frontend, the frontend should POST to this
    endpoint with the relevant data from Google

    If the user is already logged in, and has a valid google token stored,
    then this will return an error instead.
    """
    return start_oauth_flow(
        request,
        login,
        "google",
        models.GoogleAccount,
        models.GoogleFlowToken,
        "https://accounts.google.com/o/oauth2/v2/auth",
        {
            "client_id": config.settings.google_client_id,
            "redirect_uri": config.settings.google_return_url,
            "scope": "openid email",
            "response_type": "code",
        },
    )


def start_oauth_flow(
    request: Request,
    login: dict,
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
            # Already mid-flow to something else
            return JSONResponse(
                {"state": "error", "error": "User is mid-login-flow elsewhere"},
                status_code=400,
            )
    user = login["user"]
    if user is not None:
        account = account_model.by_user(db, user)
        if account is not None and account.token is not None:
            return JSONResponse(
                {"state": "error", "error": f"User already logged into {method}"},
                status_code=400,
            )
    # Okay, we're preparing a login, step one, do we already have an
    # intermediate we're using?
    flowtoken_model.housekeeping(db)
    intermediate = login["method_intermediate"]
    if intermediate is not None:
        # Yes, retrieve it from the db
        intermediate = db.session.get(flowtoken_model, intermediate)
    if intermediate is None:
        # No, let's create one
        randomtoken = uuid4().hex
        intermediate = flowtoken_model(
            state=randomtoken,
            created=datetime.now(),
        )
        db.session.add(intermediate)
        db.session.commit()
    # Copy the oauth arguments so we can add our state to them
    args = oauth_args.copy()
    args["state"] = intermediate.state
    args = urlencode(args)
    request.session["active-login-flow"] = method
    request.session["active-login-flow-intermediate"] = intermediate.id
    return {
        "state": "ok",
        "redirect": f"{oauth_endpoint}?{args}",
    }


@router.post("/login/github")
def continue_github_flow(
    data: OauthLoginResponse, request: Request, login=Depends(login_state)
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

    def github_userdata(tokens):
        gh = Github(tokens["access_token"])
        ghuser = gh.get_user()
        return {
            "id": ghuser.id,
            "login": ghuser.login,
            "name": ghuser.name,
            "avatar_url": ghuser.avatar_url,
        }

    def github_postlogin(tokens, account):
        gh = Github(tokens["access_token"])
        ghuser = gh.get_user()
        repos = [
            repo.full_name.removeprefix("flathub/")
            for repo in ghuser.get_repos(affiliation="collaborator")
            if repo.full_name.startswith("flathub/") and repo.permissions.push
        ]
        models.GithubRepository.unify_repolist(db, account, repos)

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


@router.post("/login/gitlab")
def continue_gitlab_flow(
    data: OauthLoginResponse, request: Request, login=Depends(login_state)
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

    def gitlab_userdata(tokens):
        gh = Gitlab("https://gitlab.com", oauth_token=tokens["access_token"])
        gh.auth()
        gluser = gh.user
        return {
            "id": gluser.id,
            "login": gluser.username,
            "name": gluser.name,
            "avatar_url": gluser.avatar_url,
        }

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


@router.post("/login/gnome")
def continue_gnome_flow(
    data: OauthLoginResponse, request: Request, login=Depends(login_state)
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

    def gnome_userdata(tokens):
        gl = Gitlab("https://gitlab.gnome.org", oauth_token=tokens["access_token"])
        gl.auth()
        gluser = gl.user
        return {
            "id": gluser.id,
            "login": gluser.username,
            "name": gluser.name,
            "avatar_url": gluser.avatar_url,
        }

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


@router.post("/login/google")
def continue_google_flow(
    data: OauthLoginResponse, request: Request, login=Depends(login_state)
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

    def google_userdata(tokens):
        userinfo_endpoint = "https://www.googleapis.com/oauth2/v3/userinfo"
        access_token = tokens["access_token"]
        gguser = requests.get(
            userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"}
        ).json()
        sub = gguser["sub"]
        login = gguser.get("email", sub)
        return {
            "id": sub,
            "login": login,
            "name": gguser.get("name", login),
            "avatar_url": gguser.get("picture"),
        }

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


def continue_oauth_flow(
    request: Request,
    login: dict,
    data: OauthLoginResponse,
    method: str,
    flowtoken_model: models.Base,
    token_endpoint: str,
    oauth_args: dict,
    token_to_data: Callable,
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
    if login["method"] != method:
        return JSONResponse(
            {"state": "error", "error": f"Not mid-{method} login flow"}, status_code=400
        )
    flowtoken_model.housekeeping(db)
    flowtokens = db.session.get(flowtoken_model, login["method_intermediate"])
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
    db.session.delete(flowtokens)
    if isinstance(data, OauthLoginResponseFailure):
        # We are dealing with a login failure, we've cleared the flow out of
        # the session cookie, and we're ready to clear from the database session
        # so just return a 'successfully not logged in' return
        db.session.commit()
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
    print("TOKENS: " + repr(login_result))
    if "error" in login_result:
        return JSONResponse(
            {
                "state": "error",
                "error": (
                    f"{method} login flow had an error: "
                    + repr(login_result.get("error_description", login_result["error"]))
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
    account = account_model.by_provider_id(db, provider_data["id"])
    if account is None:
        # We've never seen this provider's user before, if we're not already logged
        # in then create a user
        user = login["user"]
        if user is None:
            user = models.FlathubUser(display_name=provider_data["name"])
            db.session.add(user)
            db.session.flush()
        # Now we have a user, create the local account model for it
        userid = {}
        userid[f"{method}_userid"] = provider_data["id"]
        account = account_model(
            user=user.id,
            token=login_result["access_token"],
            login=provider_data["login"],
            avatar_url=provider_data["avatar_url"],
            last_used=datetime.now(),
            **userid,
        )
        if "refresh_token" in login_result:
            account.refresh_token = login_result["refresh_token"]
            account.access_token_expires = datetime.now() + timedelta(
                seconds=int(login_result.get("expires_in", "7200"))
            )
        db.session.add(account)
    else:
        # The provider's user has been seen before, if we're logged in already and
        # things don't match then abort now
        user = login["user"]
        if user is not None:
            # Eventually we might do user-merge here?
            db.session.commit()
            return JSONResponse(
                {"status": "error", "error": "User already logged in?"}, status_code=500
            )
        account.login = provider_data["login"]
        account.avatar_url = provider_data["avatar_url"]
        account.token = login_result["access_token"]
        account.last_used = datetime.now()
        if "refresh_token" in login_result:
            account.refresh_token = login_result["refresh_token"]
            account.access_token_expires = datetime.now() + timedelta(
                seconds=int(login_result.get("expires_in", "7200"))
            )
        db.session.add(account)
    request.session["user-id"] = account.user
    # Let's find the set of repos the user has write access to in the flathub
    # org since we have a functional token
    postlogin_handler(login_result, account)
    # The session is now ready
    db.session.commit()
    return {
        "status": "ok",
        "result": "logged_in",
    }


@router.get("/userinfo")
def get_userinfo(login=Depends(login_state)):
    """
    Retrieve the current login's user information.  If the user is not logged in
    you will get a `403` return.  Otherwise you will receive JSON describing the
    currently logged in user, for example:

    ```
    {
        "displayname": "Mx Human Person",
        "dev-flatpaks": [ "org.people.human.Appname" ],
    }
    ```

    If the user has an active github login, you'll also get their github login
    name, and avatar.  If they have some other login, details for that login
    will be provided.

    dev-flatpaks is filtered against IDs available in AppStream
    """
    if not login["state"].logged_in():
        return Response(status_code=403)
    user = login["user"]
    ret = {"displayname": user.display_name, "dev-flatpaks": set()}
    ret["auths"] = {}

    gha = models.GithubAccount.by_user(db, user)
    if gha is not None:
        available_apps = apps.list_appstream()

        ret["auths"]["github"] = {}
        if gha.login:
            ret["auths"]["github"]["login"] = gha.login
        if gha.avatar_url:
            ret["auths"]["github"]["avatar"] = gha.avatar_url
        for repo in models.GithubRepository.all_by_account(db, gha):
            if repo.reponame in available_apps:
                ret["dev-flatpaks"].add(repo.reponame)

    gla = models.GitlabAccount.by_user(db, user)
    if gla is not None:
        ret["auths"]["gitlab"] = {}
        if gla.login:
            ret["auths"]["gitlab"]["login"] = gla.login
        if gla.avatar_url:
            ret["auths"]["gitlab"]["avatar"] = gla.avatar_url

    gnma = models.GnomeAccount.by_user(db, user)
    if gnma is not None:
        ret["auths"]["gnome"] = {}
        if gnma.login:
            ret["auths"]["gnome"]["login"] = gnma.login
        if gnma.avatar_url:
            ret["auths"]["gnome"]["avatar"] = gnma.avatar_url

    gga = models.GoogleAccount.by_user(db, user)
    if gga is not None:
        ret["auths"]["google"] = {}
        if gga.login:
            ret["auths"]["google"]["login"] = gga.login
        if gga.avatar_url:
            ret["auths"]["google"]["avatar"] = gga.avatar_url

    return ret


@router.post("/logout")
def do_logout(request: Request, login=Depends(login_state)):
    """
    Clear the login state.  This will discard tokens which access socials,
    and will clear the session cookie so that the user is not logged in.
    """
    if login["state"] == LoginState.LOGGED_OUT:
        return {}

    # Clear the login ID
    del request.session["user-id"]
    if login["state"].logging_in():
        # Also clear any pending login-flow from the session
        del request.session["active-login-flow"]
        del request.session["active-login-flow-intermediate"]
    return {}


@router.get("/deleteuser")
def get_deleteuser(login=Depends(login_state)):
    """
    Delete a user's login information.
    If they're not logged in, they'll get a `403` return.
    Otherwise they will get an option to delete their account
    and data.
    """
    if not login["state"].logged_in():
        return Response(status_code=403)
    user = login["user"]

    token = models.FlathubUser.generate_token(db, user)
    return {
        "status": "ok",
        "token": token,
    }


@router.post("/deleteuser")
def do_deleteuser(
    request: Request, data: UserDeleteRequest, login=Depends(login_state)
):
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
    if not login["state"].logged_in():
        return Response(status_code=403)
    user = login["user"]

    ret = models.FlathubUser.delete_user(db, user, data.token)

    if ret["status"] == "ok":
        request.session.clear()
    else:
        return JSONResponse(ret, status_code=400)

    return ret


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application

    This also enables session middleware and the database middleware
    """
    app.add_middleware(SessionMiddleware, secret_key=config.settings.session_secret_key)
    app.add_middleware(DBSessionMiddleware, db_url=config.settings.database_url)
    app.include_router(router)
