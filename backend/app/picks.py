import json
import os

import requests

from . import config, db, utils


def update():
    with db.redis_conn.pipeline() as p:
        with requests.Session() as session:
            for pick in ["games", "apps"]:
                r = session.get(
                    f"https://raw.githubusercontent.com/flathub/backend/master/data/picks/{pick}.json"
                )
                if r.status_code == 200:
                    # Decode JSON to ensure it's not malformed
                    content = r.json()

                    p.set(f"picks:{pick}", json.dumps(content))

        p.execute()


def initialize():
    picks_dir = os.path.join(config.settings.datadir, "picks")
    with db.redis_conn.pipeline() as p:
        for pick_json in os.listdir(picks_dir):
            value = utils.get_appids(os.path.join(picks_dir, pick_json))
            p.set(f"picks:{pick_json[:-5]}", json.dumps(value))
        p.execute()


def get_pick(pick):
    if value := db.redis_conn.get(f"picks:{pick}"):
        return json.loads(value)
    return None
