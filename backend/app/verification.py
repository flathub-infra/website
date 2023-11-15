import xml.etree.ElementTree as ET
from enum import Enum
from uuid import uuid4

import github
import gitlab
import requests
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path
from fastapi_sqlalchemy import DBSessionMiddleware
from fastapi_sqlalchemy import db as sqldb
from github.GithubException import UnknownObjectException
from pydantic import BaseModel
from sqlalchemy.sql import func

from . import config, models, utils, worker
from .login_info import logged_in
from .logins import LoginInformation, refresh_oauth_token


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
    # The operation requires you to be logged in to Flathub or a specific provider.
    NOT_LOGGED_IN = "not_logged_in"
    # The operation requires a different user to be logged in.
    USERNAME_DOES_NOT_MATCH = "username_does_not_match"
    # The app ID contains a username that does not exist for its provider.
    USER_DOES_NOT_EXIST = "user_does_not_exist"
    # An issue occurred when connecting to the login provider.
    PROVIDER_ERROR = "provider_error"
    # The login provider denied access to the information needed, such as membership in the organization. This can
    # happen when verifying by GitHub organization if the organization has restricted access to OAuth apps. See
    # <https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data>.
    PROVIDER_DENIED_ACCESS = "provider_denied_access"
    # The currently logged in user is not a member of the required organization on a login provider.
    NOT_ORG_MEMBER = "not_org_member"
    # The currently logged in user is regular member, not an admin, of the required organization on a login provider.
    NOT_ORG_ADMIN = "not_org_admin"
    # The app can't be verified because it is already verified
    APP_ALREADY_VERIFIED = "app_already_verified"
    # Website verification needs to be set up before it can be confirmed
    MUST_SET_UP_FIRST = "must_set_up_first"
    # The app can't be verified as a new app because it already exists in github.org/flathub
    APP_ALREADY_EXISTS = "app_already_exists"
    # The user has not agreed to the publisher agreement
    MUST_ACCEPT_PUBLISHER_AGREEMENT = "must_accept_publisher_agreement"


# Utility functions


def _matches_prefixes(app_id: str, *prefixes) -> bool:
    return any(app_id.startswith(prefix + ".") for prefix in prefixes)


def _get_provider_username(app_id: str) -> tuple["LoginProvider", str] | None:
    if _matches_prefixes(app_id, "com.github", "io.github"):
        return (LoginProvider.GITHUB, _demangle_name(app_id.split(".")[2]))
    elif _matches_prefixes(app_id, "com.gitlab", "io.gitlab"):
        return (LoginProvider.GITLAB, _demangle_name(app_id.split(".")[2]))
    elif _matches_prefixes(app_id, "org.gnome.gitlab"):
        return (LoginProvider.GNOME_GITLAB, _demangle_name(app_id.split(".")[3]))
    elif _matches_prefixes(app_id, "org.gnome.World"):
        if maintainers := _get_gnome_world_doap_maintainers(app_id):
            return (LoginProvider.GNOME_GITLAB, maintainers[0])
        else:
            return None
    elif _matches_prefixes(app_id, "org.gnome.design"):
        return (LoginProvider.GNOME_GITLAB, "World/design")
    elif _matches_prefixes(app_id, "org.gnome"):
        return (LoginProvider.GNOME_GITLAB, "GNOME")
    elif _matches_prefixes(app_id, "org.kde"):
        return (LoginProvider.KDE_GITLAB, "teams/flathub")
    else:
        return None


def _demangle_name(name: str) -> str:
    # Flatpak app IDs are slightly more restrictive than domain names, so some mangling is required. Fortunately,
    # given the syntax for domain name labels [1], the prescribed mangling rules are reversible.
    #
    # We also demangle login_provider usernames in the same way. For GitLab, the mangling rules are *not* reversible,
    # but because of GitLab Pages most people won't have a username that really contains underscores anyway.
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
    if name.startswith("_"):
        # Remove the underscore, which is escaping a digit
        name = name[1:]
    # All other underscores are replacements for hyphens
    name = name.replace("_", "-")

    return name


