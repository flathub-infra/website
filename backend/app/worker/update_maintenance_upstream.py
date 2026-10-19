import dramatiq

from .. import cron
from ..maintenance_upstream import refresh_maintenance_upstream


@cron.cron("15 4 * * *")
@dramatiq.actor(time_limit=3600000, max_retries=0)
def update_maintenance_upstream():
    refresh_maintenance_upstream()
