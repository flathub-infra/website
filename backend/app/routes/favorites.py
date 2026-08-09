import datetime
import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from .. import cache, models
from ..database import get_db
from ..login_info import logged_in

_logged_in_dependency = Depends(logged_in)
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
    login=_logged_in_dependency,
):
    """
    Add an app to a users favorites. The appid is the ID of the app to add.
    """
    with get_db("writer") as db_session:
        try:
            models.UserFavoriteApp.add_app(db_session, login["user"].id, app_id)
            db_session.commit()

            # Invalidate the favorites count cache for this app
            await cache.invalidate_cache_by_pattern(
                f"cache:endpoint:get_app_favorites_count:*{app_id}*"
            )

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
    login=_logged_in_dependency,
):
    """
    Remove an app from a users favorites. The appid is the ID of the app to remove.
    """
    with get_db("writer") as db_session:
        try:
            models.UserFavoriteApp.remove_app(db_session, login["user"].id, app_id)
            db_session.commit()

            # Invalidate the favorites count cache for this app
            await cache.invalidate_cache_by_pattern(
                f"cache:endpoint:get_app_favorites_count:*{app_id}*"
            )

            return Response(status_code=HTTPStatus.OK)
        except Exception:
            db_session.rollback()
            logger.exception("Failed to remove app %s from favorites", app_id)
            return Response(status_code=HTTPStatus.INTERNAL_SERVER_ERROR)


class FavoriteApp(BaseModel):
    app_id: str
    created_at: datetime.datetime


@router.get(
    "/favorites",
    tags=["app"],
    responses={
        200: {"description": "List of user's favorite apps"},
    },
)
@cache.private
def get_favorites(
    login=_logged_in_dependency,
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
    login=_logged_in_dependency,
) -> bool:
    with get_db("replica") as db_session:
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
@cache.cached(ttl=3600)
async def get_app_favorites_count(
    app_id: str,
) -> dict:
    """
    Get the total number of users who have favorited a specific app.
    """
    with get_db("replica") as db_session:
        count = (
            db_session.query(models.UserFavoriteApp)
            .filter(models.UserFavoriteApp.app_id == app_id)
            .count()
        )
        return {"favorites_count": count}