def _get_domain_name(app_id: str) -> str | None:
    if _matches_prefixes(app_id, "com.github", "com.gitlab"):
        # These app IDs are common, and we don't want to confuse people by saying they can put a file on GitHub/GitLab's
        # main website.
        return None
    elif _matches_prefixes(app_id, "io.github", "io.gitlab", "page.codeberg"):
        # You can, however, verify by putting a file on your *.github.io or *.gitlab.io site
        [tld, domain, username] = app_id.split(".")[0:3]
        username = _demangle_name(username)
        return f"{username}.{domain}.{tld}".lower()
    else:
        [tld, domain] = app_id.split(".")[0:2]
        domain = _demangle_name(domain)
        return f"{domain}.{tld}".lower()


def _get_gnome_world_doap_maintainers(app_id: str) -> list[str]:
    repo_name = app_id.split(".")[-1].lower()
    if repo_name == "pikabackup":
        repo_name = "pika-backup"

    try:
        r = requests.get(
            f"https://gitlab.gnome.org/World/{repo_name}/-/raw/HEAD/{repo_name}.doap"
        )
    except requests.exceptions.ConnectionError:
        return []

    if r.status_code != 200:
        return []

    root = ET.fromstring(r.text)
    maintainers = []

    maintainer_tags = root.findall("{http://usefulinc.com/ns/doap#}maintainer")
    for maintainer_tag in maintainer_tags:
        person_tags = maintainer_tag.findall("{http://xmlns.com/foaf/0.1/}Person")
        for person_tag in person_tags:
            if account_tag := person_tag.find("{http://xmlns.com/foaf/0.1/}account"):
                if online_account := account_tag.find(
                    "{http://xmlns.com/foaf/0.1/}OnlineAccount"
                ):
                    account_name = online_account.find(
                        "{http://xmlns.com/foaf/0.1/}accountName"
                    )
                    if account_name is not None:
                        maintainers.append(account_name.text)
    return maintainers


# Routes
router = APIRouter(prefix="/verification")


class WebsiteVerificationResult(BaseModel):
    verified: bool
    detail: ErrorDetail | None = None
    status_code: int | None = None


class CheckWebsiteVerification:
    """Downloads a domain's verified apps list and checks for a token. This is split into a dependency so it can be
    tested separately."""

    def __call__(self, app_id: str, token: str):
        domain = _get_domain_name(app_id)
        if domain is None:
            return WebsiteVerificationResult(
                verified=False, detail=ErrorDetail.INVALID_METHOD
            )

        try:
            r = requests.get(
                f"https://{domain}/.well-known/org.flathub.VerifiedApps.txt", timeout=5
            )
        except requests.exceptions.ConnectionError:
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
    KDE_GITLAB = "kde"


class VerificationStatus(BaseModel):
    verified: bool
    timestamp: str | None = None
    method: VerificationMethod | None = None
    website: str | None = None
    login_provider: LoginProvider | None = None
    login_name: str | None = None
    login_is_organization: bool | None = None
    detail: str | None = None


def _is_github_app(app_id: str) -> bool:
    """Determines whether the app is a non-archived repo in github.com/flathub."""
    try:
        gh = github.Github(
            config.settings.github_client_id, config.settings.github_client_secret
        )
        try:
            repo = gh.get_repo(f"flathub/{app_id}")
            if repo.archived:
                return False
        except UnknownObjectException:
            return False
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to connect to GitHub")

        return True
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=500, detail="Failed to connect to GitHub")


def is_appid_runtime(app_id: str) -> str | bool:
    # All runtimes are pushed by verified vendors, but they might be using anything
    # matching tld.vendor.*, so we need to test refs against one specific ID
    # Extensions are special case maintained by other developers
    split_appid = app_id.split(".")
    if (
        split_appid[0] == "org"
        and split_appid[1] in ("gnome", "kde", "freedesktop")
        and split_appid[2] in ("Platform", "Sdk")
    ):
        if split_appid[3:4] == "Extension":
            return False
        else:
            app_id = ".".join([split_appid[0], split_appid[1], "Sdk"])
            return app_id
    return False


