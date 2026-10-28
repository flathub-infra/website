import asyncio
import concurrent.futures
import copy
import datetime
import json
import logging
from collections import defaultdict
from collections.abc import Mapping
from typing import TypedDict, cast
from urllib.parse import urlparse, urlunparse

import httpx
from sqlalchemy import text

from app import utils

from . import config, database, models, schemas, search, stats_db
from .database import get_db as stats_get_db
from .trending import calculate_trending_score as _calculate_trending_score
from .types import JSONValue, is_json_object

logger = logging.getLogger(__name__)


class StatsFromServer(TypedDict):
    countries: dict[str, int]
    date: datetime.date
    delta_downloads: int
    downloads: int
    updates: int
    flatpak_versions: dict[str, int]
    os_flatpak_versions: dict[str, dict[str, int]]
    os_versions: dict[str, int]
    ostree_versions: dict[str, int]
    ref_by_country: dict[str, dict[str, list[int]]]
    ref_by_os_version: dict[str, dict[str, list[int]]]
    refs: dict[str, dict[str, list[int]]]


FIRST_STATS_DATE = datetime.date(2018, 4, 29)


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


def _get_stats_for_date(
    date: datetime.date, session: httpx.Client | None = None, *, use_cache: bool = True
) -> StatsFromServer | None:
    now = utils.utcnow().replace(tzinfo=datetime.UTC)
    cached = stats_db.load_day(date)
    if use_cache and cached is not None:
        payload, fetched_at = cached
        stable_at = datetime.datetime.combine(
            date + datetime.timedelta(days=2), datetime.time.min, tzinfo=datetime.UTC
        )
        stable = date <= now.date() - datetime.timedelta(days=2)
        fresh = now - fetched_at < datetime.timedelta(hours=4)
        if (not stable or fetched_at >= stable_at) and (
            date <= now.date() - datetime.timedelta(days=7) or fresh
        ):
            return cast("StatsFromServer", payload)
    url = urlparse(config.settings.stats_baseurl + date.strftime("/%Y/%m/%d.json"))
    if url.scheme == "file":
        try:
            with open(url.path) as stats_file:
                payload = json.load(stats_file)
        except FileNotFoundError:
            return None
    else:
        if session is None:
            with httpx.Client() as client:
                response = client.get(urlunparse(url), timeout=30.0)
        else:
            response = session.get(urlunparse(url), timeout=30.0)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        payload = response.json()
    stats_db.save_day(date, payload, utils.utcnow().replace(tzinfo=datetime.UTC))
    return payload


def _import_source_dates() -> None:
    today = utils.utcnow().date()
    known = stats_db.known_dates(FIRST_STATS_DATE, today)
    stale = stats_db.stale_dates(FIRST_STATS_DATE, today - datetime.timedelta(days=2))
    dates = [
        FIRST_STATS_DATE + datetime.timedelta(days=i)
        for i in range((today - FIRST_STATS_DATE).days + 1)
    ]
    dates = [
        date
        for date in dates
        if date not in known
        or date in stale
        or date >= today - datetime.timedelta(days=7)
    ]
    with (
        httpx.Client() as client,
        concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor,
    ):
        for offset in range(0, len(dates), 4):
            futures = {
                executor.submit(_get_stats_for_date, date, client): date
                for date in dates[offset : offset + 4]
            }
            for future in concurrent.futures.as_completed(futures):
                try:
                    future.result()
                except Exception:
                    logger.exception("Failed to fetch stats for %s", futures[future])
                    raise
    if config.settings.force_recompute_stats:
        stats_db.rebuild_refs()


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


def get_installs_by_ids(ids: list[str]):
    result = defaultdict()
    for app_id in ids:
        app_stats = database.get_json_key(f"app_stats:{app_id}")
        if app_stats is None:
            continue

        if "installs_per_day" in app_stats:
            app_stats["installs_per_day"] = dict(
                sorted(app_stats["installs_per_day"].items())
            )

        app_stats["id"] = app_id
        result[app_id] = app_stats
    return result


def _calculate_quality_passed_ratio(app_quality_status) -> float:
    if app_quality_status is None:
        return 0.0
    total = (
        app_quality_status.passed
        + app_quality_status.not_passed
        + app_quality_status.unrated
    )
    return app_quality_status.passed / total if total > 0 else 0.0


