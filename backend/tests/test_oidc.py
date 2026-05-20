import hashlib
import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app.models import FlathubUser
from app.oidc import (
    ensure_oidc_subject,
    generate_token,
    hash_client_secret,
    hash_token,
    verify_client_secret,
    verify_token,
)


class FakeDb:
    def __init__(self):
        self.added = []
        self.flushes = 0

    def add(self, item):
        self.added.append(item)

    def flush(self):
        self.flushes += 1


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


def test_lazy_subject_generation_persists_subject_once():
    db = FakeDb()
    user = FlathubUser(id=1)

    first_subject = ensure_oidc_subject(db, user)
    second_subject = ensure_oidc_subject(db, user)

    assert first_subject == second_subject
    assert user.oidc_subject == first_subject
    assert db.added == [user]
    assert db.flushes == 1
