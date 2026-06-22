from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response

from . import audit_log, models
from .database import get_db
from .login_info import logged_in, moderator_only, modify_users_only, view_users_only

router = APIRouter(prefix="/users")


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get(
    "/me",
    tags=["users"],
    responses={
        200: {"description": "Currently logged in user's details"},
        401: {"description": "Unauthorized"},
        404: {"description": "User not found"},
        500: {"description": "Internal server error"},
    },
)
def me(response: Response, login=Depends(logged_in)) -> models.UserResult:
    response.headers["Cache-Control"] = "private"

    with get_db("replica") as db_session:
        user = models.FlathubUser.by_id_result(db_session, login.user.id)

        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        return user


@router.get(
    "",
    tags=["users"],
    responses={
        200: {"description": "List of users"},
        400: {"description": "Invalid pagination parameters"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def users(
    response: Response,
    page: int = 1,
    page_size: int = 30,
    filterString: str | None = None,
    _moderator=Depends(moderator_only),
) -> models.FlathubUsersResult:
    """
    Return a list of all known users
    """
    response.headers["Cache-Control"] = "private"
    if page < 1:
        raise HTTPException(
            status_code=400,
        )

    with get_db("replica") as db_session:
        return models.FlathubUser.all(db_session, page, page_size, filterString)


@router.get(
    "/roles",
    tags=["users"],
    responses={
        200: {"description": "List of role names"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - view users permission required"},
        500: {"description": "Internal server error"},
    },
)
def roles(response: Response, _admin=Depends(view_users_only)) -> list[str]:
    """
    Return a list of all known role names
    """
    response.headers["Cache-Control"] = "private"
    with get_db("replica") as db_session:
        return [role.name for role in models.Role.all(db_session)]


@router.get(
    "/{user_id}",
    tags=["users"],
    responses={
        200: {"description": "User details"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - view users permission required"},
        404: {"description": "User not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def user(
    response: Response, user_id: int, _moderator=Depends(moderator_only)
) -> models.UserResult:
    """
    Return the current user
    """
    response.headers["Cache-Control"] = "private"
    with get_db("replica") as db_session:
        user = models.FlathubUser.by_id_result(db_session, user_id)

        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        return user


@router.post(
    "/{user_id}/role",
    tags=["users"],
    responses={
        200: {"description": "Role added successfully"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - modify users permission required"},
        404: {"description": "User not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def add_user_role(
    user_id: int,
    role: models.RoleName,
    http_request: Request,
    login=Depends(modify_users_only),
) -> models.UserResult:
    """
    Add a role to a user
    """
    with get_db("writer") as db_session:
        user = models.FlathubUser.by_id(db_session, user_id)

        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        changed = user.add_role(db_session, role)

        result = user.to_result(db_session)

    if changed:
        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType.ROLE_GRANTED,
            target_user_id=user_id,
            details={"role": str(role)},
        )
    return result


@router.delete(
    "/{user_id}/role",
    tags=["users"],
    responses={
        200: {"description": "Role removed successfully"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - modify users permission required"},
        404: {"description": "User not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def delete_user_role(
    user_id: int,
    role: models.RoleName,
    http_request: Request,
    login=Depends(modify_users_only),
) -> models.UserResult:
    """
    Remove a role from a user
    """
    with get_db("writer") as db_session:
        user = models.FlathubUser.by_id(db_session, user_id)

        if user is None:
            raise HTTPException(status_code=404, detail="user not found")

        changed = user.remove_role(db_session, role)

        result = user.to_result(db_session)

    if changed:
        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType.ROLE_REVOKED,
            target_user_id=user_id,
            details={"role": str(role)},
        )
    return result


@router.get(
    "/roles/{role_name}",
    tags=["users"],
    responses={
        200: {"description": "List of users with the specified role"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - view users permission required"},
        404: {"description": "Role not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def role_users(
    response: Response, role_name: models.RoleName, _admin=Depends(view_users_only)
) -> list[models.UserResult]:
    """
    Return all users with a specific role
    """
    response.headers["Cache-Control"] = "private"
    with get_db("replica") as db_session:
        return [
            user.to_result(db_session)
            for user in models.Role.by_name_users(db_session, role_name)
        ]
