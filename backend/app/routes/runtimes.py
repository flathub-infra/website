from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel

from .. import config, http_client, models, utils
from ..database import get_db
from ..login_info import modify_users_only
from ..utils import jti

router = APIRouter(prefix="/runtime-scopes")

ALLOWED_REPOS = ["stable", "beta"]


def _validate_id_list(entries: list[str], field: str) -> None:
    """Reject empty entries or any entry containing whitespace."""
    for entry in entries:
        if not entry or any(c.isspace() for c in entry):
            raise HTTPException(
                status_code=400,
                detail=f"invalid_{field}_entry",
            )


class RuntimeMaintainer(BaseModel):
    id: int
    display_name: str | None
    is_primary: bool


class RuntimeResponse(BaseModel):
    app_id: str
    prefixes: list[str]
    extra_ids: list[str]
    repos: list[str]
    created_at: int
    maintainers: list[RuntimeMaintainer]


class CreateRuntimeRequest(BaseModel):
    app_id: str
    prefixes: list[str]
    extra_ids: list[str] = []
    repos: list[str] = ["stable", "beta"]
    primary_maintainer_user_id: int


class UpdateRuntimeRequest(BaseModel):
    prefixes: list[str] | None = None
    extra_ids: list[str] | None = None
    repos: list[str] | None = None


def _runtime_response(
    db, scope: models.RuntimeScope, direct_upload_app: models.DirectUploadApp | None
) -> RuntimeResponse:
    maintainers = []
    if direct_upload_app is not None:
        for dev, user in models.DirectUploadAppDeveloper.by_app(db, direct_upload_app):
            maintainers.append(
                RuntimeMaintainer(
                    id=user.id,
                    display_name=user.display_name,
                    is_primary=dev.is_primary,
                )
            )

    return RuntimeResponse(
        app_id=scope.app_id,
        prefixes=scope.prefixes.split(),
        extra_ids=scope.extra_ids.split(),
        repos=scope.repos.split(),
        created_at=int(scope.created_at.timestamp()),
        maintainers=maintainers,
    )


