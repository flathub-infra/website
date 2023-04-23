import json

import requests

from . import db


def update():
    r = requests.get(
        "https://raw.githubusercontent.com/barthalion/flatpak-builder-lint/HEAD/flatpak_builder_lint/staticfiles/exceptions.json"
    )

    if r.status_code == 200:
        exceptions = r.json()
        db.redis_conn.mset(
            {f"exc:{appid}": json.dumps(exceptions[appid]) for appid in exceptions}
        )
        db.redis_conn.set("exc", r.text)
