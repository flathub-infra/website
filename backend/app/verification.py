from enum import Enum
from typing import List, Optional, Tuple
from uuid import uuid4

import requests
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi_sqlalchemy import DBSessionMiddleware
from fastapi_sqlalchemy import db as sqldb
from pydantic import BaseModel
from sqlalchemy.sql import func

from . import config, models, utils
from .logins import login_state


class ErrorDetail(str, Enum):
    # The app ID is not syntactically correct
    MALFORMED_APP_ID = "malformed_app_id"
    # The current user does not have access to the app's repository on github.com/flathub
    NOT_APP_DEVELOPER = "not_app_developer"
    # The app ID is not eligible for the requested verification method.
    INVALID_METHOD = "invalid_method"
    # The server could not connect to the website.
    FAILED_TO_CONNECT = "failed_to_connect"
    # The server got a non-200 status code from the website.
    SERVER_RETURNED_ERROR = "server_returned_error"
    # The correct token is not present in /.well-known/org.flathub.VerifiedApps.txt on the website.
    TOKEN_NOT_PRESENT = "app_not_listed"
    # The app cannot be verified because the Flathub administrators manually blocked it.
    BLOCKED_BY_ADMINS = "blocked_by_admins"
    # The operation requires you to be logged in.
    NOT_LOGGED_IN = "not_logged_in"
    # The operation requires a different user to be logged in.
    USERNAME_DOES_NOT_MATCH = "username_does_not_match"
    # The app can't be verified because it is already verified
    APP_ALREADY_VERIFIED = "app_already_verified"
    # Website verification needs to be set up before it can be confirmed
    MUST_SET_UP_FIRST = "must_set_up_first"


# Utility functions


def _matches_prefixes(appid: str, *prefixes) -> bool:
    for prefix in prefixes:
        if appid.startswith(prefix + "."):
            return True
    return False


def _get_provider_username(appid: str) -> Tuple["LoginProvider", str]:
    if _matches_prefixes(appid, "com.github", "io.github"):
        return (LoginProvider.GITHUB, appid.split(".")[2])
    elif _matches_prefixes(appid, "com.gitlab", "io.gitlab"):
        return (LoginProvider.GITLAB, appid.split(".")[2])
    elif _matches_prefixes(appid, "org.gnome.gitlab"):
        return (LoginProvider.GNOME_GITLAB, appid.split(".")[3])
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
        [tld, domain] = appid.split(".")[0:2]

        # Flatpak app IDs are slightly more restrictive than domain names, so some mangling is required. Fortunately,
        # given the syntax for domain name labels [1], the prescribed mangling rules are reversible.
        #
        # Mangling rules [2]:
        # - If an element starts with a digit, which is not allowed in D-Bus, prefix it with an underscore.
        # - Replace hyphens with underscores, since hyphens are not allowed in D-Bus.
        #
        # Domain names may not contain underscores, so any underscore in an app ID is the result of mangling. Hyphens
        # are not permitted as the first character of a domain name, so an underscore there is always escaping a
        # digit. Only a digit as the first character must be escaped as such, so an underscore anywhere else is always
        # replacing a hyphen.
        #
        # [1]: https://www.rfc-editor.org/rfc/rfc1035#section-2.3.1
        # [2]: https://dbus.freedesktop.org/doc/dbus-specification.html#message-protocol-names-bus
        if domain.startswith("_"):
            # Remove the underscore, which is escaping a digit
            domain = domain[1:]
        # All other underscores are replacements for hyphens
        domain = domain.replace("_", "-")

        return f"{domain}.{tld}"


# Routes
router = APIRouter(prefix="/verification")


class WebsiteVerificationResult(BaseModel):
    verified: bool
    detail: Optional[ErrorDetail] = None
    status_code: Optional[int] = None


