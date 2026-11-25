import datetime
import logging
from http import HTTPStatus
from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel

from .. import api_models, cache, models
from ..database import get_db
from ..login_info import LoggedInDep, ModifyUsersDep

logger = logging.getLogger(__name__)

router = APIRouter()


def register_to_app(app):
    app.include_router(router)


@router.post(
    "/favorites/{app_id}/add",
    tags=["app"],
    responses={
        200: {"description": "App added to favorites successfully"},
        500: {"description": "Internal server error"},
    },
)
async def add_to_favorites(
    app_id: str,
    login: LoggedInDep,
):
    """
    Add an app to a users favorites. The appid is the ID of the app to add.
    """
    with get_db("writer") as db_session:
        try:
            models.UserFavoriteApp.add_app(db_session, login["user"].id, app_id)
            db_session.commit()

            return Response(status_code=HTTPStatus.OK)
        except Exception:
            db_session.rollback()
            logger.exception("Failed to add app %s to favorites", app_id)
            return Response(status_code=HTTPStatus.INTERNAL_SERVER_ERROR)


@router.delete(
    "/favorites/{app_id}/remove",
    tags=["app"],
    responses={
        200: {"description": "App removed from favorites successfully"},
        500: {"description": "Internal server error"},
    },
)
async def remove_from_favorites(
    app_id: str,
    login: LoggedInDep,
):
    """
    Remove an app from a users favorites. The appid is the ID of the app to remove.
    """
    with get_db("writer") as db_session:
        try:
            models.UserFavoriteApp.remove_app(db_session, login["user"].id, app_id)
            db_session.commit()

            return Response(status_code=HTTPStatus.OK)
        except Exception:
            db_session.rollback()
            logger.exception("Failed to remove app %s from favorites", app_id)
            return Response(status_code=HTTPStatus.INTERNAL_SERVER_ERROR)


class FavoriteApp(BaseModel):
    app_id: str
    created_at: datetime.datetime


class FavoritesCount(BaseModel):
    favorites_count: int


class RecommendedApp(BaseModel):
    id: str
    name: str
    summary: str
    icon: str
    metadata: api_models.Metadata | None = None


@router.get("/favorites/{app_id}/recommendations", tags=["favorite-recommendations"])
@cache.private
def get_favorite_recommendations(
    app_id: str, login: ModifyUsersDep, locale: str = "en"
) -> list[RecommendedApp]:
    with get_db("replica") as db:
        return [
            RecommendedApp.model_validate(row)
            for row in models.UserFavoriteApp.recommended_apps(db, app_id, locale)
        ]


@router.get(
    "/favorites",
    tags=["app"],
    responses={
        200: {"description": "List of user's favorite apps"},
    },
)
@cache.private
def get_favorites(
    login: LoggedInDep,
) -> list[FavoriteApp]:
    """
    Get a list of the users favorite apps.
    """
    with get_db("replica") as db_session:
        return [
            FavoriteApp(app_id=result.app_id, created_at=result.created)
            for result in models.UserFavoriteApp.all_favorited_by_user(
                db_session, login["user"].id
            )
        ]


@router.get(
    "/favorites/{app_id}",
    tags=["app"],
    responses={
        200: {"description": "Whether the app is favorited by the user"},
    },
)
@cache.private
def is_favorited(
    app_id: str,
    login: LoggedInDep,
) -> bool:
    with get_db("writer") as db_session:
        return models.UserFavoriteApp.is_favorited_by_user(
            db_session, login["user"].id, app_id
        )


@router.get(
    "/favorites/{app_id}/count",
    tags=["app"],
    responses={
        200: {"description": "Number of users who favorited the app"},
    },
)
def get_app_favorites_count(
    app_id: str,
    response: Response,
) -> FavoritesCount:
    """
    Get the total number of users who have favorited a specific app.
    """
    response.headers["Cache-Control"] = "public, max-age=0, s-maxage=60"
    return _favorites_count(app_id, "replica")


@router.get("/favorites/{app_id}/count/current", tags=["app"])
@cache.no_store
def get_current_favorites_count(app_id: str, login: LoggedInDep) -> FavoritesCount:
    """Read the committed count after a signed-in user's bookmark changes."""
    return _favorites_count(app_id, "writer")


def _favorites_count(app_id: str, role: Literal["writer", "replica"]) -> FavoritesCount:
    with get_db(role) as db_session:
        count = (
            db_session.query(models.UserFavoriteApp)
            .filter(models.UserFavoriteApp.app_id == app_id)
            .count()
        )
        return FavoritesCount(favorites_count=count)
