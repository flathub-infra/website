import asyncio
import concurrent.futures
import copy
import datetime
import json
from collections import defaultdict
from typing import TypedDict
from urllib.parse import urlparse, urlunparse

import httpx
import orjson

from app import utils

from . import config, database, models, schemas, search, zscore
from .worker.redis import redis_conn

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


FIRST_STATS_DATE = datetime.date(2018, 4, 29)

AGGREGATES_KEYS = {
    "totals": "stats:agg:totals",
    "per_day": "stats:agg:per_day",
    "per_country": "stats:agg:per_country",
    "global": "stats:agg:global",
    "last_date": "stats:agg:last_date",
}

# Download thresholds for filtering meaningful statistics
# Used to exclude apps/categories with insufficient downloads from various calculations
MINIMAL_USAGE_THRESHOLD = (
    500  # Minimum downloads to indicate real usage (for hidden gems)
)
MEANINGFUL_DOWNLOADS_THRESHOLD = (
    1000  # Standard threshold for meaningful download counts
)
HIGH_DOWNLOADS_THRESHOLD = (
    5000  # Higher threshold for stricter filtering (percentage growth)
)
MINIMUM_GEM_THRESHOLD = 1000  # Minimum threshold for hidden gems calculation


def _fetch_stats_parallel(
    sdate: datetime.date, edate: datetime.date
) -> list[StatsFromServer | None]:
    dates = [
        sdate + datetime.timedelta(days=i) for i in range((edate - sdate).days + 1)
    ]

    results: list[StatsFromServer | None] = [None] * len(dates)
    with httpx.Client() as shared_session:
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            future_to_index = {
                executor.submit(_get_stats_for_date, date, shared_session): idx
                for idx, date in enumerate(dates)
            }

            for future in concurrent.futures.as_completed(future_to_index):
                idx = future_to_index[future]
                try:
                    results[idx] = future.result()
                except Exception:
                    results[idx] = None

    return results