class CheckWebsiteVerification:
    """Downloads a domain's verified apps list and checks for a token. This is split into a dependency so it can be
    tested separately."""

    def __call__(self, appid: str, token: str):
        domain = _get_domain_name(appid)
        if domain is None:
            return WebsiteVerificationResult(
                verified=False, detail=ErrorDetail.INVALID_METHOD
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

        if token in r.text:
            return WebsiteVerificationResult(verified=True)
        else:
            return WebsiteVerificationResult(
                verified=False, detail=ErrorDetail.TOKEN_NOT_PRESENT
            )


class VerificationMethod(Enum):
    # The app is not verified.
    NONE = "none"
    # The app was verified (or blocked from verification) by the admins.
    MANUAL = "manual"
    # The app was verified via website.
    WEBSITE = "website"
    # The app was verified via a login provider.
    LOGIN_PROVIDER = "login_provider"


class LoginProvider(Enum):
    GITHUB = "github"
    GITLAB = "gitlab"
    GNOME_GITLAB = "gnome"


class VerificationStatus(BaseModel):
    verified: bool
    method: Optional[VerificationMethod]
    website: Optional[str]
    login_provider: Optional[LoginProvider]
    login_name: Optional[str]
    detail: Optional[str]


def _get_existing_verification(appid: str) -> models.AppVerification | None:
    # Get all verification rows for this app
    verifications = models.AppVerification.all_by_app(sqldb, appid)

    # Manual unverification overrides any other verifications
    unverified = [
        verification
        for verification in verifications
        if verification.method == "manual" and not verification.verified
    ]
    if len(unverified):
        return unverified[0]

    # Get the verified row, if there is one (only one row can have verified=True due to a partial unique index)
    verified = [verification for verification in verifications if verification.verified]

    if len(verified):
        return verified[0]
    else:
        return None


def _check_app_id(appid: str, login):
    """Make sure the given user has development access to the given flatpak."""

    if not login["state"].logged_in():
        raise HTTPException(status_code=403, detail=ErrorDetail.NOT_LOGGED_IN)

    if not utils.is_valid_app_id(appid):
        raise HTTPException(status_code=400, detail=ErrorDetail.MALFORMED_APP_ID)

    if appid not in login["user"].dev_flatpaks(sqldb):
        raise HTTPException(status_code=401, detail=ErrorDetail.NOT_APP_DEVELOPER)

    existing = _get_existing_verification(appid)

    if existing is None:
        return
    elif existing.method == "manual" and not existing.verified:
        raise HTTPException(status_code=403, detail=ErrorDetail.BLOCKED_BY_ADMINS)
    else:
        raise HTTPException(status_code=403, detail=ErrorDetail.APP_ALREADY_VERIFIED)


def get_verified_apps():
    verified = models.AppVerification.all_verified(sqldb)
    return verified


@router.get(
    "/{appid}/status",
    status_code=200,
    response_model=VerificationStatus,
    response_model_exclude_none=True,
)
def get_verification_status(appid: str) -> VerificationStatus:
    """Gets the verification status of the given app."""

    verification = _get_existing_verification(appid)

    if verification is None:
        return VerificationStatus(verified=False)

    match verification.method:
        case "manual":
            return VerificationStatus(
                verified=verification.verified, method=VerificationMethod.MANUAL
            )
        case "website":
            return VerificationStatus(
                verified=True,
                method=VerificationMethod.WEBSITE,
                website=_get_domain_name(appid),
            )
        case "login_provider":
            (provider, username) = _get_provider_username(appid)
            return VerificationStatus(
                verified=True,
                method=VerificationMethod.LOGIN_PROVIDER,
                login_provider=provider,
                login_name=username,
            )


class AvailableMethodType(Enum):
    WEBSITE = "website"
    LOGIN_PROVIDER = "login_provider"


class AvailableMethod(BaseModel):
    method: AvailableMethodType
    website: Optional[str]
    website_token: Optional[str]
    login_provider: Optional[LoginProvider]
    login_name: Optional[str]


class AvailableMethods(BaseModel):
    methods: Optional[List[AvailableMethod]]
    detail: Optional[str]


@router.get(
    "/{appid}/available-methods",
    status_code=200,
    response_model=AvailableMethods,
    response_model_exclude_none=True,
)
def get_available_methods(appid: str, login=Depends(login_state)):
    """Gets the ways an app may be verified."""

    _check_app_id(appid, login)

    methods = []

    if domain := _get_domain_name(appid):
        verification = models.AppVerification.by_app_and_user(
            sqldb, appid, login["user"]
        )
        if (
            verification is not None
            and verification.method == "website"
            and verification.token is not None
        ):
            token = verification.token
        else:
            token = None

        methods.append(
            AvailableMethod(
                method=AvailableMethodType.WEBSITE, website=domain, website_token=token
            )
        )

    if provider := _get_provider_username(appid):
        provider_name, username = provider
        methods.append(
            AvailableMethod(
                method=AvailableMethodType.LOGIN_PROVIDER,
                login_provider=provider_name,
                login_name=username,
            )
        )

    return AvailableMethods(methods=methods)


@router.post("/{appid}/verify-by-login-provider", status_code=200)
def verify_by_login_provider(appid: str, login=Depends(login_state)):
    """If the current account is eligible to verify the given account via SSO, and the app is not already verified by
    someone else, marks the app as verified."""

    _check_app_id(appid, login)

    provider_username = _get_provider_username(appid)
    if provider_username is None:
        raise HTTPException(status_code=400, detail=ErrorDetail.INVALID_METHOD)

    (provider, username) = provider_username

    account = None
    if provider == LoginProvider.GITHUB:
        account = models.GithubAccount.by_user(sqldb, login["user"])
    elif provider == LoginProvider.GITLAB:
        account = models.GitlabAccount.by_user(sqldb, login["user"])
    elif provider == LoginProvider.GNOME_GITLAB:
        account = models.GnomeAccount.by_user(sqldb, login["user"])

    if account is None or account.login != username:
        raise HTTPException(status_code=401, detail=ErrorDetail.USERNAME_DOES_NOT_MATCH)

    verification = models.AppVerification(
        app_id=appid,
        account=login["user"].id,
        method="login_provider",
        verified=True,
        verified_timestamp=func.now(),
    )
    sqldb.session.merge(verification)
    sqldb.session.commit()


class WebsiteVerificationToken(BaseModel):
    domain: str
    token: str


@router.post(
    "/{appid}/setup-website-verification",
    status_code=200,
    response_model=WebsiteVerificationToken,
)
def setup_website_verification(appid: str, login=Depends(login_state)):
    """Creates a token for the user to verify the app via website."""

    _check_app_id(appid, login)

    domain = _get_domain_name(appid)

    if domain is None:
        raise HTTPException(status_code=400, detail=ErrorDetail.INVALID_METHOD)

    verification = models.AppVerification.by_app_and_user(sqldb, appid, login["user"])

    if (
        verification is None
        or verification.method != "website"
        or verification.token is None
    ):
        verification = models.AppVerification(
            app_id=appid,
            account=login["user"].id,
            method="website",
            verified=False,
            token=str(uuid4()),
        )
        sqldb.session.merge(verification)
        sqldb.session.commit()

    return WebsiteVerificationToken(domain=domain, token=verification.token)


@router.post(
    "/{appid}/confirm-website-verification",
    status_code=200,
    response_model=WebsiteVerificationResult,
    response_model_exclude_none=True,
)
def confirm_website_verification(
    appid: str, login=Depends(login_state), check=Depends(CheckWebsiteVerification)
):
    """Checks website verification, and if it succeeds, marks the app as verified for the current account."""

    _check_app_id(appid, login)

    verification = models.AppVerification.by_app_and_user(sqldb, appid, login["user"])

    if (
        verification is None
        or verification.method != "website"
        or verification.token is None
    ):
        raise HTTPException(status_code=400, detail=ErrorDetail.MUST_SET_UP_FIRST)

    result = check(appid, verification.token)

    if result.verified:
        verification.verified = True
        verification.verified_timestamp = func.now()
        sqldb.session.commit()

    return result


@router.post("/{appid}/unverify", status_code=204)
def unverify(appid: str, login=Depends(login_state)):
    """If the current account has verified the given app, mark it as no longer verified."""

    if not login["state"].logged_in():
        raise HTTPException(status_code=403, detail=ErrorDetail.NOT_LOGGED_IN)

    verification = models.AppVerification.by_app_and_user(sqldb, appid, login["user"])
    if verification is not None:
        sqldb.session.delete(verification)
        sqldb.session.commit()


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application

    This also enables session middleware and the database middleware
    """
    app.add_middleware(DBSessionMiddleware, db_url=config.settings.database_url)
    app.include_router(router)
