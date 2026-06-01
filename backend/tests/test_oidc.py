import base64
import hashlib
import json
import os
import sys
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any, cast
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
    OidcRefreshToken,
)
from app.oidc import (
    ensure_oidc_subject,
    generate_token,
    hash_client_secret,
    hash_token,
    oidc_client_enabled,
    redirect_uri_allowed,
    requested_scopes_allowed,
    verify_client_secret,
    verify_pkce_s256,
    verify_token,
)
from app.routes import oidc as oidc_routes
from app.utils import utcnow

PRIVATE_JWK_FIELDS = {"d", "p", "q", "dp", "dq", "qi", "oth"}


def _decode_jwt_payload(token_str):
    """Decode JWT claims without signature verification (for test inspection)."""
    parts = token_str.split(".")
    assert len(parts) == 3, f"Expected 3 JWT parts, got {len(parts)}"
    payload_b64 = parts[1]
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
    app.add_middleware(cast("Any", SessionMiddleware), secret_key="test-session-secret")
    with TestClient(app, raise_server_exceptions=False) as client_:
        yield client_


def enable_oidc(monkeypatch, private_jwks=None):
    monkeypatch.setattr(config.settings, "oidc_enabled", True)
    monkeypatch.setattr(config.settings, "oidc_issuer", "https://flathub.org")
    monkeypatch.setattr(config.settings, "oidc_private_jwks", private_jwks)


