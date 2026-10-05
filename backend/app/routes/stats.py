import datetime
from enum import IntEnum

from fastapi import APIRouter, FastAPI, Path, Response
from pydantic import BaseModel

from .. import cache, database, models, stats, utils

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
    permission_counts: dict[str, dict[str, dict[str, int]]]


class PermissionStatsWindowResult(BaseModel):
    start_month: str
    end_month: str
    snapshots: list[PermissionStatsSnapshotResult]


class PermissionStatsMonths(IntEnum):
    six = 6
    twelve = 12


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
    response_model=PermissionStatsWindowResult,
    responses={
        200: {"description": "Latest application permission snapshot per month"}
    },
)
@cache.cached(ttl=900)
async def get_permission_stats(
    months: PermissionStatsMonths = PermissionStatsMonths.six,
) -> PermissionStatsWindowResult:
    end_date = utils.utcnow().date()
    month_index = end_date.year * 12 + end_date.month - months
    start_date = datetime.date(month_index // 12, month_index % 12 + 1, 1)

    with database.get_db() as sqldb:
        snapshots = models.PermissionStatsSnapshot.get_monthly(
            sqldb, start_date=start_date, end_date=end_date
        )

    return PermissionStatsWindowResult(
        start_month=start_date.strftime("%Y-%m"),
        end_month=end_date.strftime("%Y-%m"),
        snapshots=[
            PermissionStatsSnapshotResult(
                snapshot_date=snapshot.snapshot_date,
                eligible_apps=snapshot.eligible_apps,
                apps_with_stable_metadata=snapshot.apps_with_stable_metadata,
                permission_counts=snapshot.permission_counts,
            )
            for snapshot in snapshots
        ],
    )


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
