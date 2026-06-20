from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel

from .. import config, http_client, models, utils, worker
from ..database import get_db
from ..login_info import modify_users_only
from ..utils import jti

router = APIRouter(prefix="/direct-upload-apps")

ALLOWED_REPOS = ["stable", "beta"]


def _validate_id_list(entries: list[str], field: str) -> None:
    """Reject empty entries or any entry containing whitespace."""
    for entry in entries:
        if not entry or any(c.isspace() for c in entry):
            raise HTTPException(
                status_code=400,
                detail=f"invalid_{field}_entry",
            )


class AppMaintainer(BaseModel):
    id: int
    display_name: str | None
    is_primary: bool


class RuntimeScopeData(BaseModel):
    prefixes: list[str]
    extra_ids: list[str]
    repos: list[str]


class ManagedAppResponse(BaseModel):
    app_id: str
    archived: bool
    created_at: int
    first_seen_at: int | None
    maintainers: list[AppMaintainer]
    scope: RuntimeScopeData | None


class RuntimeScopeInput(BaseModel):
    prefixes: list[str]
    extra_ids: list[str] = []
    repos: list[str] = ["stable", "beta"]


class UpdateScopeRequest(BaseModel):
    prefixes: list[str]
    extra_ids: list[str] = []
    repos: list[str] = ["stable", "beta"]


class ArchiveRequest(BaseModel):
    endoflife: str
    endoflife_rebase: str | None = None


class SwitchToDirectUploadRequest(BaseModel):
    app_id: str
    primary_maintainer_user_id: int
    scope: RuntimeScopeInput | None = None


class AddMaintainerRequest(BaseModel):
    user_id: int


def _managed_app_response(
    db,
    direct_upload_app: models.DirectUploadApp,
    scope: models.RuntimeScope | None,
) -> ManagedAppResponse:
    maintainers = []
    for dev, user in models.DirectUploadAppDeveloper.by_app(db, direct_upload_app):
        maintainers.append(
            AppMaintainer(
                id=user.id,
                display_name=user.display_name,
                is_primary=dev.is_primary,
            )
        )

    scope_data: RuntimeScopeData | None = None
    if scope is not None:
        scope_data = RuntimeScopeData(
            prefixes=scope.prefixes.split(),
            extra_ids=scope.extra_ids.split(),
            repos=scope.repos.split(),
        )

    return ManagedAppResponse(
        app_id=direct_upload_app.app_id,
        archived=direct_upload_app.archived,
        created_at=int(direct_upload_app.created_at.timestamp()),
        first_seen_at=(
            int(direct_upload_app.first_seen_at.timestamp())
            if direct_upload_app.first_seen_at is not None
            else None
        ),
        maintainers=maintainers,
        scope=scope_data,
    )


def _grant_uploader_role(db, user: models.FlathubUser) -> None:

    role = models.Role.by_name(db, models.RoleName.UPLOADER)
    if role is None:
        raise HTTPException(status_code=500, detail="uploader_role_missing")
    if not models.flathubuser_role.by_user_role(db, user, role):
        db.session.add(models.flathubuser_role(flathubuser_id=user.id, role_id=role.id))


def _ensure_direct_upload_app(
    db, app_id: str, maintainer: models.FlathubUser
) -> models.DirectUploadApp:
    """Create or un-archive the DirectUploadApp and assign the primary maintainer.

    Grants the uploader role to the maintainer so they can mint tokens.
    Raises HTTPException on conflict (primary_already_assigned) or missing role.
    """
    direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
    if direct_upload_app is None:
        direct_upload_app = models.DirectUploadApp(app_id=app_id)
        db.session.add(direct_upload_app)
        db.session.flush()
    elif direct_upload_app.archived:
        direct_upload_app.archived = False
        db.session.add(direct_upload_app)

    existing_dev = models.DirectUploadAppDeveloper.by_developer_and_app(
        db, maintainer, direct_upload_app
    )
    if existing_dev is not None:
        if not existing_dev.is_primary:
            current_primary = models.DirectUploadAppDeveloper.primary_for_app(
                db, direct_upload_app
            )
            if current_primary is not None:
                raise HTTPException(
                    status_code=400,
                    detail="primary_already_assigned",
                )
            existing_dev.is_primary = True
            db.session.add(existing_dev)
    else:
        current_primary = models.DirectUploadAppDeveloper.primary_for_app(
            db, direct_upload_app
        )
        if current_primary is not None:
            raise HTTPException(
                status_code=400,
                detail="primary_already_assigned",
            )
        db.session.add(
            models.DirectUploadAppDeveloper(
                app_id=direct_upload_app.id,
                developer_id=maintainer.id,
                is_primary=True,
            )
        )

    _grant_uploader_role(db, maintainer)

    return direct_upload_app


