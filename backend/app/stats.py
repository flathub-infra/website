import datetime
import json
from collections import defaultdict
from typing import TypedDict
from urllib.parse import urlparse, urlunparse

import httpx
import orjson

from app import utils

from . import config, database, models, search, zscore

StatsType = dict[str, dict[str, list[int]]]


class StatsFromServer(TypedDict):
    countries: dict[str, int]
    date: datetime.date
    delta_downloads: int
    downloads: int
    updates: int
    flatpak_versions: dict[str, int]
    ostree_versions: dict[str, int]
    ref_by_country: dict[str, dict[str, list[int]]]
    refs: dict[str, dict[str, list[int]]]


POPULAR_DAYS_NUM = 7

FIRST_STATS_DATE = datetime.date(2018, 4, 29)


def _get_stats_for_date(
    date: datetime.date, session: httpx.Client
) -> StatsFromServer | None:
    stats_json_url = urlparse(
        config.settings.stats_baseurl + date.strftime("/%Y/%m/%d.json")
    )
    if stats_json_url.scheme == "file":
        try:
            with open(stats_json_url.path) as stats_file:
                stats = json.load(stats_file)
        except FileNotFoundError:
            return None
        return stats
    redis_key = f"stats:date:{date.isoformat()}"
    stats_txt = database.redis_conn.get(redis_key)
    if stats_txt is None:
        response = session.get(urlunparse(stats_json_url), timeout=30.0)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        stats = response.json()
        expire = (
            datetime.timedelta(hours=4)
            if date > datetime.date.today() + datetime.timedelta(days=-7)
            else None
        )
        database.redis_conn.set(redis_key, orjson.dumps(stats), ex=expire)
    else:
        stats = orjson.loads(stats_txt)
    return stats


def _get_stats_for_period(sdate: datetime.date, edate: datetime.date):
    totals: StatsType = {}
    with httpx.Client() as session:
        for i in range((edate - sdate).days + 1):
            date = sdate + datetime.timedelta(days=i)
            stats = _get_stats_for_date(date, session)

            if stats is None or "refs" not in stats or stats["refs"] is None:
                continue
            for app_id, app_stats in stats["refs"].items():
                app_id_without_architecture = _remove_architecture_from_id(app_id)
                if app_id_without_architecture not in totals:
                    totals[app_id_without_architecture] = {}
                app_totals = totals[app_id_without_architecture]
                for arch, downloads in app_stats.items():
                    if arch not in app_totals:
                        app_totals[arch] = [0, 0, 0]
                    app_totals[arch][0] += downloads[0]
                    app_totals[arch][1] += downloads[1]
                    app_totals[arch][2] += downloads[0] - downloads[1]
    return totals


def _get_app_stats_per_country() -> dict[str, dict[str, int]]:
    # Skip last two days as flathub-stats publishes partial statistics
    edate = datetime.date.today() - datetime.timedelta(days=2)
    sdate = FIRST_STATS_DATE

    app_stats_per_country: dict[str, dict[str, int]] = {}

    with httpx.Client() as session:
        for i in range((edate - sdate).days + 1):
            date = sdate + datetime.timedelta(days=i)
            stats = _get_stats_for_date(date, session)

            if (
                stats is not None
                and "ref_by_country" in stats
                and stats["ref_by_country"] is not None
            ):
                for app_id, app_stats in stats["ref_by_country"].items():
                    if app_id not in app_stats_per_country:
                        app_stats_per_country[app_id] = {}
                    for country, downloads in app_stats.items():
                        if country not in app_stats_per_country[app_id]:
                            app_stats_per_country[app_id][country] = 0
                        app_stats_per_country[app_id][country] += (
                            downloads[0] - downloads[1]
                        )
    return app_stats_per_country


