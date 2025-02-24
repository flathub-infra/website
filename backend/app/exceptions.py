import json

import httpx

from . import db


def update():
    r = httpx.get(
        "https://raw.githubusercontent.com/barthalion/flatpak-builder-lint/HEAD/flatpak_builder_lint/staticfiles/exceptions.json"
    )

    if r.status_code == 200:
        exceptions = r.json()
        db.redis_conn.mset(
            {f"exc:{app_id}": json.dumps(exceptions[app_id]) for app_id in exceptions}
        )
        db.redis_conn.set("exc", r.text)