def _source_rows(sqldb, start, end):
    return sqldb.execute(
        text("""
        SELECT date, data - 'refs' - 'ref_by_country' - 'ref_by_os_version'
        FROM stats_daily WHERE date BETWEEN :start AND :end ORDER BY date
    """).execution_options(stream_results=True),
        {"start": start, "end": end},
    ).yield_per(64)


def _global_data(sqldb, app_count):
    today = utils.utcnow().date()
    versions_start = today - datetime.timedelta(days=31)
    versions_end = today - datetime.timedelta(days=2)
    series = {
        "downloads_per_day": {},
        "updates_per_day": {},
        "delta_downloads_per_day": {},
    }
    countries = defaultdict(int)
    os_versions, flatpak_versions = defaultdict(int), defaultdict(int)
    os_flatpak_versions = defaultdict(lambda: defaultdict(int))
    for date, data in _source_rows(sqldb, FIRST_STATS_DATE, today):
        for field, target in (
            ("downloads", "downloads_per_day"),
            ("updates", "updates_per_day"),
            ("delta_downloads", "delta_downloads_per_day"),
        ):
            if data.get(field) is not None:
                series[target][date.isoformat()] = data[field]
        for country, count in (data.get("countries") or {}).items():
            countries[country] += count
        if versions_start <= date <= versions_end:
            for field, target in (
                ("os_versions", os_versions),
                ("flatpak_versions", flatpak_versions),
            ):
                reported = data.get(field) or {}
                for version, count in reported.items():
                    target[version] += count
                unknown = sum((data.get("ostree_versions") or {}).values()) - sum(
                    reported.values()
                )
                if unknown > 0:
                    target["unknown"] += unknown
            for os_version, versions in (data.get("os_flatpak_versions") or {}).items():
                for version, count in versions.items():
                    os_flatpak_versions[os_version][version] += count
    result = {
        "totals": {
            "downloads": sum(series["downloads_per_day"].values()),
            "number_of_apps": app_count,
            "verified_apps": search.get_number_of_verified_apps(),
        },
        "countries": dict(countries),
        **series,
        "category_totals": get_category_totals(),
        "os_versions": dict(os_versions),
        "flatpak_versions": dict(flatpak_versions),
        "os_flatpak_versions": {
            key: dict(value) for key, value in os_flatpak_versions.items()
        },
    }
    if not is_json_object(result):
        raise TypeError("Statistics must be a JSON object")
    return result


def _put_global(sqldb, data):
    row = sqldb.get(models.StatsGlobal, 1)
    if row is None:
        row = models.StatsGlobal(
            id=1, data=data, computed_at=utils.utcnow().replace(tzinfo=datetime.UTC)
        )
        sqldb.add(row)
    else:
        row.data = data
        row.computed_at = utils.utcnow().replace(tzinfo=datetime.UTC)


def seed_global_snapshot() -> None:
    app_count = len(database.get_all_appids_for_frontend())
    with stats_get_db("writer") as sqldb:
        _put_global(sqldb, _global_data(sqldb, app_count))
        sqldb.commit()


def _date_windows(start, end):
    while start <= end:
        window_end = min(start + datetime.timedelta(days=29), end)
        yield start, window_end
        start = window_end + datetime.timedelta(days=1)


def _prepare_app_snapshot(sqldb, today):
    sqldb.execute(
        text("""
        CREATE TEMPORARY TABLE stats_app_daily_snapshot ON COMMIT DROP AS
        SELECT split_part(ref, '/', 1) AS app_id, date, sum(downloads - updates) AS installs
        FROM stats_daily_ref WHERE date <= :today
        GROUP BY split_part(ref, '/', 1), date
    """),
        {"today": today},
    )
    sqldb.execute(text("CREATE INDEX ON stats_app_daily_snapshot (app_id, date)"))
    sqldb.execute(
        text("""
        CREATE TEMPORARY TABLE stats_app_country_snapshot (
            app_id text NOT NULL, country text NOT NULL, installs numeric NOT NULL,
            PRIMARY KEY (app_id, country)
        ) ON COMMIT DROP
    """)
    )
    stable = today - datetime.timedelta(days=2)
    for start, end in _date_windows(FIRST_STATS_DATE, stable):
        sqldb.execute(
            text("""
            INSERT INTO stats_app_country_snapshot (app_id, country, installs)
            SELECT refs.key, countries.key,
                   coalesce(sum((countries.value->>0)::bigint - (countries.value->>1)::bigint), 0)
            FROM stats_daily d
            CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(d.data->'ref_by_country') = 'object' THEN d.data->'ref_by_country' ELSE '{}'::jsonb END) refs
            CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(refs.value) = 'object' THEN refs.value ELSE '{}'::jsonb END) countries
            WHERE d.date BETWEEN :start AND :end
            GROUP BY refs.key, countries.key
            ON CONFLICT (app_id, country) DO UPDATE
            SET installs = stats_app_country_snapshot.installs + excluded.installs
        """),
            {"start": start, "end": end},
        )


