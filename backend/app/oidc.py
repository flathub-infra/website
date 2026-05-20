from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from typing import Any, Protocol

TOKEN_BYTES = 32
PBKDF2_ITERATIONS = 600_000
PBKDF2_SALT_BYTES = 32
CLIENT_SECRET_HASH_SCHEME = "pbkdf2_sha256"


class OidcSubjectUser(Protocol):
    oidc_subject: str | None


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


def ensure_oidc_subject(db: Any, user: OidcSubjectUser) -> str:
    if user.oidc_subject is None:
        user.oidc_subject = generate_token()
        db.add(user)
        db.flush()

    return user.oidc_subject


def _pbkdf2(secret: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", secret.encode(), salt, iterations)


def _b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode()


def _b64decode(value: str) -> bytes:
    return base64.b64decode(value.encode(), validate=True)
