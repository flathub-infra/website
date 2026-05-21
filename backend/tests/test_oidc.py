import base64
import hashlib
import json
import os
import sys
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)


from fastapi import FastAPI
from fastapi.testclient import TestClient
from joserfc import jwk, jwt
from sqlalchemy.dialects import postgresql
from starlette.middleware.sessions import SessionMiddleware

from app import config
from app.login_info import LoginInformation, LoginState, login_state
from app.models import (
    FlathubUser,
    OidcAccessToken,
    OidcAuthorizationCode,
    OidcClient,
)
from app.oidc import (
    ensure_oidc_subject,
    generate_token,
    hash_client_secret,
    hash_token,
    verify_client_secret,
    verify_token,
)
from app.routes import oidc as oidc_routes

PRIVATE_JWK_FIELDS = {"d", "p", "q", "dp", "dq", "qi", "oth"}


def _decode_jwt_payload(token_str):
    """Decode JWT claims without signature verification (for test inspection)."""
    parts = token_str.split(".")
    assert len(parts) == 3, f"Expected 3 JWT parts, got {len(parts)}"
    payload_b64 = parts[1]
    # Add padding if needed
    padding = 4 - len(payload_b64) % 4
    if padding != 4:
        payload_b64 += "=" * padding
    return json.loads(base64.urlsafe_b64decode(payload_b64))


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
    oidc_routes.register_to_app(app)
    app.add_middleware(
        SessionMiddleware, secret_key="test-session-secret"
    )
    with TestClient(app, raise_server_exceptions=False) as client_:
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


REDIRECT_URI = "https://test-client.example.com/oauth2/callback"
AUTHORIZE_PARAMS = {
    "client_id": "test-client",
    "redirect_uri": REDIRECT_URI,
    "response_type": "code",
    "scope": "openid profile email",
    "state": "test-state",
}


def _make_client(enabled=True):
    client = OidcClient(
        id=1,
        client_id="test-client",
        name="Test Client",
        client_secret_hash="hash",
        redirect_uris=[REDIRECT_URI],
        allowed_scopes=["openid", "profile", "email"],
        enabled=enabled,
    )
    return client


def _make_logged_in_login(user_id=1):
    user = FlathubUser(id=user_id, oidc_subject="sub-1")
    return LoginInformation(state=LoginState.LOGGED_IN, user=user, method=None)


def _make_logged_out_login():
    return LoginInformation(state=LoginState.LOGGED_OUT, user=None, method=None)


def _mock_db_ctx(client_obj=None, user=None, added=None):
    session = MagicMock()
    query_chain = MagicMock()
    query_chain.first.return_value = client_obj
    session.query.return_value.filter.return_value = query_chain
    session.merge.return_value = user or FlathubUser(id=1, oidc_subject="sub-1")
    if added is not None:
        session.add.side_effect = lambda obj: added.append(obj)
    else:
        session.add = MagicMock()

    db = MagicMock()
    db.session = session

    @contextmanager
    def _ctx(*_args, **_kwargs):
        yield db

    return _ctx


def _setup_app(client_fixture):
    enable_oidc(client_fixture.monkeypatch)
    return client_fixture.app


@pytest.fixture
def authorize_client(client, monkeypatch):
    enable_oidc(monkeypatch)
    return client



def test_authorize_returns_404_when_disabled(client, monkeypatch):
    monkeypatch.setattr(config.settings, "oidc_enabled", False)

    response = client.get("/oidc/authorize", params=AUTHORIZE_PARAMS)

    assert response.status_code == 404


def test_authorize_invalid_client_returns_400(authorize_client):
    get_db_mock = _mock_db_ctx(client_obj=None)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_client"}


