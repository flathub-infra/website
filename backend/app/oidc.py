from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from typing import TYPE_CHECKING, Any, Protocol, TypeGuard, cast

from sqlalchemy import select, update

if TYPE_CHECKING:
    from collections.abc import Sequence

    from .models import FlathubUser

TOKEN_BYTES = 32
PBKDF2_ITERATIONS = 600_000
PBKDF2_SALT_BYTES = 32
CLIENT_SECRET_HASH_SCHEME = "pbkdf2_sha256"


class OidcSubjectUser(Protocol):
    id: int
    oidc_subject: str | None


class OidcClientRecord(Protocol):
    client_id: str
    client_secret_hash: str
    redirect_uris: Sequence[str]
    allowed_scopes: Sequence[str]
    enabled: bool


def generate_token(num_bytes: int = TOKEN_BYTES) -> str:
    return secrets.token_urlsafe(num_bytes)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token(token: str, token_hash: str) -> bool:
    return hmac.compare_digest(hash_token(token), token_hash)


def hash_client_secret(secret: str) -> str:
    salt = secrets.token_bytes(PBKDF2_SALT_BYTES)
    secret_hash = _pbkdf2(secret, salt, PBKDF2_ITERATIONS)
    return "$".join(
        [
            CLIENT_SECRET_HASH_SCHEME,
            str(PBKDF2_ITERATIONS),
            _b64encode(salt),
            _b64encode(secret_hash),
        ]
    )


def verify_client_secret(secret: str, stored_hash: str) -> bool:
    try:
        scheme, iterations, encoded_salt, encoded_secret_hash = stored_hash.split("$")
        if scheme != CLIENT_SECRET_HASH_SCHEME:
            return False

        iteration_count = int(iterations)
        salt = _b64decode(encoded_salt)
        secret_hash = _b64decode(encoded_secret_hash)
    except (TypeError, ValueError):
        return False

    calculated_hash = _pbkdf2(secret, salt, iteration_count)
    return hmac.compare_digest(calculated_hash, secret_hash)


def oidc_client_enabled(client: OidcClientRecord | None) -> TypeGuard[OidcClientRecord]:
    return client is not None and client.enabled


def redirect_uri_allowed(redirect_uri: str, allowed_redirect_uris: Sequence[str]) -> bool:
    return redirect_uri in allowed_redirect_uris


def requested_scopes_allowed(scope: str, allowed_scopes: Sequence[str]) -> bool:
    requested_scopes = scope.split()
    return "openid" in requested_scopes and set(requested_scopes).issubset(
        set(allowed_scopes)
    )


def deferred_authorize_parameters_requested(
    code_challenge: str | None, code_challenge_method: str | None
) -> bool:
    return code_challenge is not None or code_challenge_method is not None


def ensure_oidc_subject(db: Any, user: OidcSubjectUser) -> str:
    if user.oidc_subject is not None:
        return user.oidc_subject

    session = getattr(db, "session", db)
    user_model = cast("type[FlathubUser]", type(user))

    subject = session.execute(
        update(user_model)
        .where(user_model.id == user.id, user_model.oidc_subject.is_(None))
        .values(oidc_subject=generate_token())
        .returning(user_model.oidc_subject)
    ).scalar_one_or_none()

    if subject is None:
        subject = session.execute(
            select(user_model.oidc_subject).where(user_model.id == user.id)
        ).scalar_one_or_none()

    if subject is None:
        raise ValueError(f"User {user.id} has no OIDC subject")

    user.oidc_subject = subject
    return subject


def _pbkdf2(secret: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", secret.encode(), salt, iterations)


def _b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode()


def _b64decode(value: str) -> bytes:
    return base64.b64decode(value.encode(), validate=True)
