import datetime

from fastapi import APIRouter, Depends, FastAPI, Path
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from .. import cache, models
from ..database import get_db
from ..login_info import quality_moderator_only

router = APIRouter(prefix="/app-picks", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


class AppOfTheDay(BaseModel):
    app_id: str
    day: datetime.date


@router.get(
    "/app-of-the-day/{date}",
    tags=["app-picks"],
    responses={
        200: {"description": "App of the day"},
        404: {"description": "No app of the day for this date"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
@cache.cached(ttl=21600)
def get_app_of_the_day(
    date: datetime.date = Path(
        examples=[
            "2021-01-01",
            "2023-10-21",
        ],
    ),
) -> AppOfTheDay:
    with get_db("replica") as db:
        app_of_the_day = models.AppOfTheDay.by_date(db, date)

    if app_of_the_day is None:
        return AppOfTheDay(app_id="tv.kodi.Kodi", day=date)

    return AppOfTheDay(app_id=app_of_the_day.app_id, day=date)


class AppOfTheWeek(BaseModel):
    app_id: str
    position: int
    isFullscreen: bool


class AppsOfTheWeek(BaseModel):
    apps: list[AppOfTheWeek]


@router.get(
    "/apps-of-the-week/{date}",
    tags=["app-picks"],
    responses={
        200: {"description": "Apps of the week"},
        404: {"description": "No apps of the week for this date"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
@cache.cached(ttl=21600)
def get_app_of_the_week(
    date: datetime.date = Path(
        examples=[
            "2021-01-01",
            "2023-10-21",
        ],
    ),
) -> AppsOfTheWeek:
    """Returns apps of the week"""
    with get_db("replica") as db:
        apps_of_the_week = models.AppsOfTheWeek.by_week(
            db, date.isocalendar().week, date.year
        )

        return AppsOfTheWeek(
            apps=[
                AppOfTheWeek(
                    app_id=app.app_id,
                    position=app.position,
                    isFullscreen=models.App.get_fullscreen_app(db, app.app_id),
                )
                for app in apps_of_the_week
            ]
        )


class UpsertAppOfTheWeek(BaseModel):
    app_id: str
    weekNumber: int
    year: int
    position: int


@router.post(
    "/app-of-the-week",
    tags=["app-picks"],
    responses={
        200: {"description": "Successfully set app of the week"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def set_app_of_the_week(
    body: UpsertAppOfTheWeek,
    moderator=Depends(quality_moderator_only),
):
    """Sets an app of the week"""
    with get_db("writer") as db:
        models.AppsOfTheWeek.upsert(
            db,
            body.app_id,
            body.weekNumber,
            body.year,
            body.position,
            moderator.user.id,
        )


@router.post(
    "/app-of-the-day",
    tags=["app-picks"],
    responses={
        200: {"description": "Successfully set app of the day"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def set_app_of_the_day(
    body: AppOfTheDay,
    _moderator=Depends(quality_moderator_only),
):
    """Sets an app of the day"""
    with get_db("writer") as db:
        models.AppOfTheDay.set_app_of_the_day(db, body.app_id, body.day)
