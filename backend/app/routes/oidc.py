import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, FastAPI, Form, HTTPException, Query, Request
from fastapi.responses import ORJSONResponse
from joserfc import jwk, jwt
from joserfc.errors import JoseError
from sqlalchemy import update
from starlette.responses import RedirectResponse

from .. import config, models
from ..database import get_db
from ..login_info import LoginStatusDep
from ..oidc import (
    ensure_oidc_subject,
    generate_token,
    hash_token,
    verify_client_secret,
)


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
    has_query_string = bool(request.url.query)

    if has_query_string:
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


def _get_signing_key():
    """Load the first RSA signing key from the configured private JWKS."""
    if config.settings.oidc_private_jwks is None:
        raise HTTPException(status_code=500, detail="OIDC JWKS is not configured")

    try:
        private_jwks = json.loads(config.settings.oidc_private_jwks)
        key_set = jwk.KeySet.import_key_set(private_jwks)
    except (json.JSONDecodeError, KeyError, TypeError, JoseError) as e:
        raise HTTPException(status_code=500, detail="OIDC JWKS is invalid") from e

    for key in key_set:
        if key.key_type == "RSA":
            return key

    raise HTTPException(status_code=500, detail="OIDC JWKS is invalid")


def _resolve_client_credentials(
    request: Request,
    post_client_id: str | None,
    post_client_secret: str | None,
) -> tuple[str, str]:
    """Extract client_id and client_secret from request headers or form body.

    Returns (client_id, client_secret) or raises HTTPException.
    """
    auth_header = request.headers.get("authorization", "")
    basic_client_id: str | None = None
    basic_client_secret: str | None = None

    # Try client_secret_basic (Authorization: Basic base64(client_id:client_secret))
    if auth_header.startswith("Basic "):
        try:
            decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
            basic_client_id, basic_client_secret = decoded.split(":", 1)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(status_code=401, detail="invalid_client")

    # Mutually exclusive: cannot use both methods
    if basic_client_id and post_client_id:
        raise HTTPException(status_code=400, detail="invalid_request")

    if basic_client_id:
        # basic_client_secret is guaranteed non-None after split(":", 1)
        assert basic_client_secret is not None
        return basic_client_id, basic_client_secret
    if not post_client_id:
        raise HTTPException(status_code=401, detail="invalid_client")
    if not post_client_secret:
        raise HTTPException(status_code=401, detail="invalid_client")

    return post_client_id, post_client_secret