@pytest.mark.parametrize(
    "path", ["/.well-known/openid-configuration", "/oidc/jwks.json", "/oidc/userinfo"]
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


def test_oidc_discovery_advertises_pkce_s256(client, monkeypatch):
    enable_oidc(monkeypatch)

    response = client.get("/.well-known/openid-configuration")

    assert response.status_code == 200
    body = response.json()
    assert body["response_types_supported"] == ["code"]
    assert body["grant_types_supported"] == ["authorization_code", "refresh_token"]
    assert "registration_endpoint" not in body
    assert body["code_challenge_methods_supported"] == ["S256"]


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


def test_oidc_openapi_does_not_include_secret_material(client, monkeypatch):
    private_key = jwk.generate_key(
        "RSA",
        2048,
        parameters={"alg": "RS256", "kid": "test-key", "use": "sig"},
    ).as_dict(private=True)
    enable_oidc(monkeypatch, json.dumps({"keys": [private_key]}))

    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema_text = json.dumps(response.json())
    assert "oidc_private_jwks" not in schema_text
    assert "client_secret_hash" not in schema_text
    for field in PRIVATE_JWK_FIELDS:
        if field in private_key:
            private_value = private_key[field]
            if isinstance(private_value, str):
                assert private_value not in schema_text

    assert "refresh_token_hash" not in schema_text
    assert "access_token_hash" not in schema_text


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


def test_oidc_refresh_token_in_tables_for_delete():
    assert OidcRefreshToken in FlathubUser.TABLES_FOR_DELETE


def test_delete_user_clears_oidc_subject():
    user = FlathubUser(id=1, oidc_subject="sub-to-clear")
    db = MagicMock()

    with (
        patch.object(FlathubUser, "generate_token", return_value="tok"),
        patch.object(FlathubUser, "TABLES_FOR_DELETE", []),
    ):
        result = FlathubUser.delete_user(db, user, "tok")

    assert user.oidc_subject is None
    assert user.deleted is True
    assert result.status == "ok"


def test_oidc_refresh_token_delete_hook_revokes_tokens():
    user = FlathubUser(id=42)
    refresh_db = StatementDb()

    OidcRefreshToken.delete_user(refresh_db, user)

    refresh_sql = compile_statement(refresh_db.session.statements[0])

    assert "UPDATE oidcrefreshtoken SET revoked_at=" in refresh_sql
    assert "oidcrefreshtoken.user_id = 42" in refresh_sql
    assert "oidcrefreshtoken.revoked_at IS NULL" in refresh_sql


def test_oidc_refresh_token_model_has_hash_only_storage():
    """Verify OidcRefreshToken stores only the hash, not the plaintext token."""
    column_names = {c.name for c in OidcRefreshToken.__table__.columns}
    assert "refresh_token_hash" in column_names
    assert "refresh_token" not in column_names
    assert "plaintext" not in column_names


def test_oidc_refresh_token_model_has_family_fields():
    """Verify family/rotation fields exist on OidcRefreshToken."""
    column_names = {c.name for c in OidcRefreshToken.__table__.columns}
    assert "family_id" in column_names
    assert "rotated_at" in column_names
    assert "revoked_at" in column_names
    assert "replaced_by_id" in column_names


def test_oidc_access_token_has_refresh_token_family_id():
    """Verify OidcAccessToken has refresh_token_family_id for replay handling."""
    column_names = {c.name for c in OidcAccessToken.__table__.columns}
    assert "refresh_token_family_id" in column_names


def test_oidc_client_has_refresh_tokens_enabled():
    """Verify OidcClient has refresh_tokens_enabled flag."""
    column_names = {c.name for c in OidcClient.__table__.columns}
    assert "refresh_tokens_enabled" in column_names


def test_oidc_refresh_token_lifetime_config_default():
    """Verify the default refresh token lifetime config value."""
    from app import config

    assert (
        config.Settings.model_fields["oidc_refresh_token_lifetime_seconds"].default
        == 2592000
    )


def test_access_token_scope_removes_offline_access():
    """_access_token_scope helper removes offline_access from scope string."""
    from app.routes.oidc import _access_token_scope

    assert _access_token_scope("openid profile email") == "openid profile email"
    assert (
        _access_token_scope("openid profile email offline_access")
        == "openid profile email"
    )
    assert _access_token_scope("openid offline_access") == "openid"
    assert _access_token_scope("openid") == "openid"


def test_scope_subset_or_invalid_allows_narrowing():
    """_scope_subset_or_invalid allows narrowing but not expanding scopes."""
    from app.routes.oidc import _scope_subset_or_invalid

    assert (
        _scope_subset_or_invalid("openid profile", "openid profile email")
        == "openid profile"
    )
    assert (
        _scope_subset_or_invalid("openid profile email", "openid profile email")
        == "openid profile email"
    )
    assert (
        _scope_subset_or_invalid("openid profile email admin", "openid profile email")
        is None
    )
    assert _scope_subset_or_invalid("", "openid profile email") == ""


def test_revoke_refresh_family_compiles_expected_sql():
    """_revoke_refresh_family issues UPDATE statements for refresh and access tokens."""
    from app.routes.oidc import _revoke_refresh_family

    now = datetime.now(UTC)

    combined_session = StatementSession()

    combined_db = MagicMock()
    combined_db.session = combined_session

    _revoke_refresh_family(combined_db, "family-abc", now)

    assert len(combined_session.statements) == 2
    refresh_sql = compile_statement(combined_session.statements[0])
    access_sql = compile_statement(combined_session.statements[1])
    assert "UPDATE oidcrefreshtoken SET revoked_at=" in refresh_sql
    assert "oidcrefreshtoken.family_id = 'family-abc'" in refresh_sql
    assert "oidcrefreshtoken.revoked_at IS NULL" in refresh_sql
    assert "UPDATE oidcaccesstoken SET revoked_at=" in access_sql
    assert "oidcaccesstoken.refresh_token_family_id = 'family-abc'" in access_sql
    assert "oidcaccesstoken.revoked_at IS NULL" in access_sql


def test_discovery_advertises_refresh_token_grant_and_offline_access(
    client, monkeypatch
):
    enable_oidc(monkeypatch)
    response = client.get("/.well-known/openid-configuration")
    assert response.status_code == 200
    body = response.json()
    assert "refresh_token" in body["grant_types_supported"]
    assert "offline_access" in body["scopes_supported"]


REDIRECT_URI = "https://test-client.example.com/oauth2/callback"
AUTHORIZE_PARAMS = {
    "client_id": "test-client",
    "redirect_uri": REDIRECT_URI,
    "response_type": "code",
    "scope": "openid profile email",
    "state": "test-state",
}


def _make_client(enabled=True, refresh_tokens_enabled=False, allowed_scopes=None):
    client = OidcClient(
        id=1,
        client_id="test-client",
        name="Test Client",
        client_secret_hash="hash",
        redirect_uris=[REDIRECT_URI],
        allowed_scopes=allowed_scopes or ["openid", "profile", "email"],
        enabled=enabled,
        refresh_tokens_enabled=refresh_tokens_enabled,
    )
    return client


def test_oidc_client_enabled_helper_rejects_disabled_clients():
    assert oidc_client_enabled(_make_client())
    assert not oidc_client_enabled(_make_client(enabled=False))
    assert not oidc_client_enabled(None)


def test_redirect_uri_helper_requires_exact_match():
    allowed_redirect_uris = [REDIRECT_URI]

    assert redirect_uri_allowed(REDIRECT_URI, allowed_redirect_uris)
    assert not redirect_uri_allowed(f"{REDIRECT_URI}/", allowed_redirect_uris)
    assert not redirect_uri_allowed(
        f"{REDIRECT_URI}?next=/admin", allowed_redirect_uris
    )
    assert not redirect_uri_allowed(
        "https://evil.example.com/callback", allowed_redirect_uris
    )


def test_scope_helper_requires_openid_and_client_allowed_scopes():
    allowed_scopes = ["openid", "profile", "email"]

    assert requested_scopes_allowed("openid profile email", allowed_scopes)
    assert requested_scopes_allowed("openid", allowed_scopes)
    assert not requested_scopes_allowed("profile email", allowed_scopes)
    assert not requested_scopes_allowed("openid profile admin", allowed_scopes)


def test_verify_pkce_s256():
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    challenge = (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest())
        .rstrip(b"=")
        .decode("ascii")
    )
    assert verify_pkce_s256(verifier, challenge)
    assert not verify_pkce_s256("wrong-verifier", challenge)


