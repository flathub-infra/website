from fastapi import APIRouter, FastAPI, Path, Response
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from .. import database, stats

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
    countries: dict[str, stats.CountryData]
    downloads_per_day: dict[str, int]
    updates_per_day: dict[str, int]
    delta_downloads_per_day: dict[str, int]
    category_totals: list[StatsResultCategoryTotals]


@router.get("/", status_code=200)
def get_stats(response: Response) -> StatsResult | None:
    if value := database.get_json_key("stats"):
        return value

    response.status_code = 404
    return None


@router.get("/{app_id}", status_code=200)
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
):
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
