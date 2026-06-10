import base64
import json
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote, urlencode, urlsplit

from fastapi import APIRouter, Depends, FastAPI, Form, HTTPException, Query, Request
from joserfc import jwk, jwt
from joserfc.errors import JoseError
from sqlalchemy import update
from starlette.responses import RedirectResponse

from .. import config, models, utils
from ..database import get_db
from ..login_info import LoginStatusDep
from ..oidc import (
    ensure_oidc_subject,
    generate_token,
    hash_token,
    oidc_client_enabled,
    redirect_uri_allowed,
    requested_scopes_allowed,
    verify_client_secret,
    verify_pkce_s256,
)


def require_oidc_enabled():
    if not config.settings.oidc_enabled:
        raise HTTPException(status_code=404)


router = APIRouter(
    tags=["oidc"],
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
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "scopes_supported": ["openid", "profile", "email", "offline_access"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
        ],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "code_challenge_methods_supported": ["S256"],
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


def _error_redirect(
    redirect_uri: str, error: str, state: str | None
) -> RedirectResponse:
    params: dict[str, str] = {"error": error}
    if state is not None:
        params["state"] = state
    separator = "&" if "?" in redirect_uri else "?"
    location = f"{redirect_uri}{separator}{urlencode(params)}"
    return RedirectResponse(url=location, status_code=302)


def _user_can_use_oidc(user: models.FlathubUser) -> bool:
    return models.RoleName.OIDC.value in user.role_list()


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

    if not oidc_client_enabled(client):
        raise HTTPException(status_code=400, detail="invalid_client")

    if not redirect_uri_allowed(redirect_uri, client.redirect_uris):
        raise HTTPException(status_code=400, detail="invalid_redirect_uri")

    if response_type != "code":
        return _error_redirect(redirect_uri, "unsupported_response_type", state)

    if not requested_scopes_allowed(scope, client.allowed_scopes):
        return _error_redirect(redirect_uri, "invalid_scope", state)

    requested_scope_set = set(scope.split())
    if "offline_access" in requested_scope_set and not client.refresh_tokens_enabled:
        return _error_redirect(redirect_uri, "invalid_scope", state)

    if code_challenge is not None or code_challenge_method is not None:
        if code_challenge_method != "S256" or not code_challenge:
            return _error_redirect(redirect_uri, "invalid_request", state)

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
        authorize_path = (
            urlsplit(config.settings.oidc_issuer.rstrip("/")).path + "/oidc/authorize"
        )
        login_url = (
            f"{config.settings.frontend_url}/login"
            f"?returnTo={quote(authorize_path, safe='')}"
        )
        return RedirectResponse(url=login_url, status_code=302)

    code = generate_token()
    expires_at = utils.utcnow() + timedelta(
        seconds=config.settings.oidc_code_lifetime_seconds
    )

    with get_db("writer") as db:
        client = (
            db.session.query(models.OidcClient)
            .filter(models.OidcClient.client_id == client_id)
            .first()
        )
        if not oidc_client_enabled(client):
            raise HTTPException(status_code=400, detail="invalid_client")
        if not redirect_uri_allowed(redirect_uri, client.redirect_uris):
            raise HTTPException(status_code=400, detail="invalid_redirect_uri")
        if not requested_scopes_allowed(scope, client.allowed_scopes):
            return _error_redirect(redirect_uri, "invalid_scope", state)
        if "offline_access" in set(scope.split()) and not client.refresh_tokens_enabled:
            return _error_redirect(redirect_uri, "invalid_scope", state)

        user = db.session.merge(login.user)
        if user.deleted:
            return _error_redirect(redirect_uri, "access_denied", state)
        if not _user_can_use_oidc(user):
            return _error_redirect(redirect_uri, "access_denied", state)
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


def _load_enabled_client_or_401(db, client_id: str):
    """Load an OIDC client by client_id and return it only if enabled.

    Raises HTTPException(401, invalid_client) if the client is missing or disabled.
    """
    client = (
        db.session.query(models.OidcClient)
        .filter(models.OidcClient.client_id == client_id)
        .first()
    )
    if not oidc_client_enabled(client):
        raise HTTPException(status_code=401, detail="invalid_client")
    return client


def _sign_id_token(
    client_id: str, subject: str, now: datetime, nonce: str | None = None
) -> str:
    """Build and sign a JWT ID token."""
    signing_key = _get_signing_key()
    issuer = config.settings.oidc_issuer.rstrip("/")
    now_epoch = int(now.replace(tzinfo=UTC).timestamp())
    id_claims: dict[str, Any] = {
        "iss": issuer,
        "sub": subject,
        "aud": client_id,
        "iat": now_epoch,
        "exp": now_epoch + config.settings.oidc_id_token_lifetime_seconds,
    }
    if nonce is not None:
        id_claims["nonce"] = nonce

    header = {"alg": config.settings.oidc_jwt_alg, "kid": signing_key.kid}
    return jwt.encode(
        header, id_claims, signing_key, algorithms=[config.settings.oidc_jwt_alg]
    )


def _access_token_scope(scope: str) -> str:
    """Remove offline_access from the scope string for access-token storage."""
    scopes = scope.split()
    return " ".join(s for s in scopes if s != "offline_access")


def _create_access_token(
    db,
    client_id: str,
    user_id: int,
    scope: str,
    now: datetime,
    family_id: str | None = None,
):
    """Create and persist an OidcAccessToken (hash only)."""
    access_token = generate_token()
    expires_at = now + timedelta(
        seconds=config.settings.oidc_access_token_lifetime_seconds
    )
    access_token_obj = models.OidcAccessToken(
        client_id=client_id,
        user_id=user_id,
        access_token_hash=hash_token(access_token),
        scope=scope,
        expires_at=expires_at,
        refresh_token_family_id=family_id,
    )
    db.session.add(access_token_obj)
    return access_token, expires_at


def _scope_subset_or_invalid(requested: str, original: str) -> str | None:
    """Validate that requested scopes are a subset of original scopes.

    Returns the validated scope string, or None if invalid.
    """
    requested_set = set(requested.split()) if requested else set()
    original_set = set(original.split())
    if not requested_set.issubset(original_set):
        return None
    return requested


def _revoke_refresh_family(db, family_id: str, now: datetime):
    """Revoke all refresh tokens and active access tokens in a family."""
    db.session.execute(
        update(models.OidcRefreshToken)
        .where(
            models.OidcRefreshToken.family_id == family_id,
            models.OidcRefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    db.session.execute(
        update(models.OidcAccessToken)
        .where(
            models.OidcAccessToken.refresh_token_family_id == family_id,
            models.OidcAccessToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )


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
    refresh_token: str | None = Form(None),
    scope: str | None = Form(None),
    code_verifier: str | None = Form(None),
):
    client_id, client_secret = _resolve_client_credentials(
        request, client_id, client_secret
    )

    now = utils.utcnow()

    if grant_type == "authorization_code":
        return _handle_authorization_code_grant(
            client_id, client_secret, code, redirect_uri, code_verifier, now
        )
    elif grant_type == "refresh_token":
        return _handle_refresh_token_grant(
            client_id, client_secret, refresh_token, scope, now
        )
    else:
        raise HTTPException(status_code=400, detail="unsupported_grant_type")


def _handle_authorization_code_grant(
    client_id: str,
    client_secret: str,
    code: str | None,
    redirect_uri: str | None,
    code_verifier: str | None,
    now: datetime,
):
    if not code:
        raise HTTPException(status_code=400, detail="invalid_request")

    code_hash_value = hash_token(code)

    with get_db("writer") as db:
        client = _load_enabled_client_or_401(db, client_id)
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
                models.OidcAuthorizationCode.code_challenge,
                models.OidcAuthorizationCode.code_challenge_method,
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
        if now > row.expires_at:
            raise HTTPException(status_code=400, detail="invalid_grant")

        if row.code_challenge is not None:
            if not code_verifier or not verify_pkce_s256(
                code_verifier, row.code_challenge
            ):
                raise HTTPException(status_code=400, detail="invalid_grant")

        user = db.session.get(models.FlathubUser, row.user_id)
        if user is None or user.deleted:
            raise HTTPException(status_code=400, detail="invalid_grant")
        if not _user_can_use_oidc(user):
            raise HTTPException(status_code=400, detail="invalid_grant")
        subject = ensure_oidc_subject(db, user)

        id_token = _sign_id_token(client_id, subject, now, nonce=row.nonce)

        at_scope = _access_token_scope(row.scope)

        refresh_token_value = None
        family_id = None
        if "offline_access" in set(row.scope.split()) and client.refresh_tokens_enabled:
            family_id = generate_token()
            refresh_token_value = generate_token()
            refresh_expires_at = now + timedelta(
                seconds=config.settings.oidc_refresh_token_lifetime_seconds
            )
            refresh_obj = models.OidcRefreshToken(
                client_id=client_id,
                user_id=row.user_id,
                refresh_token_hash=hash_token(refresh_token_value),
                family_id=family_id,
                scope=row.scope,
                expires_at=refresh_expires_at,
            )
            db.session.add(refresh_obj)

        access_token, _ = _create_access_token(
            db, client_id, row.user_id, at_scope, now, family_id=family_id
        )

    response: dict[str, Any] = {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": config.settings.oidc_access_token_lifetime_seconds,
        "scope": at_scope,
        "id_token": id_token,
    }
    if refresh_token_value is not None:
        response["refresh_token"] = refresh_token_value
    return response


def _handle_refresh_token_grant(
    client_id: str,
    client_secret: str,
    refresh_token_value: str | None,
    requested_scope: str | None,
    now: datetime,
):
    if not refresh_token_value:
        raise HTTPException(status_code=400, detail="invalid_request")

    token_hash = hash_token(refresh_token_value)

    with get_db("writer") as db:
        client = _load_enabled_client_or_401(db, client_id)
        if not verify_client_secret(client_secret, client.client_secret_hash):
            raise HTTPException(status_code=401, detail="invalid_client")
        if not client.refresh_tokens_enabled:
            raise HTTPException(status_code=401, detail="invalid_client")

        result = db.session.execute(
            update(models.OidcRefreshToken)
            .where(
                models.OidcRefreshToken.refresh_token_hash == token_hash,
                models.OidcRefreshToken.client_id == client_id,
                models.OidcRefreshToken.rotated_at.is_(None),
                models.OidcRefreshToken.revoked_at.is_(None),
            )
            .values(rotated_at=now)
            .returning(
                models.OidcRefreshToken.id,
                models.OidcRefreshToken.user_id,
                models.OidcRefreshToken.family_id,
                models.OidcRefreshToken.scope,
                models.OidcRefreshToken.expires_at,
            )
        )
        row = result.first()

        if row is None:
            replay_obj = (
                db.session.query(models.OidcRefreshToken)
                .filter(
                    models.OidcRefreshToken.refresh_token_hash == token_hash,
                    models.OidcRefreshToken.client_id == client_id,
                )
                .first()
            )
            if replay_obj is not None and (
                replay_obj.rotated_at is not None or replay_obj.revoked_at is not None
            ):
                _revoke_refresh_family(db, replay_obj.family_id, now)
                db.session.commit()
            raise HTTPException(status_code=400, detail="invalid_grant")

        if now > row.expires_at:
            raise HTTPException(status_code=400, detail="invalid_grant")

        user = db.session.get(models.FlathubUser, row.user_id)
        if user is None or user.deleted:
            raise HTTPException(status_code=400, detail="invalid_grant")
        if not _user_can_use_oidc(user):
            raise HTTPException(status_code=400, detail="invalid_grant")
        subject = ensure_oidc_subject(db, user)

        effective_scope = row.scope
        if requested_scope is not None:
            validated = _scope_subset_or_invalid(requested_scope, row.scope)
            if validated is None:
                raise HTTPException(status_code=400, detail="invalid_scope")
            effective_scope = validated

        new_rt_value = generate_token()
        new_rt_expires_at = now + timedelta(
            seconds=config.settings.oidc_refresh_token_lifetime_seconds
        )
        new_rt_obj = models.OidcRefreshToken(
            client_id=client_id,
            user_id=row.user_id,
            refresh_token_hash=hash_token(new_rt_value),
            family_id=row.family_id,
            scope=effective_scope,
            expires_at=new_rt_expires_at,
        )
        db.session.add(new_rt_obj)

        db.session.flush()
        db.session.execute(
            update(models.OidcRefreshToken)
            .where(models.OidcRefreshToken.id == row.id)
            .values(replaced_by_id=new_rt_obj.id)
        )

        at_scope = _access_token_scope(effective_scope)
        access_token, _ = _create_access_token(
            db, client_id, row.user_id, at_scope, now, family_id=row.family_id
        )

        id_token = None
        if "openid" in effective_scope.split():
            id_token = _sign_id_token(client_id, subject, now)

    response: dict[str, Any] = {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": config.settings.oidc_access_token_lifetime_seconds,
        "scope": at_scope,
        "refresh_token": new_rt_value,
    }
    if id_token is not None:
        response["id_token"] = id_token
    return response


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
    now = utils.utcnow()

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
        if user is None or user.deleted:
            raise HTTPException(status_code=401, detail="invalid_token")
        if not _user_can_use_oidc(user):
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