def test_utcnow_is_naive():
    now = utcnow()
    assert now.tzinfo is None


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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    **AUTHORIZE_PARAMS,
                    "redirect_uri": "https://evil.example.com/callback",
                },
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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
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


def test_authorize_pkce_s256_accepted_and_stored(authorize_client):
    valid_client = _make_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=valid_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    **AUTHORIZE_PARAMS,
                    "code_challenge": "test-challenge",
                    "code_challenge_method": "S256",
                },
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert "code=test-auth-code" in response.headers["location"]
    assert len(added) == 1
    authz_code = added[0]
    assert authz_code.code_challenge == "test-challenge"
    assert authz_code.code_challenge_method == "S256"


def test_authorize_pkce_plain_method_rejected(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    **AUTHORIZE_PARAMS,
                    "code_challenge": "test-challenge",
                    "code_challenge_method": "plain",
                },
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert REDIRECT_URI in response.headers["location"]
    assert "error=invalid_request" in response.headers["location"]
    assert "state=test-state" in response.headers["location"]


def test_authorize_pkce_challenge_without_method_rejected(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={**AUTHORIZE_PARAMS, "code_challenge": "test-challenge"},
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert REDIRECT_URI in response.headers["location"]
    assert "error=invalid_request" in response.headers["location"]


def test_authorize_missing_openid_scope(authorize_client):
    valid_client = _make_client()
    get_db_mock = _mock_db_ctx(client_obj=valid_client)
    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    location = response.headers["location"]
    assert location.startswith(
        "http://localhost:3000/login?returnTo=%2Foidc%2Fauthorize"
    ), location
    assert "redirect_uri" not in location


def test_authorize_authenticated_issues_code(authorize_client):
    valid_client = _make_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=valid_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
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


def test_authorize_deleted_user_is_denied(authorize_client):
    valid_client = _make_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    user.deleted = True
    added = []
    get_db_mock = _mock_db_ctx(client_obj=valid_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject") as ensure_subject,
        ):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert REDIRECT_URI in response.headers["location"]
    assert "error=access_denied" in response.headers["location"]
    assert added == []
    ensure_subject.assert_not_called()


def test_authorize_nonce_persisted(authorize_client):
    valid_client = _make_client()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=valid_client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
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
        replica_client=valid_client,
        writer_client=disabled_client,
        user=user,
        added=added,
    )

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
            response = authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_client"}
    assert len(added) == 0


NESTED_REDIRECT_URI = (
    "https://test-client.example.com/oauth2/callback%3Fnext%3D%252Fadmin%26foo%3Dbar"
)


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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
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
        refresh_tokens_enabled=False,
    )


def test_authorize_fresh_request_ignores_stale_session(authorize_client):
    client = make_client_with_redirect(REDIRECT_URI)
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=client, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )

        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="fresh-code"),
        ):
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
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
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
        assert location.startswith(
            "http://localhost:3000/login?returnTo=%2Foidc%2Fauthorize"
        )
        assert "redirect_uri" not in location

        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
            response = authorize_client.get("/oidc/authorize", follow_redirects=False)
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert len(added) == 1
    assert added[0].redirect_uri == NESTED_REDIRECT_URI


def test_authorize_malformed_fresh_request_ignores_stale_session(authorize_client):
    stale_client = make_client_with_redirect(REDIRECT_URI)
    get_db_mock = _mock_db_ctx(client_obj=stale_client)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            authorize_client.get(
                "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
            )

        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize?foo=bar", follow_redirects=False
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_request"}


def test_authorize_offline_access_rejected_if_client_refresh_disabled(authorize_client):
    """offline_access scope is rejected when client refresh_tokens_enabled=False."""
    client_obj = _make_client(
        refresh_tokens_enabled=False,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    get_db_mock = _mock_db_ctx(client_obj=client_obj)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_out_login()
        )
        with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    "client_id": "test-client",
                    "redirect_uri": REDIRECT_URI,
                    "response_type": "code",
                    "scope": "openid profile email offline_access",
                    "state": "test-state",
                },
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert REDIRECT_URI in response.headers["location"]
    assert "error=invalid_scope" in response.headers["location"]


