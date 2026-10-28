import argparse
import datetime
import logging

import httpx

from . import stats, stats_db, utils

logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force-recompute", action="store_true")
    args = parser.parse_args()

    today = utils.utcnow().date()
    recent_start = today - datetime.timedelta(days=7)
    known = stats_db.known_dates(stats.FIRST_STATS_DATE, today)
    stale = stats_db.stale_dates(
        stats.FIRST_STATS_DATE, today - datetime.timedelta(days=2)
    )
    date = stats.FIRST_STATS_DATE
    with httpx.Client() as session:
        while date <= today:
            if (
                date not in known or date in stale or date >= recent_start
            ) and stats._get_stats_for_date(date, session, use_cache=False) is None:
                logger.warning("Statistics unavailable for %s", date)
            date += datetime.timedelta(days=1)

    if args.force_recompute:
        stats_db.rebuild_refs()
    stats.seed_global_snapshot()


if __name__ == "__main__":
    main()
