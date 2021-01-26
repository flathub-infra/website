import os
import json

import requests

from . import db
from . import config


def _get_appids(path):
    try:
        with open(
            path,
        ) as file_:
            return json.load(file_)
    except IOError:
        return []


def update():
    with db.redis_conn.pipeline() as p:
        for pick in ["games", "apps"]:
            r = requests.get(f"https://raw.githubusercontent.com/flathub/backend/master/data/picks/{pick}.json")
            if r.status_code == 200:
                # Decode JSON to ensure it's not malformed
                content = r.json()

                p.set(f"picks:{pick}", json.dumps(content))


def initialize():
    picks_dir = os.path.join(config.settings.datadir, "picks")
    with db.redis_conn.pipeline() as p:
        for pick_json in os.listdir(picks_dir):
            value = _get_appids(os.path.join(picks_dir, pick_json))
            p.set(f"picks:{pick_json[:-5]}", json.dumps(value))
        p.execute()


def get_pick(pick):
    if value := db.redis_conn.get(f"picks:{pick}"):
        return json.loads(value)
    return None
