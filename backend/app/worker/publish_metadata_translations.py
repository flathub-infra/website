import dramatiq

from .. import cron
from ..metadata_translation_batches import (
    backfill_listing_counts,
    prune_translation_snapshots,
    publish_translation_batches,
)
from ..metadata_translation_queue import refresh_index


@cron.cron("0 */3 * * *")
@dramatiq.actor(max_retries=0, time_limit=3_600_000)
def publish_metadata_translations():
    publish_translation_batches()
    prune_translation_snapshots()


@cron.cron("*/5 * * * *")
@dramatiq.actor(max_retries=0, time_limit=240_000)
def index_translation_listings():
    backfill_listing_counts()
    refresh_index()