def test_authorize_offline_access_allowed_if_client_refresh_enabled(authorize_client):
    """offline_access scope is allowed when client has refresh_tokens_enabled=True."""
    client_obj = _make_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_db_ctx(client_obj=client_obj, user=user, added=added)

    try:
        authorize_client.app.dependency_overrides[login_state] = lambda: (
            _make_logged_in_login()
        )
        with (
            patch("app.routes.oidc.get_db", side_effect=get_db_mock),
            patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
            patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
        ):
            response = authorize_client.get(
                "/oidc/authorize",
                params={
                    "client_id": "test-client",
                    "redirect_uri": REDIRECT_URI,
                    "response_type": "code",
                    "scope": "openid profile email offline_access",
                    "state": "test-state",
                },
                follow_redirects=False,
            )
    finally:
        authorize_client.app.dependency_overrides.clear()

    assert response.status_code == 302
    assert len(added) == 1
    assert added[0].scope == "openid profile email offline_access"


# ── Token endpoint tests ──

TOKEN_REDIRECT_URI = REDIRECT_URI
CLIENT_SECRET = "s3cret"


def _generate_test_jwks():
    key = jwk.generate_key(
        "RSA", 2048, parameters={"alg": "RS256", "kid": "test-key", "use": "sig"}
    )
    return json.dumps({"keys": [key.as_dict(private=True)]})


def _make_token_client(
    secret=CLIENT_SECRET, refresh_tokens_enabled=False, allowed_scopes=None
):
    return OidcClient(
        id=1,
        client_id="test-client",
        name="Test Client",
        client_secret_hash=hash_client_secret(secret),
        redirect_uris=[TOKEN_REDIRECT_URI],
        allowed_scopes=allowed_scopes or ["openid", "profile", "email"],
        enabled=True,
        refresh_tokens_enabled=refresh_tokens_enabled,
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
        code_challenge=None,
        code_challenge_method=None,
    ):
        self.client_id = client_id
        self.user_id = user_id
        self.redirect_uri = redirect_uri
        self.scope = scope
        self.nonce = nonce
        self.code_challenge = code_challenge
        self.code_challenge_method = code_challenge_method
        self.expires_at = expires_at


def _make_auth_code_row(
    client_id="test-client",
    user_id=1,
    redirect_uri=TOKEN_REDIRECT_URI,
    scope="openid profile",
    nonce=None,
    expired=False,
    code_challenge=None,
    code_challenge_method=None,
):
    now = utcnow()
    return _AuthCodeRow(
        client_id=client_id,
        user_id=user_id,
        redirect_uri=redirect_uri,
        scope=scope,
        nonce=nonce,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        expires_at=now + timedelta(seconds=600)
        if not expired
        else now - timedelta(seconds=1),
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
    writer_session = MagicMock()

    client_query = MagicMock()
    client_query.first.return_value = client_obj
    writer_session.query.return_value.filter.return_value = client_query

    execute_result = MagicMock()
    execute_result.first.return_value = auth_code_row
    writer_session.execute.return_value = execute_result

    writer_session.get.return_value = user_obj

    if added is not None:
        writer_session.add.side_effect = lambda obj: added.append(obj)
    else:
        writer_session.add = MagicMock()

    writer_db = MagicMock()
    writer_db.session = writer_session

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

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-access-token"),
    ):
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
    assert "refresh_token" not in body

    id_token = body["id_token"]
    claims = _decode_jwt_payload(id_token)
    assert claims["iss"] == "https://flathub.org"
    assert claims["sub"] == "sub-1"
    assert claims["aud"] == "test-client"
    assert "iat" in claims
    assert "exp" in claims
    assert (
        claims["exp"] - claims["iat"] == config.settings.oidc_id_token_lifetime_seconds
    )
    assert "nonce" not in claims

    assert len(added) == 1
    assert isinstance(added[0], OidcAccessToken)
    assert added[0].access_token_hash == hash_token("test-access-token")


def _pkce_challenge(verifier):
    return (
        base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest())
        .rstrip(b"=")
        .decode("ascii")
    )


def test_token_pkce_valid_verifier(token_client):
    verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row(
        code_challenge=_pkce_challenge(verifier), code_challenge_method="S256"
    )
    user = FlathubUser(id=1, oidc_subject="sub-1")
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-access-token"),
    ):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "authorization_code",
                "code": "test-code",
                "redirect_uri": TOKEN_REDIRECT_URI,
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
                "code_verifier": verifier,
            },
        )

    assert response.status_code == 200
    assert response.json()["access_token"] == "test-access-token"