def _get_app_stats_per_day() -> dict[str, dict[str, int]]:
    # Skip last two days as flathub-stats publishes partial statistics
    edate = datetime.date.today() - datetime.timedelta(days=2)
    sdate = FIRST_STATS_DATE

    app_stats_per_day: dict[str, dict[str, int]] = {}

    with httpx.Client() as session:
        for i in range((edate - sdate).days + 1):
            date = sdate + datetime.timedelta(days=i)
            stats = _get_stats_for_date(date, session)

            if stats is not None and "refs" in stats and stats["refs"] is not None:
                for app_id, app_stats in stats["refs"].items():
                    app_id_without_architecture = _remove_architecture_from_id(app_id)
                    if app_id_without_architecture not in app_stats_per_day:
                        app_stats_per_day[app_id_without_architecture] = {}
                    app_stats_per_day[app_id_without_architecture][date.isoformat()] = (
                        sum([i[0] - i[1] for i in app_stats.values()])
                    )

    # Sort each app's stats by date
    for app_id in app_stats_per_day:
        app_stats_per_day[app_id] = dict(sorted(app_stats_per_day[app_id].items()))

    return app_stats_per_day


def _get_stats(app_count: int):
    edate = datetime.date.today()
    sdate = FIRST_STATS_DATE

    downloads_per_day: dict[str, int] = {}
    delta_downloads_per_day: dict[str, int] = {}
    updates_per_day: dict[str, int] = {}
    totals_country: dict[str, int] = {}
    with httpx.Client() as session:
        for i in range((edate - sdate).days + 1):
            date = sdate + datetime.timedelta(days=i)
            stats = _get_stats_for_date(date, session)

            if (
                stats is not None
                and "downloads" in stats
                and stats["downloads"] is not None
            ):
                downloads_per_day[date.isoformat()] = stats["downloads"]

            if (
                stats is not None
                and "updates" in stats
                and stats["updates"] is not None
            ):
                updates_per_day[date.isoformat()] = stats["updates"]

            if (
                stats is not None
                and "delta_downloads" in stats
                and stats["delta_downloads"] is not None
            ):
                delta_downloads_per_day[date.isoformat()] = stats["delta_downloads"]

            if (
                stats is not None
                and "countries" in stats
                and stats["countries"] is not None
            ):
                for country, downloads in stats["countries"].items():
                    if country not in totals_country:
                        totals_country[country] = 0
                    totals_country[country] = totals_country[country] + downloads

    category_totals = get_category_totals()

    return {
        "totals": {
            "downloads": sum(downloads_per_day.values()),
            "number_of_apps": app_count,
            "verified_apps": search.get_number_of_verified_apps(),
        },
        "countries": totals_country,
        "downloads_per_day": downloads_per_day,
        "updates_per_day": updates_per_day,
        "delta_downloads_per_day": delta_downloads_per_day,
        "category_totals": category_totals,
    }


def get_category_totals():
    categories = []
    category_totals = search.search_apps_post(
        search.SearchQuery(query="", filters=None), "en"
    )

    if (
        category_totals is None
        or category_totals.facetDistribution is None
        or "main_categories" not in category_totals.facetDistribution
    ):
        return categories

    for category, count in category_totals.facetDistribution["main_categories"].items():
        categories.append(
            {
                "category": category,
                "count": count,
            }
        )

    return categories


def _sort_key(
    app_stats: dict[str, list[int]], for_arches: list[str] | None = None
) -> int:
    new_dls = 0
    for arch, dls in app_stats.items():
        if for_arches is not None and arch not in for_arches:
            continue
        new_dls += dls[2]
    return new_dls


def _is_app(app_id: str) -> bool:
    return "/" not in app_id


def _remove_architecture_from_id(app_id: str) -> str:
    return app_id.split("/")[0]


def get_installs_by_ids(ids: list[str]):
    result = defaultdict()
    for app_id in ids:
        app_stats = database.get_json_key(f"app_stats:{app_id}")
        if app_stats is None:
            continue

        app_stats["id"] = app_id
        result[app_id] = app_stats
    return result


