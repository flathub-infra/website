from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import ORJSONResponse
from fastapi_sqlalchemy import db as sqldb

from . import models
from .login_info import moderator_only, modify_users_only, view_users_only

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
    "/roles",
    tags=["users"],
)
def roles(_admin=Depends(view_users_only)) -> list[str]:
    """
    Return a list of all known role names
    """
    return [role.name for role in models.Role.all(sqldb)]


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


@router.post(
    "/{user_id}/role",
    tags=["users"],
)
def add_user_role(
    user_id: int, role: models.RoleName, _admin=Depends(modify_users_only)
) -> models.UserResult:
    """
    Add a role to a user
    """
    user = models.FlathubUser.by_id(sqldb, user_id)

    if user is None:
        raise HTTPException(status_code=404, detail="user not found")

    user.add_role(sqldb, role)

    return user.to_result(sqldb)


@router.delete(
    "/{user_id}/role",
    tags=["users"],
)
def delete_user_role(
    user_id: int, role: models.RoleName, _admin=Depends(modify_users_only)
) -> models.UserResult:
    """
    Remove a role from a user
    """
    user = models.FlathubUser.by_id(sqldb, user_id)

    if user is None:
        raise HTTPException(status_code=404, detail="user not found")

    user.remove_role(sqldb, role)

    return user.to_result(sqldb)


@router.get(
    "/roles/{role_name}",
    tags=["users"],
)
def role_users(
    role_name: models.RoleName, _admin=Depends(view_users_only)
) -> list[models.UserResult]:
    """
    Return all users with a specific role
    """
    return [
        user.to_result(sqldb) for user in models.Role.by_name_users(sqldb, role_name)
    ]
