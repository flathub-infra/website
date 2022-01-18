import os

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


def get_verification_methods(appid: str):
    segments = appid.split(".")

    if len(segments) < 3:
        return {
            "methods": [],
            "detail": "malformed_app_id",
        }

    elif db.redis_conn.sismember("verification:blocked", appid):
        return {
            "methods": [],
            "detail": "blocked_by_admins",
        }

    elif segments[0:2] in [["com", "github"], ["io", "github"]]:
        return {
            "methods": [
                {
                    "method": "login_provider",
                    "login_provider": "GitHub",
                    "login_name": segments[2],
                }
            ]
        }

    else:
        return {
            "methods": [
                {
                    "method": "website",
                    "website": f"{segments[1]}.{segments[0]}",
                }
            ]
        }


def get_verification_status(appid: str):
    if db.redis_conn.sismember("verification:verified", appid):
        return {
            "verified": True,
            "method": "manual",
        }

    elif db.redis_conn.sismember("verification:blocked", appid):
        return {
            "verified": False,
            "method": "manual",
        }

    else:
        return {
            "verified": False,
            "method": "none",
        }