def _app_batch(sqldb, ids, today) -> dict[str, models.AppStatsData]:
    stable = today - datetime.timedelta(days=2)
    result: dict[str, models.AppStatsData] = {
        app_id: {
            "installs_total": 0,
            "installs_last_month": 0,
            "installs_last_7_days": 0,
            "installs_per_day": {},
            "installs_per_country": {},
        }
        for app_id in ids
    }
    rows = sqldb.execute(
        text("""
        SELECT app_id, date, installs FROM stats_app_daily_snapshot
        WHERE app_id = ANY(:ids) ORDER BY app_id, date
    """),
        {"ids": ids},
    ).yield_per(1000)
    for app_id, date, count in rows:
        count = int(count)
        item = result[app_id]
        item["installs_total"] += count
        if date >= today - datetime.timedelta(days=29):
            item["installs_last_month"] += count
        if date >= today - datetime.timedelta(days=6):
            item["installs_last_7_days"] += count
        if date <= stable:
            item["installs_per_day"][date.isoformat()] = count
    for item in result.values():
        if not item["installs_per_day"]:
            item["installs_total"] = 0
    rows = sqldb.execute(
        text("""
        SELECT app_id, country, installs FROM stats_app_country_snapshot
        WHERE app_id = ANY(:ids)
    """),
        {"ids": ids},
    ).yield_per(1000)
    for app_id, country, count in rows:
        result[app_id]["installs_per_country"][country] = int(count or 0)
    return result