def _revoke_all_tokens(app_id: str) -> None:
    """Revoke all upload tokens for an app via the flat-manager API."""
    assert (
        config.settings.flat_manager_api is not None
    )  # callers must check before calling
    with get_db("replica") as db:
        tokens = models.UploadToken.by_app_id(db, app_id)

    flat_manager_jwt = utils.create_flat_manager_token(
        "revoke_upload_token", ["tokenmanagement"], sub=""
    )
    for token in tokens:
        if token.revoked:
            continue
        response = http_client.post(
            config.settings.flat_manager_api + "/api/v1/tokens/revoke",
            headers={"Authorization": flat_manager_jwt},
            json={"token_ids": [jti(token)]},
        )
        if not response.is_success:
            raise HTTPException(status_code=500, detail="flat_manager_error")
        token.revoked = True
        with get_db("writer") as db:
            db.session.merge(token)
            db.session.commit()


@router.get(
    "",
    status_code=200,
    tags=["direct-upload-apps"],
    responses={
        200: {"description": "List of direct-upload apps"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
    },
)
def list_direct_upload_apps(
    _admin=Depends(modify_users_only),
) -> list[ManagedAppResponse]:
    """List all direct-upload apps."""
    with get_db("replica") as db:
        result = []
        for app in models.DirectUploadApp.all(db):
            scope = models.RuntimeScope.by_app_id(db, app.app_id)
            result.append(_managed_app_response(db, app, scope))
        return result


@router.get(
    "/{app_id}",
    status_code=200,
    tags=["direct-upload-apps"],
    responses={
        200: {"description": "Direct-upload app details"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App not found"},
    },
)
def get_direct_upload_app(
    app_id: str, _admin=Depends(modify_users_only)
) -> ManagedAppResponse:
    with get_db("replica") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")
        scope = models.RuntimeScope.by_app_id(db, app_id)
        return _managed_app_response(db, direct_upload_app, scope)


@router.post(
    "",
    status_code=201,
    tags=["direct-upload-apps"],
    responses={
        201: {"description": "App switched to direct upload"},
        400: {"description": "Invalid request parameters"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "Maintainer not found"},
    },
)
def switch_to_direct_upload(
    request: SwitchToDirectUploadRequest, _admin=Depends(modify_users_only)
) -> ManagedAppResponse:
    """Switch an app to direct upload, optionally with a runtime scope."""
    if not utils.is_valid_app_id(request.app_id):
        raise HTTPException(status_code=400, detail="malformed_app_id")

    if request.scope is not None:
        if not request.scope.prefixes:
            raise HTTPException(status_code=400, detail="prefixes_required")
        if not all(r in ALLOWED_REPOS for r in request.scope.repos):
            raise HTTPException(status_code=400, detail="forbidden_repo")
        _validate_id_list(request.scope.prefixes, "prefixes")
        _validate_id_list(request.scope.extra_ids, "extra_ids")

    with get_db("writer") as db:
        maintainer = models.FlathubUser.by_id(db, request.primary_maintainer_user_id)
        if maintainer is None:
            raise HTTPException(status_code=404, detail="user_not_found")

        existing_app = models.DirectUploadApp.by_app_id(db, request.app_id)
        if existing_app is not None and not existing_app.archived:
            raise HTTPException(status_code=400, detail="app_already_exists")

        scope: models.RuntimeScope | None = None
        if request.scope is not None:
            if models.RuntimeScope.by_app_id(db, request.app_id) is not None:
                raise HTTPException(status_code=400, detail="scope_already_exists")
            scope = models.RuntimeScope(
                app_id=request.app_id,
                prefixes=" ".join(request.scope.prefixes),
                extra_ids=" ".join(request.scope.extra_ids),
                repos=" ".join(request.scope.repos),
            )
            db.session.add(scope)

        direct_upload_app = _ensure_direct_upload_app(db, request.app_id, maintainer)

        db.session.commit()
        return _managed_app_response(db, direct_upload_app, scope)


@router.patch(
    "/{app_id}/scope",
    status_code=200,
    tags=["direct-upload-apps"],
    responses={
        200: {"description": "Runtime scope updated"},
        400: {"description": "Invalid request parameters"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App or scope not found"},
    },
)
def update_runtime_scope(
    app_id: str, request: UpdateScopeRequest, _admin=Depends(modify_users_only)
) -> ManagedAppResponse:
    """Update the prefixes and extra_ids of a runtime scope."""
    if not request.prefixes:
        raise HTTPException(status_code=400, detail="prefixes_required")

    repos = request.repos or ALLOWED_REPOS
    if not all(r in ALLOWED_REPOS for r in repos):
        raise HTTPException(status_code=400, detail="forbidden_repo")

    _validate_id_list(request.prefixes, "prefixes")
    _validate_id_list(request.extra_ids, "extra_ids")

    with get_db("writer") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")

        scope = models.RuntimeScope.by_app_id(db, app_id)
        if scope is None:
            raise HTTPException(status_code=404, detail="scope_not_found")

        scope.prefixes = " ".join(request.prefixes)
        scope.extra_ids = " ".join(request.extra_ids)
        scope.repos = " ".join(repos)
        db.session.add(scope)
        db.session.commit()

        return _managed_app_response(db, direct_upload_app, scope)


@router.delete(
    "/{app_id}",
    status_code=204,
    tags=["direct-upload-apps"],
    responses={
        204: {"description": "App switched off direct upload"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App not found"},
        500: {"description": "Flat manager not configured or server error"},
    },
)
def switch_off_direct_upload(app_id: str, _admin=Depends(modify_users_only)):
    """Hard-delete a direct-upload app and revoke all its tokens."""
    if not config.settings.flat_manager_api:
        raise HTTPException(status_code=500, detail="flat_manager_not_configured")

    with get_db("replica") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")

    _revoke_all_tokens(app_id)

    with get_db("writer") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")

        scope = models.RuntimeScope.by_app_id(db, app_id)
        if scope is not None:
            db.session.delete(scope)

        models.DirectUploadAppDeveloper.delete_all_for_app(db, direct_upload_app)
        models.DirectUploadAppInvite.delete_all_for_app(db, direct_upload_app)
        db.session.delete(direct_upload_app)
        db.session.commit()


@router.post(
    "/{app_id}/archive",
    status_code=204,
    tags=["direct-upload-apps"],
    responses={
        204: {"description": "App archived"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App not found"},
        500: {"description": "Flat manager not configured or server error"},
    },
)
def archive_direct_upload_app(
    app_id: str, request: ArchiveRequest, _admin=Depends(modify_users_only)
):
    """Archive a direct-upload app: revoke tokens, mark archived, republish as EOL.

    Unlike the app-author archive flow in verification.py, this admin endpoint works
    for runtimes too and never touches GitHub (every entry here is a DirectUploadApp).
    """
    if not config.settings.flat_manager_api:
        raise HTTPException(status_code=500, detail="flat_manager_not_configured")

    with get_db("replica") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")
        if direct_upload_app.archived:
            return

    _revoke_all_tokens(app_id)

    with get_db("writer") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")
        direct_upload_app.archived = True
        db.session.add(direct_upload_app)
        db.session.commit()

    worker.republish_app.send(app_id, request.endoflife, request.endoflife_rebase)


@router.post(
    "/{app_id}/unarchive",
    status_code=204,
    tags=["direct-upload-apps"],
    responses={
        204: {"description": "App unarchived"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App not found"},
    },
)
def unarchive_direct_upload_app(app_id: str, _admin=Depends(modify_users_only)):
    """Unarchive a direct-upload app: clear the archived flag and republish to lift EOL."""
    with get_db("writer") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")
        if not direct_upload_app.archived:
            return
        direct_upload_app.archived = False
        db.session.add(direct_upload_app)
        db.session.commit()

    worker.republish_app.send(app_id)


@router.post(
    "/{app_id}/revoke-tokens",
    status_code=204,
    tags=["direct-upload-apps"],
    responses={
        204: {"description": "All upload tokens revoked"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App not found"},
        500: {"description": "Flat manager not configured or server error"},
    },
)
def revoke_tokens(app_id: str, _admin=Depends(modify_users_only)):
    """Revoke all upload tokens for a direct-upload app without deleting it."""
    if not config.settings.flat_manager_api:
        raise HTTPException(status_code=500, detail="flat_manager_not_configured")

    with get_db("replica") as db:
        if models.DirectUploadApp.by_app_id(db, app_id) is None:
            raise HTTPException(status_code=404, detail="app_not_found")

    _revoke_all_tokens(app_id)


@router.post(
    "/{app_id}/maintainers",
    status_code=201,
    tags=["direct-upload-apps"],
    responses={
        201: {"description": "Secondary maintainer added"},
        400: {"description": "Invalid request or already a maintainer"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App or user not found"},
    },
)
def add_maintainer(
    app_id: str,
    request: AddMaintainerRequest,
    _admin=Depends(modify_users_only),
) -> ManagedAppResponse:

    with get_db("writer") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")

        user = models.FlathubUser.by_id(db, request.user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="user_not_found")

        existing = models.DirectUploadAppDeveloper.by_developer_and_app(
            db, user, direct_upload_app
        )
        if existing is not None:
            raise HTTPException(status_code=400, detail="already_a_maintainer")

        db.session.add(
            models.DirectUploadAppDeveloper(
                app_id=direct_upload_app.id,
                developer_id=user.id,
                is_primary=False,
            )
        )
        _grant_uploader_role(db, user)
        db.session.commit()

        scope = models.RuntimeScope.by_app_id(db, app_id)
        return _managed_app_response(db, direct_upload_app, scope)


@router.delete(
    "/{app_id}/maintainers/{user_id}",
    status_code=204,
    tags=["direct-upload-apps"],
    responses={
        204: {"description": "Maintainer removed"},
        400: {"description": "Cannot remove primary maintainer"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App, user, or maintainer not found"},
    },
)
def remove_maintainer(
    app_id: str,
    user_id: int,
    _admin=Depends(modify_users_only),
):

    with get_db("writer") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")

        user = models.FlathubUser.by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="user_not_found")

        dev = models.DirectUploadAppDeveloper.by_developer_and_app(
            db, user, direct_upload_app
        )
        if dev is None:
            raise HTTPException(status_code=404, detail="maintainer_not_found")
        if dev.is_primary:
            raise HTTPException(status_code=400, detail="cannot_remove_primary")

        db.session.delete(dev)
        db.session.commit()


@router.post(
    "/{app_id}/maintainers/{user_id}/set-primary",
    status_code=200,
    tags=["direct-upload-apps"],
    responses={
        200: {"description": "Primary maintainer changed"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "App, user, or maintainer not found"},
    },
)
def set_primary_maintainer(
    app_id: str,
    user_id: int,
    _admin=Depends(modify_users_only),
) -> ManagedAppResponse:

    with get_db("writer") as db:
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        if direct_upload_app is None:
            raise HTTPException(status_code=404, detail="app_not_found")

        user = models.FlathubUser.by_id(db, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="user_not_found")

        target = models.DirectUploadAppDeveloper.by_developer_and_app(
            db, user, direct_upload_app
        )
        if target is None:
            raise HTTPException(status_code=404, detail="maintainer_not_found")

        if target.is_primary:
            scope = models.RuntimeScope.by_app_id(db, app_id)
            return _managed_app_response(db, direct_upload_app, scope)

        current_primary = models.DirectUploadAppDeveloper.primary_for_app(
            db, direct_upload_app
        )
        if current_primary is not None:
            current_primary.is_primary = False
            db.session.add(current_primary)
            db.session.flush()

        target.is_primary = True
        db.session.add(target)
        db.session.flush()
        db.session.commit()

        scope = models.RuntimeScope.by_app_id(db, app_id)
        return _managed_app_response(db, direct_upload_app, scope)


def register_to_app(app: FastAPI):
    app.include_router(router)