@router.get(
    "",
    status_code=200,
    tags=["runtimes"],
    responses={
        200: {"description": "List of provisioned runtimes"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
    },
)
def get_runtimes(_admin=Depends(modify_users_only)) -> list[RuntimeResponse]:
    """List all provisioned runtimes and their scopes."""
    with get_db("replica") as db:
        result = []
        for scope in models.RuntimeScope.all(db):
            direct_upload_app = models.DirectUploadApp.by_app_id(db, scope.app_id)
            result.append(_runtime_response(db, scope, direct_upload_app))
        return result


@router.get(
    "/{app_id}",
    status_code=200,
    tags=["runtimes"],
    responses={
        200: {"description": "Runtime details"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "Runtime not found"},
    },
)
def get_runtime(app_id: str, _admin=Depends(modify_users_only)) -> RuntimeResponse:
    with get_db("replica") as db:
        scope = models.RuntimeScope.by_app_id(db, app_id)
        if scope is None:
            raise HTTPException(status_code=404, detail="runtime_not_found")
        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        return _runtime_response(db, scope, direct_upload_app)


@router.post(
    "",
    status_code=201,
    tags=["runtimes"],
    responses={
        201: {"description": "Runtime provisioned"},
        400: {"description": "Invalid request parameters"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "Maintainer not found"},
    },
)
def create_runtime(
    request: CreateRuntimeRequest, _admin=Depends(modify_users_only)
) -> RuntimeResponse:
    """Provision a runtime: create its scope and assign a primary maintainer.

    Runtimes are admin-only. The maintainer's tokens are scoped to the curated
    allow-list (prefixes + extra_ids), which is what grants a broad multi-prefix
    upload token. Co-maintainers are added through the regular invite flow.
    """
    if not utils.is_valid_app_id(request.app_id):
        raise HTTPException(status_code=400, detail="malformed_app_id")
    if not request.prefixes:
        raise HTTPException(status_code=400, detail="prefixes_required")
    if not all(r in ALLOWED_REPOS for r in request.repos):
        raise HTTPException(status_code=400, detail="forbidden_repo")
    _validate_id_list(request.prefixes, "prefixes")
    _validate_id_list(request.extra_ids, "extra_ids")
    with get_db("writer") as db:
        maintainer = models.FlathubUser.by_id(db, request.primary_maintainer_user_id)
        if maintainer is None:
            raise HTTPException(status_code=404, detail="user_not_found")

        if models.RuntimeScope.by_app_id(db, request.app_id) is not None:
            raise HTTPException(status_code=400, detail="runtime_already_exists")

        direct_upload_app = models.DirectUploadApp.by_app_id(db, request.app_id)
        if direct_upload_app is None:
            direct_upload_app = models.DirectUploadApp(app_id=request.app_id)
            db.session.add(direct_upload_app)
            db.session.flush()
        elif direct_upload_app.archived:
            direct_upload_app.archived = False
            db.session.add(direct_upload_app)

        scope = models.RuntimeScope(
            app_id=request.app_id,
            prefixes=" ".join(request.prefixes),
            extra_ids=" ".join(request.extra_ids),
            repos=" ".join(request.repos),
        )
        db.session.add(scope)

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
        # Runtime maintainers need the direct-upload permission to mint tokens.
        role = models.Role.by_name(db, models.RoleName.UPLOADER)
        if role is None:
            raise HTTPException(status_code=500, detail="uploader_role_missing")
        models.flathubuser_role.add_user_role(db, maintainer, role)

        db.session.commit()
        return _runtime_response(db, scope, direct_upload_app)


@router.patch(
    "/{app_id}",
    status_code=200,
    tags=["runtimes"],
    responses={
        200: {"description": "Runtime updated"},
        400: {"description": "Invalid request parameters"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "Runtime not found"},
    },
)
def update_runtime(
    app_id: str,
    request: UpdateRuntimeRequest,
    _admin=Depends(modify_users_only),
) -> RuntimeResponse:
    if request.repos is not None and not all(r in ALLOWED_REPOS for r in request.repos):
        raise HTTPException(status_code=400, detail="forbidden_repo")
    if request.prefixes is not None and not request.prefixes:
        raise HTTPException(status_code=400, detail="prefixes_required")
    if request.prefixes is not None:
        _validate_id_list(request.prefixes, "prefixes")
    if request.extra_ids is not None:
        _validate_id_list(request.extra_ids, "extra_ids")
    with get_db("writer") as db:
        scope = models.RuntimeScope.by_app_id(db, app_id)
        if scope is None:
            raise HTTPException(status_code=404, detail="runtime_not_found")

        if request.prefixes is not None:
            scope.prefixes = " ".join(request.prefixes)
        if request.extra_ids is not None:
            scope.extra_ids = " ".join(request.extra_ids)
        if request.repos is not None:
            scope.repos = " ".join(request.repos)

        db.session.add(scope)
        db.session.commit()

        direct_upload_app = models.DirectUploadApp.by_app_id(db, app_id)
        return _runtime_response(db, scope, direct_upload_app)


@router.post(
    "/{app_id}/revoke-tokens",
    status_code=204,
    tags=["runtimes"],
    responses={
        204: {"description": "All runtime upload tokens revoked"},
        401: {"description": "Not logged in"},
        403: {"description": "Forbidden - admin required"},
        404: {"description": "Runtime not found"},
        500: {"description": "Flat manager not configured or server error"},
    },
)
def revoke_runtime_tokens(app_id: str, _admin=Depends(modify_users_only)):
    """Revoke all upload tokens for a runtime without archiving it."""
    if not config.settings.flat_manager_api:
        raise HTTPException(status_code=500, detail="flat_manager_not_configured")

    with get_db("replica") as db:
        if models.RuntimeScope.by_app_id(db, app_id) is None:
            raise HTTPException(status_code=404, detail="runtime_not_found")
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


def register_to_app(app: FastAPI):
    app.include_router(router)
