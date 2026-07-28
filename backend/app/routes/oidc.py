import base64
import hmac
import html
import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any, cast
from urllib.parse import quote, unquote_plus, urlencode, urlsplit

import redis
from fastapi import APIRouter, Depends, FastAPI, Form, HTTPException, Query, Request
from joserfc import jwk, jwt
from joserfc.errors import JoseError
from sqlalchemy import select, update
from starlette.responses import HTMLResponse, JSONResponse, RedirectResponse, Response

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
    valid_pkce_value,
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


OIDC_SIGNING_ALGORITHM = "RS256"
TOKEN_RESPONSE_HEADERS = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
}

logger = logging.getLogger(__name__)

_signing_key_cache_source: str | None = None
_signing_key_cache: Any | None = None
_token_rate_limit_store = redis.Redis(
    host=config.settings.redis_host,
    port=config.settings.redis_port,
    db=config.settings.redis_db,
    decode_responses=True,
    socket_connect_timeout=0.2,
    socket_timeout=0.2,
)

_TOKEN_RATE_LIMIT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
"""

INVALID_PERCENT_ESCAPE_PATTERN = re.compile(r"%(?![0-9A-Fa-f]{2})")


class OidcTokenError(Exception):
    def __init__(
        self,
        error: str,
        status_code: int = 400,
        authenticate: bool = False,
    ):
        super().__init__(error)
        self.error = error
        self.status_code = status_code
        self.authenticate = authenticate


class OidcBearerError(Exception):
    def __init__(self, error: str | None = None, status_code: int = 401):
        super().__init__(error)
        self.error = error
        self.status_code = status_code

async def oidc_bearer_error_handler(_request: Request, exc: Exception):
    assert isinstance(exc, OidcBearerError)
    challenge = 'Bearer realm="oidc/userinfo"'
    if exc.error is not None:
        challenge += f', error="{exc.error}"'
    return Response(
        status_code=exc.status_code,
        headers={"WWW-Authenticate": challenge},
    )


async def oidc_token_error_handler(_request: Request, exc: Exception):
    assert isinstance(exc, OidcTokenError)
    headers = dict(TOKEN_RESPONSE_HEADERS)
    if exc.authenticate:
        headers["WWW-Authenticate"] = 'Basic realm="oidc/token"'
    return JSONResponse(
        {"error": exc.error},
        status_code=exc.status_code,
        headers=headers,
    )


def _token_response(content: dict[str, Any]) -> JSONResponse:
    return JSONResponse(content, headers=TOKEN_RESPONSE_HEADERS)


def register_to_app(app: FastAPI):
    app.include_router(router)
    app.add_exception_handler(OidcTokenError, oidc_token_error_handler)
    app.add_exception_handler(OidcBearerError, oidc_bearer_error_handler)


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
        "id_token_signing_alg_values_supported": [OIDC_SIGNING_ALGORITHM],
        "claims_supported": [
            "sub",
            "name",
            "preferred_username",
            "picture",
            "email",
        ],
        "code_challenge_methods_supported": ["S256"],
    }


def invalidate_signing_key_cache():
    global _signing_key_cache, _signing_key_cache_source
    _signing_key_cache = None
    _signing_key_cache_source = None


def _load_private_key_set():
    global _signing_key_cache, _signing_key_cache_source

    private_jwks = config.settings.oidc_private_jwks
    if private_jwks is None:
        raise HTTPException(status_code=500, detail="OIDC JWKS is not configured")
    if _signing_key_cache is not None and _signing_key_cache_source == private_jwks:
        return _signing_key_cache

    try:
        key_set = jwk.KeySet.import_key_set(json.loads(private_jwks))
    except (json.JSONDecodeError, KeyError, TypeError, JoseError) as e:
        raise HTTPException(status_code=500, detail="OIDC JWKS is invalid") from e

    _signing_key_cache = key_set
    _signing_key_cache_source = private_jwks
    return key_set


@router.get(
    "/oidc/jwks.json",
    responses={
        200: {"description": "OIDC JSON Web Key Set"},
        404: {"description": "OIDC is disabled"},
        500: {"description": "OIDC JWKS is not configured"},
    },
)
def jwks():
    key_set = _load_private_key_set()

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


def _issue_authorization_code(
    client_id: str,
    redirect_uri: str,
    scope: str,
    state: str | None,
    nonce: str | None,
    code_challenge: str | None,
    code_challenge_method: str | None,
    user_id: int,
):
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

        user = db.session.get(models.FlathubUser, user_id)
        if user is None or user.login_disabled or not _user_can_use_oidc(user):
            return _error_redirect(redirect_uri, "access_denied", state)
        ensure_oidc_subject(db, user)
        db.session.add(
            models.OidcAuthorizationCode(
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
        )

    params: dict[str, str] = {"code": code}
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
    prompt: str | None = Query(None),
    request_object: str | None = Query(None, alias="request"),
    request_uri: str | None = Query(None),
):
    has_query_string = bool(request.url.query)

    if has_query_string:
        request.session.pop("oidc_authorize_params", None)
    else:
        pending = request.session.pop("oidc_authorize_params", None)
        if pending is not None:
            client_id = pending["client_id"]
            prompt = pending.get("prompt")
            redirect_uri = pending["redirect_uri"]
            response_type = pending["response_type"]
            scope = pending["scope"]
            state = pending.get("state")
            nonce = pending.get("nonce")
            code_challenge = pending.get("code_challenge")
            code_challenge_method = pending.get("code_challenge_method")
            created_at = pending.get("_created_at")
            pre_login_user_id = pending.get("_pre_login_user_id")
            if (
                not isinstance(created_at, (int, float))
                or utils.utcnow().timestamp() - created_at
                > config.settings.oidc_code_lifetime_seconds
                or (
                    pre_login_user_id is not None
                    and pre_login_user_id != request.session.get("user-id")
                )
                or (
                    pre_login_user_id is None
                    and not pending.get("_login_flow_started")
                    and request.session.get("user-id") is not None
                )
            ):
                raise HTTPException(status_code=400, detail="invalid_request")
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
    if request_object is not None or request_uri is not None:
        return _error_redirect(redirect_uri, "request_not_supported", state)

    prompt_values = set(prompt.split()) if prompt else set()
    if not prompt_values.issubset({"none", "login", "consent", "select_account"}):
        return _error_redirect(redirect_uri, "invalid_request", state)
    if "none" in prompt_values and len(prompt_values) != 1:
        return _error_redirect(redirect_uri, "invalid_request", state)

    if response_type != "code":
        return _error_redirect(redirect_uri, "unsupported_response_type", state)
    if not requested_scopes_allowed(scope, client.allowed_scopes):
        return _error_redirect(redirect_uri, "invalid_scope", state)

    requested_scope_set = set(scope.split())
    if "offline_access" in requested_scope_set and not client.refresh_tokens_enabled:
        return _error_redirect(redirect_uri, "invalid_scope", state)

    if client.require_pkce and code_challenge is None:
        return _error_redirect(redirect_uri, "invalid_request", state)

    if code_challenge is not None or code_challenge_method is not None:
        if (
            code_challenge is None
            or code_challenge_method != "S256"
            or not valid_pkce_value(code_challenge)
        ):
            return _error_redirect(redirect_uri, "invalid_request", state)

    if "none" in prompt_values and (not login.state.logged_in() or login.user is None):
        return _error_redirect(redirect_uri, "login_required", state)

    if not login.state.logged_in() or login.user is None:
        request.session["oidc_authorize_params"] = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": response_type,
            "scope": scope,
            "prompt": prompt,
            "state": state,
            "nonce": nonce,
            "code_challenge": code_challenge,
            "code_challenge_method": code_challenge_method,
            "_created_at": utils.utcnow().timestamp(),
            "_pre_login_user_id": request.session.get("user-id"),
            "_login_flow_started": False,
        }
        authorize_path = (
            urlsplit(config.settings.oidc_issuer.rstrip("/")).path + "/oidc/authorize"
        )
        login_url = (
            f"{config.settings.frontend_url}/login"
            f"?returnTo={quote(authorize_path, safe='')}"
        )
        return RedirectResponse(url=login_url, status_code=302)

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
        user = db.session.get(models.FlathubUser, login.user.id)
        if user is None or user.login_disabled or not _user_can_use_oidc(user):
            return _error_redirect(redirect_uri, "access_denied", state)

    if "none" in prompt_values:
        return _error_redirect(redirect_uri, "consent_required", state)
    request.session["oidc_consent"] = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": response_type,
        "prompt": prompt,
        "scope": scope,
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge,
        "code_challenge_method": code_challenge_method,
        "user_id": login.user.id,
        "created_at": utils.utcnow().timestamp(),
        "csrf_token": generate_token(),
    }
    consent_url = config.settings.oidc_issuer.rstrip("/") + "/oidc/consent"
    return RedirectResponse(url=consent_url, status_code=302)


def _get_pending_consent(request: Request, login: LoginStatusDep):
    pending = request.session.get("oidc_consent")
    # Consent expiry deliberately shares the authorization-code lifetime.
    if (
        not isinstance(pending, dict)
        or not login.state.logged_in()
        or login.user is None
        or pending.get("user_id") != login.user.id
        or not isinstance(pending.get("created_at"), (int, float))
        or utils.utcnow().timestamp() - pending["created_at"]
        > config.settings.oidc_code_lifetime_seconds
    ):
        request.session.pop("oidc_consent", None)
        raise HTTPException(status_code=400, detail="invalid_request")
    return pending


@router.get("/oidc/consent", include_in_schema=False)
def consent(request: Request, login: LoginStatusDep):
    pending = _get_pending_consent(request, login)
    with get_db("replica") as db:
        client = (
            db.session.query(models.OidcClient)
            .filter(models.OidcClient.client_id == pending["client_id"])
            .first()
        )
    if not oidc_client_enabled(client):
        request.session.pop("oidc_consent", None)
        raise HTTPException(status_code=400, detail="invalid_client")

    csrf_token = html.escape(pending["csrf_token"], quote=True)
    client_name = html.escape(client.name, quote=True)
    scope = html.escape(pending["scope"], quote=True)
    consent_url = html.escape(
        config.settings.oidc_issuer.rstrip("/") + "/oidc/consent", quote=True
    )
    return HTMLResponse(
        f"""
        <!doctype html>
        <html lang="en">
          <head><title>Authorize {client_name}</title></head>
          <body>
            <main>
              <h1>Authorize {client_name}</h1>
              <p>This application requests: {scope}</p>
              <form method="post" action="{consent_url}">
                <input type="hidden" name="csrf_token" value="{csrf_token}">
                <button type="submit" name="decision" value="approve">Allow</button>
                <button type="submit" name="decision" value="deny">Deny</button>
              </form>
            </main>
          </body>
        </html>
        """,
        headers={"Cache-Control": "no-store"},
    )


@router.post("/oidc/consent", include_in_schema=False)
def submit_consent(
    request: Request,
    login: LoginStatusDep,
    csrf_token: str = Form(...),
    decision: str = Form(...),
):
    pending = _get_pending_consent(request, login)
    assert login.user is not None
    if not hmac.compare_digest(csrf_token, pending["csrf_token"]):
        request.session.pop("oidc_consent", None)
        raise HTTPException(status_code=400, detail="invalid_request")
    request.session.pop("oidc_consent", None)
    if decision != "approve":
        return _error_redirect(
            pending["redirect_uri"], "access_denied", pending.get("state")
        )
    return _issue_authorization_code(
        pending["client_id"],
        pending["redirect_uri"],
        pending["scope"],
        pending.get("state"),
        pending.get("nonce"),
        pending.get("code_challenge"),
        pending.get("code_challenge_method"),
        login.user.id,
    )


def _get_signing_key():
    """Load the first compatible RSA signing key from the private JWKS."""
    key_set = _load_private_key_set()

    for key in key_set:
        if (
            key.key_type != "RSA"
            or not key.is_private
            or key.get("use") not in (None, "sig")
        ):
            continue
        try:
            key.check_key_op("sign")
            key.check_alg(OIDC_SIGNING_ALGORITHM)
        except JoseError:
            continue
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
        raise OidcTokenError("invalid_client", status_code=401, authenticate=True)
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

    header = {"alg": OIDC_SIGNING_ALGORITHM, "kid": signing_key.kid}
    return jwt.encode(
        header, id_claims, signing_key, algorithms=[OIDC_SIGNING_ALGORITHM]
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
    authorization_code_id: int | None = None,
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
        authorization_code_id=authorization_code_id,
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


def _revoke_authorization_code_tokens(db, authorization_code_id: int, now: datetime):
    """Revoke tokens issued from a replayed authorization code."""
    db.session.execute(
        update(models.OidcRefreshToken)
        .where(
            models.OidcRefreshToken.authorization_code_id == authorization_code_id,
            models.OidcRefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    db.session.execute(
        update(models.OidcAccessToken)
        .where(
            models.OidcAccessToken.authorization_code_id == authorization_code_id,
            models.OidcAccessToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )


def _resolve_client_credentials(
    request: Request,
    post_client_id: str | None,
    post_client_secret: str | None,
) -> tuple[str, str]:
    """Extract client_id and client_secret from request headers or form body."""
    auth_header = request.headers.get("authorization", "")
    scheme, separator, credential_payload = auth_header.partition(" ")
    basic_header_present = scheme.casefold() == "basic"
    basic_client_id: str | None = None
    basic_client_secret: str | None = None

    if basic_header_present:
        try:
            if not separator:
                raise ValueError
            decoded = base64.b64decode(credential_payload, validate=True).decode(
                "utf-8"
            )
            encoded_client_id, encoded_client_secret = decoded.split(":", 1)
            if INVALID_PERCENT_ESCAPE_PATTERN.search(
                encoded_client_id
            ) or INVALID_PERCENT_ESCAPE_PATTERN.search(encoded_client_secret):
                raise ValueError
            basic_client_id = unquote_plus(
                encoded_client_id, encoding="utf-8", errors="strict"
            )
            basic_client_secret = unquote_plus(
                encoded_client_secret, encoding="utf-8", errors="strict"
            )
        except ValueError:
            raise OidcTokenError("invalid_client", status_code=401, authenticate=True)

    if basic_header_present and (
        post_client_id is not None or post_client_secret is not None
    ):
        raise OidcTokenError("invalid_request")

    if basic_header_present:
        if not basic_client_id or not basic_client_secret:
            raise OidcTokenError("invalid_client", status_code=401, authenticate=True)
        return basic_client_id, basic_client_secret

    if not post_client_id or not post_client_secret:
        raise OidcTokenError("invalid_client", status_code=401, authenticate=True)

    return post_client_id, post_client_secret


def _check_token_rate_limit(request: Request, client_id: str):
    window = config.settings.oidc_token_rate_limit_window_seconds
    limits = (
        (
            "ip",
            request.client.host if request.client else "unknown",
            config.settings.oidc_token_rate_limit_per_ip,
        ),
        ("client", client_id, config.settings.oidc_token_rate_limit_per_client),
    )
    for kind, identifier, limit in limits:
        key = f"oidc:token-rate:{kind}:{identifier}"
        try:
            count = int(
                cast(
                    str,
                    _token_rate_limit_store.eval(
                        _TOKEN_RATE_LIMIT_SCRIPT,
                        1,
                        key,
                        window,
                    ),
                )
            )
        except redis.RedisError:
            logger.warning("OIDC token rate limiting unavailable", exc_info=True)
            continue
        if count > limit:
            raise OidcTokenError("temporarily_unavailable", status_code=429)


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
    _check_token_rate_limit(request, client_id)

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
        raise OidcTokenError("unsupported_grant_type")


def _handle_authorization_code_grant(
    client_id: str,
    client_secret: str,
    code: str | None,
    redirect_uri: str | None,
    code_verifier: str | None,
    now: datetime,
):
    if not code:
        raise OidcTokenError("invalid_request")

    code_hash_value = hash_token(code)

    with get_db("writer") as db:
        client = _load_enabled_client_or_401(db, client_id)
        if not verify_client_secret(client_secret, client.client_secret_hash):
            raise OidcTokenError("invalid_client", status_code=401, authenticate=True)

        # Atomically claim the code: UPDATE ... WHERE unconsumed RETURNING ...
        result = db.session.execute(
            update(models.OidcAuthorizationCode)
            .where(
                models.OidcAuthorizationCode.code_hash == code_hash_value,
                models.OidcAuthorizationCode.client_id == client_id,
                models.OidcAuthorizationCode.consumed_at.is_(None),
            )
            .values(consumed_at=now)
            .returning(
                models.OidcAuthorizationCode.id,
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
            replayed_code = db.session.execute(
                update(models.OidcAuthorizationCode)
                .where(
                    models.OidcAuthorizationCode.code_hash == code_hash_value,
                    models.OidcAuthorizationCode.client_id == client_id,
                    models.OidcAuthorizationCode.consumed_at.is_not(None),
                    models.OidcAuthorizationCode.replayed_at.is_(None),
                )
                .values(replayed_at=now)
                .returning(models.OidcAuthorizationCode.id)
            ).first()
            if replayed_code is not None:
                _revoke_authorization_code_tokens(db, replayed_code.id, now)
                db.session.commit()
            raise OidcTokenError("invalid_grant")
        db.session.commit()

        if row.redirect_uri != redirect_uri:
            raise OidcTokenError("invalid_grant")
        if now > row.expires_at:
            raise OidcTokenError("invalid_grant")

        if row.code_challenge is not None:
            if not code_verifier or not verify_pkce_s256(
                code_verifier, row.code_challenge
            ):
                raise OidcTokenError("invalid_grant")

        replayed_at = db.session.execute(
            select(models.OidcAuthorizationCode.replayed_at)
            .where(models.OidcAuthorizationCode.id == row.id)
            .with_for_update()
        ).scalar_one()
        if replayed_at is not None:
            raise OidcTokenError("invalid_grant")

        user = db.session.get(models.FlathubUser, row.user_id)
        if user is None or user.login_disabled:
            raise OidcTokenError("invalid_grant")
        if not _user_can_use_oidc(user):
            raise OidcTokenError("invalid_grant")
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
                authorization_code_id=row.id,
            )
            db.session.add(refresh_obj)

        access_token, _ = _create_access_token(
            db,
            client_id,
            row.user_id,
            at_scope,
            now,
            family_id=family_id,
            authorization_code_id=row.id,
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
    return _token_response(response)


def _handle_refresh_token_grant(
    client_id: str,
    client_secret: str,
    refresh_token_value: str | None,
    requested_scope: str | None,
    now: datetime,
):
    if not refresh_token_value:
        raise OidcTokenError("invalid_request")

    token_hash = hash_token(refresh_token_value)

    with get_db("writer") as db:
        client = _load_enabled_client_or_401(db, client_id)
        if not verify_client_secret(client_secret, client.client_secret_hash):
            raise OidcTokenError("invalid_client", status_code=401, authenticate=True)
        if not client.refresh_tokens_enabled:
            raise OidcTokenError("invalid_client", status_code=401, authenticate=True)

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
                models.OidcRefreshToken.authorization_code_id,
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
            raise OidcTokenError("invalid_grant")

        if now > row.expires_at:
            raise OidcTokenError("invalid_grant")

        user = db.session.get(models.FlathubUser, row.user_id)
        if user is None or user.login_disabled:
            raise OidcTokenError("invalid_grant")
        if not _user_can_use_oidc(user):
            raise OidcTokenError("invalid_grant")
        subject = ensure_oidc_subject(db, user)

        effective_scope = row.scope
        if requested_scope:
            validated = _scope_subset_or_invalid(requested_scope, row.scope)
            if validated is None:
                raise OidcTokenError("invalid_scope")
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
            authorization_code_id=row.authorization_code_id,
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
            db,
            client_id,
            row.user_id,
            at_scope,
            now,
            family_id=row.family_id,
            authorization_code_id=row.authorization_code_id,
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
    return _token_response(response)


@router.get(
    "/oidc/userinfo",
    responses={
        200: {"description": "UserInfo claims"},
        401: {"description": "Invalid or missing bearer token"},
        404: {"description": "OIDC is disabled"},
    },
)
def userinfo(request: Request):
    return _userinfo(request, None)


@router.post("/oidc/userinfo", include_in_schema=False)
def userinfo_post(request: Request, access_token: str | None = Form(None)):
    return _userinfo(request, access_token)


def _userinfo(request: Request, access_token: str | None):
    auth_header = request.headers.get("Authorization")
    if auth_header and access_token is not None:
        raise OidcBearerError("invalid_request", status_code=400)

    if auth_header:
        scheme, separator, token_value = auth_header.partition(" ")
        if not separator or scheme.casefold() != "bearer":
            raise OidcBearerError
        token_value = token_value.strip()
        if not token_value:
            raise OidcBearerError
    elif access_token:
        token_value = access_token
    else:
        raise OidcBearerError

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
            raise OidcBearerError("invalid_token")

        user = db.session.get(models.FlathubUser, access_token_obj.user_id)
        if user is None or user.login_disabled:
            raise OidcBearerError("invalid_token")
        if not _user_can_use_oidc(user):
            raise OidcBearerError("invalid_token")

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
