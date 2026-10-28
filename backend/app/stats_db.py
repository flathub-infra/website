import datetime

from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert

from . import models
from .database import get_db
from .types import JSONObject

_REF_INSERT = text("""
    INSERT INTO stats_daily_ref (date, ref, architecture, downloads, updates)
    SELECT daily.date, refs.key, arches.key,
           (arches.value ->> 0)::bigint, (arches.value ->> 1)::bigint
    FROM stats_daily AS daily
    CROSS JOIN LATERAL jsonb_each(
        COALESCE(NULLIF(daily.data -> 'refs', 'null'::jsonb), '{}'::jsonb)
    ) AS refs
    CROSS JOIN LATERAL jsonb_each(refs.value) AS arches
    WHERE daily.date = :date
""")


def load_day(date: datetime.date) -> tuple[JSONObject, datetime.datetime] | None:
    with get_db("writer") as db:
        row = db.get(models.StatsDaily, date)
        if row is None:
            return None
        return row.data, row.fetched_at


def _replace_refs(db, date: datetime.date) -> None:
    db.execute(delete(models.StatsDailyRef).where(models.StatsDailyRef.date == date))
    db.execute(_REF_INSERT, {"date": date})


def save_day(
    date: datetime.date, payload: JSONObject, fetched_at: datetime.datetime
) -> None:
    if fetched_at.utcoffset() is None:
        raise ValueError("fetched_at must be timezone-aware")
    with get_db("writer") as db:
        stmt = insert(models.StatsDaily).values(
            date=date, data=payload, fetched_at=fetched_at
        )
        db.execute(
            stmt.on_conflict_do_update(
                index_elements=[models.StatsDaily.date],
                set_={
                    "data": stmt.excluded.data,
                    "fetched_at": stmt.excluded.fetched_at,
                },
            )
        )
        _replace_refs(db, date)


def known_dates(start: datetime.date, end: datetime.date) -> set[datetime.date]:
    with get_db("writer") as db:
        return set(
            db.scalars(
                select(models.StatsDaily.date).where(
                    models.StatsDaily.date >= start, models.StatsDaily.date <= end
                )
            )
        )


def stale_dates(start: datetime.date, end: datetime.date) -> set[datetime.date]:
    with get_db("writer") as db:
        return set(
            db.scalars(
                text("""
                SELECT date FROM stats_daily
                WHERE date BETWEEN :start AND :end
                  AND fetched_at < (date + 2)::timestamp AT TIME ZONE 'UTC'
            """),
                {"start": start, "end": end},
            )
        )


def rebuild_refs() -> None:
    with get_db("writer") as db:
        dates = list(
            db.scalars(select(models.StatsDaily.date).order_by(models.StatsDaily.date))
        )
    for date in dates:
        with get_db("writer") as db:
            row = db.execute(
                select(models.StatsDaily.date)
                .where(models.StatsDaily.date == date)
                .with_for_update()
            ).scalar_one_or_none()
            if row is not None:
                _replace_refs(db, date)
