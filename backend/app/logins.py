"""
This is all the login support for the flathub backend

Here we handle all the login flows, user management etc.

And we present the full /auth/ sub-namespace
"""


from datetime import datetime
from enum import Enum
from urllib.parse import urlencode
from uuid import uuid4

import requests
from fastapi import APIRouter, Depends, FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import DBSessionMiddleware, db
from github import Github
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware

from . import config, models

# Utility bits


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


class GithubLoginResponse(BaseModel):
    state: str
    code: str


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
            "button": "https://login-with-github-icon.png",
            "text": "Log in with Github",
        }
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
    if login["state"].logging_in():
        # Already logging in to something
        if login["method"] == "github":
            # Already logging into github, so assume something went squiffy
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
        gha = models.GithubAccount.by_user(db, user)
        if gha is not None and gha.token is not None:
            return JSONResponse(
                {"state": "error", "error": "User already logged into github"},
                status_code=400,
            )
    # Okay, we're preparing a login, step one, do we already have an
    # intermediate we're using?
    intermediate = login["method_intermediate"]
    if intermediate is not None:
        # Yes, retrieve it from the db
        intermediate = db.session.get(models.GithubFlowToken, intermediate)
        created = intermediate.created
        now = datetime.now()
        if (now - created).seconds > (10 * 60):
            # More than 10 minutes have passed, cancel this
            db.session.delete(intermediate)
            intermediate = None
    if intermediate is None:
        # No, let's create one
        randomtoken = uuid4().hex
        intermediate = models.GithubFlowToken(
            state=randomtoken,
            created=datetime.now(),
        )
        db.session.add(intermediate)
        db.session.commit()
    # We have reached the point of wanting to return the redirect.
    # Github OAUTH endpoint is:
    # https://github.com/login/oauth/authorize
    # It expects parameters of client_id, redirect_uri, state, and allow_signup
    # state is our intermediate's state
    # redirect_uri must point at our frontend's accept point and is part of the
    # client whose client_id we must provide.
    # By default we use a client registered to work with the dev backend/frontend
    args = {
        "client_id": config.settings.github_client_id,
        "state": intermediate.state,
        "redirect_uri": config.settings.github_return_url,
        "allow_signup": "false",
        "scope": "read:user read:org",
    }
    args = urlencode(args)
    request.session["active-login-flow"] = "github"
    request.session["active-login-flow-intermediate"] = intermediate.id
    return {
        "state": "ok",
        "redirect": f"https://github.com/login/oauth/authorize?{args}",
    }


@router.post("/login/github")
def continue_github_flow(
    data: GithubLoginResponse, request: Request, login=Depends(login_state)
):
    """
    Process the result of the Github oauth flow

    This expects to have some JSON posted to it which contains:

    ```
    {
        "state": "the state code",
        "code": "the github oauth code",
    }
    ```

    This will either return an error if something went wrong, or else
    will return a redirect to the userinfo endpoint.
    """
    if login["method"] != "github":
        return JSONResponse(
            {"state": "error", "error": "Not mid-github login flow"}, status_code=400
        )
    flowtokens = db.session.get(models.GithubFlowToken, login["method_intermediate"])
    del request.session["active-login-flow"]
    del request.session["active-login-flow-intermediate"]
    if flowtokens.state != data.state:
        return JSONResponse(
            {
                "state": "error",
                "error": "Github authentication flow token does not match",
            },
            status_code=400,
        )
    if (datetime.now() - flowtokens.created).seconds > 10 * 60:
        db.session.delete(flowtokens)
        db.session.commit()
        return JSONResponse(
            {
                "state": "error",
                "error": "Github authentication flow token too old",
            },
            status_code=400,
        )
    # Token is good, age is good, let's clean up the flowtokens
    db.session.delete(flowtokens)
    # And acquire the bearer info from Github
    args = {
        "client_id": config.settings.github_client_id,
        "client_secret": config.settings.github_client_secret,
        "code": data.code,
    }
    args = urlencode(args)
    login_result = requests.post(
        "https://github.com/login/oauth/access_token",
        data=args,
        headers={"Accept": "application/json"},
    ).json()
    if login_result["token_type"] != "bearer":
        return JSONResponse(
            {
                "state": "error",
                "error": "Github did not return a bearer token",
            },
            status_code=500,
        )
    # We now have a logged in user, so let's do our best to do something useful
    token = login_result["access_token"]
    github = Github(token)
    ghuser = github.get_user()
    # Do we have a github user noted with this ID already?
    gha = models.GithubAccount.by_gh_id(db, ghuser.id)
    if gha is None:
        # We've never seen this github user before, if we're not already logged
        # in then create a user
        user = login["user"]
        if user is None:
            user = models.FlathubUser(display_name=ghuser.name)
            db.session.add(user)
            db.session.flush()
        # Now we have a user, create the github account for it
        gha = models.GithubAccount(
            user=user.id,
            github_userid=ghuser.id,
            token=token,
            login=ghuser.login,
            avatar_url=ghuser.avatar_url,
            last_used=datetime.now(),
        )
        db.session.add(gha)
    else:
        # The github user has been seen before, if we're logged in already and
        # things don't match then abort now
        user = login["user"]
        if user is not None:
            # Eventually we might do user-merge here?
            db.session.commit()
            return JSONResponse(
                {"status": "error", "error": "User already logged in?"}, status_code=500
            )
        gha.login = ghuser.login
        gha.avatar_url = ghuser.avatar_url
        gha.token = token
        gha.last_used = datetime.now()
        db.session.add(gha)
    request.session["user-id"] = gha.user
    # Let's find the set of repos the user has write access to in the flathub
    # org since we have a functional token
    repos = [
        repo.full_name.removeprefix("flathub/")
        for repo in ghuser.get_repos(affiliation="collaborator")
        if repo.full_name.startswith("flathub/") and repo.permissions.push
    ]
    models.GithubRepository.unify_repolist(db, gha, repos)
    # The session is now ready
    db.session.commit()
    return Response(status_code=302, headers={"Location": "/auth/userinfo"})


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
    """
    if not login["state"].logged_in():
        return Response(status_code=403)
    user = login["user"]
    ret = {"displayname": user.display_name, "dev-flatpaks": set()}

    gha = models.GithubAccount.by_user(db, user)
    if gha is not None:
        if gha.login:
            ret["github_login"] = gha.login
        if gha.avatar_url:
            ret["github_avatar"] = gha.avatar_url
        for repo in models.GithubRepository.all_by_account(db, gha):
            ret["dev-flatpaks"].add(repo.reponame)

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


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application

    This also enables session middleware and the database middleware
    """
    app.add_middleware(SessionMiddleware, secret_key=config.settings.session_secret_key)
    app.add_middleware(DBSessionMiddleware, db_url=config.settings.database_url)
    app.include_router(router)
