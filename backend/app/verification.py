import os
import re
import urllib.parse
from enum import Enum
from typing import Optional, Tuple

import requests
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi_sqlalchemy import DBSessionMiddleware
from fastapi_sqlalchemy import db as sqldb
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import func

from . import config, db, models, utils
from .logins import login_state


class ErrorDetail(str, Enum):
    # The app ID is not syntactically correct
    MALFORMED_APP_ID = "malformed_app_id"
    # The app ID does not refer to an existing flathub repository.
    REPO_DOES_NOT_EXIST = "repo_does_not_exist"
    # The server could not connect to GitHub.
    ERROR_CONNECTING_TO_GITHUB = "error_connecting_to_github"
    # Website verification was requested, but the app ID is not eligible for website verification.
    INVALID_DOMAIN = "invalid_domain"
    # Login verification was requested, but the app ID is not eligible for it.
    INVALID_USERNAME = "invalid_username"
    # The server could not connect to the website.
    FAILED_TO_CONNECT = "failed_to_connect"
    # The server got a non-200 status code from the website.
    SERVER_RETURNED_ERROR = "server_returned_error"
    # The app ID is not listed in /.well-known/org.flathub.VerifiedApps.txt on the website.
    APP_NOT_LISTED = "app_not_listed"
    # The app cannot be verified because the flathub administrators manually blocked it.
    BLOCKED_BY_ADMINS = "blocked_by_admins"
    # The operation requires you to be logged in.
    NOT_LOGGED_IN = "not_logged_in"
    # The operation requires a different user to be logged in.
    USERNAME_DOES_NOT_MATCH = "username_does_not_match"
    # The app can't be verified because it is already verified
    APP_ALREADY_VERIFIED = "app_already_verified"


def update():
    with db.redis_conn.pipeline() as p:
        with requests.Session() as session:
            for verdict in ["verified", "blocked"]:
                r = session.get(
                    f"https://raw.githubusercontent.com/flathub/website/main/backend/data/verification/{verdict}.json"
                )
                if r.status_code == 200:
                    value = r.json()
                    p.unlink(f"verification:{verdict}")
                    if len(value):
                        p.sadd(f"verification:{verdict}", *value)

        p.execute()


def initialize():
    verification_dir = os.path.join(config.settings.datadir, "verification")
    with db.redis_conn.pipeline() as p:
        for verdict in ["verified", "blocked"]:
            value = utils.get_appids(os.path.join(verification_dir, verdict + ".json"))
            p.unlink(f"verification:{verdict}")
            if len(value):
                p.sadd(f"verification:{verdict}", *value)
        p.execute()


# Utility functions


def _matches_prefixes(appid: str, *prefixes) -> bool:
    for prefix in prefixes:
        if appid.startswith(prefix + "."):
            return True
    return False


def _get_provider_username(appid: str) -> Tuple[str, str]:
    if _matches_prefixes(appid, "com.github", "io.github"):
        return ("GitHub", appid.split(".")[2])
    elif _matches_prefixes(appid, "com.gitlab", "io.gitlab"):
        return ("GitLab", appid.split(".")[2])
    elif _matches_prefixes(appid, "org.gnome.gitlab"):
        return ("GnomeGitLab", appid.split(".")[3])
    else:
        return None


def _get_domain_name(appid: str) -> str:
    if _matches_prefixes(appid, "com.github", "com.gitlab"):
        # These app IDs are common, and we don't want to confuse people by saying they can put a file on GitHub/GitLab's
        # main website.
        return None
    elif _matches_prefixes(appid, "io.github", "io.gitlab"):
        # You can, however, verify by putting a file on your *.github.io or *.gitlab.io site
        return ".".join(reversed(appid.split(".")[0:3]))
    else:
        return ".".join(reversed(appid.split(".")[0:2]))


def is_valid_app_id(appid: str) -> bool:
    return len(appid.split(".")) >= 3 and re.match("[_\w\.]+$", appid)


def is_github_app(appid: str) -> bool:
    """Determines whether the app is a repo in github.com/flathub."""

    try:
        r = requests.get(
            f"https://api.github.com/repos/flathub/{urllib.parse.quote(appid, safe='')}"
        )
        return r.status_code == 200
    except:
        raise HTTPException(
            status_code=500, detail=ErrorDetail.ERROR_CONNECTING_TO_GITHUB
        )


def _check_app_id_error(appid: str) -> ErrorDetail:
    """
    Returns an ErrorDetail if the app ID is invalid, or None if it is valid.
    """

    if not is_valid_app_id(appid):
        return ErrorDetail.MALFORMED_APP_ID

    if not is_github_app(appid):
        return ErrorDetail.REPO_DOES_NOT_EXIST

    return None


# Routes
router = APIRouter(prefix="/verification")


class WebsiteVerificationResult(BaseModel):
    verified: bool
    detail: Optional[ErrorDetail] = None
    status_code: Optional[int] = None


def _check_website_verification(appid: str) -> WebsiteVerificationResult:
    domain = _get_domain_name(appid)
    if domain is None:
        return WebsiteVerificationResult(
            verified=False, detail=ErrorDetail.INVALID_DOMAIN
        )

    try:
        r = requests.get(
            f"https://{domain}/.well-known/org.flathub.VerifiedApps.txt", timeout=5
        )
    except:
        return WebsiteVerificationResult(
            verified=False, detail=ErrorDetail.FAILED_TO_CONNECT
        )

    if r.status_code != 200:
        return WebsiteVerificationResult(
            verified=False,
            detail=ErrorDetail.SERVER_RETURNED_ERROR,
            status_code=r.status_code,
        )

    if appid in r.text.split("\n"):
        return WebsiteVerificationResult(verified=True)
    else:
        return WebsiteVerificationResult(
            verified=False, detail=ErrorDetail.APP_NOT_LISTED
        )


