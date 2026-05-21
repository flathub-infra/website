import json
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import ORJSONResponse
from joserfc import jwk
from joserfc.errors import JoseError
from starlette.responses import RedirectResponse

from .. import config, models
from ..database import get_db
from ..login_info import LoginStatusDep
from ..oidc import ensure_oidc_subject, generate_token, hash_token


def require_oidc_enabled():
    if not config.settings.oidc_enabled:
        raise HTTPException(status_code=404)


router = APIRouter(
    tags=["oidc"],
    default_response_class=ORJSONResponse,
    dependencies=[Depends(require_oidc_enabled)],
)


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get(
    "/.well-known/openid-configuration",
    responses={
        200: {"description": "OIDC discovery metadata"},
        404: {"description": "OIDC is disabled"},
    },
)
def openid_configuration():
    issuer = config.settings.oidc_issuer.rstrip("/")
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/oidc/authorize",
        "token_endpoint": f"{issuer}/oidc/token",
        "userinfo_endpoint": f"{issuer}/oidc/userinfo",
        "jwks_uri": f"{issuer}/oidc/jwks.json",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
        ],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
    }


@router.get(
    "/oidc/jwks.json",
    responses={
        200: {"description": "OIDC JSON Web Key Set"},
        404: {"description": "OIDC is disabled"},
        500: {"description": "OIDC JWKS is not configured"},
    },
)
def jwks():
    if config.settings.oidc_private_jwks is None:
        raise HTTPException(status_code=500, detail="OIDC JWKS is not configured")

    try:
        private_jwks = json.loads(config.settings.oidc_private_jwks)
        key_set = jwk.KeySet.import_key_set(private_jwks)
    except (json.JSONDecodeError, KeyError, TypeError, JoseError) as e:
        raise HTTPException(status_code=500, detail="OIDC JWKS is invalid") from e

    keys: list[dict[str, Any]] = []
    for key in key_set:
        if key.key_type != "RSA":
            raise HTTPException(status_code=500, detail="OIDC JWKS is invalid")
        keys.append(key.as_dict(private=False))

    return {"keys": keys}


def _error_redirect(redirect_uri: str, error: str, state: str | None) -> RedirectResponse:
    params: dict[str, str] = {"error": error}
    if state is not None:
        params["state"] = state
    separator = "&" if "?" in redirect_uri else "?"
    location = f"{redirect_uri}{separator}{urlencode(params)}"
    return RedirectResponse(url=location, status_code=302)


@router.get(
    "/oidc/authorize",
    responses={
        302: {"description": "Redirect to client with code or error, or to login page"},
        400: {"description": "Invalid client or redirect URI"},
        404: {"description": "OIDC is disabled"},
    },
)
def authorize(
    request: Request,
    login: LoginStatusDep,
    client_id: str = Query(None),
    redirect_uri: str = Query(None),
    response_type: str = Query(None),
    scope: str = Query(None),
    state: str | None = Query(None),
    nonce: str | None = Query(None),
    code_challenge: str | None = Query(None),
    code_challenge_method: str | None = Query(None),
):
    has_fresh_params = client_id is not None

    if has_fresh_params:
        request.session.pop("oidc_authorize_params", None)
    else:
        pending = request.session.pop("oidc_authorize_params", None)
        if pending is not None:
            client_id = pending["client_id"]
            redirect_uri = pending["redirect_uri"]
            response_type = pending["response_type"]
            scope = pending["scope"]
            state = pending.get("state")
            nonce = pending.get("nonce")
            code_challenge = pending.get("code_challenge")
            code_challenge_method = pending.get("code_challenge_method")

    if not client_id or not redirect_uri or not response_type or not scope:
        raise HTTPException(status_code=400, detail="invalid_request")
    with get_db("replica") as db:
        client = (
            db.session.query(models.OidcClient)
            .filter(models.OidcClient.client_id == client_id)
            .first()
        )

    if client is None or not client.enabled:
        raise HTTPException(status_code=400, detail="invalid_client")

    if redirect_uri not in client.redirect_uris:
        raise HTTPException(status_code=400, detail="invalid_redirect_uri")

    if response_type != "code":
        return _error_redirect(redirect_uri, "unsupported_response_type", state)

    requested_scopes = scope.split()
    if "openid" not in requested_scopes:
        return _error_redirect(redirect_uri, "invalid_scope", state)

    if not set(requested_scopes).issubset(set(client.allowed_scopes)):
        return _error_redirect(redirect_uri, "invalid_scope", state)

    if not login.state.logged_in() or login.user is None:
        request.session["oidc_authorize_params"] = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": response_type,
            "scope": scope,
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
        }
        login_url = f"{config.settings.frontend_url}/login?returnTo=%2Foidc%2Fauthorize"
        return RedirectResponse(url=login_url, status_code=302)

    code = generate_token()
    expires_at = datetime.now(UTC) + timedelta(
        seconds=config.settings.oidc_code_lifetime_seconds
    )

    with get_db("writer") as db:
        client = (
            db.session.query(models.OidcClient)
            .filter(models.OidcClient.client_id == client_id)
            .first()
        )
        if client is None or not client.enabled:
            raise HTTPException(status_code=400, detail="invalid_client")
        if redirect_uri not in client.redirect_uris:
            raise HTTPException(status_code=400, detail="invalid_redirect_uri")
        if not set(requested_scopes).issubset(set(client.allowed_scopes)):
            return _error_redirect(redirect_uri, "invalid_scope", state)

        user = db.session.merge(login.user)
        ensure_oidc_subject(db, user)
        authz_code = models.OidcAuthorizationCode(
            client_id=client.client_id,
            user_id=user.id,
            code_hash=hash_token(code),
            redirect_uri=redirect_uri,
            scope=scope,
            nonce=nonce,
            code_challenge=code_challenge,
            code_challenge_method=code_challenge_method,
            expires_at=expires_at,
        )
        db.session.add(authz_code)

    params: dict[str, str] = {"code": code}
    if state is not None:
        params["state"] = state
    separator = "&" if "?" in redirect_uri else "?"
    location = f"{redirect_uri}{separator}{urlencode(params)}"
    return RedirectResponse(url=location, status_code=302)