def update(sqldb):
    _import_source_dates()
    today = utils.utcnow().date()
    stable = today - datetime.timedelta(days=2)
    _prepare_app_snapshot(sqldb, today)
    frontend = set(database.get_all_appids_for_frontend())
    app_ids = [
        row[0]
        for row in sqldb.execute(
            text("SELECT DISTINCT app_id FROM stats_app_daily_snapshot")
        )
    ]
    monthly_ids = {
        row[0]
        for row in sqldb.execute(
            text(
                "SELECT DISTINCT app_id FROM stats_app_daily_snapshot WHERE date >= :start"
            ),
            {"start": today - datetime.timedelta(days=29)},
        )
    }
    rebases = database.get_json_key("eol_rebase") or {}
    app_ids = sorted(set(app_ids) | set(rebases))
    present = set(app_ids)
    rebased: dict[str, models.AppStatsData] = {}
    for app_id, old_ids in rebases.items():
        sources = {app_id} | {
            old.removesuffix(":stable")
            for old in old_ids
            if old.removesuffix(":stable") in present
        }
        originals = _app_batch(sqldb, list(sources), today)
        item = copy.deepcopy(originals[app_id])
        for old in old_ids:
            old = old.removesuffix(":stable")
            if old not in originals:
                continue
            source = item if old == app_id else rebased.get(old, originals[old])
            item["installs_total"] += source["installs_total"]
            item["installs_last_month"] += source["installs_last_month"]
            item["installs_last_7_days"] += source["installs_last_7_days"]
            for name, count in source["installs_per_day"].items():
                item["installs_per_day"][name] = (
                    item["installs_per_day"].get(name, 0) + count
                )
            for name, count in source["installs_per_country"].items():
                item["installs_per_country"][name] = (
                    item["installs_per_country"].get(name, 0) + count
                )
        item["installs_per_day"] = dict(sorted(item["installs_per_day"].items()))
        rebased[app_id] = item
    quality = models.QualityModeration.by_appids_summarized(
        sqldb, list(frontend & present)
    )
    eol = models.QualityModeration.by_appids_eol_status(sqldb, list(frontend & present))
    icon_count = models.QualityModeration.by_appids_icon_quality_passed_count(
        sqldb, list(frontend & present)
    )
    icon_status = models.QualityModeration.by_appids_icon_status(
        sqldb, list(frontend & present)
    )
    trending, installs = [], []
    for offset in range(0, len(app_ids), 200):
        targets = app_ids[offset : offset + 200]
        batch = _app_batch(sqldb, targets, today)
        published: dict[str, models.AppStatsData] = {}
        for app_id in targets:
            item = batch[app_id]
            if app_id in frontend and item["installs_per_day"]:
                values = [
                    item["installs_per_day"].get(
                        (stable - datetime.timedelta(days=20 - i)).isoformat(), 0
                    )
                    for i in range(21)
                ]
                trending.append(
                    {
                        "id": utils.get_clean_app_id(app_id),
                        "trending": _calculate_trending_score(
                            installs_over_days=values,
                            quality_passed_ratio=_calculate_quality_passed_ratio(
                                quality.get(app_id)
                            ),
                            icon_quality_bonus=icon_count.get(app_id, 0),
                            is_eol=eol.get(app_id, False),
                            icons_passed=icon_status.get(app_id, False),
                        ),
                    }
                )
            if app_id in frontend and app_id in monthly_ids:
                installs.append(
                    {
                        "id": utils.get_clean_app_id(app_id),
                        "installs_last_month": item["installs_last_month"],
                    }
                )
            sqldb.execute(
                text(
                    "UPDATE apps SET installs_last_7_days = :count WHERE app_id = :app_id AND installs_last_7_days IS DISTINCT FROM :count"
                ),
                {"count": item["installs_last_7_days"], "app_id": app_id},
            )
            published[app_id] = rebased.get(app_id, item)
        models.AppStats.bulk_set_stats(sqldb, published)
    _put_global(sqldb, _global_data(sqldb, len(frontend)))
    sqldb.commit()
    search.create_or_update_apps(trending)
    search.create_or_update_apps(installs)
    favorites = models.UserFavoriteApp.get_favorites_count_per_app(sqldb)
    favorites_list = [
        {"id": utils.get_clean_app_id(app_id), "favorites_count": favorites[app_id]}
        for app_id in frontend
        if favorites.get(app_id, 0) > 0
    ]
    if favorites_list:
        search.create_or_update_apps(favorites_list)
    _generate_and_store_year_in_review_stats(sqldb)


class _IncompleteYearStats(Exception):
    """A required daily source is unavailable; retry without publishing."""


def _year_in_review_is_finalized(data: dict[str, JSONValue], year: int) -> bool:
    # Legacy rows have no coverage guarantee and must be rebuilt once.
    snapshot = data.get("_snapshot")
    return (
        isinstance(snapshot, dict)
        and snapshot.get("version") == 1
        and snapshot.get("through") == datetime.date(year, 12, 31).isoformat()
    )


def _generate_and_store_year_in_review_stats(sqldb):
    current_year = utils.utcnow().year
    first_year = FIRST_STATS_DATE.year

    for year in range(first_year, current_year + 1):
        if year < current_year:
            existing = models.YearInReviewStats.get_for_year(sqldb, year)
            if existing and _year_in_review_is_finalized(existing.data, year):
                continue

        try:
            base_stats = asyncio.run(_build_year_in_review_base(year))
        except Exception:
            logger.exception("Failed to build year-in-review stats for %s", year)
            continue

        if base_stats:
            models.YearInReviewStats.set_for_year(sqldb, year, base_stats)


def _normalize_year_date_range(year: int) -> tuple[datetime.date, datetime.date] | None:
    sdate = datetime.date(year, 1, 1)
    edate = datetime.date(year, 12, 31)
    today = utils.utcnow().date()

    # Match the stable daily horizon used by the statistics aggregates. In
    # particular, December 31 cannot finalize the year until January 2 UTC.
    edate = min(edate, today - datetime.timedelta(days=2))
    sdate = max(sdate, FIRST_STATS_DATE)
    if sdate > edate:
        return None

    return (sdate, edate)