def get_popular(days: int | None):
    edate = datetime.date.today()

    if days is None:
        sdate = FIRST_STATS_DATE
    else:
        sdate = edate - datetime.timedelta(days=days - 1)

    redis_key = f"popular:{sdate}-{edate}"

    if popular := database.get_json_key(redis_key):
        return popular

    stats = _get_stats_for_period(sdate, edate)
    sorted_apps = sorted(
        filter(lambda a: _is_app(a[0]), stats.items()),
        key=lambda a: _sort_key(a[1]),
        reverse=True,
    )

    popular = [k for k, v in sorted_apps]
    database.redis_conn.set(redis_key, orjson.dumps(popular), ex=60 * 60)
    return popular


def _calculate_trending_score(
    installs_over_days: list[int],
    quality_passed_ratio: float,
    is_eol: bool,
    is_new_app: bool,
) -> float:
    """
    Calculate the trending score for an app based on recent install patterns.

    The algorithm uses multiple signals:
    1. Short-term momentum: Compare recent 3-day average vs previous 7-day average
    2. Velocity: Rate of change in installs (acceleration)
    3. Z-score: Statistical deviation from the app's own baseline
    4. Quality bonus: Apps with good quality ratings get a boost
    5. Penalties: EOL apps are penalized

    Args:
        installs_over_days: List of daily install counts (oldest first)
        quality_passed_ratio: Ratio of passed quality checks (0.0 to 1.0)
        is_eol: Whether the app uses an EOL runtime
        is_new_app: Whether the app has limited install history
    """
    # Penalty multiplier for apps using EOL runtimes
    eol_penalty = 0.5

    # Maximum quality bonus points for apps with 100% passed quality checks
    quality_bonus_max = 15.0

    # Quality bonus: Scale by quality ratio
    # Use a curved bonus that rewards higher quality more
    quality_bonus = (quality_passed_ratio**0.7) * quality_bonus_max

    if len(installs_over_days) < 2:
        # Not enough data for trend analysis - use raw installs as a baseline
        # Scale down significantly since we can't detect actual trends
        if len(installs_over_days) == 1:
            base_score = installs_over_days[0] * 0.1
            if is_new_app:
                base_score *= 1.5  # Small boost for new apps
            if is_eol:
                base_score *= eol_penalty
            return base_score + quality_bonus
        # No data at all - just return quality bonus
        return quality_bonus

    # Calculate moving averages for momentum detection
    recent_days = (
        installs_over_days[-3:]
        if len(installs_over_days) >= 3
        else installs_over_days[-2:]
    )
    older_days = (
        installs_over_days[:-3]
        if len(installs_over_days) > 3
        else installs_over_days[:-2]
    )

    recent_avg = sum(recent_days) / len(recent_days) if recent_days else 0
    older_avg = sum(older_days) / len(older_days) if older_days else recent_avg

    # Momentum: How much has the recent average grown compared to older average?
    # Use a logarithmic scale to prevent huge apps from dominating
    if older_avg > 0:
        momentum = (recent_avg - older_avg) / older_avg
    elif recent_avg > 0:
        momentum = 1.0  # New activity where there was none
    else:
        momentum = 0.0

    # Calculate velocity (rate of change / acceleration)
    # This helps detect apps that are accelerating in popularity
    if len(installs_over_days) >= 4:
        first_half = installs_over_days[: len(installs_over_days) // 2]
        second_half = installs_over_days[len(installs_over_days) // 2 :]
        first_half_growth = first_half[-1] - first_half[0] if len(first_half) > 1 else 0
        second_half_growth = (
            second_half[-1] - second_half[0] if len(second_half) > 1 else 0
        )
        velocity = second_half_growth - first_half_growth
    else:
        velocity = 0

    # Z-score component: How unusual is the most recent value?
    # Use a moderate decay to balance recent vs historical importance
    latest_value = installs_over_days[-1]
    z_score_calc = zscore.zscore(0.75, installs_over_days[:-1])
    z_component = z_score_calc.score(latest_value)

    # Combine components with weights
    # - Z-score: Primary signal for statistical anomalies
    # - Momentum: Captures sustained growth patterns
    # - Velocity: Rewards accelerating growth
    base_score = (
        z_component * 0.5
        + momentum * 20.0  # Scale momentum to be comparable
        + (velocity / max(recent_avg, 1)) * 5.0  # Normalize velocity by app size
    )

    # Apply penalties
    if is_eol:
        base_score = base_score * eol_penalty

    # New app boost: Help new apps with limited history get discovered
    # if they show promising early numbers
    if is_new_app and len(installs_over_days) <= 7:
        new_app_boost = 1.0 + (0.3 * (7 - len(installs_over_days)) / 7)
        base_score = base_score * new_app_boost

    return base_score + quality_bonus


def update(sqldb):
    stats_apps_dict = defaultdict(lambda: {})

    edate = datetime.date.today()
    sdate = datetime.date(2018, 4, 29)

    frontend_app_ids = database.get_all_appids_for_frontend()

    stats_total = _get_stats_for_period(sdate, edate)
    stats_dict = _get_stats(len(frontend_app_ids))

    app_stats_per_day = _get_app_stats_per_day()
    app_stats_per_country = _get_app_stats_per_country()

    # Pre-fetch quality moderation data for all apps to avoid N+1 queries
    apps_with_stats = [
        app_id for app_id in app_stats_per_day.keys() if app_id in frontend_app_ids
    ]
    quality_status_batch = models.QualityModeration.by_appids_summarized(
        sqldb, apps_with_stats
    )
    eol_status_batch = models.QualityModeration.by_appids_eol_status(
        sqldb, apps_with_stats
    )

    trending_apps: list = []
    for app_id, stats_dict_for_app in app_stats_per_day.items():
        if app_id in frontend_app_ids:
            installs = list(stats_dict_for_app.values())

            max_history_length = 21
            # first item is the oldest, last item is the most recent
            # only use the last x values minus the last one
            if len(installs) > 1:
                install_history_length = min(len(installs), max_history_length + 1)
                installs_over_days = installs[-install_history_length:-1]
            else:
                installs_over_days = []

            # Determine if this is a "new" app (limited history)
            is_new_app = len(installs) <= 14

            # Get quality moderation status from pre-fetched batch
            app_quality_status = quality_status_batch.get(app_id)
            if app_quality_status is None:
                # Fallback for apps not in batch (shouldn't happen normally)
                quality_passed_ratio = 0.0
            else:
                total_quality_checks = (
                    app_quality_status.passed
                    + app_quality_status.not_passed
                    + app_quality_status.unrated
                )

                quality_passed_ratio = (
                    app_quality_status.passed / total_quality_checks
                    if total_quality_checks > 0
                    else 0.0
                )

            # Check if app runtime is EOL from pre-fetched batch
            is_eol = eol_status_batch.get(app_id, False)

            trending_score = _calculate_trending_score(
                installs_over_days=installs_over_days,
                quality_passed_ratio=quality_passed_ratio,
                is_eol=is_eol,
                is_new_app=is_new_app,
            )

            trending_apps.append(
                {
                    "id": utils.get_clean_app_id(app_id),
                    "trending": trending_score,
                }
            )
    search.create_or_update_apps(trending_apps)

    for app_id, dict in stats_total.items():
        # Index 0 is install and update count index 1 would be the update count
        # Index 2 is the install count
        stats_apps_dict[app_id]["installs_total"] = sum([i[2] for i in dict.values()])

        if app_id in app_stats_per_day:
            stats_apps_dict[app_id]["installs_per_day"] = app_stats_per_day[app_id]

        if app_id in app_stats_per_country:
            stats_apps_dict[app_id]["installs_per_country"] = app_stats_per_country[
                app_id
            ]

    sdate_30_days = edate - datetime.timedelta(days=30 - 1)
    stats_30_days = _get_stats_for_period(sdate_30_days, edate)

    stats_installs: list = []
    for app_id, dict in stats_30_days.items():
        # Index 0 is install and update count index 1 would be the update count
        # Index 2 is the install count
        installs_last_month = sum([i[2] for i in dict.values()])
        stats_apps_dict[app_id]["installs_last_month"] = installs_last_month
        if app_id in frontend_app_ids:
            stats_installs.append(
                {
                    "id": utils.get_clean_app_id(app_id),
                    "installs_last_month": installs_last_month,
                }
            )
    search.create_or_update_apps(stats_installs)

    # Get favorites count per app and update meilisearch
    favorites_count_dict = models.UserFavoriteApp.get_favorites_count_per_app(sqldb)
    favorites_list: list = []
    for app_id in frontend_app_ids:
        favorites_count = favorites_count_dict.get(app_id, 0)
        if favorites_count > 0:
            favorites_list.append(
                {
                    "id": utils.get_clean_app_id(app_id),
                    "favorites_count": favorites_count,
                }
            )
    if len(favorites_list) > 0:
        search.create_or_update_apps(favorites_list)

    sdate_7_days = edate - datetime.timedelta(days=7 - 1)
    stats_7_days = _get_stats_for_period(sdate_7_days, edate)

    for app_id, dict in stats_7_days.items():
        # Index 0 is install and update count index 1 would be the update count
        # Index 2 is the install count
        stats_apps_dict[app_id]["installs_last_7_days"] = sum(
            [i[2] for i in dict.values()]
        )

    for app_id in stats_apps_dict:
        models.App.set_downloads(
            sqldb, app_id, stats_apps_dict[app_id].get("installs_last_7_days", 0)
        )

    # Make sure the Apps has all Keys
    for app_id in stats_apps_dict:
        stats_apps_dict[app_id]["installs_total"] = stats_apps_dict[app_id].get(
            "installs_total", 0
        )
        stats_apps_dict[app_id]["installs_last_month"] = stats_apps_dict[app_id].get(
            "installs_last_month", 0
        )
        stats_apps_dict[app_id]["installs_last_7_days"] = stats_apps_dict[app_id].get(
            "installs_last_7_days", 0
        )
        stats_apps_dict[app_id]["installs_per_day"] = stats_apps_dict[app_id].get(
            "installs_per_day", {}
        )
        stats_apps_dict[app_id]["installs_per_country"] = stats_apps_dict[app_id].get(
            "installs_per_country", {}
        )

    new_id: str
    old_id_list: list[str]
    for new_id, old_id_list in database.get_json_key("eol_rebase").items():
        if new_id not in stats_apps_dict:
            stats_apps_dict[new_id] = {
                "installs_total": 0,
                "installs_last_month": 0,
                "installs_last_7_days": 0,
                "installs_per_day": {},
                "installs_per_country": {},
            }

        for old_id in old_id_list:
            old_id = old_id.removesuffix(":stable")

            if old_id not in stats_apps_dict:
                continue

            stats_apps_dict[new_id]["installs_total"] += stats_apps_dict[old_id][
                "installs_total"
            ]
            stats_apps_dict[new_id]["installs_last_month"] += stats_apps_dict[old_id][
                "installs_last_month"
            ]
            stats_apps_dict[new_id]["installs_last_7_days"] += stats_apps_dict[old_id][
                "installs_last_7_days"
            ]

            for day, count in stats_apps_dict[old_id]["installs_per_day"].items():
                if day in stats_apps_dict[new_id]["installs_per_day"]:
                    stats_apps_dict[new_id]["installs_per_day"][day] += count
                else:
                    stats_apps_dict[new_id]["installs_per_day"][day] = count

            sorted_days = {}
            for day in sorted(stats_apps_dict[new_id]["installs_per_day"]):
                sorted_days[day] = stats_apps_dict[new_id]["installs_per_day"][day]
            stats_apps_dict[new_id]["installs_per_day"] = sorted_days

            for country, count in stats_apps_dict[old_id][
                "installs_per_country"
            ].items():
                if country in stats_apps_dict[new_id]["installs_per_country"]:
                    stats_apps_dict[new_id]["installs_per_country"][country] += count
                else:
                    stats_apps_dict[new_id]["installs_per_country"][country] = count

    database.redis_conn.set("stats", orjson.dumps(stats_dict))
    database.bulk_set_app_stats(stats_apps_dict)