def _get_existing_verification(app_id: str) -> models.AppVerification | None:
    if runtime_id := is_appid_runtime(app_id):
        app_id = runtime_id

    # Get all verification rows for this app
    verifications = models.AppVerification.all_by_app(sqldb, app_id)

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


def _check_app_id(
    app_id: str,
    new_app: bool,
    login=Depends(logged_in),
):
    """Make sure the given user has development access to the given flatpak."""

    if not utils.is_valid_app_id(app_id):
        raise HTTPException(status_code=400, detail=ErrorDetail.MALFORMED_APP_ID)

    if new_app:
        if login.user.accepted_publisher_agreement_at is None:
            raise HTTPException(
                status_code=403, detail=ErrorDetail.MUST_ACCEPT_PUBLISHER_AGREEMENT
            )

        if models.DirectUploadApp.by_app_id(sqldb, app_id) is not None:
            raise HTTPException(status_code=400, detail=ErrorDetail.APP_ALREADY_EXISTS)

        if _is_github_app(app_id):
            raise HTTPException(status_code=400, detail=ErrorDetail.APP_ALREADY_EXISTS)

        if _matches_prefixes(app_id, "com.github", "com.gitlab"):
            # Do not allow new apps with com.github.* or com.gitlab.* app IDs. If GitHub or GitLab themselves want to
            # submit an app, they should ask for manual verification.
            raise HTTPException(status_code=400, detail=ErrorDetail.MALFORMED_APP_ID)
    else:
        if app_id not in login.user.dev_flatpaks(sqldb):
            raise HTTPException(status_code=403, detail=ErrorDetail.NOT_APP_DEVELOPER)

    existing = _get_existing_verification(app_id)

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
    "/{app_id}/status",
    status_code=200,
    response_model=VerificationStatus,
    response_model_exclude_none=True,
    tags=["verification"],
)
def get_verification_status(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
) -> VerificationStatus:
    """Gets the verification status of the given app."""

    verification = _get_existing_verification(app_id)

    if verification is None:
        return VerificationStatus(verified=False)

    match verification.method:
        case "manual":
            return VerificationStatus(
                verified=verification.verified,
                timestamp=str(int(verification.verified_timestamp.timestamp())),
                method=VerificationMethod.MANUAL,
            )
        case "website":
            return VerificationStatus(
                verified=True,
                timestamp=str(int(verification.verified_timestamp.timestamp())),
                method=VerificationMethod.WEBSITE,
                website=_get_domain_name(app_id),
            )
        case "login_provider":
            (provider, username) = _get_provider_username(app_id)
            return VerificationStatus(
                verified=True,
                timestamp=str(int(verification.verified_timestamp.timestamp())),
                method=VerificationMethod.LOGIN_PROVIDER,
                login_provider=provider,
                login_name=username,
                login_is_organization=verification.login_is_organization,
            )

    return VerificationStatus(verified=False)


class AvailableMethodType(Enum):
    WEBSITE = "website"
    LOGIN_PROVIDER = "login_provider"


class AvailableLoginMethodStatus(str, Enum):
    READY = "ready"
    USER_DOES_NOT_EXIST = ErrorDetail.USER_DOES_NOT_EXIST.value
    USERNAME_DOES_NOT_MATCH = ErrorDetail.USERNAME_DOES_NOT_MATCH.value
    PROVIDER_DENIED_ACCESS = ErrorDetail.PROVIDER_DENIED_ACCESS.value
    NOT_LOGGED_IN = ErrorDetail.NOT_LOGGED_IN.value
    NOT_ORG_MEMBER = ErrorDetail.NOT_ORG_MEMBER.value
    NOT_ORG_ADMIN = ErrorDetail.NOT_ORG_ADMIN.value