def test_authorize_disabled_client_returns_400(authorize_client):
    disabled_client = _make_client(enabled=False)
    get_db_mock = _mock_db_ctx(client_obj=disabled_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_client"}


def test_authorize_redirect_mismatch_returns_400(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={**AUTHORIZE_PARAMS, "redirect_uri": "https://evil.example.com/callback"},
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_redirect_uri"}


def test_authorize_unsupported_response_type(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={**AUTHORIZE_PARAMS, "response_type": "token"},
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert REDIRECT_URI in response.headers["location"]
    assert "error=unsupported_response_type" in response.headers["location"]
    assert "state=test-state" in response.headers["location"]


def test_authorize_missing_openid_scope(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={**AUTHORIZE_PARAMS, "scope": "profile email"},
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert REDIRECT_URI in response.headers["location"]
    assert "error=invalid_scope" in response.headers["location"]


def test_authorize_disallowed_scope(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={**AUTHORIZE_PARAMS, "scope": "openid profile email admin"},
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert REDIRECT_URI in response.headers["location"]
    assert "error=invalid_scope" in response.headers["location"]


def test_authorize_unauthenticated_redirects_to_login(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith("http://localhost:3000/login?returnTo=%2Foidc%2Fauthorize"), location
    # returnTo is just the bare path — no query params, no external redirect_uri embedded
    assert "redirect_uri" not in location

def test_authorize_authenticated_issues_code(authorize_client):
    valid_client = _make_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=valid_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
            "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
        ), patch("app.routes.oidc.generate_token", return_value="test-auth-code"):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith(REDIRECT_URI)
    assert "code=test-auth-code" in location
    assert "state=test-state" in location
    assert len(added) == 1
    authz_code = added[0]
    assert isinstance(authz_code, OidcAuthorizationCode)
    assert authz_code.client_id == "test-client"
    assert authz_code.user_id == 1
    assert authz_code.code_hash == hash_token("test-auth-code")
    assert authz_code.redirect_uri == REDIRECT_URI
    assert authz_code.scope == "openid profile email"


def test_authorize_nonce_persisted(authorize_client):
    valid_client = _make_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=valid_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
            "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
        ), patch("app.routes.oidc.generate_token", return_value="test-auth-code"):
            response = authorize_client.get(
                "/oidc/authorize",
                params={**AUTHORIZE_PARAMS, "nonce": "test-nonce"},
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert len(added) == 1
    assert added[0].nonce == "test-nonce"


def test_authorize_state_preserved(authorize_client):
    valid_client = _make_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=valid_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
            "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
        ), patch("app.routes.oidc.generate_token", return_value="test-auth-code"):
            response = authorize_client.get(
                "/oidc/authorize",
                params={**AUTHORIZE_PARAMS, "state": "custom-state-42"},
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    location = response.headers["location"]
    assert "state=custom-state-42" in location


def _mock_db_ctx_split(replica_client=None, writer_client=None, user=None, added=None):
    replica_session = MagicMock()
    replica_query = MagicMock()
    replica_query.first.return_value = replica_client
    replica_session.query.return_value.filter.return_value = replica_query
    replica_session.merge.return_value = user or FlathubUser(id=1, oidc_subject="sub-1")

    replica_db = MagicMock()
    replica_db.session = replica_session

    writer_session = MagicMock()
    writer_query = MagicMock()
    writer_query.first.return_value = writer_client
    writer_session.query.return_value.filter.return_value = writer_query
    writer_session.merge.return_value = user or FlathubUser(id=1, oidc_subject="sub-1")
    if added is not None:
        writer_session.add.side_effect = lambda obj: added.append(obj)
    else:
        writer_session.add = MagicMock()

    writer_db = MagicMock()
    writer_db.session = writer_session

    @contextmanager
    def _ctx(db_type="replica", **_kwargs):
        if db_type == "writer":
            yield writer_db
        else:
            yield replica_db

    return _ctx


def test_authorize_revalidates_client_on_writer(authorize_client):
    valid_client = _make_client()
    disabled_client = _make_client(enabled=False)
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx_split(
        replica_client=valid_client, writer_client=disabled_client,
        user=user, added=added,
    )

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
            "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
        ), patch("app.routes.oidc.generate_token", return_value="test-auth-code"):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_client"}
    assert len(added) == 0


NESTED_REDIRECT_URI = "https://test-client.example.com/oauth2/callback%3Fnext%3D%252Fadmin%26foo%3Dbar"


def test_authorize_preserves_nested_encoded_redirect_uri(authorize_client):
    nested_client = OidcClient(
        id=2,
        client_id="test-client-nested",
        name="Test Client Nested",
        client_secret_hash="hash",
        redirect_uris=[NESTED_REDIRECT_URI],
        allowed_scopes=["openid", "profile", "email"],
        enabled=True,
    )
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=nested_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
            "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
        ), patch("app.routes.oidc.generate_token", return_value="test-auth-code"):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    "client_id": "test-client-nested",
                    "redirect_uri": NESTED_REDIRECT_URI,
                    "response_type": "code",
                    "scope": "openid profile",
                },
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert len(added) == 1
    assert added[0].redirect_uri == NESTED_REDIRECT_URI


def make_client_with_redirect(redirect_uri):
    return OidcClient(
        id=1,
        client_id="test-client",
        name="Test Client",
        client_secret_hash="hash",
        redirect_uris=[redirect_uri],
        allowed_scopes=["openid", "profile", "email"],
        enabled=True,
    )


def test_authorize_fresh_request_ignores_stale_session(authorize_client):
    client = make_client_with_redirect(REDIRECT_URI)
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )

        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
            "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
        ), patch("app.routes.oidc.generate_token", return_value="fresh-code"):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    **AUTHORIZE_PARAMS,
                    "state": "fresh-state",
                },
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert len(added) == 1
    assert added[0].redirect_uri == REDIRECT_URI
    assert "state=fresh-state" in response.headers["location"]