@router.post(
    "/oidc/token",
    responses={
        200: {"description": "Token response"},
        400: {"description": "Invalid request"},
        401: {"description": "Invalid client"},
        404: {"description": "OIDC is disabled"},
    },
)
def token(
    request: Request,
    grant_type: str = Form(None),
    code: str = Form(None),
    redirect_uri: str = Form(None),
    client_id: str | None = Form(None),
    client_secret: str | None = Form(None),
):
    client_id, client_secret = _resolve_client_credentials(
        request, client_id, client_secret
    )

    if grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail="unsupported_grant_type")

    if not code:
        raise HTTPException(status_code=400, detail="invalid_request")

    # Authenticate client and atomically consume the code in one writer transaction
    code_hash_value = hash_token(code)
    access_token = generate_token()
    now = datetime.now(UTC)
    access_token_expires_at = now + timedelta(
        seconds=config.settings.oidc_access_token_lifetime_seconds
    )

    with get_db("writer") as db:
        # Authenticate client against the writer to avoid stale replica data
        client = (
            db.session.query(models.OidcClient)
            .filter(models.OidcClient.client_id == client_id)
            .first()
        )
        if client is None or not client.enabled:
            raise HTTPException(status_code=401, detail="invalid_client")
        if not verify_client_secret(client_secret, client.client_secret_hash):
            raise HTTPException(status_code=401, detail="invalid_client")

        # Atomically claim the code: UPDATE ... WHERE unconsumed RETURNING ...
        result = db.session.execute(
            update(models.OidcAuthorizationCode)
            .where(
                models.OidcAuthorizationCode.code_hash == code_hash_value,
                models.OidcAuthorizationCode.consumed_at.is_(None),
            )
            .values(consumed_at=now)
            .returning(
                models.OidcAuthorizationCode.client_id,
                models.OidcAuthorizationCode.user_id,
                models.OidcAuthorizationCode.redirect_uri,
                models.OidcAuthorizationCode.scope,
                models.OidcAuthorizationCode.nonce,
                models.OidcAuthorizationCode.expires_at,
            )
        )
        row = result.first()

        if row is None:
            raise HTTPException(status_code=400, detail="invalid_grant")

        if row.client_id != client_id:
            raise HTTPException(status_code=400, detail="invalid_grant")
        if row.redirect_uri != redirect_uri:
            raise HTTPException(status_code=400, detail="invalid_grant")
        if now > row.expires_at.replace(tzinfo=UTC):
            raise HTTPException(status_code=400, detail="invalid_grant")

        user = db.session.get(models.FlathubUser, row.user_id)
        if user is None:
            raise HTTPException(status_code=400, detail="invalid_grant")
        subject = ensure_oidc_subject(db, user)

        # Build and sign ID token BEFORE committing the mutation
        signing_key = _get_signing_key()
        issuer = config.settings.oidc_issuer.rstrip("/")
        now_epoch = int(now.timestamp())
        id_claims: dict[str, Any] = {
            "iss": issuer,
            "sub": subject,
            "aud": client_id,
            "iat": now_epoch,
            "exp": now_epoch + config.settings.oidc_access_token_lifetime_seconds,
        }
        if row.nonce is not None:
            id_claims["nonce"] = row.nonce

        header = {"alg": config.settings.oidc_jwt_alg, "kid": signing_key.kid}
        id_token = jwt.encode(
            header, id_claims, signing_key, algorithms=[config.settings.oidc_jwt_alg]
        )

        # Persist access token (hash only)
        access_token_obj = models.OidcAccessToken(
            client_id=client_id,
            user_id=row.user_id,
            access_token_hash=hash_token(access_token),
            scope=row.scope,
            expires_at=access_token_expires_at,
        )
        db.session.add(access_token_obj)

        # Capture scalar values before commit expires ORM instances
        scope_value = row.scope

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": config.settings.oidc_access_token_lifetime_seconds,
        "scope": scope_value,
        "id_token": id_token,
    }


@router.get(
    "/oidc/userinfo",
    responses={
        200: {"description": "UserInfo claims"},
        401: {"description": "Invalid or missing bearer token"},
        404: {"description": "OIDC is disabled"},
    },
)
def userinfo(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="invalid_token")

    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0] != "Bearer":
        raise HTTPException(status_code=401, detail="invalid_token")

    token_value = parts[1].strip()
    if not token_value:
        raise HTTPException(status_code=401, detail="invalid_token")

    token_hash_value = hash_token(token_value)
    now = datetime.now(UTC)

    with get_db("writer") as db:
        access_token_obj = (
            db.session.query(models.OidcAccessToken)
            .filter(
                models.OidcAccessToken.access_token_hash == token_hash_value,
                models.OidcAccessToken.expires_at > now,
                models.OidcAccessToken.revoked_at.is_(None),
            )
            .first()
        )

        if access_token_obj is None:
            raise HTTPException(status_code=401, detail="invalid_token")

        user = db.session.get(models.FlathubUser, access_token_obj.user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="invalid_token")

        subject = ensure_oidc_subject(db, user)
        scopes = access_token_obj.scope.split()

        claims: dict[str, Any] = {"sub": subject}

        if "profile" in scopes:
            claims["name"] = user.display_name
            default_account = user.get_default_account(db)
            if default_account is not None:
                claims["preferred_username"] = default_account.login
                if getattr(default_account, "avatar_url", None) is not None:
                    claims["picture"] = default_account.avatar_url

        if "email" in scopes:
            default_account = user.get_default_account(db)
            if default_account is not None:
                if getattr(default_account, "email", None) is not None:
                    claims["email"] = default_account.email

        return claims
