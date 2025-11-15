from apscheduler.schedulers.background import BackgroundScheduler

from .. import cron

# Background scheduler for cron-decorated Dramatiq actors.
# We only start it inside the dedicated worker process (IS_WORKER=true) so it
# doesn't run in the API server process.
from ..config import settings
from .core import broker
from .emails import send_email_new, send_one_email_new
from .refresh_github_repo_list import refresh_github_repo_list
from .republish_app import republish_app, review_check
from .update import update
from .update_app_picks import update_app_picks
from .update_quality_moderation import update_quality_moderation
from .update_stats import update_stats


def _start_background_scheduler():
    import logging

    scheduler = BackgroundScheduler()
    for trigger, module_path, func_name in cron.JOBS:
        # Each cron job should call the dramatiq actor's .send() method.
        job_path = f"{module_path}:{func_name}.send"
        job_name = f"{module_path}.{func_name}"
        scheduler.add_job(job_path, trigger=trigger, name=job_name)

    scheduler.start()
    logging.getLogger(__name__).info(
        "Started background scheduler with %d jobs", len(cron.JOBS)
    )
    return scheduler


_scheduler = None
if settings.is_worker:
    try:
        _scheduler = _start_background_scheduler()
    except Exception:  # pragma: no cover - defensive; log and continue worker startup
        import logging

        logging.getLogger(__name__).exception("Failed to start background scheduler")

__all__ = [
    "broker",
    "refresh_github_repo_list",
    "republish_app",
    "review_check",
    "send_email_new",
    "send_one_email_new",
    "update",
    "update_app_picks",
    "update_quality_moderation",
    "update_stats",
]