def _get_stats_for_date(
    date: datetime.date, session: httpx.Client | None = None
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
    stats_txt = redis_conn.get(redis_key)
    if stats_txt is None:
        if session is None:
            with httpx.Client() as temp_session:
                response = temp_session.get(urlunparse(stats_json_url), timeout=30.0)
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                stats = response.json()
        else:
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
        redis_conn.set(redis_key, orjson.dumps(stats), ex=expire)
    else:
        stats = orjson.loads(stats_txt)
    return stats


def _load_aggregates() -> dict:
    result = {}
    for key, redis_key in AGGREGATES_KEYS.items():
        data = redis_conn.get(redis_key)
        result[key] = orjson.loads(data) if data else None
    return result


def _save_aggregates(agg: dict):
    pipe = redis_conn.pipeline()
    for key, redis_key in AGGREGATES_KEYS.items():
        if agg.get(key) is not None:
            pipe.set(redis_key, orjson.dumps(agg[key]))
    pipe.execute()


def _delete_aggregates():
    pipe = redis_conn.pipeline()
    for redis_key in AGGREGATES_KEYS.values():
        pipe.delete(redis_key)
    pipe.execute()


def _init_empty_aggregates() -> dict:
    return {
        "totals": {},
        "per_day": {},
        "per_country": {},
        "global": {
            "downloads_per_day": {},
            "updates_per_day": {},
            "delta_downloads_per_day": {},
            "totals_country": {},
        },
        "last_date": None,
    }


def _update_aggregates_for_date(date: datetime.date, stats: dict, agg: dict) -> None:
    if stats is None:
        return

    date_str = date.isoformat()

    if stats.get("refs"):
        for app_id, app_stats in stats["refs"].items():
            clean_id = _remove_architecture_from_id(app_id)
            totals_for_app = agg["totals"].setdefault(clean_id, {})
            for arch, downloads in app_stats.items():
                arch_totals = totals_for_app.setdefault(arch, [0, 0, 0])
                arch_totals[0] += downloads[0]
                arch_totals[1] += downloads[1]
                arch_totals[2] += downloads[0] - downloads[1]

            per_day_for_app = agg["per_day"].setdefault(clean_id, {})
            per_day_for_app[date_str] = _sum_installs_by_arch(app_stats)

    if stats.get("ref_by_country"):
        for app_id, country_stats in stats["ref_by_country"].items():
            country_for_app = agg["per_country"].setdefault(app_id, {})
            for country, downloads in country_stats.items():
                country_for_app[country] = (
                    country_for_app.get(country, 0) + downloads[0] - downloads[1]
                )

    if stats.get("downloads"):
        agg["global"]["downloads_per_day"][date_str] = stats["downloads"]
    if stats.get("updates"):
        agg["global"]["updates_per_day"][date_str] = stats["updates"]
    if stats.get("delta_downloads"):
        agg["global"]["delta_downloads_per_day"][date_str] = stats["delta_downloads"]
    if stats.get("countries"):
        for country, downloads in stats["countries"].items():
            agg["global"]["totals_country"][country] = (
                agg["global"]["totals_country"].get(country, 0) + downloads
            )


def _get_stats_for_period(sdate: datetime.date, edate: datetime.date):
    totals: StatsType = {}
    for i in range((edate - sdate).days + 1):
        date = sdate + datetime.timedelta(days=i)
        stats = _get_stats_for_date(date)

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


def _get_app_stats_per_day() -> dict[str, dict[str, int]]:
    # Skip last two days as flathub-stats publishes partial statistics
    redis_key = "app_stats_per_day"
    cached_data = database.get_json_key(redis_key)
    if cached_data is not None and isinstance(cached_data, dict):
        return cached_data  # type: ignore

    edate = datetime.date.today() - datetime.timedelta(days=2)
    sdate = FIRST_STATS_DATE

    app_stats_per_day: dict[str, dict[str, int]] = {}

    dates = [
        sdate + datetime.timedelta(days=i) for i in range((edate - sdate).days + 1)
    ]

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        future_to_date = {
            executor.submit(_get_stats_for_date, date): date for date in dates
        }

        for future in concurrent.futures.as_completed(future_to_date):
            date = future_to_date[future]
            try:
                stats = future.result()
            except Exception:
                continue

            if stats is not None and "refs" in stats and stats["refs"] is not None:
                for app_id, app_stats in stats["refs"].items():
                    app_id_without_architecture = _remove_architecture_from_id(app_id)
                    if app_id_without_architecture not in app_stats_per_day:
                        app_stats_per_day[app_id_without_architecture] = {}
                    app_stats_per_day[app_id_without_architecture][date.isoformat()] = (
                        _sum_installs_by_arch(app_stats)
                    )

    # Sort each app's stats by date
    for app_id in app_stats_per_day:
        app_stats_per_day[app_id] = dict(sorted(app_stats_per_day[app_id].items()))

    # Cache for a day; data is historical and slow to compute
    redis_conn.set(redis_key, orjson.dumps(app_stats_per_day), ex=86400)

    return app_stats_per_day


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


def _calculate_installs(downloads_data: list[int]) -> int:
    if len(downloads_data) >= 2:
        return downloads_data[0] - downloads_data[1]
    return 0


def _sum_installs_by_arch(app_stats: dict[str, list[int]]) -> int:
    return sum(_calculate_installs(dls) for dls in app_stats.values())


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

        # Ensure installs_per_day is sorted chronologically
        if "installs_per_day" in app_stats:
            app_stats["installs_per_day"] = dict(
                sorted(app_stats["installs_per_day"].items())
            )

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
    redis_conn.set(redis_key, orjson.dumps(popular), ex=60 * 60)
    return popular


def _calculate_quality_passed_ratio(app_quality_status) -> float:
    if app_quality_status is None:
        return 0.0
    total = (
        app_quality_status.passed
        + app_quality_status.not_passed
        + app_quality_status.unrated
    )
    return app_quality_status.passed / total if total > 0 else 0.0


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
        momentum = 1.0
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


def _build_or_update_aggregates() -> dict:
    edate = datetime.date.today() - datetime.timedelta(days=2)

    if config.settings.force_recompute_stats:
        _delete_aggregates()

    agg = _load_aggregates()

    if agg["last_date"] is None:
        agg = _init_empty_aggregates()
        sdate = FIRST_STATS_DATE
    else:
        last_date = datetime.date.fromisoformat(agg["last_date"])
        sdate = last_date + datetime.timedelta(days=1)
        if sdate > edate:
            return agg

    checkpoint_interval = 100
    days_processed = 0
    current_date = sdate

    while current_date <= edate:
        stats = _get_stats_for_date(current_date)
        _update_aggregates_for_date(current_date, stats, agg)
        agg["last_date"] = current_date.isoformat()
        days_processed += 1

        if days_processed % checkpoint_interval == 0:
            _save_aggregates(agg)

        current_date += datetime.timedelta(days=1)

    _save_aggregates(agg)
    return agg


def _build_stats_dict_from_aggregates(agg: dict, app_count: int) -> dict:
    downloads_per_day = dict(agg["global"]["downloads_per_day"])
    updates_per_day = dict(agg["global"]["updates_per_day"])
    delta_downloads_per_day = dict(agg["global"]["delta_downloads_per_day"])
    totals_country = dict(agg["global"]["totals_country"])

    edate = datetime.date.today()
    sdate = edate - datetime.timedelta(days=1)
    for i in range(2):
        date = sdate + datetime.timedelta(days=i)
        stats = _get_stats_for_date(date)
        if stats is None:
            continue
        date_str = date.isoformat()
        if stats.get("downloads") is not None:
            downloads_per_day[date_str] = stats["downloads"]
        if stats.get("updates") is not None:
            updates_per_day[date_str] = stats["updates"]
        if stats.get("delta_downloads") is not None:
            delta_downloads_per_day[date_str] = stats["delta_downloads"]
        if stats.get("countries"):
            for country, downloads in stats["countries"].items():
                totals_country[country] = totals_country.get(country, 0) + downloads

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


def update(sqldb):
    stats_apps_dict = defaultdict(lambda: {})

    edate = datetime.date.today()

    frontend_app_ids = database.get_all_appids_for_frontend()

    agg = _build_or_update_aggregates()
    stats_dict = _build_stats_dict_from_aggregates(agg, len(frontend_app_ids))

    apps_with_stats = [
        app_id for app_id in agg["per_day"].keys() if app_id in frontend_app_ids
    ]
    quality_status_batch = models.QualityModeration.by_appids_summarized(
        sqldb, apps_with_stats
    )
    eol_status_batch = models.QualityModeration.by_appids_eol_status(
        sqldb, apps_with_stats
    )

    trending_apps: list = []
    for app_id in agg["per_day"]:
        if app_id in frontend_app_ids:
            stats_dict_for_app = agg["per_day"][app_id]
            sorted_stats = dict(sorted(stats_dict_for_app.items()))
            installs = list(sorted_stats.values())

            max_history_length = 21
            if len(installs) > 1:
                install_history_length = min(len(installs), max_history_length + 1)
                installs_over_days = installs[-install_history_length:-1]
            else:
                installs_over_days = []

            is_new_app = len(agg["per_day"][app_id]) <= 14

            quality_passed_ratio = _calculate_quality_passed_ratio(quality_status_batch.get(app_id))

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

    for app_id, arch_stats in agg["totals"].items():
        stats_apps_dict[app_id]["installs_total"] = sum(
            [s[2] for s in arch_stats.values()]
        )

        if app_id in agg["per_day"]:
            stats_apps_dict[app_id]["installs_per_day"] = dict(
                sorted(agg["per_day"][app_id].items())
            )

        if app_id in agg["per_country"]:
            stats_apps_dict[app_id]["installs_per_country"] = agg["per_country"][app_id]

    recent_sdate = edate - datetime.timedelta(days=1)
    recent_stats = _get_stats_for_period(recent_sdate, edate)
    for app_id, app_dict in recent_stats.items():
        recent_installs = sum([i[2] for i in app_dict.values()])
        if app_id in stats_apps_dict:
            stats_apps_dict[app_id]["installs_total"] = (
                stats_apps_dict[app_id].get("installs_total", 0) + recent_installs
            )

    sdate_30_days = edate - datetime.timedelta(days=30 - 1)
    stats_30_days = _get_stats_for_period(sdate_30_days, edate)

    stats_installs: list = []
    for app_id, app_dict in stats_30_days.items():
        installs_last_month = sum([i[2] for i in app_dict.values()])
        stats_apps_dict[app_id]["installs_last_month"] = installs_last_month
        if app_id in frontend_app_ids:
            stats_installs.append(
                {
                    "id": utils.get_clean_app_id(app_id),
                    "installs_last_month": installs_last_month,
                }
            )
    search.create_or_update_apps(stats_installs)

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

    for app_id, app_dict in stats_7_days.items():
        stats_apps_dict[app_id]["installs_last_7_days"] = sum(
            [i[2] for i in app_dict.values()]
        )

    for app_id in stats_apps_dict:
        models.App.set_downloads(
            sqldb, app_id, stats_apps_dict[app_id].get("installs_last_7_days", 0)
        )

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

    redis_conn.set("stats", orjson.dumps(stats_dict))
    database.bulk_set_app_stats(stats_apps_dict)
    _generate_and_store_year_in_review_stats(sqldb)


def _generate_and_store_year_in_review_stats(sqldb):
    current_year = datetime.date.today().year
    first_year = FIRST_STATS_DATE.year

    for year in range(first_year, current_year + 1):
        if year < current_year:
            existing = models.YearInReviewStats.get_for_year(sqldb, year)
            if existing:
                continue

        try:
            base_stats = asyncio.run(_build_year_in_review_base(year))
        except Exception:
            continue

        if base_stats:
            models.YearInReviewStats.set_for_year(sqldb, year, base_stats)


def _normalize_year_date_range(year: int) -> tuple[datetime.date, datetime.date] | None:
    sdate = datetime.date(year, 1, 1)
    edate = datetime.date(year, 12, 31)
    today = datetime.date.today()

    if edate > today:
        edate = today
    if sdate < FIRST_STATS_DATE:
        sdate = FIRST_STATS_DATE
    if sdate > today:
        return None

    return (sdate, edate)


def _get_country_downloads_for_year(year: int) -> dict[str, int]:
    date_range = _normalize_year_date_range(year)
    if not date_range:
        return {}

    sdate, edate = date_range

    country_downloads: dict[str, int] = {}
    stats_results = _fetch_stats_parallel(sdate, edate)

    for stats in stats_results:
        if stats and "ref_by_country" in stats and stats["ref_by_country"] is not None:
            for app_id, country_stats in stats["ref_by_country"].items():
                for country, downloads in country_stats.items():
                    if country not in country_downloads:
                        country_downloads[country] = 0
                    new_installs = _calculate_installs(downloads)
                    if new_installs > 0:
                        country_downloads[country] += new_installs

    return country_downloads


def _get_basic_year_stats(year: int) -> dict | None:
    date_range = _normalize_year_date_range(year)
    if not date_range:
        return None

    sdate, edate = date_range

    total_downloads = 0
    total_updates = 0

    stats_results = _fetch_stats_parallel(sdate, edate)
    for stats in stats_results:
        if stats:
            if "refs" in stats and stats["refs"] is not None:
                for app_id, app_stats in stats["refs"].items():
                    for arch, downloads in app_stats.items():
                        new_installs = _calculate_installs(downloads)
                        if new_installs > 0:
                            total_downloads += new_installs
            if "updates" in stats and stats["updates"] is not None:
                total_updates += stats["updates"]

    # Get app count for the year
    new_apps_count = 0
    with database.get_db() as sqldb:
        new_apps_count = (
            sqldb.query(models.App)
            .filter(models.App.type == "desktop-application")
            .filter(models.App.initial_release_at >= sdate)
            .filter(models.App.initial_release_at <= edate)
            .count()
        )

    result = {
        "total_downloads": total_downloads,
        "new_apps_count": new_apps_count,
        "updates_count": total_updates,
    }

    return result


def _get_category_downloads_for_year(year: int) -> dict[str, int]:
    date_range = _normalize_year_date_range(year)
    if not date_range:
        return {}

    sdate, edate = date_range

    app_downloads = defaultdict(int)
    stats_results = _fetch_stats_parallel(sdate, edate)

    for stats in stats_results:
        if stats and "refs" in stats and stats["refs"] is not None:
            for app_id, app_stats in stats["refs"].items():
                app_id_clean = _remove_architecture_from_id(app_id)
                for arch, downloads in app_stats.items():
                    new_installs = _calculate_installs(downloads)
                    if new_installs > 0:
                        app_downloads[app_id_clean] += new_installs

    # Map app downloads to categories
    category_downloads = defaultdict(int)
    with database.get_db() as sqldb:
        if not app_downloads:
            app_rows: list[tuple[str, str | None]] = []
        else:
            app_rows = (
                sqldb.query(models.App.app_id, models.App.main_category)
                .filter(
                    models.App.type == "desktop-application",
                    models.App.app_id.in_(app_downloads.keys()),
                )
                .all()
            )

        for app_id, main_category in app_rows:
            if main_category:
                category_downloads[main_category.lower()] += app_downloads[app_id]

    result = dict(category_downloads)

    return result


def _get_app_downloads_for_year(year: int) -> dict[str, int]:
    date_range = _normalize_year_date_range(year)
    if not date_range:
        return {}

    sdate, edate = date_range

    app_downloads = defaultdict(int)
    stats_results = _fetch_stats_parallel(sdate, edate)

    for stats in stats_results:
        if stats and "refs" in stats and stats["refs"] is not None:
            for app_id, app_stats in stats["refs"].items():
                app_id_clean = _remove_architecture_from_id(app_id)
                for arch, downloads in app_stats.items():
                    new_installs = _calculate_installs(downloads)
                    if new_installs > 0:
                        app_downloads[app_id_clean] += new_installs

    result = dict(app_downloads)

    return result


def _load_year_in_review_base(year: int) -> dict | None:
    with database.get_db() as sqldb:
        stored_stats = models.YearInReviewStats.get_for_year(sqldb, year)
        if stored_stats:
            return stored_stats.data
    return None


def _save_year_in_review_base(year: int, base_data: dict) -> None:
    with database.get_db("writer") as sqldb:
        models.YearInReviewStats.set_for_year(sqldb, year, base_data)


def _build_base_top_list(
    app_ids: list[str], downloads_dict: dict[str, int]
) -> list[dict]:
    return [
        {
            "app_id": app_id,
            "downloads": downloads_dict.get(app_id, 0),
        }
        for app_id in app_ids
    ]


async def _build_year_in_review_base(year: int) -> dict | None:
    sdate = datetime.date(year, 1, 1)
    edate = datetime.date(year, 12, 31)

    today = datetime.date.today()
    if edate > today:
        edate = today

    if sdate < FIRST_STATS_DATE:
        sdate = FIRST_STATS_DATE

    if sdate > today:
        return None

    total_downloads = 0
    total_updates = 0
    app_downloads = defaultdict(int)
    app_updates_dict = defaultdict(int)
    monthly_downloads = defaultdict(lambda: defaultdict(int))
    country_downloads = defaultdict(int)
    arch_downloads = defaultdict(int)

    dates = [
        sdate + datetime.timedelta(days=i) for i in range((edate - sdate).days + 1)
    ]

    async def _fetch_stats_async(date):
        cache_key = f"stats:date:{date.isoformat()}"
        try:
            cached_value = await redis_conn.get(cache_key)
        except Exception:
            cached_value = None

        if cached_value:
            try:
                return orjson.loads(cached_value)
            except Exception:
                # Fallback to recomputing if cache is corrupt
                pass

        try:
            data = await asyncio.to_thread(_get_stats_for_date, date)
        except Exception:
            return None

        if data is not None:
            try:
                today = datetime.date.today()
                ttl_seconds = 60 * 60 if date.year == today.year else 60 * 60 * 24 * 7
                await redis_conn.set(cache_key, orjson.dumps(data), ex=ttl_seconds)
            except Exception:
                # If caching fails, just proceed without cache
                pass

        return data

    stats_results = await asyncio.gather(*[_fetch_stats_async(date) for date in dates])

    for date_idx, stats in enumerate(stats_results):
        if stats is None:
            continue

        date = dates[date_idx]

        if "updates" in stats and stats["updates"] is not None:
            total_updates += stats["updates"]

        month_key = date.strftime("%Y-%m")
        if "refs" in stats and stats["refs"] is not None:
            for app_id, app_stats in stats["refs"].items():
                app_id_clean = _remove_architecture_from_id(app_id)
                for arch, downloads in app_stats.items():
                    new_installs = _calculate_installs(downloads)
                    if new_installs > 0:
                        updates = downloads[1] if len(downloads) >= 2 else 0
                        app_downloads[app_id_clean] += new_installs
                        app_updates_dict[app_id_clean] += updates
                        monthly_downloads[month_key][app_id_clean] += new_installs
                        arch_downloads[arch] += new_installs
                        total_downloads += new_installs

        if "ref_by_country" in stats and stats["ref_by_country"] is not None:
            for app_id, country_stats in stats["ref_by_country"].items():
                for country, downloads in country_stats.items():
                    new_installs = _calculate_installs(downloads)
                    if new_installs > 0:
                        country_downloads[country] += new_installs

    loop = asyncio.get_running_loop()

    def _categorize_gaming_app(
        app, gaming_app_ids, emulator_app_ids, game_store_app_ids, game_utility_app_ids
    ):
        app_subcategories = set(s.lower() for s in (app.sub_categories or []))

        if "emulator" in app_subcategories:
            emulator_app_ids.add(app.app_id)
        elif app_subcategories & {"launcherStore", "packagemanager"}:
            game_store_app_ids.add(app.app_id)
        elif app_subcategories & {"utility", "network", "gameTool"}:
            game_utility_app_ids.add(app.app_id)
        else:
            gaming_app_ids.add(app.app_id)

    def _fetch_app_data():
        desktop_app_ids = set()
        gaming_app_ids = set()
        emulator_app_ids = set()
        game_store_app_ids = set()
        game_utility_app_ids = set()
        non_game_app_ids = set()
        app_main_category = {}

        with database.get_db() as sqldb:
            all_apps = (
                sqldb.query(models.App)
                .filter(models.App.type == "desktop-application")
                .all()
            )

            for app in all_apps:
                desktop_app_ids.add(app.app_id)

                is_game = app.main_category and app.main_category.lower() == "game"

                if is_game:
                    _categorize_gaming_app(
                        app,
                        gaming_app_ids,
                        emulator_app_ids,
                        game_store_app_ids,
                        game_utility_app_ids,
                    )
                else:
                    non_game_app_ids.add(app.app_id)

                if app.main_category:
                    app_main_category[app.app_id] = app.main_category

        return (
            desktop_app_ids,
            gaming_app_ids,
            emulator_app_ids,
            game_store_app_ids,
            game_utility_app_ids,
            non_game_app_ids,
            app_main_category,
        )

    (
        desktop_app_ids,
        gaming_app_ids,
        emulator_app_ids,
        game_store_app_ids,
        game_utility_app_ids,
        non_game_app_ids,
        app_main_category,
    ) = await loop.run_in_executor(None, _fetch_app_data)

    # Manual overrides for well-known gaming apps whose subcategories don't map cleanly
    for app_id in {"net.lutris.Lutris"}:
        if app_id in desktop_app_ids:
            game_store_app_ids.add(app_id)
            gaming_app_ids.discard(app_id)
            game_utility_app_ids.discard(app_id)
            emulator_app_ids.discard(app_id)
            non_game_app_ids.discard(app_id)

    for app_id in {
        "org.scummvm.ScummVM",
        "org.prismlauncher.PrismLauncher",
        "com.moonlight_stream.Moonlight",
        "org.polymc.PolyMC",
    }:
        if app_id in desktop_app_ids:
            game_utility_app_ids.add(app_id)
            gaming_app_ids.discard(app_id)
            game_store_app_ids.discard(app_id)
            emulator_app_ids.discard(app_id)
            non_game_app_ids.discard(app_id)

    def _filter_downloads_by_ids(id_set: set) -> dict[str, int]:
        return {
            app_id: downloads
            for app_id, downloads in app_downloads.items()
            if app_id in id_set
        }

    non_game_app_downloads = _filter_downloads_by_ids(non_game_app_ids)
    gaming_app_downloads = _filter_downloads_by_ids(gaming_app_ids)
    emulator_app_downloads = _filter_downloads_by_ids(emulator_app_ids)
    game_store_app_downloads = _filter_downloads_by_ids(game_store_app_ids)
    game_utility_app_downloads = _filter_downloads_by_ids(game_utility_app_ids)

    def _get_top_app_ids(downloads_dict: dict, count: int = 3) -> list[str]:
        """Get top N app IDs from downloads dict."""
        if not downloads_dict:
            return []
        sorted_items = sorted(downloads_dict.items(), key=lambda x: x[1], reverse=True)[
            :count
        ]
        return [app_id for app_id, _ in sorted_items]

    top_app_ids = _get_top_app_ids(non_game_app_downloads, 3)
    top_game_ids = _get_top_app_ids(gaming_app_downloads, 3)
    top_emulator_ids = _get_top_app_ids(emulator_app_downloads, 3)
    top_game_store_ids = _get_top_app_ids(game_store_app_downloads, 3)
    top_game_utility_ids = _get_top_app_ids(game_utility_app_downloads, 3)

    frontend_app_ids, app_stats_per_day = await asyncio.gather(
        loop.run_in_executor(None, database.get_all_appids_for_frontend),
        loop.run_in_executor(None, _get_app_stats_per_day),
    )

    new_apps_count = 0
    total_apps_at_year_end = 0
    for app_id, daily_stats in app_stats_per_day.items():
        if app_id in frontend_app_ids and daily_stats:
            first_date_str = min(daily_stats.keys())
            first_date = datetime.date.fromisoformat(first_date_str)
            if first_date <= edate:
                total_apps_at_year_end += 1
            if sdate <= first_date <= edate:
                new_apps_count += 1

    total_apps = total_apps_at_year_end

    def _calculate_yoy_growth(
        prev_downloads_dict, current_downloads_dict, min_threshold
    ):
        growth_dict = {}
        for app_id, current_downloads in current_downloads_dict.items():
            prev_downloads = prev_downloads_dict.get(app_id, 0)
            if prev_downloads >= min_threshold:
                growth = current_downloads - prev_downloads
                if growth > 0:
                    growth_dict[app_id] = {
                        "growth": growth,
                        "growth_percentage": int((growth / prev_downloads) * 100),
                    }
        return growth_dict

    new_apps_downloads = {}
    for app_id, daily_stats in app_stats_per_day.items():
        if app_id in desktop_app_ids and daily_stats:
            first_date_str = min(daily_stats.keys())
            first_date = datetime.date.fromisoformat(first_date_str)
            # App is new if it first appeared in this year
            if sdate <= first_date <= edate and app_id in app_downloads:
                new_apps_downloads[app_id] = app_downloads[app_id]

    def _get_sort_value(value, sort_key):
        return value if isinstance(value, int) else value[sort_key]

    def _build_category_list(data_dict: dict, value_key: str, sort_key: str):
        category_data = defaultdict(dict)
        for app_id, value in data_dict.items():
            if app_id in app_main_category:
                category_data[app_main_category[app_id]][app_id] = value

        result = []
        for category_name, apps in category_data.items():
            if not apps:
                continue

            top_app_id = max(
                apps.items(), key=lambda x: _get_sort_value(x[1], sort_key)
            )[0]
            top_value = apps[top_app_id]

            try:
                category_enum = schemas.MainCategory(category_name)
            except ValueError:
                continue

            item = {
                "category": category_enum.value,
                "app_id": top_app_id,
            }

            if isinstance(top_value, dict):
                item.update(top_value)
            else:
                item[value_key] = top_value

            result.append(item)

        return sorted(result, key=lambda x: x[sort_key], reverse=True)

    popular_apps_by_category = _build_category_list(
        app_downloads, "downloads", "downloads"
    )

    biggest_growth_by_category = []
    most_improved_by_category = []
    if year > 2018:
        prev_year_app_downloads = await loop.run_in_executor(
            None, _get_app_downloads_for_year, year - 1
        )

        if prev_year_app_downloads and app_downloads:
            app_yoy_growth = _calculate_yoy_growth(
                prev_year_app_downloads, app_downloads, MEANINGFUL_DOWNLOADS_THRESHOLD
            )
            biggest_growth_by_category = _build_category_list(
                app_yoy_growth, "growth", "growth"
            )

        if prev_year_app_downloads and app_downloads:
            app_yoy_growth = _calculate_yoy_growth(
                prev_year_app_downloads, app_downloads, HIGH_DOWNLOADS_THRESHOLD
            )
            most_improved_by_category = _build_category_list(
                app_yoy_growth, "growth_percentage", "growth_percentage"
            )
    newcomers_by_category = []
    if new_apps_downloads:
        newcomers_by_category = _build_category_list(
            new_apps_downloads, "downloads", "downloads"
        )

    top_countries = []
    if country_downloads:
        sorted_countries = sorted(
            country_downloads.items(), key=lambda x: x[1], reverse=True
        )[:5]
        for country_code, downloads in sorted_countries:
            top_countries.append(
                {
                    "country_code": country_code,
                    "downloads": downloads,
                }
            )

    fastest_growing_regions = []
    if year > 2018:  # Need previous year data
        prev_year_countries = await loop.run_in_executor(
            None, _get_country_downloads_for_year, year - 1
        )

        if prev_year_countries and country_downloads:
            country_growth = []
            for country_code, downloads in country_downloads.items():
                prev_downloads = prev_year_countries.get(country_code, 0)
                if prev_downloads >= MEANINGFUL_DOWNLOADS_THRESHOLD:
                    growth = downloads - prev_downloads
                    growth_pct = int((growth / prev_downloads) * 100)
                    if growth > 0:
                        country_growth.append(
                            {
                                "country_code": country_code,
                                "downloads": downloads,
                                "previous_year_downloads": prev_downloads,
                                "growth": growth,
                                "growth_percentage": growth_pct,
                            }
                        )

            fastest_growing_regions = sorted(
                country_growth, key=lambda x: x["growth_percentage"], reverse=True
            )[:5]

    geographic_stats = {
        "top_countries": top_countries,
        "total_countries": len(country_downloads),
        "fastest_growing_regions": fastest_growing_regions,
    }

    total_downloads_change = 0
    total_downloads_change_percentage = 0.0
    if year > 2018:  # Only if we have previous year data
        prev_year_stats = await loop.run_in_executor(
            None, _get_basic_year_stats, year - 1
        )
        if prev_year_stats:
            prev_downloads = prev_year_stats.get("total_downloads", 0)

            downloads_change = total_downloads - prev_downloads
            downloads_change_pct = (
                (downloads_change / prev_downloads * 100) if prev_downloads > 0 else 0
            )

            total_downloads_change = downloads_change
            total_downloads_change_percentage = round(downloads_change_pct, 1)

    def _fetch_quality_apps():
        with database.get_db() as sqldb:
            if config.settings.env == "development":
                return list(non_game_app_ids)
            else:
                quality_apps = models.QualityModeration.by_appids_summarized(
                    sqldb, list(non_game_app_ids)
                )
                return [
                    app_id for app_id, status in quality_apps.items() if status.passes
                ]

    hidden_gems = []
    passing_apps = await loop.run_in_executor(None, _fetch_quality_apps)

    if passing_apps and app_downloads:
        non_game_downloads_list = [
            app_downloads[app_id]
            for app_id in non_game_app_ids
            if app_id in app_downloads and app_downloads[app_id] > 0
        ]
        if non_game_downloads_list:
            sorted_downloads = sorted(non_game_downloads_list)
            median_downloads = sorted_downloads[len(sorted_downloads) // 2]
            threshold_idx = int(len(sorted_downloads) * 0.3)
            low_threshold = (
                sorted_downloads[threshold_idx]
                if threshold_idx < len(sorted_downloads)
                else median_downloads
            )
            low_threshold = max(low_threshold, MINIMUM_GEM_THRESHOLD)

            gems_candidates = []
            for app_id in passing_apps:
                downloads = app_downloads.get(app_id, 0)
                if downloads >= MINIMAL_USAGE_THRESHOLD and downloads < low_threshold:
                    gems_candidates.append(
                        {
                            "app_id": app_id,
                            "downloads": downloads,
                        }
                    )

            hidden_gems = sorted(
                gems_candidates, key=lambda x: x["downloads"], reverse=True
            )[:5]

    trending_categories = []
    if year > 2018:
        prev_category_downloads = await loop.run_in_executor(
            None, _get_category_downloads_for_year, year - 1
        )
        current_category_downloads = defaultdict(int)

        for app_id, downloads in app_downloads.items():
            category = app_main_category.get(app_id)
            if category:
                current_category_downloads[category.lower()] += downloads

        for category, current_downloads in current_category_downloads.items():
            prev_downloads = prev_category_downloads.get(category, 0)
            if prev_downloads > MEANINGFUL_DOWNLOADS_THRESHOLD:
                growth = current_downloads - prev_downloads
                growth_pct = growth / prev_downloads * 100
                if growth > 0:
                    trending_categories.append(
                        {
                            "category": category,
                            "current_year_downloads": current_downloads,
                            "previous_year_downloads": prev_downloads,
                            "growth": growth,
                            "growth_percentage": round(growth_pct, 1),
                        }
                    )

        trending_categories = sorted(
            trending_categories, key=lambda x: x["growth_percentage"], reverse=True
        )[:3]

    platform_stats = []
    if arch_downloads:
        total_arch_downloads = sum(arch_downloads.values())
        if total_arch_downloads > 0:
            sorted_archs = sorted(
                arch_downloads.items(), key=lambda x: x[1], reverse=True
            )
            for arch, downloads in sorted_archs:
                platform_stats.append(
                    {
                        "architecture": arch,
                        "downloads": downloads,
                        "percentage": round(
                            (downloads / total_arch_downloads) * 100, 2
                        ),
                    }
                )

    base_result = {
        "year": year,
        "total_downloads": total_downloads,
        "new_apps_count": new_apps_count,
        "total_apps": total_apps,
        "updates_count": total_updates,
        "total_downloads_change": total_downloads_change,
        "total_downloads_change_percentage": total_downloads_change_percentage,
        "top_apps": _build_base_top_list(top_app_ids, non_game_app_downloads),
        "top_games": _build_base_top_list(top_game_ids, gaming_app_downloads),
        "top_emulators": _build_base_top_list(top_emulator_ids, emulator_app_downloads),
        "top_game_stores": _build_base_top_list(
            top_game_store_ids, game_store_app_downloads
        ),
        "top_game_utilities": _build_base_top_list(
            top_game_utility_ids, game_utility_app_downloads
        ),
        "popular_apps_by_category": popular_apps_by_category,
        "biggest_growth_by_category": biggest_growth_by_category,
        "newcomers_by_category": newcomers_by_category,
        "most_improved_by_category": most_improved_by_category,
        "geographic_stats": geographic_stats,
        "hidden_gems": hidden_gems,
        "trending_categories": trending_categories,
        "platform_stats": platform_stats,
    }

    return base_result


async def _add_translations_to_year_in_review(base_data: dict, locale: str) -> dict:
    loop = asyncio.get_running_loop()

    def _collect_app_ids() -> set[str]:
        app_ids: set[str] = set()
        for key in [
            "top_apps",
            "top_games",
            "top_emulators",
            "top_game_stores",
            "top_game_utilities",
            "popular_apps_by_category",
            "biggest_growth_by_category",
            "newcomers_by_category",
            "most_improved_by_category",
            "hidden_gems",
        ]:
            for item in base_data.get(key, []):
                app_ids.add(item["app_id"])
        return app_ids

    def _fetch_translations_for_apps(app_ids: set[str]):
        app_names = {}
        app_icons = {}
        app_summaries = {}

        with database.get_db() as sqldb:
            apps = sqldb.query(models.App).filter(models.App.app_id.in_(app_ids)).all()
            for app in apps:
                translated_appstream = app.get_translated_appstream(locale)
                if translated_appstream:
                    if "name" in translated_appstream:
                        app_names[app.app_id] = translated_appstream["name"]
                    if "icon" in translated_appstream:
                        app_icons[app.app_id] = translated_appstream["icon"]
                    if "summary" in translated_appstream:
                        app_summaries[app.app_id] = translated_appstream["summary"]

        return app_names, app_icons, app_summaries

    app_names, app_icons, app_summaries = await loop.run_in_executor(
        None, _fetch_translations_for_apps, _collect_app_ids()
    )

    def _apply_translations(items: list[dict]) -> list[dict]:
        translated_items: list[dict] = []
        for item in items:
            app_id = item["app_id"]
            translated_items.append(
                {
                    **item,
                    "name": app_names.get(app_id) or app_id,
                    "icon": app_icons.get(app_id),
                    "summary": app_summaries.get(app_id),
                }
            )
        return translated_items

    result = copy.deepcopy(base_data)
    result["top_apps"] = _apply_translations(base_data.get("top_apps", []))
    result["top_games"] = _apply_translations(base_data.get("top_games", []))
    result["top_emulators"] = _apply_translations(base_data.get("top_emulators", []))
    result["top_game_stores"] = _apply_translations(
        base_data.get("top_game_stores", [])
    )
    result["top_game_utilities"] = _apply_translations(
        base_data.get("top_game_utilities", [])
    )
    result["popular_apps_by_category"] = _apply_translations(
        base_data.get("popular_apps_by_category", [])
    )
    result["biggest_growth_by_category"] = _apply_translations(
        base_data.get("biggest_growth_by_category", [])
    )
    result["newcomers_by_category"] = _apply_translations(
        base_data.get("newcomers_by_category", [])
    )
    result["most_improved_by_category"] = _apply_translations(
        base_data.get("most_improved_by_category", [])
    )
    result["hidden_gems"] = _apply_translations(base_data.get("hidden_gems", []))

    return result


async def get_year_stats(year: int, locale: str = "en"):
    base_data = _load_year_in_review_base(year)

    if base_data is None:
        base_data = await _build_year_in_review_base(year)
        if base_data:
            try:
                _save_year_in_review_base(year, base_data)
            except Exception:
                pass

    if base_data is None:
        return None

    return await _add_translations_to_year_in_review(base_data, locale)