def test_authorize_round_trip_preserves_nested_encoded_redirect_uri(authorize_client):
    nested_client = make_client_with_redirect(NESTED_REDIRECT_URI)
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=nested_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    "client_id": "test-client",
                    "redirect_uri": NESTED_REDIRECT_URI,
                    "response_type": "code",
                    "scope": "openid profile",
                },
                follow_redirects=False,
            )

        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith("http://localhost:3000/login?returnTo=%2Foidc%2Fauthorize")
        assert "redirect_uri" not in location

        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
            "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
        ), patch("app.routes.oidc.generate_token", return_value="test-auth-code"):
            response = authorize_client.get(
                "/oidc/authorize", follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert len(added) == 1
    assert added[0].redirect_uri == NESTED_REDIRECT_URI


def test_authorize_malformed_fresh_request_ignores_stale_session(authorize_client):
    stale_client = make_client_with_redirect(REDIRECT_URI)
    get_db_mock = _mock_db_ctx(client_obj=stale_client)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_out_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )

        authorize_client.app.dependency_overrides[login_state] = lambda: _make_logged_in_login()
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize?foo=bar", follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_request"}


# ── Token endpoint tests ──

TOKEN_REDIRECT_URI = REDIRECT_URI
CLIENT_SECRET = "s3cret"


def _generate_test_jwks():
    key = jwk.generate_key(
        "RSA", 2048, parameters={"alg": "RS256", "kid": "test-key", "use": "sig"}
    )
    return json.dumps({"keys": [key.as_dict(private=True)]})


def _make_token_client(secret=CLIENT_SECRET):
    return OidcClient(
        id=1,
        client_id="test-client",
        name="Test Client",
        client_secret_hash=hash_client_secret(secret),
        redirect_uris=[TOKEN_REDIRECT_URI],
        allowed_scopes=["openid", "profile", "email"],
        enabled=True,
    )


class _AuthCodeRow:
    """Simulates a RETURNING row from UPDATE ... RETURNING."""

    def __init__(
        self,
        client_id,
        user_id,
        redirect_uri,
        scope,
        nonce,
        expires_at,
    ):
        self.client_id = client_id
        self.user_id = user_id
        self.redirect_uri = redirect_uri
        self.scope = scope
        self.nonce = nonce
        self.expires_at = expires_at


def _make_auth_code_row(
    client_id="test-client",
    user_id=1,
    redirect_uri=TOKEN_REDIRECT_URI,
    scope="openid profile",
    nonce=None,
    expired=False,
):
    now = datetime.now(UTC)
    return _AuthCodeRow(
        client_id=client_id,
        user_id=user_id,
        redirect_uri=redirect_uri,
        scope=scope,
        nonce=nonce,
        expires_at=now + timedelta(seconds=600) if not expired else now - timedelta(seconds=1),
    )


def _mock_token_db(
    client_obj=None,
    auth_code_row=None,
    user_obj=None,
    added=None,
):
    """Mock get_db for the token endpoint (writer-only flow).

    Writer session handles:
    - session.query().filter().first() for client lookup
    - session.execute(UPDATE...RETURNING) for code consumption
    - session.get() for user lookup
    - session.add() for access token persistence
    """
    # Writer session
    writer_session = MagicMock()

    # Client query: session.query(OidcClient).filter(...).first()
    client_query = MagicMock()
    client_query.first.return_value = client_obj
    writer_session.query.return_value.filter.return_value = client_query

    # UPDATE...RETURNING: session.execute(update...).first()
    execute_result = MagicMock()
    execute_result.first.return_value = auth_code_row
    writer_session.execute.return_value = execute_result

    # User lookup: session.get(FlathubUser, user_id)
    writer_session.get.return_value = user_obj

    if added is not None:
        writer_session.add.side_effect = lambda obj: added.append(obj)
    else:
        writer_session.add = MagicMock()

    writer_db = MagicMock()
    writer_db.session = writer_session

    # Both replica and writer contexts yield the same writer_db
    # since the token endpoint does all work on the writer
    @contextmanager
    def _ctx(db_type="replica", **_kwargs):
        yield writer_db

    return _ctx


@pytest.fixture
def token_client(client, monkeypatch):
    enable_oidc(monkeypatch, _generate_test_jwks())
    return client