class AvailableMethod(BaseModel):
    method: AvailableMethodType
    website: str | None = None
    website_token: str | None = None
    login_provider: LoginProvider | None = None
    login_name: str | None = None
    login_is_organization: bool | None = None
    login_status: AvailableLoginMethodStatus | None = None


class AvailableMethods(BaseModel):
    methods: list[AvailableMethod] | None = None
    detail: str | None = None


@router.get(
    "/{app_id}/available-methods",
    status_code=200,
    response_model=AvailableMethods,
    response_model_exclude_none=True,
    tags=["verification"],
)
def get_available_methods(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    new_app: bool = False,
):
    """Gets the ways an app may be verified."""

    _check_app_id(app_id, new_app, login)

    methods = []

    if domain := _get_domain_name(app_id):
        verification = models.AppVerification.by_app_and_user(sqldb, app_id, login.user)
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

    if _get_provider_username(app_id) is not None:
        available_method = _check_login_provider_verification(app_id, new_app, login)
        methods.append(available_method)

    return AvailableMethods(methods=methods)


def _verify_by_github(username: str, account) -> AvailableMethod:
    # For GitHub, we allow verifying by either user or organization. If it's by organization, the user must be an
    # admin of that organization.

    result = AvailableMethod(
        method=AvailableMethodType.LOGIN_PROVIDER,
        login_provider=LoginProvider.GITHUB,
        login_name=username,
    )

    account = models.GithubAccount.by_user(sqldb, account)

    if account is None:
        result.login_status = AvailableLoginMethodStatus.NOT_LOGGED_IN
        return result

    try:
        gh = github.Github(account.token)

        try:
            user = gh.get_user(username)
        except UnknownObjectException:
            result.login_status = AvailableLoginMethodStatus.USER_DOES_NOT_EXIST
            return result

        if user.type == "User":
            result.login_is_organization = False

            # Verify the username matches. We use .lower() because GitHub usernames are case insensitive.
            if account.login.lower() != username.lower():
                result.login_status = AvailableLoginMethodStatus.USERNAME_DOES_NOT_MATCH
                return result

            result.login_status = AvailableLoginMethodStatus.READY
            return result

        elif user.type == "Organization":
            result.login_is_organization = True

            # Verify the current user is an admin of this organization
            try:
                membership = gh.get_user(account.login).get_organization_membership(
                    username
                )
            except github.GithubException as e:
                if e.status == 403 or e.status == 401:
                    result.login_status = (
                        AvailableLoginMethodStatus.PROVIDER_DENIED_ACCESS
                    )
                    return result
                elif e.status == 404:
                    result.login_status = AvailableLoginMethodStatus.NOT_ORG_MEMBER
                    return result
                else:
                    raise HTTPException(
                        status_code=500, detail=ErrorDetail.PROVIDER_ERROR
                    )

            if membership.role != "admin":
                result.login_status = AvailableLoginMethodStatus.NOT_ORG_ADMIN
                return result

            result.login_status = AvailableLoginMethodStatus.READY
            return result
        else:
            raise HTTPException(status_code=500, detail=ErrorDetail.PROVIDER_ERROR)
    except github.GithubException:
        raise HTTPException(status_code=500, detail=ErrorDetail.PROVIDER_ERROR)


