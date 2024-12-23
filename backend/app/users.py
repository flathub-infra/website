from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import ORJSONResponse
from fastapi_sqlalchemy import db as sqldb

from . import models
from .login_info import moderator_only

router = APIRouter(prefix="/users", default_response_class=ORJSONResponse)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get(
    "",
    tags=["users"],
)
def users(
    page: int = 1,
    page_size: int = 30,
    filterString: str | None = None,
    _moderator=Depends(moderator_only),
) -> models.FlathubUsersResult:
    """
    Return a list of all known users
    """
    return models.FlathubUser.all(sqldb, page, page_size, filterString)


@router.get(
    "/{user_id}",
    tags=["users"],
)
def user(user_id: int, _moderator=Depends(moderator_only)) -> models.UserResult:
    """
    Return the current user
    """
    user = models.FlathubUser.by_id_result(sqldb, user_id)

    if user is None:
        raise HTTPException(status_code=404, detail="user not found")

    return user
