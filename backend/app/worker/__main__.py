import logging

from . import scheduler

try:
    scheduler.start_background_scheduler()
except Exception:
    logging.getLogger(__name__).exception("Failed to start background scheduler")