def _verify_by_gitlab(username: str, account, model, provider, url) -> AvailableMethod:
    """Checks verification using a GitLab instance. If username is a group, the user must have owner, maintainer or
    developer access to that group. Returns True if the username is a group, returns False if it is a regular user,
    and raises an exception if verification fails."""

    result = AvailableMethod(
        method=AvailableMethodType.LOGIN_PROVIDER,
        login_provider=provider,
        login_name=username,
    )

    account = model.by_user(sqldb, account)

    if account is None:
        result.login_status = AvailableLoginMethodStatus.NOT_LOGGED_IN
        return result

    # If the username matches, return immediately. We use .lower() because GitLab usernames are case insensitive.
    if account.login.lower() == username.lower():
        result.login_status = AvailableLoginMethodStatus.READY
        return result

    try:
        access_token = refresh_oauth_token(account)
    except HTTPException:
        raise HTTPException(status_code=500, detail=ErrorDetail.PROVIDER_ERROR)

    try:
        gl = gitlab.Gitlab(url)

        # Does the username refer to a user or a group?
        matching_users = gl.users.list(username=username)
        if len(matching_users) == 1:
            result.login_is_organization = False
            result.login_status = AvailableLoginMethodStatus.USERNAME_DOES_NOT_MATCH
            return result

        try:
            gl.groups.get(username)
        except gitlab.GitlabError:
            # Group does not exist. Either it's private or it's a user.
            result.login_status = AvailableLoginMethodStatus.USERNAME_DOES_NOT_MATCH
            return result

        # python-gitlab does not support the userinfo endpoint AFAICT, so we have to do it manually.
        r = requests.get(
            url + "/oauth/userinfo",
            headers={"Authorization": "Bearer " + access_token},
        )

        if not r.ok:
            raise HTTPException(status_code=500, detail=ErrorDetail.PROVIDER_ERROR)

        userinfo = r.json()

        result.login_is_organization = True

        # Must be owner or maintainer of the group
        if groups := userinfo.get("https://gitlab.org/claims/groups/owner"):
            if username.lower() in [group.lower() for group in groups]:
                result.login_status = AvailableLoginMethodStatus.READY
                return result

        if groups := userinfo.get("https://gitlab.org/claims/groups/maintainer"):
            if username.lower() in [group.lower() for group in groups]:
                result.login_status = AvailableLoginMethodStatus.READY
                return result

        if groups := userinfo.get("https://gitlab.org/claims/groups/developer"):
            if username.lower() in [group.lower() for group in groups]:
                result.login_status = AvailableLoginMethodStatus.READY
                return result

        result.login_status = AvailableLoginMethodStatus.NOT_ORG_MEMBER
        return result
    except HTTPException as e:
        raise e


def _check_login_provider_verification(
    app_id: str, new_app: bool, login: LoginInformation
) -> AvailableMethod:
    _check_app_id(app_id, new_app, login)

    provider_username = _get_provider_username(app_id)
    if provider_username is None:
        raise HTTPException(status_code=400, detail=ErrorDetail.INVALID_METHOD)

    (provider, username) = provider_username

    if provider == LoginProvider.GITHUB:
        return _verify_by_github(username, login.user)
    elif provider == LoginProvider.GITLAB:
        return _verify_by_gitlab(
            username,
            login.user,
            models.GitlabAccount,
            LoginProvider.GITLAB,
            "https://gitlab.com",
        )
    elif provider == LoginProvider.GNOME_GITLAB:
        return _verify_by_gitlab(
            username,
            login.user,
            models.GnomeAccount,
            LoginProvider.GNOME_GITLAB,
            "https://gitlab.gnome.org",
        )
    elif provider == LoginProvider.KDE_GITLAB:
        return _verify_by_gitlab(
            username,
            login.user,
            models.KdeAccount,
            LoginProvider.KDE_GITLAB,
            "https://invent.kde.org",
        )
    else:
        raise HTTPException(status_code=500)


def _create_direct_upload_app(user: models.FlathubUser, app_id: str):
    direct_upload_app = models.DirectUploadApp(app_id=app_id)
    sqldb.session.add(direct_upload_app)
    sqldb.session.flush()
    app_developer = models.DirectUploadAppDeveloper(
        app_id=direct_upload_app.id, developer_id=user.id, is_primary=True
    )
    sqldb.session.add(app_developer)


