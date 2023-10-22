import datetime

from fastapi import APIRouter, Depends, FastAPI, Path
from fastapi.responses import ORJSONResponse
from fastapi_sqlalchemy import db
from pydantic import BaseModel

from . import models
from .login_info import quality_moderator_only

router = APIRouter(prefix="/app-picks", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


class AppOfTheDay(BaseModel):
    app_id: str


@router.get("/app-of-the-day/{date}", tags=["app-picks"])
def get_app_of_the_day(
    date: datetime.date = Path(
        examples=[
            "2021-01-01",
            "2023-10-21",
        ],
    ),
) -> AppOfTheDay:
    app_of_the_day = models.AppOfTheDay.by_date(db, date)

    if app_of_the_day is None:
        return AppOfTheDay(app_id="org.gnome.Totem")

    return AppOfTheDay(app_id=app_of_the_day.app_id)


class AppOfTheWeek(BaseModel):
    app_id: str
    position: int


class AppsOfTheWeek(BaseModel):
    apps: list[AppOfTheWeek]


@router.get("/apps-of-the-week/{date}", tags=["app-picks"])
def get_app_of_the_week(
    date: datetime.date = Path(
        examples=[
            "2021-01-01",
            "2023-10-21",
        ],
    ),
) -> AppsOfTheWeek:
    """Returns apps of the week"""
    apps_of_the_week = models.AppsOfTheWeek.by_week(
        db, date.isocalendar().week, date.year
    )

    return AppsOfTheWeek(
        apps=[
            AppOfTheWeek(app_id=app.app_id, position=app.position)
            for app in apps_of_the_week
        ]
    )


class UpsertAppOfTheWeek(BaseModel):
    app_id: str
    weekNumber: int
    year: int
    position: int


@router.post("/app-of-the-week", tags=["app-picks"])
def set_app_of_the_week(
    body: UpsertAppOfTheWeek,
    moderator=Depends(quality_moderator_only),
):
    """Sets an app of the week"""
    models.AppsOfTheWeek.upsert(
        db, body.app_id, body.weekNumber, body.year, body.position, moderator.user.id
    )
