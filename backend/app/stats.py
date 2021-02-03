import datetime
import json
from typing import Dict, List, Optional

import requests

from . import config
from . import db


StatsType = Dict[str, Dict[str, List[int]]]
POPULAR_ITEMS_NUM = 30
POPULAR_DAYS_NUM = 7


def get_stats_for_date(date: datetime.date, session: requests.Session) -> Optional[StatsType]:
    stats_json_url = config.settings.stats_baseurl + date.strftime("/%Y/%m/%d.json")
    redis_key = f"stats:date:{date.isoformat()}"
    stats_txt = db.redis_conn.get(redis_key)
    if stats_txt is None:
        response = session.get(stats_json_url)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        stats = response.json()
        if date == datetime.date.today():
            expire = 60*60
        else:
            expire = 24*60*60
        db.redis_conn.set(redis_key, json.dumps(stats), ex=expire)
    else:
        stats = json.loads(stats_txt)
    return stats["refs"]


def get_stats_for_period(sdate: datetime.date, edate: datetime.date) -> StatsType:
    totals: StatsType = {}
    with requests.Session() as session:
        for i in range((edate - sdate).days + 1):
            date = sdate + datetime.timedelta(days=i)
            stats = get_stats_for_date(date, session)
            if stats is None:
                continue
            for app_id, app_stats in stats.items():
                if app_id not in totals:
                    totals[app_id] = {}
                app_totals = totals[app_id]
                for arch, downloads in app_stats.items():
                    if arch not in app_totals:
                        app_totals[arch] = [0, 0]
                    app_totals[arch][0] += downloads[0]
                    app_totals[arch][1] += downloads[1]
    return totals


def _sort_key(app_stats: Dict[str, List[int]], for_arches:  Optional[List[str]] = None) -> int:
    new_dls = 0
    for arch, dls in app_stats.items():
        if for_arches is not None and arch not in for_arches:
            continue
        new_dls += (dls[0] - dls[1])
    return new_dls


def _is_app(app_id: str) -> bool:
    return "/" not in app_id


def get_popular(sdate: Optional[datetime.date], edate: Optional[datetime.date]):
    if sdate is None:
        sdate = datetime.date.today() - datetime.timedelta(days=POPULAR_DAYS_NUM-1)
    if edate is None:
        edate = datetime.date.today()
    stats = get_stats_for_period(sdate, edate)
    sorted_apps = sorted(
        filter(lambda a: _is_app(a[0]), stats.items()),
        key=lambda a: _sort_key(a[1]),
        reverse=True
    )
    return [k for k, v in sorted_apps[:POPULAR_ITEMS_NUM]]
