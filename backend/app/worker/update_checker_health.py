import dramatiq

from .. import cron
from ..checker_health_ingestion import refresh_checker_health


@cron.cron("45 */4 * * *")
@dramatiq.actor(time_limit=3600000, max_retries=2)
def update_checker_health() -> None:
    refresh_checker_health()
