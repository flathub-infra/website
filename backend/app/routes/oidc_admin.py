from datetime import datetime

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, update

from .. import audit_log, models, utils
from ..database import get_db
from ..login_info import manage_oidc_clients_only
from ..oidc import (
    generate_token,
    hash_client_secret,
    validate_oidc_client_configuration,
)

router = APIRouter(prefix="/admin/oidc-clients", tags=["oidc-admin"])


class OidcClientResult(BaseModel):
    client_id: str
    name: str
    description: str | None
    redirect_uris: list[str]
    allowed_scopes: list[str]
    enabled: bool
    refresh_tokens_enabled: bool
    require_pkce: bool
    created_at: datetime
    updated_at: datetime | None
    secret_rotated_at: datetime | None
    active_token_count: int


class OidcClientCreated(OidcClientResult):
    client_secret: str


class OidcClientCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    redirect_uris: list[str]
    allowed_scopes: list[str]
    refresh_tokens_enabled: bool = False
    require_pkce: bool = True


class OidcClientPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    description: str | None = None
    redirect_uris: list[str] | None = None
    allowed_scopes: list[str] | None = None
    refresh_tokens_enabled: bool | None = None
    require_pkce: bool | None = None


def register_to_app(app: FastAPI):
    app.include_router(router)


def _client_or_404(db, client_id: str) -> models.OidcClient:
    client = (
        db.session.query(models.OidcClient)
        .filter(models.OidcClient.client_id == client_id)
        .first()
    )
    if client is None:
        raise HTTPException(status_code=404, detail="OIDC client not found")
    return client


def _active_token_count(db, client_id: str) -> int:
    count = (
        db.session.query(func.count(models.OidcAccessToken.id))
        .filter(
            models.OidcAccessToken.client_id == client_id,
            models.OidcAccessToken.revoked_at.is_(None),
            models.OidcAccessToken.expires_at > utils.utcnow(),
        )
        .scalar()
    )
    return int(count or 0)


def _client_result(db, client: models.OidcClient) -> OidcClientResult:
    return OidcClientResult(
        client_id=client.client_id,
        name=client.name,
        description=client.description,
        redirect_uris=list(client.redirect_uris),
        allowed_scopes=list(client.allowed_scopes),
        enabled=client.enabled,
        refresh_tokens_enabled=client.refresh_tokens_enabled,
        require_pkce=client.require_pkce,
        created_at=client.created_at,
        updated_at=client.updated_at,
        secret_rotated_at=client.secret_rotated_at,
        active_token_count=_active_token_count(db, client.client_id),
    )


