import os
from datetime import datetime
from pathlib import Path

import dramatiq
import memray

PROFILE_DIR = Path(os.getenv("MEMRAY_PROFILE_DIR", "/tmp/memray"))


class MemrayMiddleware(dramatiq.Middleware):
    def before_process_message(self, broker, message):
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        actor_name = message.actor_name
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        profile_path = PROFILE_DIR / f"{actor_name}_{timestamp}.bin"

        tracker = memray.Tracker(str(profile_path), native_traces=True)
        tracker.__enter__()
        message.options["_memray_tracker"] = tracker
        message.options["_memray_path"] = str(profile_path)

    def after_process_message(self, broker, message, *, result=None, exception=None):
        tracker = message.options.get("_memray_tracker")
        if tracker:
            tracker.__exit__(None, None, None)
            print(f"[memray] Profile saved: {message.options.get('_memray_path')}")