@router.get("/{appid}/available-methods", status_code=200)
def get_verification_methods(appid: str):
    """
    Gets a list of all available verification methods for an app.

    Returns:
    - "methods": An array of methods.
      - "method": "website" or "login_provider"
      - "website": For "website" method, the domain name for the website (e.g. flathub.org)
      - "login_provider": For "login_provider" method. Currently one of "GitHub", "GitLab", or "GnomeGitLab".
      - "login_name": For "login_provider" method. The username of the user who must verify the app.
    - "detail": Error detail.
    """
    if detail := _check_app_id_error(appid):
        return {
            "methods": [],
            "detail": detail,
        }

    if db.redis_conn.sismember("verification:blocked", appid):
        return {
            "methods": [],
            "detail": ErrorDetail.BLOCKED_BY_ADMINS,
        }

    methods = []

    if domain := _get_domain_name(appid):
        methods.append(
            {
                "method": "website",
                "website": domain,
            }
        )

    if provider := _get_provider_username(appid):
        provider_name, username = provider
        methods.append(
            {
                "method": "login_provider",
                "login_provider": provider_name,
                "login_name": username,
            }
        )

    return {
        "methods": methods,
    }


@router.get("/{appid}/status", status_code=200)
def get_verification_status(appid: str):
    """
    Gets the verification status of an app ID.

    Returns:
    - "verified": True or False
    - "method": "none", "manual", or "website"
    - "website": For "website" method, the domain name of the website that verified the app (e.g. "gnome.org").
    - "login_provider": For "login_provider" method, the login provider the app was verified through.
    - "login_name": For "login_provider" method, the username of the user who verified the app.
    - "detail": Error detail. See docs for _check_app_id_error().
    """
    if detail := _check_app_id_error(appid):
        return {
            "verified": False,
            "method": "none",
            "detail": detail,
        }

    if db.redis_conn.sismember("verification:verified", appid):
        return {
            "verified": True,
            "method": "manual",
        }

    if db.redis_conn.sismember("verification:blocked", appid):
        return {
            "verified": False,
            "method": "manual",
        }

    if _check_website_verification(appid).verified:
        return {
            "verified": True,
            "method": "website",
            "website": _get_domain_name(appid),
        }

    if provider := _get_provider_username(appid):
        provider_name, username = provider
        verified_app = sqldb.session.get(models.UserVerifiedApp, appid)
        if verified_app is not None:
            return {
                "verified": True,
                "method": "login_provider",
                "login_provider": provider_name,
                "login_name": username,
            }

    return {
        "verified": False,
        "method": "none",
    }


@router.get("/{appid}/website", status_code=200)
def get_website_verification(appid: str):
    """
    Returns information helpful for debugging the website verification process, such as what error occurred (if any)
    and the status code received from the website.

    Returns:
    - "verified": True or False
    - "detail": Error detail. See docs for _check_app_id_error().
    - "status_code": The status code if "detail" is "server_returned_error".
    """
    if detail := _check_app_id_error(appid):
        return WebsiteVerificationResult(verified=False, detail=detail)

    return _check_website_verification(appid)


def _verify_app(appid: str, login, verified: bool):
    """Marks a flatpak as verified. This requires the logged in user to have an account with the correct provider and
    with the correct username, as specified by the app ID.

    Returns: Same as get_verification_status()."""

    if not login["state"].logged_in():
        raise HTTPException(status_code=403, detail="not_logged_in")

    if detail := _check_app_id_error(appid):
        return {
            "verified": False,
            "method": "none",
            "detail": detail,
        }

    provider = _get_provider_username(appid)
    if provider is None:
        raise HTTPException(status_code=400, detail=ErrorDetail.INVALID_USERNAME)

    provider_name, username = provider

    account = None
    if provider_name == "GitHub":
        account = models.GithubAccount.by_user(sqldb, login["user"])
    elif provider_name == "GitLab":
        account = models.GitlabAccount.by_user(sqldb, login["user"])
    elif provider_name == "GnomeGitLab":
        account = models.GnomeAccount.by_user(sqldb, login["user"])

    if account is not None and account.login == username:
        if verified:
            verification = models.UserVerifiedApp(
                app_id=appid, account=login["user"].id, created=func.now()
            )
            try:
                sqldb.session.add(verification)
                sqldb.session.commit()
                return JSONResponse(
                    {
                        "verified": True,
                        "method": "login_provider",
                        "login_provider": provider_name,
                        "login_name": account.login,
                    }
                )
            except IntegrityError:
                raise HTTPException(
                    status_code=400, detail=ErrorDetail.APP_ALREADY_VERIFIED
                )
        else:
            sqldb.session.execute(
                delete(models.UserVerifiedApp).where(
                    models.UserVerifiedApp.app_id == appid
                )
            )
            sqldb.session.commit()
            return JSONResponse(
                {
                    "verified": False,
                    "method": "none",
                }
            )
    else:
        raise HTTPException(status_code=403, detail=ErrorDetail.USERNAME_DOES_NOT_MATCH)


@router.post("/{appid}/verify", status_code=200)
def verify_app(appid: str, login=Depends(login_state)):
    return _verify_app(appid, login, True)


@router.post("/{appid}/unverify", status_code=200)
def unverify_app(appid: str, login=Depends(login_state)):
    return _verify_app(appid, login, False)


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application

    This also enables session middleware and the database middleware
    """
    app.add_middleware(DBSessionMiddleware, db_url=config.settings.database_url)
    app.include_router(router)