def _require_complete_year(sdate: datetime.date, edate: datetime.date) -> None:
    known = stats_db.known_dates(sdate, edate)
    for offset in range((edate - sdate).days + 1):
        date = sdate + datetime.timedelta(days=offset)
        if date not in known and date != datetime.date(2018, 6, 19):
            raise _IncompleteYearStats(f"Missing year-in-review daily stats for {date}")
    with stats_get_db("writer") as sqldb:
        stale = sqldb.execute(
            text("""
            SELECT date FROM stats_daily
            WHERE date BETWEEN :start AND :end
              AND fetched_at < (date + 2)::timestamp AT TIME ZONE 'UTC'
            ORDER BY date LIMIT 1
        """),
            {"start": sdate, "end": edate},
        ).scalar_one_or_none()
    if stale is not None:
        raise _IncompleteYearStats(f"Unstable year-in-review daily stats for {stale}")


def _annual_data(sdate: datetime.date, edate: datetime.date):
    _require_complete_year(sdate, edate)
    apps, arches, countries = defaultdict(int), defaultdict(int), defaultdict(int)
    with stats_get_db("writer") as sqldb:
        rows = sqldb.execute(
            text("""
            SELECT split_part(ref, '/', 1), architecture, sum(downloads - updates)
            FROM stats_daily_ref WHERE date BETWEEN :start AND :end AND downloads > updates
            GROUP BY split_part(ref, '/', 1), architecture
        """),
            {"start": sdate, "end": edate},
        ).yield_per(1000)
        for app_id, arch, count in rows:
            count = int(count)
            apps[app_id] += count
            arches[arch] += count
        updates = sqldb.execute(
            text("""
            SELECT coalesce(sum((data->>'updates')::bigint), 0) FROM stats_daily
            WHERE date BETWEEN :start AND :end
        """),
            {"start": sdate, "end": edate},
        ).scalar_one()
        for start, end in _date_windows(sdate, edate):
            rows = sqldb.execute(
                text("""
                SELECT country.key, sum(greatest((country.value->>0)::bigint - (country.value->>1)::bigint, 0))
                FROM stats_daily d
                CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(d.data->'ref_by_country') = 'object' THEN d.data->'ref_by_country' ELSE '{}'::jsonb END) refs
                CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(refs.value) = 'object' THEN refs.value ELSE '{}'::jsonb END) country
                WHERE d.date BETWEEN :start AND :end GROUP BY country.key
            """),
                {"start": start, "end": end},
            ).yield_per(1000)
            for country, count in rows:
                countries[country] += int(count or 0)
    return dict(apps), dict(arches), dict(countries), int(updates)


def _first_seen():
    with stats_get_db("writer") as sqldb:
        return {
            app_id: date
            for app_id, date in sqldb.execute(
                text(
                    "SELECT split_part(ref, '/', 1), min(date) FROM stats_daily_ref "
                    "WHERE date <= :stable GROUP BY split_part(ref, '/', 1)"
                ),
                {"stable": utils.utcnow().date() - datetime.timedelta(days=2)},
            )
        }


def _get_country_downloads_for_year(year: int) -> dict[str, int]:
    date_range = _normalize_year_date_range(year)
    return _annual_data(*date_range)[2] if date_range else {}


def _get_basic_year_stats(year: int) -> dict[str, int] | None:
    date_range = _normalize_year_date_range(year)
    if not date_range:
        return None
    sdate, edate = date_range
    apps, _, _, updates = _annual_data(sdate, edate)
    with database.get_db() as sqldb:
        count = (
            sqldb.query(models.App)
            .filter(
                models.App.type == "desktop-application",
                models.App.initial_release_at >= sdate,
                models.App.initial_release_at <= edate,
            )
            .count()
        )
    return {
        "total_downloads": sum(apps.values()),
        "new_apps_count": count,
        "updates_count": updates,
    }


def _get_category_downloads_for_year(year: int) -> dict[str, int]:
    app_downloads = _get_app_downloads_for_year(year)
    result = defaultdict(int)
    with database.get_db() as sqldb:
        rows = (
            sqldb.query(models.App.app_id, models.App.main_category)
            .filter(
                models.App.type == "desktop-application",
                models.App.app_id.in_(app_downloads),
            )
            .all()
        )
        for app_id, category in rows:
            if category:
                result[category.lower()] += app_downloads[app_id]
    return dict(result)


def _get_app_downloads_for_year(year: int) -> dict[str, int]:
    date_range = _normalize_year_date_range(year)
    return _annual_data(*date_range)[0] if date_range else {}