def test_token_pkce_wrong_verifier(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row(
        code_challenge=_pkce_challenge("the-real-verifier"),
        code_challenge_method="S256",
    )
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
                "code_verifier": "wrong-verifier",
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_token_pkce_missing_verifier(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row(
        code_challenge=_pkce_challenge("the-real-verifier"),
        code_challenge_method="S256",
    )
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


def test_token_valid_exchange_with_client_secret_basic(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-access-token"),
    ):
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

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-access-token"),
    ):
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


def test_token_disabled_client_returns_401(token_client):
    client_obj = _make_token_client()
    client_obj.enabled = False
    get_db_mock = _mock_token_db(client_obj=client_obj)

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


def test_token_deleted_user_returns_invalid_grant(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    user.deleted = True
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject") as ensure_subject,
    ):
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
    assert added == []
    ensure_subject.assert_not_called()


def test_token_code_replay(token_client):
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

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-access-token"),
    ):
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

    jwks_response = token_client.get("/oidc/jwks.json")
    assert jwks_response.status_code == 200
    key_set = jwk.KeySet.import_key_set(jwks_response.json())

    token_obj = jwt.decode(id_token_str, key=key_set, algorithms=["RS256"])
    claims = token_obj.claims

    assert claims["iss"] == "https://flathub.org"
    assert claims["sub"] == "sub-1"
    assert claims["aud"] == "test-client"
    assert claims["nonce"] == "sig-test-nonce"
    assert "iat" in claims
    assert "exp" in claims


def test_token_auth_code_with_offline_access_returns_refresh_token(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    auth_code_row = _make_auth_code_row(scope="openid profile email offline_access")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch(
            "app.routes.oidc.generate_token",
            side_effect=["test-family-id", "test-refresh-token", "test-access-token"],
        ),
    ):
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
    assert "refresh_token" in body
    assert body["refresh_token"] == "test-refresh-token"
    assert body["scope"] == "openid profile email"

    access_token_obj = next(o for o in added if isinstance(o, OidcAccessToken))
    assert "offline_access" not in access_token_obj.scope
    assert access_token_obj.refresh_token_family_id == "test-family-id"

    refresh_obj = next(o for o in added if isinstance(o, OidcRefreshToken))
    assert refresh_obj.refresh_token_hash == hash_token("test-refresh-token")
    assert refresh_obj.family_id == "test-family-id"
    assert refresh_obj.scope == "openid profile email offline_access"


def test_token_auth_code_without_offline_access_no_refresh_token(token_client):
    client_obj = _make_token_client()
    auth_code_row = _make_auth_code_row(scope="openid profile")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-access-token"),
    ):
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
    assert "refresh_token" not in body
    assert not any(isinstance(o, OidcRefreshToken) for o in added)


def test_token_auth_code_offline_access_ignored_if_client_refresh_disabled(
    token_client,
):
    client_obj = _make_token_client(
        refresh_tokens_enabled=False,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    auth_code_row = _make_auth_code_row(scope="openid profile email offline_access")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-access-token"),
    ):
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
    assert "refresh_token" not in body
    assert not any(isinstance(o, OidcRefreshToken) for o in added)


def test_token_refresh_token_stored_hashed_only(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    auth_code_row = _make_auth_code_row(scope="openid profile email offline_access")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch(
            "app.routes.oidc.generate_token",
            side_effect=["test-family-id", "test-refresh-token", "test-access-token"],
        ),
    ):
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
    refresh_obj = next(o for o in added if isinstance(o, OidcRefreshToken))
    assert refresh_obj.refresh_token_hash == hash_token("test-refresh-token")
    assert refresh_obj.refresh_token_hash != "test-refresh-token"


