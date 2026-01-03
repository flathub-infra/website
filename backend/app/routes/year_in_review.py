import datetime

from fastapi import APIRouter, FastAPI, HTTPException, Path, Response
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from .. import cache, stats

router = APIRouter(
    prefix="/year-in-review",
    tags=["year-in-review"],
    default_response_class=ORJSONResponse,
)


def register_to_app(app: FastAPI):
    app.include_router(router)


class YearInReviewMostPopularApp(BaseModel):
    app_id: str
    name: str
    icon: str
    summary: str
    downloads: int


class YearInReviewCategoryApp(BaseModel):
    category: str
    app_id: str
    name: str
    icon: str
    summary: str
    downloads: int


class YearInReviewCategoryGrowthApp(BaseModel):
    category: str
    app_id: str
    name: str
    icon: str
    summary: str
    growth: int
    growth_percentage: int


class YearInReviewCountry(BaseModel):
    country_code: str
    downloads: int


class YearInReviewCountryGrowth(BaseModel):
    country_code: str
    downloads: int
    previous_year_downloads: int
    growth: int
    growth_percentage: int


class YearInReviewGeographicStats(BaseModel):
    top_countries: list[YearInReviewCountry] = []
    total_countries: int = 0
    fastest_growing_regions: list[YearInReviewCountryGrowth] = []


class HiddenGem(BaseModel):
    app_id: str
    name: str
    icon: str
    summary: str
    downloads: int


class TrendingCategory(BaseModel):
    category: str
    current_year_downloads: int
    previous_year_downloads: int
    growth: int
    growth_percentage: float


class PlatformStats(BaseModel):
    architecture: str
    downloads: int
    percentage: float


class YearInReviewResult(BaseModel):
    year: int
    total_downloads: int
    new_apps_count: int
    total_apps: int
    updates_count: int
    total_downloads_change: int
    total_downloads_change_percentage: float
    top_apps: list[YearInReviewMostPopularApp]
    top_games: list[YearInReviewMostPopularApp]
    top_emulators: list[YearInReviewMostPopularApp]
    top_game_stores: list[YearInReviewMostPopularApp]
    top_game_utilities: list[YearInReviewMostPopularApp]
    popular_apps_by_category: list[YearInReviewCategoryApp]
    biggest_growth_by_category: list[YearInReviewCategoryGrowthApp]
    newcomers_by_category: list[YearInReviewCategoryApp]
    most_improved_by_category: list[YearInReviewCategoryGrowthApp]
    geographic_stats: YearInReviewGeographicStats | None = None
    hidden_gems: list[HiddenGem] = []
    trending_categories: list[TrendingCategory] = []
    platform_stats: list[PlatformStats] = []


@router.get(
    "/{year}",
    status_code=200,
    responses={
        200: {"description": "Year in review statistics"},
        404: {"description": "Year statistics not available"},
    },
)
@cache.cached(ttl=86400)  # 1 day cache
async def get_year_in_review(
    response: Response,
    year: int = Path(
        ge=2018,
        examples=[2025],
        description="Year to get statistics for",
    ),
    locale: str = "en",
) -> YearInReviewResult:
    now = datetime.datetime.now()
    current_year = now.year
    current_month = now.month
    current_day = now.day

    is_late_december = current_month == 12 and current_day >= 15
    max_year = current_year if is_late_december else current_year - 1

    if year > max_year:
        raise HTTPException(
            status_code=422, detail=f"Year must be between 2018 and {max_year}"
        )

    if value := await stats.get_year_stats(year, locale):
        return value

    raise HTTPException(status_code=404, detail="Year statistics not available")
