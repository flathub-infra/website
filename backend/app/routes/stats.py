import datetime
from typing import Any

from fastapi import APIRouter, FastAPI, HTTPException, Path, Response
from pydantic import BaseModel

from .. import cache, database, models, permission_stats, stats

router = APIRouter(
    prefix="/stats",
    tags=["stats"],
)


def register_to_app(app: FastAPI):
    app.include_router(router)


class StatsResultCategoryTotalsSubCategories(BaseModel):
    sub_category: str
    count: int


class StatsResultCategoryTotals(BaseModel):
    category: str
    count: int


class StatsResult(BaseModel):
    totals: dict[str, int]
    countries: dict[str, int]
    downloads_per_day: dict[str, int]
    updates_per_day: dict[str, int]
    delta_downloads_per_day: dict[str, int]
    category_totals: list[StatsResultCategoryTotals]
    os_versions: dict[str, int]
    flatpak_versions: dict[str, int]
    os_flatpak_versions: dict[str, dict[str, int]]


class PermissionStatsSnapshotResult(BaseModel):
    snapshot_date: datetime.date
    eligible_apps: int
    apps_with_stable_metadata: int
    permission_counts: dict[str, Any]


def _normalize_stats_result(value: dict) -> StatsResult:
    if "os_versions" not in value or value["os_versions"] is None:
        value["os_versions"] = {}
    if "flatpak_versions" not in value or value["flatpak_versions"] is None:
        value["flatpak_versions"] = {}
    if "os_flatpak_versions" not in value or value["os_flatpak_versions"] is None:
        value["os_flatpak_versions"] = {}

    return StatsResult.model_validate(value)


class StatsResultApp(BaseModel):
    installs_total: int
    installs_per_day: dict[str, int]
    installs_per_country: dict[str, int]
    installs_last_month: int
    installs_last_7_days: int
    id: str


@router.get(
    "/",
    status_code=200,
    responses={
        200: {"description": "Overall statistics"},
        404: {"description": "Statistics not available"},
    },
)
@cache.cached(ttl=900)
async def get_stats(response: Response) -> StatsResult | None:
    if value := database.get_json_key("stats"):
        if isinstance(value, dict):
            return _normalize_stats_result(value)
        return value

    response.status_code = 404
    return None


@router.get(
    "/permissions",
    status_code=200,
    response_model=list[PermissionStatsSnapshotResult],
    responses={200: {"description": "Daily application permission statistics"}},
)
@cache.cached(ttl=900)
async def get_permission_stats(
    start_date: datetime.date | None = None,
    end_date: datetime.date | None = None,
) -> list[dict[str, Any]]:
    try:
        permission_stats.validate_date_range(start_date, end_date)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    with database.get_db() as sqldb:
        snapshots = models.PermissionStatsSnapshot.get_range(
            sqldb, start_date=start_date, end_date=end_date
        )

    return [
        PermissionStatsSnapshotResult(
            snapshot_date=snapshot.snapshot_date,
            eligible_apps=snapshot.eligible_apps,
            apps_with_stable_metadata=snapshot.apps_with_stable_metadata,
            permission_counts=snapshot.permission_counts,
        ).model_dump(mode="json")
        for snapshot in snapshots
    ]


@router.get(
    "/{app_id}",
    status_code=200,
    responses={
        200: {"description": "Statistics for specific app"},
        404: {"description": "App statistics not found"},
    },
)
@cache.cached(ttl=900)
async def get_stats_for_app(
    response: Response,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    all: bool = False,
    days: int = 180,
) -> StatsResultApp | None:
    if value := stats.get_installs_by_ids([app_id]).get(app_id, None):
        if all:
            return value

        if per_day := value.get("installs_per_day"):
            requested_dates = list(per_day.keys())[-days:]
            requested_per_day = {date: per_day[date] for date in requested_dates}
            value["installs_per_day"] = requested_per_day
            return value

    response.status_code = 404
    return None
