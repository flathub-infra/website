import datetime

from fastapi import APIRouter, FastAPI, Path, Query, Response
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from .. import database, models, stats

router = APIRouter(
    prefix="/stats",
    tags=["stats"],
    default_response_class=ORJSONResponse,
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


class MonthlyPermissionStatsResult(BaseModel):
    app_id: str
    month: str
    permission: str
    # usage_count removed
    permission_value: object | None = None
    created_at: datetime.datetime


# Endpoint: /stats/permissions?month=YYYY-MM&app_id=...&permission=...
@router.get(
    "/permissions",
    status_code=200,
    response_model=list[MonthlyPermissionStatsResult],
    responses={
        200: {"description": "Monthly permission statistics"},
    },
)
def get_monthly_permission_stats(
    month: str = Query(None, description="Month in YYYY-MM format"),
    app_id: str = Query(None, description="App ID to filter"),
    permission: str = Query(None, description="Permission to filter"),
):
    with database.get_db() as db:
        query = db.query(models.MonthlyPermissionStats)
        if month:
            query = query.filter(models.MonthlyPermissionStats.month == month)
        if app_id:
            query = query.filter(models.MonthlyPermissionStats.app_id == app_id)
        if permission:
            query = query.filter(models.MonthlyPermissionStats.permission == permission)
        results = query.all()
        return [
            MonthlyPermissionStatsResult(
                app_id=r.app_id,
                month=r.month,
                permission=r.permission,
                permission_value=r.permission_value,
                created_at=r.created_at,
            )
            for r in results
        ]


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
def get_stats(response: Response) -> StatsResult | None:
    if value := database.get_json_key("stats"):
        return value

    response.status_code = 404
    return None


@router.get(
    "/{app_id}",
    status_code=200,
    responses={
        200: {"description": "Statistics for specific app"},
        404: {"description": "App statistics not found"},
    },
)
def get_stats_for_app(
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
