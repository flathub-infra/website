import datetime
import json
from collections import defaultdict
from typing import Dict, List, Optional
from urllib.parse import urlparse, urlunparse

import requests

from . import config, db

StatsType = Dict[str, Dict[str, List[int]]]
POPULAR_DAYS_NUM = 7

FIRST_STATS_DATE = datetime.date(2018, 4, 29)


def _get_stats_for_date(date: datetime.date, session: requests.Session):
    stats_json_url = urlparse(
        config.settings.stats_baseurl + date.strftime("/%Y/%m/%d.json")
    )
    if stats_json_url.scheme == "file":
        try:
            with open(stats_json_url.path, "r") as stats_file:
                stats = json.load(stats_file)
        except FileNotFoundError:
            return None
        return stats
    redis_key = f"stats:date:{date.isoformat()}"
    stats_txt = db.redis_conn.get(redis_key)
    if stats_txt is None:
        response = session.get(urlunparse(stats_json_url))
        if response.status_code == 404:
            return None
        response.raise_for_status()
        stats = response.json()
        if date == datetime.date.today():
            expire = 60 * 60
        else:
            expire = 24 * 60 * 60
        db.redis_conn.set(redis_key, json.dumps(stats), ex=expire)
    else:
        stats = json.loads(stats_txt)
    return stats


def _get_stats_for_period(sdate: datetime.date, edate: datetime.date):
    totals: StatsType = {}
    with requests.Session() as session:
        for i in range((edate - sdate).days + 1):
            date = sdate + datetime.timedelta(days=i)
            stats = _get_stats_for_date(date, session)

            if stats is None or "refs" not in stats or stats["refs"] is None:
                continue
            for app_id, app_stats in stats["refs"].items():
                if app_id not in totals:
                    totals[app_id] = {}
                app_totals = totals[app_id]
                for arch, downloads in app_stats.items():
                    if arch not in app_totals:
                        app_totals[arch] = [0, 0]
                    app_totals[arch][0] += downloads[0]
                    app_totals[arch][1] += downloads[1]
    return totals


def _get_app_stats_per_day() -> Dict[str, Dict[str, int]]:
    edate = datetime.date.today()
    sdate = FIRST_STATS_DATE

    app_stats_per_day: Dict[str, Dict[str, int]] = {}

    with requests.Session() as session:
        for i in range((edate - sdate).days + 1):
            date = sdate + datetime.timedelta(days=i)
            stats = _get_stats_for_date(date, session)

            if stats is not None and "refs" in stats and stats["refs"] is not None:
                for app_id, app_stats in stats["refs"].items():
                    if _is_app(app_id):
                        if app_id not in app_stats_per_day:
                            app_stats_per_day[app_id] = {}
                        app_stats_per_day[app_id][date.isoformat()] = sum(
                            [i[0] for i in app_stats.values()]
                        )
    return app_stats_per_day


def _get_stats() -> Dict[str, Dict[str, int]]:
    edate = datetime.date.today()
    sdate = FIRST_STATS_DATE

    downloads_per_day: Dict[str, int] = {}
    delta_downloads_per_day: Dict[str, int] = {}
    updates_per_day: Dict[str, int] = {}
    totals_country: Dict[str, int] = {}
    with requests.Session() as session:
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
    return {
        "countries": totals_country,
        "downloads_per_day": downloads_per_day,
        "updates_per_day": updates_per_day,
        "delta_downloads_per_day": delta_downloads_per_day,
        "downloads": sum(downloads_per_day.values()),
        "number_of_apps": db.get_app_count(),
    }


def _sort_key(
    app_stats: Dict[str, List[int]], for_arches: Optional[List[str]] = None
) -> int:
    new_dls = 0
    for arch, dls in app_stats.items():
        if for_arches is not None and arch not in for_arches:
            continue
        new_dls += dls[0] - dls[1]
    return new_dls


def _is_app(app_id: str) -> bool:
    return "/" not in app_id


def get_downloads_by_ids(ids: List[str]):
    result = defaultdict()
    for app_id in ids:
        if not _is_app(app_id):
            continue
        app_stats = db.get_json_key(f"app_stats:{app_id}")
        if app_stats is None:
            continue
        result[app_id] = app_stats
    return result


def get_popular(days: Optional[int]):
    edate = datetime.date.today()

    if days is None:
        sdate = FIRST_STATS_DATE
    else:
        sdate = edate - datetime.timedelta(days=days - 1)

    redis_key = f"popular:{sdate}-{edate}"

    if popular := db.get_json_key(redis_key):
        return popular

    stats = _get_stats_for_period(sdate, edate)
    sorted_apps = sorted(
        filter(lambda a: _is_app(a[0]), stats.items()),
        key=lambda a: _sort_key(a[1]),
        reverse=True,
    )

    popular = [k for k, v in sorted_apps]
    db.redis_conn.set(redis_key, json.dumps(popular), ex=60 * 60)
    return popular


def update():
    stats_apps_dict = defaultdict(lambda: {})

    edate = datetime.date.today()
    sdate = datetime.date(2018, 4, 29)

    stats_total = _get_stats_for_period(sdate, edate)
    stats_dict = _get_stats()

    app_stats_per_day = _get_app_stats_per_day()

    for appid, dict in stats_total.items():
        if _is_app(appid):
            # Index 0 is install and update count index 1 would be the update count
            stats_apps_dict[appid]["downloads_total"] = sum(
                [i[0] for i in dict.values()]
            )
            stats_apps_dict[appid]["downloads_per_day"] = app_stats_per_day[appid]

    sdate_30_days = edate - datetime.timedelta(days=30 - 1)
    stats_30_days = _get_stats_for_period(sdate_30_days, edate)

    for appid, dict in stats_30_days.items():
        if _is_app(appid):
            # Index 0 is install and update count index 1 would be the update count
            stats_apps_dict[appid]["downloads_last_month"] = sum(
                [i[0] for i in dict.values()]
            )

    sdate_7_days = edate - datetime.timedelta(days=7 - 1)
    stats_7_days = _get_stats_for_period(sdate_7_days, edate)

    for appid, dict in stats_7_days.items():
        if _is_app(appid):
            # Index 0 is install and update count index 1 would be the update count
            stats_apps_dict[appid]["downloads_last_7_days"] = sum(
                [i[0] for i in dict.values()]
            )

    db.redis_conn.set("stats", json.dumps(stats_dict))
    db.redis_conn.mset(
        {
            f"app_stats:{appid}": json.dumps(stats_apps_dict[appid])
            for appid in stats_apps_dict
        }
    )