def _validate_configuration(
    redirect_uris: list[str],
    allowed_scopes: list[str],
    refresh_tokens_enabled: bool,
) -> tuple[list[str], list[str]]:
    try:
        return validate_oidc_client_configuration(
            redirect_uris, allowed_scopes, refresh_tokens_enabled
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


def _client_details(client: models.OidcClient) -> dict[str, object]:
    return {
        "redirect_uris": list(client.redirect_uris),
        "allowed_scopes": list(client.allowed_scopes),
        "refresh_tokens_enabled": client.refresh_tokens_enabled,
        "require_pkce": client.require_pkce,
    }


@router.get("")
def list_oidc_clients(
    _login=Depends(manage_oidc_clients_only),
) -> list[OidcClientResult]:
    with get_db("replica") as db:
        clients = (
            db.session.query(models.OidcClient)
            .order_by(models.OidcClient.created_at.desc())
            .all()
        )
        return [_client_result(db, client) for client in clients]


@router.post("", status_code=201)
def create_oidc_client(
    request: OidcClientCreate,
    http_request: Request,
    login=Depends(manage_oidc_clients_only),
) -> OidcClientCreated:
    if not request.name.strip():
        raise HTTPException(status_code=422, detail="name cannot be empty")
    redirect_uris, allowed_scopes = _validate_configuration(
        request.redirect_uris,
        request.allowed_scopes,
        request.refresh_tokens_enabled,
    )
    client_secret = generate_token()
    client_id = generate_token()

    with get_db("writer") as db:
        client = models.OidcClient(
            client_id=client_id,
            client_secret_hash=hash_client_secret(client_secret),
            name=request.name,
            description=request.description,
            redirect_uris=redirect_uris,
            allowed_scopes=allowed_scopes,
            refresh_tokens_enabled=request.refresh_tokens_enabled,
            require_pkce=request.require_pkce,
            created_by_user_id=login.user.id,
        )
        db.session.add(client)
        db.session.flush()
        result = OidcClientCreated(
            **_client_result(db, client).model_dump(),
            client_secret=client_secret,
        )

    audit_log.enqueue_audit_log(
        http_request,
        login.user.id,
        models.AuditEventType.OIDC_CLIENT_CREATED,
        details={"client_id": client_id, "name": request.name},
    )

    return result


@router.get("/{client_id}")
def get_oidc_client(
    client_id: str,
    _login=Depends(manage_oidc_clients_only),
) -> OidcClientResult:
    with get_db("replica") as db:
        client = _client_or_404(db, client_id)
        return _client_result(db, client)


@router.patch("/{client_id}")
def update_oidc_client(
    client_id: str,
    request: OidcClientPatch,
    http_request: Request,
    login=Depends(manage_oidc_clients_only),
) -> OidcClientResult:
    with get_db("writer") as db:
        client = _client_or_404(db, client_id)
        before = _client_details(client)
        before_name = client.name
        before_description = client.description
        values = request.model_dump(exclude_unset=True)
        for field in (
            "name",
            "redirect_uris",
            "allowed_scopes",
            "refresh_tokens_enabled",
            "require_pkce",
        ):
            if field in values and values[field] is None:
                raise HTTPException(status_code=422, detail=f"{field} cannot be null")
        name = values.get("name", client.name)
        if not name.strip():
            raise HTTPException(status_code=422, detail="name cannot be empty")
        refresh_tokens_enabled = values.get(
            "refresh_tokens_enabled", client.refresh_tokens_enabled
        )
        redirect_uris, allowed_scopes = _validate_configuration(
            values.get("redirect_uris", list(client.redirect_uris)),
            values.get("allowed_scopes", list(client.allowed_scopes)),
            refresh_tokens_enabled,
        )
        client.name = name
        client.description = values.get("description", client.description)
        client.redirect_uris = redirect_uris
        client.allowed_scopes = allowed_scopes
        client.refresh_tokens_enabled = refresh_tokens_enabled
        client.require_pkce = values.get("require_pkce", client.require_pkce)
        after = _client_details(client)
        audit_name = client.name
        changed = (
            before != after
            or before_name != client.name
            or before_description != client.description
        )
        db.session.flush()
        result = _client_result(db, client)


    if changed:
        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType.OIDC_CLIENT_UPDATED,
            details={
                "client_id": client_id,
                "name": audit_name,
                "before": before,
                "after": after,
            },
        )
    return result


@router.post("/{client_id}/rotate-secret")
def rotate_oidc_client_secret(
    client_id: str,
    http_request: Request,
    login=Depends(manage_oidc_clients_only),
) -> OidcClientCreated:
    client_secret = generate_token()
    with get_db("writer") as db:
        client = _client_or_404(db, client_id)
        client.client_secret_hash = hash_client_secret(client_secret)
        client.secret_rotated_at = utils.utcnow()
        audit_name = client.name
        db.session.flush()
        result = OidcClientCreated(
            **_client_result(db, client).model_dump(),
            client_secret=client_secret,
        )

    audit_log.enqueue_audit_log(
        http_request,
        login.user.id,
        models.AuditEventType.OIDC_CLIENT_SECRET_ROTATED,
        details={"client_id": client_id, "name": audit_name},
    )

    return result


@router.delete("/{client_id}")
def disable_oidc_client(
    client_id: str,
    http_request: Request,
    login=Depends(manage_oidc_clients_only),
) -> OidcClientResult:
    now = utils.utcnow()
    with get_db("writer") as db:
        client = _client_or_404(db, client_id)
        changed = client.enabled
        client.enabled = False
        db.session.execute(
            update(models.OidcAccessToken)
            .where(
                models.OidcAccessToken.client_id == client_id,
                models.OidcAccessToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        db.session.execute(
            update(models.OidcRefreshToken)
            .where(
                models.OidcRefreshToken.client_id == client_id,
                models.OidcRefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        audit_name = client.name
        db.session.flush()
        result = _client_result(db, client)

    if changed:
        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType.OIDC_CLIENT_DISABLED,
            details={"client_id": client_id, "name": audit_name},
        )

    return result
