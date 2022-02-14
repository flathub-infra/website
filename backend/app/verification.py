import os
import re
import urllib.parse

import requests

from . import config, db, utils


def update():
    with db.redis_conn.pipeline() as p:
        with requests.Session() as session:
            for verdict in ["verified", "blocked"]:
                r = session.get(
                    f"https://raw.githubusercontent.com/flathub/backend/master/data/verification/{verdict}.json"
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


def _matches_prefixes(appid: str, *prefixes) -> bool:
    for prefix in prefixes:
        if appid.startswith(prefix + "."):
            return True
    return False


def _get_github_username(appid: str) -> str:
    if _matches_prefixes(appid, "com.github", "io.github"):
        return appid.split(".")[2]
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


def _check_app_id_error(appid: str) -> str:
    """
    Returns an error detail if the app ID is invalid, or None if it is valid.

    All error details, from this function and others:
    - "malformed_app_id": The app ID is not syntactically correct
    - "repo_does_not_exist": The app ID does not refer to an existing flathub repository.
    - "error_connecting_to_github": The server could not connect to GitHub.
    - "invalid_domain": Website verification was requested, but the app ID is not eligible for website verification.
    - "failed_to_connect": The server could not connect to the website.
    - "server_returned_error": The server got a non-200 status code from the website.
    - "app_not_listed": The app ID is not listed in /.well-known/org.flathub.VerifiedApps.txt on the website.
    - "blocked_by_admins": The app cannot be verified because the flathub administrators manually blocked it.
    """
    if len(appid.split(".")) < 3:
        return "malformed_app_id"
    elif not re.match("[_\w\.]+$", appid):
        return "malformed_app_id"

    try:
        r = requests.get(
            f"https://api.github.com/repos/flathub/{urllib.parse.quote(appid, safe='')}"
        )
        if r.status_code != 200:
            return "repo_does_not_exist"
    except:
        return "error_connecting_to_github"

    return None


def _check_website_verification(appid: str):
    domain = _get_domain_name(appid)
    if domain is None:
        return {
            "verified": False,
            "detail": "invalid_domain",
        }

    try:
        r = requests.get(
            f"https://{domain}/.well-known/org.flathub.VerifiedApps.txt", timeout=5
        )
    except:
        return {
            "verified": False,
            "detail": "failed_to_connect",
        }

    if r.status_code != 200:
        return {
            "verified": False,
            "detail": "server_returned_error",
            "status_code": r.status_code,
        }

    if appid in r.text.split("\n"):
        return {
            "verified": True,
        }
    else:
        return {
            "verified": False,
            "detail": "app_not_listed",
        }


def get_verification_methods(appid: str):
    """
    Gets a list of all available verification methods for an app.

    Returns:
    - "methods": An array of methods.
      - "method": "website" or "login_provider"
      - "website": For "website" method, the domain name for the website (e.g. flathub.org)
      - "login_provider": For "login_provider" method. Currently only "GitHub".
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
            "detail": "blocked_by_admins",
        }

    methods = []

    if domain := _get_domain_name(appid):
        methods.append(
            {
                "method": "website",
                "website": domain,
            }
        )

    if github_name := _get_github_username(appid):
        methods.append(
            {
                "method": "login_provider",
                "login_provider": "GitHub",
                "login_name": github_name,
            }
        )

    return {
        "methods": methods,
    }


def get_verification_status(appid: str):
    """
    Gets the verification status of an app ID.

    Returns:
    - "verified": True or False
    - "method": "none", "manual", or "website"
    - "website": For "website" method, the domain name of the website that verified the app (e.g. "gnome.org").
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

    if _check_website_verification(appid)["verified"]:
        return {
            "verified": True,
            "method": "website",
            "website": _get_domain_name(appid),
        }

    return {
        "verified": False,
        "method": "none",
    }


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
        return {
            "verified": False,
            "detail": detail,
        }

    return _check_website_verification(appid)