def _basic_auth_header(client_id, client_secret):
    creds = f"{client_id}:{client_secret}"
    encoded = base64.b64encode(creds.encode()).decode()
    return {"Authorization": f"Basic {encoded}"}


def test_token_valid_exchange_with_client_secret_post(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
        "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
    ), patch("app.routes.oidc.generate_token", return_value="test-access-token"):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "test-access-token"
    assert body["token_type"] == "Bearer"
    assert body["expires_in"] == 3600
    assert body["scope"] == "openid profile"
    assert "id_token" in body

    # Verify ID token is a valid JWT
    id_token = body["id_token"]
    claims = _decode_jwt_payload(id_token)
    assert claims["iss"] == "https://flathub.org"
    assert claims["sub"] == "sub-1"
    assert claims["aud"] == "test-client"
    assert "iat" in claims
    assert "exp" in claims
    assert "nonce" not in claims

    # Access token object was persisted
    assert len(added) == 1
    assert isinstance(added[0], OidcAccessToken)
    assert added[0].access_token_hash == hash_token("test-access-token")


def test_token_valid_exchange_with_client_secret_basic(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
        "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
    ), patch("app.routes.oidc.generate_token", return_value="test-access-token"):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
            },
            headers=_basic_auth_header("test-client", CLIENT_SECRET),
        )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "test-access-token"
    assert body["token_type"] == "Bearer"
    assert "id_token" in body


def test_token_includes_nonce_in_id_token(token_client):
    auth_code_row = _make_auth_code_row(nonce="test-nonce")
    client_obj = _make_token_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
        "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
    ), patch("app.routes.oidc.generate_token", return_value="test-access-token"):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 200
    id_token = response.json()["id_token"]
    claims = _decode_jwt_payload(id_token)
    assert claims["nonce"] == "test-nonce"


def test_token_bad_client_secret(token_client):
    client_obj = _make_token_client()
    get_db_mock = _mock_token_db(client_obj=client_obj)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": "wrong-secret",
            },
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_client"}


def test_token_client_secret_post_missing_secret(token_client):
    client_obj = _make_token_client()
    get_db_mock = _mock_token_db(client_obj=client_obj)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
            },
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_client"}


def test_token_unsupported_grant_type(token_client):
    client_obj = _make_token_client()
    get_db_mock = _mock_token_db(client_obj=client_obj)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "client_credentials",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "unsupported_grant_type"}


def test_token_expired_code(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row(expired=True)
    user = FlathubUser(id=1, oidc_subject="sub-1")
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_token_code_replay(token_client):
    # Already-consumed code: UPDATE WHERE consumed_at IS NULL returns no rows
    client_obj = _make_token_client()
    get_db_mock = _mock_token_db(client_obj=client_obj, auth_code_row=None)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_token_wrong_client(token_client):
    client_obj = _make_token_client()
    # Code was issued to a different client; UPDATE returns the row but client_id check fails
    auth_code_row = _make_auth_code_row(client_id="other-client")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_token_wrong_redirect_uri(token_client):
    client_obj = _make_token_client()
    # Code's redirect_uri doesn't match the request; UPDATE returns the row but check fails
    auth_code_row = _make_auth_code_row()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": "https://evil.example.com/callback",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_token_unknown_code(token_client):
    client_obj = _make_token_client()
    # No auth code found for this hash: UPDATE matches no rows
    get_db_mock = _mock_token_db(client_obj=client_obj, auth_code_row=None)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "nonexistent-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_token_no_client_credentials(token_client):
    with patch("app.routes.oidc.get_db", side_effect=_mock_token_db()):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
            },
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_client"}


def test_token_id_token_signature_verifiable(token_client):
    """Verify that the ID token can be verified with the public JWKS key."""
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row(nonce="sig-test-nonce")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock), patch(
        "app.routes.oidc.ensure_oidc_subject", return_value="sub-1"
    ), patch("app.routes.oidc.generate_token", return_value="test-access-token"):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 200
    id_token_str = response.json()["id_token"]

    # Verify using the public key from JWKS endpoint
    jwks_response = token_client.get("/oidc/jwks.json")
    assert jwks_response.status_code == 200
    key_set = jwk.KeySet.import_key_set(jwks_response.json())

    # Decode and verify signature
    token_obj = jwt.decode(id_token_str, key=key_set, algorithms=["RS256"])
    claims = token_obj.claims

    assert claims["iss"] == "https://flathub.org"
    assert claims["sub"] == "sub-1"
    assert claims["aud"] == "test-client"
    assert claims["nonce"] == "sig-test-nonce"
    assert "iat" in claims
    assert "exp" in claims
