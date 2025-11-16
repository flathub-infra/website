import logging

from apscheduler.schedulers.background import BackgroundScheduler

from .. import cron


def start_background_scheduler():
    scheduler = BackgroundScheduler()
    for trigger, module_path, func_name in cron.JOBS:
        job_path = f"{module_path}:{func_name}.send"
        job_name = f"{module_path}.{func_name}"
        scheduler.add_job(job_path, trigger=trigger, name=job_name)

    scheduler.start()
    logging.getLogger(__name__).info(
        "Started background scheduler with %d jobs", len(cron.JOBS)
    )
    return scheduler
