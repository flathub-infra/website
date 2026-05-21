import hashlib
import json
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from joserfc import jwk
from sqlalchemy.dialects import postgresql

from app import config
from app.models import FlathubUser, OidcAccessToken, OidcAuthorizationCode
from app.oidc import (
    ensure_oidc_subject,
    generate_token,
    hash_client_secret,
    hash_token,
    verify_client_secret,
    verify_token,
)
from app.routes import oidc

PRIVATE_JWK_FIELDS = {"d", "p", "q", "dp", "dq", "qi", "oth"}


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class StatementSession:
    def __init__(self, results=None):
        self.statements = []
        self.results = [] if results is None else list(results)

    def execute(self, statement):
        self.statements.append(statement)
        if self.results:
            return self.results.pop(0)
        return ScalarResult(None)


class StatementDb:
    def __init__(self, results=None):
        self.session = StatementSession(results)


def compile_statement(statement):
    return str(
        statement.compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )


@pytest.fixture
def client():
    app = FastAPI()
    oidc.register_to_app(app)
    with TestClient(app) as client_:
        yield client_


def enable_oidc(monkeypatch, private_jwks=None):
    monkeypatch.setattr(config.settings, "oidc_enabled", True)
    monkeypatch.setattr(config.settings, "oidc_issuer", "https://flathub.org")
    monkeypatch.setattr(config.settings, "oidc_private_jwks", private_jwks)


@pytest.mark.parametrize(
    "path", ["/.well-known/openid-configuration", "/oidc/jwks.json"]
)
def test_oidc_endpoints_return_404_when_disabled(client, monkeypatch, path):
    monkeypatch.setattr(config.settings, "oidc_enabled", False)

    response = client.get(path)

    assert response.status_code == 404


def test_oidc_discovery_content(client, monkeypatch):
    enable_oidc(monkeypatch)

    response = client.get("/.well-known/openid-configuration")

    assert response.status_code == 200
    assert response.json() == {
        "issuer": "https://flathub.org",
        "authorization_endpoint": "https://flathub.org/oidc/authorize",
        "token_endpoint": "https://flathub.org/oidc/token",
        "userinfo_endpoint": "https://flathub.org/oidc/userinfo",
        "jwks_uri": "https://flathub.org/oidc/jwks.json",
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


def test_oidc_jwks_requires_key_config(client, monkeypatch):
    enable_oidc(monkeypatch)

    response = client.get("/oidc/jwks.json")

    assert response.status_code == 500
    assert response.json() == {"detail": "OIDC JWKS is not configured"}


def test_oidc_jwks_returns_public_key_material(client, monkeypatch):
    private_key = jwk.generate_key(
        "RSA",
        2048,
        parameters={"alg": "RS256", "kid": "test-key", "use": "sig"},
    ).as_dict(private=True)
    enable_oidc(monkeypatch, json.dumps({"keys": [private_key]}))

    response = client.get("/oidc/jwks.json")

    assert response.status_code == 200
    public_key = response.json()["keys"][0]
    assert public_key == {
        key: private_key[key] for key in ("alg", "e", "kid", "kty", "n", "use")
    }
    assert PRIVATE_JWK_FIELDS.isdisjoint(public_key)


def test_client_secret_hash_verification():
    secret = "client-secret-value"

    stored_hash = hash_client_secret(secret)

    assert secret not in stored_hash
    assert verify_client_secret(secret, stored_hash)
    assert not verify_client_secret("wrong-secret", stored_hash)
    assert not verify_client_secret(secret, "not-a-valid-hash")


def test_client_secret_hash_uses_unique_salts():
    secret = "client-secret-value"

    assert hash_client_secret(secret) != hash_client_secret(secret)


def test_token_hashing_uses_sha256_and_constant_time_verification():
    token = "authorization-code-or-access-token"
    expected_hash = hashlib.sha256(token.encode()).hexdigest()

    assert hash_token(token) == expected_hash
    assert token not in hash_token(token)
    assert verify_token(token, expected_hash)
    assert not verify_token("wrong-token", expected_hash)


def test_generate_token_returns_distinct_high_entropy_values():
    first_token = generate_token()
    second_token = generate_token()

    assert first_token != second_token
    assert len(first_token) >= 32


def test_lazy_subject_generation_uses_atomic_update():
    db = StatementDb([ScalarResult("assigned-subject")])
    user = FlathubUser(id=1)

    subject = ensure_oidc_subject(db, user)

    assert subject == "assigned-subject"
    assert user.oidc_subject == "assigned-subject"
    assert len(db.session.statements) == 1

    update_sql = compile_statement(db.session.statements[0])

    assert "UPDATE flathubuser SET oidc_subject=" in update_sql
    assert "flathubuser.id = 1" in update_sql
    assert "flathubuser.oidc_subject IS NULL" in update_sql
    assert "RETURNING flathubuser.oidc_subject" in update_sql


def test_lazy_subject_generation_reuses_concurrent_subject():
    db = StatementDb([ScalarResult(None), ScalarResult("existing-subject")])
    user = FlathubUser(id=1)

    subject = ensure_oidc_subject(db, user)

    assert subject == "existing-subject"
    assert user.oidc_subject == "existing-subject"
    assert len(db.session.statements) == 2

    select_sql = compile_statement(db.session.statements[1])

    assert "SELECT flathubuser.oidc_subject" in select_sql
    assert "flathubuser.id = 1" in select_sql


def test_existing_lazy_subject_does_not_write():
    db = StatementDb()
    user = FlathubUser(id=1, oidc_subject="existing-subject")

    assert ensure_oidc_subject(db, user) == "existing-subject"
    assert db.session.statements == []


def test_oidc_rows_are_handled_by_user_delete_flow():
    assert OidcAuthorizationCode in FlathubUser.TABLES_FOR_DELETE
    assert OidcAccessToken in FlathubUser.TABLES_FOR_DELETE


def test_oidc_user_delete_hooks_remove_codes_and_revoke_tokens():
    user = FlathubUser(id=42)
    code_db = StatementDb()
    token_db = StatementDb()

    OidcAuthorizationCode.delete_user(code_db, user)
    OidcAccessToken.delete_user(token_db, user)

    code_sql = compile_statement(code_db.session.statements[0])
    token_sql = compile_statement(token_db.session.statements[0])

    assert "DELETE FROM oidcauthorizationcode" in code_sql
    assert "oidcauthorizationcode.user_id = 42" in code_sql
    assert "UPDATE oidcaccesstoken SET revoked_at=" in token_sql
    assert "oidcaccesstoken.user_id = 42" in token_sql
    assert "oidcaccesstoken.revoked_at IS NULL" in token_sql