def _load_year_in_review_base(year: int) -> dict[str, JSONValue] | None:
    with database.get_db() as sqldb:
        stored_stats = models.YearInReviewStats.get_for_year(sqldb, year)
        if stored_stats:
            return stored_stats.data
    return None


def _save_year_in_review_base(year: int, base_data: dict[str, JSONValue]) -> None:
    with database.get_db("writer") as sqldb:
        models.YearInReviewStats.set_for_year(sqldb, year, base_data)


def _build_base_top_list(
    app_ids: list[str], downloads_dict: dict[str, int]
) -> list[dict[str, str | int]]:
    return [
        {
            "app_id": app_id,
            "downloads": downloads_dict.get(app_id, 0),
        }
        for app_id in app_ids
    ]


async def _build_year_in_review_base(year: int) -> dict[str, JSONValue] | None:
    date_range = _normalize_year_date_range(year)
    if date_range is None:
        return None
    sdate, edate = date_range

    (
        app_downloads,
        arch_downloads,
        country_downloads,
        total_updates,
    ) = await asyncio.to_thread(_annual_data, sdate, edate)
    country_downloads = {
        country: count for country, count in country_downloads.items() if count > 0
    }
    total_downloads = sum(app_downloads.values())

    loop = asyncio.get_running_loop()

    def _categorize_gaming_app(
        app, gaming_app_ids, emulator_app_ids, game_store_app_ids, game_utility_app_ids
    ):
        app_subcategories = {s.lower() for s in (app.sub_categories or [])}

        if "emulator" in app_subcategories:
            emulator_app_ids.add(app.app_id)
        elif app_subcategories & {"launcherstore", "packagemanager"}:
            game_store_app_ids.add(app.app_id)
        elif app_subcategories & {"utility", "network", "gametool"}:
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
    for app_id in ("net.lutris.Lutris",):
        if app_id in desktop_app_ids:
            game_store_app_ids.add(app_id)
            gaming_app_ids.discard(app_id)
            game_utility_app_ids.discard(app_id)
            emulator_app_ids.discard(app_id)
            non_game_app_ids.discard(app_id)

    for app_id in (
        "org.scummvm.ScummVM",
        "org.prismlauncher.PrismLauncher",
        "com.moonlight_stream.Moonlight",
        "org.polymc.PolyMC",
    ):
        if app_id in desktop_app_ids:
            game_utility_app_ids.add(app_id)
            gaming_app_ids.discard(app_id)
            game_store_app_ids.discard(app_id)
            emulator_app_ids.discard(app_id)
            non_game_app_ids.discard(app_id)

    def _filter_downloads_by_ids(id_set: set[str]) -> dict[str, int]:
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

    def _get_top_app_ids(downloads_dict: dict[str, int], count: int = 3) -> list[str]:
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

    frontend_app_ids, first_seen = await asyncio.gather(
        loop.run_in_executor(None, database.get_all_appids_for_frontend),
        loop.run_in_executor(None, _first_seen),
    )
    new_apps_count = sum(
        1
        for app_id, date in first_seen.items()
        if app_id in frontend_app_ids and sdate <= date <= edate
    )
    total_apps = sum(
        1
        for app_id, date in first_seen.items()
        if app_id in frontend_app_ids and date <= edate
    )

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

    new_apps_downloads = {
        app_id: app_downloads[app_id]
        for app_id, date in first_seen.items()
        if app_id in desktop_app_ids
        and sdate <= date <= edate
        and app_id in app_downloads
    }

    def _get_sort_value(value: int | Mapping[str, int], sort_key: str) -> int:
        if isinstance(value, int):
            return value
        return value.get(sort_key, 0)

    def _build_category_list(
        data_dict: Mapping[str, int | Mapping[str, int]],
        value_key: str,
        sort_key: str,
    ) -> list[dict[str, JSONValue]]:
        category_data: dict[str, dict[str, int | Mapping[str, int]]] = defaultdict(dict)
        for app_id, value in data_dict.items():
            if app_id in app_main_category:
                category_data[app_main_category[app_id]][app_id] = value

        result: list[dict[str, JSONValue]] = []
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

            item: dict[str, JSONValue] = {
                "category": category_enum.value,
                "app_id": top_app_id,
            }

            if isinstance(top_value, Mapping):
                item.update(top_value)
            else:
                item[value_key] = top_value

            result.append(item)

        def sort_value(item: dict[str, JSONValue]) -> int:
            value = item.get(sort_key)
            if isinstance(value, int):
                return value
            if isinstance(value, Mapping):
                nested_value = value.get(sort_key)
                if isinstance(nested_value, int):
                    return nested_value
            return 0

        return sorted(result, key=sort_value, reverse=True)

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
        "_snapshot": {"version": 1, "through": edate.isoformat()},
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

    if not is_json_object(base_result):
        raise TypeError("Year-in-review statistics must be a JSON object")
    return base_result