@router.post(
    "/{app_id}/verify-by-login-provider", status_code=200, tags=["verification"]
)
def verify_by_login_provider(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    new_app: bool = False,
):
    """If the current account is eligible to verify the given account via SSO, and the app is not already verified by
    someone else, marks the app as verified."""

    available_method = _check_login_provider_verification(app_id, new_app, login)

    if available_method.login_status != AvailableLoginMethodStatus.READY:
        match available_method.login_status:
            case AvailableLoginMethodStatus.NOT_LOGGED_IN:
                status_code = 401
            case (
                AvailableLoginMethodStatus.USERNAME_DOES_NOT_MATCH
                | AvailableLoginMethodStatus.NOT_ORG_MEMBER
                | AvailableLoginMethodStatus.NOT_ORG_ADMIN
                | AvailableLoginMethodStatus.PROVIDER_DENIED_ACCESS
            ):
                status_code = 403
            case AvailableLoginMethodStatus.USER_DOES_NOT_EXIST:
                status_code = 400
            case _:
                status_code = 500

        raise HTTPException(
            status_code=status_code, detail=available_method.login_status
        )

    verification = models.AppVerification(
        app_id=app_id,
        account=login.user.id,
        method="login_provider",
        verified=True,
        verified_timestamp=func.now(),
        login_is_organization=available_method.login_is_organization,
    )
    sqldb.session.merge(verification)

    if new_app:
        _create_direct_upload_app(login.user, app_id)

    sqldb.session.commit()

    worker.republish_app.send(app_id)


class LinkResponse(BaseModel):
    link: str


@router.get(
    "/request-organization-access/github",
    response_model=LinkResponse,
    tags=["verification"],
)
def request_organization_access_github():
    """Returns the URL to request access to the organization so we can verify the user's membership."""
    return LinkResponse(
        link=f"https://github.com/settings/connections/applications/{config.settings.github_client_id}"
    )


class WebsiteVerificationToken(BaseModel):
    domain: str
    token: str


@router.post(
    "/{app_id}/setup-website-verification",
    status_code=200,
    response_model=WebsiteVerificationToken,
    tags=["verification"],
)
def setup_website_verification(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    new_app: bool = False,
):
    """Creates a token for the user to verify the app via website."""

    _check_app_id(app_id, new_app, login)

    domain = _get_domain_name(app_id)

    if domain is None:
        raise HTTPException(status_code=400, detail=ErrorDetail.INVALID_METHOD)

    verification = models.AppVerification.by_app_and_user(sqldb, app_id, login.user)

    if (
        verification is None
        or verification.method != "website"
        or verification.token is None
    ):
        verification = models.AppVerification(
            app_id=app_id,
            account=login.user.id,
            method="website",
            verified=False,
            token=str(uuid4()),
        )
        sqldb.session.merge(verification)
        sqldb.session.commit()

    return WebsiteVerificationToken(domain=domain, token=verification.token)


@router.post(
    "/{app_id}/confirm-website-verification",
    status_code=200,
    response_model=WebsiteVerificationResult,
    response_model_exclude_none=True,
    tags=["verification"],
)
def confirm_website_verification(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    new_app: bool = False,
    check=Depends(CheckWebsiteVerification),
):
    """Checks website verification, and if it succeeds, marks the app as verified for the current account."""

    _check_app_id(app_id, new_app, login)

    verification = models.AppVerification.by_app_and_user(sqldb, app_id, login.user)

    if (
        verification is None
        or verification.method != "website"
        or verification.token is None
    ):
        raise HTTPException(status_code=400, detail=ErrorDetail.MUST_SET_UP_FIRST)

    result = check(app_id, verification.token)

    if result.verified:
        verification.verified = True
        verification.verified_timestamp = func.now()

        if new_app:
            _create_direct_upload_app(login.user, app_id)

        sqldb.session.commit()

        worker.republish_app.send(app_id)

    return result


@router.post("/{app_id}/unverify", status_code=204, tags=["verification"])
def unverify(
    login=Depends(logged_in),
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
):
    """If the current account has verified the given app, mark it as no longer verified."""

    verification = models.AppVerification.by_app_and_user(sqldb, app_id, login.user)
    if verification is not None:
        sqldb.session.delete(verification)
        sqldb.session.commit()

    worker.republish_app.send(app_id)


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application

    This also enables session middleware and the database middleware
    """
    app.add_middleware(DBSessionMiddleware, db_url=config.settings.database_url)
    app.include_router(router)
