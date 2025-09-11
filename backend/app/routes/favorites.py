import datetime
from http import HTTPStatus

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from .. import models
from ..database import get_db
from ..login_info import logged_in

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
def add_to_favorites(
    app_id: str,
    login=Depends(logged_in),
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
            return Response(status_code=HTTPStatus.INTERNAL_SERVER_ERROR)


@router.delete(
    "/favorites/{app_id}/remove",
    tags=["app"],
    responses={
        200: {"description": "App removed from favorites successfully"},
        500: {"description": "Internal server error"},
    },
)
def remove_from_favorites(
    app_id: str,
    login=Depends(logged_in),
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
def get_favorites(
    login=Depends(logged_in),
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
def is_favorited(
    app_id: str,
    login=Depends(logged_in),
) -> bool:
    with get_db("replica") as db_session:
        return models.UserFavoriteApp.is_favorited_by_user(
            db_session, login["user"].id, app_id
        )