async def _add_translations_to_year_in_review(
    base_data: dict[str, JSONValue], locale: str
) -> dict[str, JSONValue]:
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
            items = base_data.get(key)
            if isinstance(items, list):
                for item in items:
                    if is_json_object(item):
                        app_id = item.get("app_id")
                        if isinstance(app_id, str):
                            app_ids.add(app_id)
        return app_ids

    def _fetch_translations_for_apps(app_ids: set[str]):
        app_names: dict[str, str] = {}
        app_icons: dict[str, str] = {}
        app_summaries: dict[str, str] = {}

        with database.get_db() as sqldb:
            apps = sqldb.query(models.App).filter(models.App.app_id.in_(app_ids)).all()
            for app in apps:
                translated_appstream = app.get_translated_appstream(locale)
                if translated_appstream:
                    name = translated_appstream.get("name")
                    if isinstance(name, str):
                        app_names[app.app_id] = name
                    icon = translated_appstream.get("icon")
                    if isinstance(icon, str):
                        app_icons[app.app_id] = icon
                    summary = translated_appstream.get("summary")
                    if isinstance(summary, str):
                        app_summaries[app.app_id] = summary

        return app_names, app_icons, app_summaries

    app_names, app_icons, app_summaries = await loop.run_in_executor(
        None, _fetch_translations_for_apps, _collect_app_ids()
    )

    def _apply_translations(
        items: list[dict[str, JSONValue]],
    ) -> list[JSONValue]:
        translated_items: list[JSONValue] = []
        for item in items:
            app_id = item["app_id"]
            if not isinstance(app_id, str):
                continue
            # Historical apps may no longer have metadata. Keep the API's string
            # contract; the frontend omits empty icons and summaries.
            translated_items.append(
                {
                    **item,
                    "name": app_names.get(app_id) or app_id,
                    "icon": app_icons.get(app_id, ""),
                    "summary": app_summaries.get(app_id, ""),
                }
            )
        return translated_items

    def _get_items(key: str) -> list[dict[str, JSONValue]]:
        value = base_data.get(key)
        if not isinstance(value, list):
            return []
        return [item for item in value if is_json_object(item)]

    result = copy.deepcopy(base_data)
    result.pop("_snapshot", None)
    result["top_apps"] = _apply_translations(_get_items("top_apps"))
    result["top_games"] = _apply_translations(_get_items("top_games"))
    result["top_emulators"] = _apply_translations(_get_items("top_emulators"))
    result["top_game_stores"] = _apply_translations(_get_items("top_game_stores"))
    result["top_game_utilities"] = _apply_translations(_get_items("top_game_utilities"))
    result["popular_apps_by_category"] = _apply_translations(
        _get_items("popular_apps_by_category")
    )
    result["biggest_growth_by_category"] = _apply_translations(
        _get_items("biggest_growth_by_category")
    )
    result["newcomers_by_category"] = _apply_translations(
        _get_items("newcomers_by_category")
    )
    result["most_improved_by_category"] = _apply_translations(
        _get_items("most_improved_by_category")
    )
    result["hidden_gems"] = _apply_translations(_get_items("hidden_gems"))

    return result


async def get_year_stats(year: int, locale: str = "en"):
    base_data = _load_year_in_review_base(year)

    if base_data is None or (
        year < utils.utcnow().year and not _year_in_review_is_finalized(base_data, year)
    ):
        try:
            base_data = await _build_year_in_review_base(year)
        except _IncompleteYearStats:
            logger.warning("Incomplete year-in-review stats for %s; retry later", year)
            return None
        if base_data:
            try:
                _save_year_in_review_base(year, base_data)
            except Exception:
                logger.exception("Failed to save year-in-review stats for %s", year)

    if base_data is None:
        return None

    return await _add_translations_to_year_in_review(base_data, locale)
