from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import ORJSONResponse

from . import models
from .database import get_db
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
    with get_db("replica") as db_session:
        return models.FlathubUser.all(db_session, page, page_size, filterString)


@router.get(
    "/roles",
    tags=["users"],
)
def roles(_admin=Depends(view_users_only)) -> list[str]:
    """
    Return a list of all known role names
    """
    with get_db("replica") as db_session:
        return [role.name for role in models.Role.all(db_session)]


@router.get(
    "/{user_id}",
    tags=["users"],
)
def user(user_id: int, _moderator=Depends(moderator_only)) -> models.UserResult:
    """
    Return the current user
    """
    with get_db("replica") as db_session:
        user = models.FlathubUser.by_id_result(db_session, user_id)

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
    with get_db("writer") as db_session:
        user = models.FlathubUser.by_id(db_session, user_id)

        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        user.add_role(db_session, role)

        return user.to_result(db_session)


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
    with get_db("writer") as db_session:
        user = models.FlathubUser.by_id(db_session, user_id)

        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        user.remove_role(db_session, role)

        return user.to_result(db_session)


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
    with get_db("replica") as db_session:
        return [
            user.to_result(db_session)
            for user in models.Role.by_name_users(db_session, role_name)
        ]
