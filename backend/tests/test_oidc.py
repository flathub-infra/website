import hashlib
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from sqlalchemy.dialects import postgresql

from app.models import FlathubUser, OidcAccessToken, OidcAuthorizationCode
from app.oidc import (
    ensure_oidc_subject,
    generate_token,
    hash_client_secret,
    hash_token,
    verify_client_secret,
    verify_token,
)


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