def test_token_access_token_scope_excludes_offline_access(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    auth_code_row = _make_auth_code_row(scope="openid profile email offline_access")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_token_db(
        client_obj=client_obj, auth_code_row=auth_code_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch(
            "app.routes.oidc.generate_token",
            side_effect=["test-family-id", "test-refresh-token", "test-access-token"],
        ),
    ):
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
    access_token_obj = next(o for o in added if isinstance(o, OidcAccessToken))
    assert "offline_access" not in access_token_obj.scope
    assert "openid" in access_token_obj.scope


# ---------------------------------------------------------------------------
# Refresh grant tests
# ---------------------------------------------------------------------------


class _RefreshTokenRow:
    """Simulates a RETURNING row from UPDATE ... RETURNING."""

    def __init__(
        self,
        id=1,
        user_id=1,
        family_id="test-family",
        scope="openid profile email offline_access",
        expires_at=None,
    ):
        self.id = id
        self.user_id = user_id
        self.family_id = family_id
        self.scope = scope
        now = utcnow()
        self.expires_at = expires_at or (now + timedelta(days=30))


class _RtObjForReplay:
    """Simulates an OidcRefreshToken ORM object found during replay check."""

    def __init__(
        self,
        family_id="test-family",
        rotated_at=None,
        revoked_at=None,
    ):
        self.family_id = family_id
        self.rotated_at = rotated_at
        self.revoked_at = revoked_at


def _mock_refresh_db(
    client_obj=None,
    rt_row=None,
    replay_obj=None,
    user_obj=None,
    added=None,
):
    writer_session = MagicMock()

    client_query = MagicMock()
    client_query.first.return_value = client_obj
    replay_query = MagicMock()
    replay_query.first.return_value = replay_obj

    query_count = [0]

    def _query_side_effect(*args, **kwargs):
        query_count[0] += 1
        if query_count[0] == 1:
            return MagicMock(filter=MagicMock(return_value=client_query))
        else:
            return MagicMock(filter=MagicMock(return_value=replay_query))

    writer_session.query = MagicMock(side_effect=_query_side_effect)

    writer_session.get.return_value = user_obj

    if added is not None:
        writer_session.add.side_effect = lambda obj: added.append(obj)
    else:
        writer_session.add = MagicMock()

    writer_session.flush = MagicMock()

    execute_call_count = [0]
    execute_results = []

    def _execute_side_effect(statement, *args, **kwargs):
        execute_call_count[0] += 1
        if execute_results:
            result_mock = MagicMock()
            result_mock.first.return_value = execute_results.pop(0)
            return result_mock
        result_mock = MagicMock()
        result_mock.first.return_value = rt_row
        return result_mock

    writer_session.execute = MagicMock(side_effect=_execute_side_effect)
    writer_session.commit = MagicMock()

    writer_db = MagicMock()
    writer_db.session = writer_session

    @contextmanager
    def _ctx(db_type="replica", **_kwargs):
        yield writer_db

    _ctx.session = writer_session
    return _ctx


def test_refresh_grant_valid(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    rt_row = _RefreshTokenRow()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_refresh_db(
        client_obj=client_obj, rt_row=rt_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch(
            "app.routes.oidc.generate_token",
            side_effect=["new-refresh-token", "new-access-token"],
        ),
    ):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "new-access-token"
    assert body["refresh_token"] == "new-refresh-token"
    assert body["token_type"] == "Bearer"
    assert "offline_access" not in body["scope"]
    assert "id_token" in body

    new_rt = next(o for o in added if isinstance(o, OidcRefreshToken))
    assert new_rt.refresh_token_hash == hash_token("new-refresh-token")
    assert new_rt.family_id == "test-family"
    new_at = next(o for o in added if isinstance(o, OidcAccessToken))
    assert "offline_access" not in new_at.scope


def test_refresh_grant_expired_token(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    now = utcnow()
    rt_row = _RefreshTokenRow(expires_at=now - timedelta(seconds=1))
    user = FlathubUser(id=1, oidc_subject="sub-1")
    get_db_mock = _mock_refresh_db(client_obj=client_obj, rt_row=rt_row, user_obj=user)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_refresh_grant_revoked_token(token_client):
    now = datetime.now(UTC)
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    replay_obj = _RtObjForReplay(revoked_at=now - timedelta(seconds=1))
    get_db_mock = _mock_refresh_db(
        client_obj=client_obj, rt_row=None, replay_obj=replay_obj
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_refresh_grant_wrong_client(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    get_db_mock = _mock_refresh_db(client_obj=client_obj, rt_row=None)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_refresh_grant_disabled_client(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    client_obj.enabled = False
    get_db_mock = _mock_refresh_db(client_obj=client_obj)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_client"}


def test_refresh_grant_client_refresh_disabled(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=False,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    get_db_mock = _mock_refresh_db(client_obj=client_obj)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_client"}


def test_refresh_grant_deleted_user(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    rt_row = _RefreshTokenRow()
    user = FlathubUser(id=1, oidc_subject="sub-1")
    user.deleted = True
    get_db_mock = _mock_refresh_db(client_obj=client_obj, rt_row=rt_row, user_obj=user)

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject") as ensure_subject,
    ):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}
    ensure_subject.assert_not_called()


def test_refresh_grant_missing_token(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    get_db_mock = _mock_refresh_db(client_obj=client_obj)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_request"}


def test_refresh_grant_scope_narrowing(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    rt_row = _RefreshTokenRow(scope="openid profile email offline_access")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_refresh_db(
        client_obj=client_obj, rt_row=rt_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch(
            "app.routes.oidc.generate_token",
            side_effect=["new-refresh-token", "new-access-token"],
        ),
    ):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "scope": "openid profile",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["scope"] == "openid profile"
    new_rt = next(o for o in added if isinstance(o, OidcRefreshToken))
    assert new_rt.scope == "openid profile"


def test_refresh_grant_narrowing_dropping_openid_omits_id_token(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    rt_row = _RefreshTokenRow(scope="openid profile email offline_access")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    added = []
    get_db_mock = _mock_refresh_db(
        client_obj=client_obj, rt_row=rt_row, user_obj=user, added=added
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch(
            "app.routes.oidc.generate_token",
            side_effect=["new-refresh-token", "new-access-token"],
        ),
    ):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "scope": "profile",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["scope"] == "profile"
    assert body["access_token"] == "new-access-token"
    assert body["refresh_token"] == "new-refresh-token"
    assert "id_token" not in body
    new_rt = next(o for o in added if isinstance(o, OidcRefreshToken))
    assert new_rt.scope == "profile"


def test_refresh_grant_scope_expansion_rejected(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    rt_row = _RefreshTokenRow(scope="openid profile")
    user = FlathubUser(id=1, oidc_subject="sub-1")
    get_db_mock = _mock_refresh_db(client_obj=client_obj, rt_row=rt_row, user_obj=user)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "scope": "openid profile email",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_scope"}


def test_refresh_grant_replay_revokes_family(token_client):
    now = datetime.now(UTC)
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    replay_obj = _RtObjForReplay(rotated_at=now - timedelta(seconds=1))
    added = []
    get_db_mock = _mock_refresh_db(
        client_obj=client_obj, rt_row=None, replay_obj=replay_obj, added=added
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}
    assert not any(isinstance(o, OidcRefreshToken) for o in added)
    assert not any(isinstance(o, OidcAccessToken) for o in added)

    session = get_db_mock.session
    session.commit.assert_called()
    assert session.execute.call_count >= 3

    # Inspect the actual SQL issued by _revoke_refresh_family
    execute_calls = session.execute.call_args_list
    sql_strings = [compile_statement(call[0][0]) for call in execute_calls]
    refresh_revocation = any(
        "UPDATE oidcrefreshtoken SET revoked_at=" in s
        and "oidcrefreshtoken.family_id" in s
        for s in sql_strings
    )
    access_revocation = any(
        "UPDATE oidcaccesstoken SET revoked_at=" in s
        and "oidcaccesstoken.refresh_token_family_id" in s
        for s in sql_strings
    )
    assert refresh_revocation, "no refresh-token family revocation UPDATE found"
    assert access_revocation, "no access-token family revocation UPDATE found"


def test_refresh_grant_unknown_token_returns_invalid_grant(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    get_db_mock = _mock_refresh_db(
        client_obj=client_obj, rt_row=None, replay_obj=None, user_obj=None
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "unknown-token",
                "client_id": "test-client",
                "client_secret": CLIENT_SECRET,
            },
        )

    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_grant"}


def test_refresh_grant_bad_client_secret(token_client):
    client_obj = _make_token_client(
        refresh_tokens_enabled=True,
        allowed_scopes=["openid", "profile", "email", "offline_access"],
    )
    get_db_mock = _mock_refresh_db(client_obj=client_obj)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = token_client.post(
            "/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": "old-refresh-token",
                "client_id": "test-client",
                "client_secret": "wrong-secret",
            },
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_client"}


USERINFO_TOKEN = "test-userinfo-token"


def _make_access_token_obj(
    client_id="test-client",
    user_id=1,
    scope="openid profile email",
    expired=False,
    revoked=False,
):
    now = datetime.now(UTC)
    token = MagicMock()
    token.client_id = client_id
    token.user_id = user_id
    token.access_token_hash = hash_token(USERINFO_TOKEN)
    token.scope = scope
    token.created_at = now - timedelta(seconds=60)
    token.expires_at = (
        now + timedelta(seconds=3600) if not expired else now - timedelta(seconds=1)
    )
    token.revoked_at = now - timedelta(seconds=1) if revoked else None
    return token


def _make_connected_account(
    login="testuser",
    avatar_url="https://example.com/avatar.png",
    email="test@example.com",
):
    account = MagicMock()
    account.login = login
    account.avatar_url = avatar_url
    account.email = email
    return account


def _mock_userinfo_db(
    access_token_obj=None,
    user_obj=None,
):
    """Mock get_db for the userinfo endpoint."""
    writer_session = MagicMock()

    token_query = MagicMock()

    token_query.filter.return_value = token_query
    if access_token_obj is not None:
        token_query.first.return_value = access_token_obj
    else:
        token_query.first.return_value = None
    writer_session.query.return_value = token_query

    writer_session.get.return_value = user_obj

    writer_db = MagicMock()
    writer_db.session = writer_session

    @contextmanager
    def _ctx(db_type="writer", **_kwargs):
        yield writer_db

    return _ctx, writer_session


def test_userinfo_valid(client, monkeypatch):
    """Valid Bearer token returns correct claims for all scopes."""
    enable_oidc(monkeypatch)
    access_token_obj = _make_access_token_obj(scope="openid profile email")
    user = FlathubUser(id=1, display_name="Test User", oidc_subject="sub-1")
    default_account = _make_connected_account()
    get_db_mock, _session = _mock_userinfo_db(
        access_token_obj=access_token_obj, user_obj=user
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch.object(FlathubUser, "get_default_account", return_value=default_account),
    ):
        response = client.get(
            "/oidc/userinfo",
            headers={"Authorization": f"Bearer {USERINFO_TOKEN}"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["sub"] == "sub-1"
    assert body["name"] == "Test User"
    assert body["preferred_username"] == "testuser"
    assert body["picture"] == "https://example.com/avatar.png"
    assert body["email"] == "test@example.com"

    assert "roles" not in body
    assert "permissions" not in body


def test_userinfo_missing_token(client, monkeypatch):
    """Missing Authorization header returns 401."""
    enable_oidc(monkeypatch)

    response = client.get("/oidc/userinfo")

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_token"}


def test_userinfo_invalid_token(client, monkeypatch):
    """Invalid (non-existent) token returns 401."""
    enable_oidc(monkeypatch)
    get_db_mock, _session = _mock_userinfo_db(access_token_obj=None, user_obj=None)

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = client.get(
            "/oidc/userinfo",
            headers={"Authorization": "Bearer nonexistent-token"},
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_token"}


def test_userinfo_expired_token(client, monkeypatch):
    """Expired tokens are excluded by the expires_at filter in the query."""
    enable_oidc(monkeypatch)
    get_db_mock, writer_session = _mock_userinfo_db(
        access_token_obj=None, user_obj=None
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = client.get(
            "/oidc/userinfo",
            headers={"Authorization": f"Bearer {USERINFO_TOKEN}"},
        )

    assert response.status_code == 401
    filter_args = writer_session.query.return_value.filter.call_args[0]
    sql_fragments = [
        str(
            arg.compile(
                dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
            )
        )
        for arg in filter_args
    ]
    assert any("oidcaccesstoken.expires_at >" in s for s in sql_fragments)


def test_userinfo_revoked_token(client, monkeypatch):
    """Revoked tokens are excluded by the revoked_at IS NULL filter in the query."""
    enable_oidc(monkeypatch)
    get_db_mock, writer_session = _mock_userinfo_db(
        access_token_obj=None, user_obj=None
    )

    with patch("app.routes.oidc.get_db", side_effect=get_db_mock):
        response = client.get(
            "/oidc/userinfo",
            headers={"Authorization": f"Bearer {USERINFO_TOKEN}"},
        )

    assert response.status_code == 401
    filter_args = writer_session.query.return_value.filter.call_args[0]
    sql_fragments = [
        str(
            arg.compile(
                dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
            )
        )
        for arg in filter_args
    ]
    assert any("oidcaccesstoken.revoked_at IS NULL" in s for s in sql_fragments)


def test_userinfo_deleted_user_returns_invalid_token(client, monkeypatch):
    enable_oidc(monkeypatch)
    access_token_obj = _make_access_token_obj(scope="openid profile email")
    user = FlathubUser(id=1, display_name="Test User", oidc_subject="sub-1")
    user.deleted = True
    get_db_mock, _session = _mock_userinfo_db(
        access_token_obj=access_token_obj, user_obj=user
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject") as ensure_subject,
    ):
        response = client.get(
            "/oidc/userinfo",
            headers={"Authorization": f"Bearer {USERINFO_TOKEN}"},
        )

    assert response.status_code == 401
    assert response.json() == {"detail": "invalid_token"}
    ensure_subject.assert_not_called()


def test_userinfo_no_profile_scope(client, monkeypatch):
    """Without profile scope, name/preferred_username/picture are omitted."""
    enable_oidc(monkeypatch)
    access_token_obj = _make_access_token_obj(scope="openid email")
    user = FlathubUser(id=1, display_name="Test User", oidc_subject="sub-1")
    default_account = _make_connected_account()
    get_db_mock, _session = _mock_userinfo_db(
        access_token_obj=access_token_obj, user_obj=user
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch.object(FlathubUser, "get_default_account", return_value=default_account),
    ):
        response = client.get(
            "/oidc/userinfo",
            headers={"Authorization": f"Bearer {USERINFO_TOKEN}"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["sub"] == "sub-1"
    assert "name" not in body
    assert "preferred_username" not in body
    assert "picture" not in body

    assert body["email"] == "test@example.com"


def test_userinfo_no_email_scope(client, monkeypatch):
    """Without email scope, email/email_verified are omitted."""
    enable_oidc(monkeypatch)
    access_token_obj = _make_access_token_obj(scope="openid profile")
    user = FlathubUser(id=1, display_name="Test User", oidc_subject="sub-1")
    default_account = _make_connected_account()
    get_db_mock, _session = _mock_userinfo_db(
        access_token_obj=access_token_obj, user_obj=user
    )

    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch.object(FlathubUser, "get_default_account", return_value=default_account),
    ):
        response = client.get(
            "/oidc/userinfo",
            headers={"Authorization": f"Bearer {USERINFO_TOKEN}"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["sub"] == "sub-1"
    assert body["name"] == "Test User"
    assert body["preferred_username"] == "testuser"
    assert "email" not in body
    assert "email_verified" not in body
