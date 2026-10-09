import base64
import hashlib
import json
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
import redis
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from webauthn.helpers import encode_cbor

from app import cache, config, login_info, logins, models
from app.db_session import DBSession
from app.email_login import require_oauth_upgrade
from app.login_info import LoginStatusDep
from app.routes import oidc as oidc_routes
from app.types import JSONValue
from tests.test_email_login_transactions import add_user
from tests.test_oidc import (
    AUTHORIZE_PARAMS,
    REDIRECT_URI,
    _approve_consent,
    _make_client,
    _make_user,
    _mock_db_ctx,
    enable_oidc,
)

FRONTEND = "https://passkeys.example"
RP_ID = "passkeys.example"
ORIGIN = {"origin": FRONTEND}
UP, UV, AT = 0x01, 0x04, 0x40


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


class Authenticator:
    def __init__(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.credential_id = secrets.token_bytes(32)
        self.sign_count = 0

    @staticmethod
    def client_data(kind, challenge, origin, cross_origin):
        return json.dumps(
            {
                "type": kind,
                "challenge": challenge,
                "origin": origin,
                "crossOrigin": cross_origin,
            }
        ).encode()

    def register(
        self, options, *, origin=FRONTEND, flags=UP | UV | AT, cross_origin=False
    ):
        numbers = self.key.public_key().public_numbers()
        public_key = encode_cbor(
            {
                1: 2,
                3: -7,
                -1: 1,
                -2: numbers.x.to_bytes(32, "big"),
                -3: numbers.y.to_bytes(32, "big"),
            }
        )
        auth_data = (
            hashlib.sha256(RP_ID.encode()).digest()
            + bytes([flags])
            + (0).to_bytes(4, "big")
            + bytes(16)
            + len(self.credential_id).to_bytes(2, "big")
            + self.credential_id
            + public_key
        )
        client_data = self.client_data(
            "webauthn.create", options["challenge"], origin, cross_origin
        )
        return {
            "id": b64(self.credential_id),
            "rawId": b64(self.credential_id),
            "type": "public-key",
            "response": {
                "clientDataJSON": b64(client_data),
                "attestationObject": b64(
                    encode_cbor({"fmt": "none", "attStmt": {}, "authData": auth_data})
                ),
                "transports": ["internal", "hybrid"],
            },
            "clientExtensionResults": {},
        }

    def sign_in(
        self,
        options,
        user_handle,
        *,
        origin=FRONTEND,
        rp_id=RP_ID,
        flags=UP | UV,
        cross_origin=False,
        challenge=None,
        credential_id=None,
        key=None,
    ):
        auth_data = (
            hashlib.sha256(rp_id.encode()).digest()
            + bytes([flags])
            + self.sign_count.to_bytes(4, "big")
        )
        client_data = self.client_data(
            "webauthn.get", challenge or options["challenge"], origin, cross_origin
        )
        signature = (key or self.key).sign(
            auth_data + hashlib.sha256(client_data).digest(),
            ec.ECDSA(hashes.SHA256()),
        )
        response = {
            "clientDataJSON": b64(client_data),
            "authenticatorData": b64(auth_data),
            "signature": b64(signature),
        }
        if user_handle is not None:
            response["userHandle"] = b64(user_handle)
        raw_id = credential_id or self.credential_id
        return {
            "id": b64(raw_id),
            "rawId": b64(raw_id),
            "type": "public-key",
            "response": response,
            "clientExtensionResults": {},
        }


def session_of(client):
    cookie = client.cookies.get("session")
    if cookie is None:
        return {}
    return json.loads(
        base64.b64decode(
            TimestampSigner(config.settings.session_secret_key).unsign(cookie)
        )
    )


def clock(seconds):
    return patch.object(login_info, "time", SimpleNamespace(time=lambda: seconds))


@pytest.fixture
def env(isolated_email_db, monkeypatch):
    writer, engine = isolated_email_db
    monkeypatch.setattr(config.settings, "frontend_url", FRONTEND)

    @contextmanager
    def expiring_db(db_type="replica"):
        with Session(engine) as session:
            yield DBSession(session)
            if db_type == "writer":
                session.commit()

    monkeypatch.setattr(login_info, "get_db", expiring_db)
    app = FastAPI()
    logins.register_to_app(app)
    oidc_routes.register_to_app(app)
    app.add_middleware(cache.CacheControlMiddleware)

    @app.get("/current")
    def current(login: LoginStatusDep):
        return {"user_id": login.user.id if login.user else None}

    @app.post("/seed-session")
    def seed_session(request: Request, session: dict[str, JSONValue]):
        request.session.clear()
        request.session.update(session)

    clients = []

    def client(session=None):
        new = TestClient(
            app, base_url="https://testserver", client=(uuid4().hex, 50000)
        )
        if session is not None:
            assert new.post("/seed-session", json=session).status_code == 200
        clients.append(new)
        return new

    def fresh(user_id, method="email", **extra):
        return client(
            {
                "user-id": user_id,
                "auth-method": method,
                "auth-time": int(time.time()),
                **extra,
            }
        )

    with patch.object(logins.audit_log, "enqueue_audit_log") as audit:
        yield SimpleNamespace(
            app=app,
            writer=writer,
            engine=engine,
            client=client,
            fresh=fresh,
            audit=audit,
        )
    for opened in clients:
        opened.close()


def enroll(client, authenticator, name="Laptop", **kwargs):
    options = client.post(
        "/auth/passkeys/registration/options", json={}, headers=ORIGIN
    )
    assert options.status_code == 200, options.text
    body = options.json()
    return client.post(
        "/auth/passkeys/registration/verify",
        json={
            "challenge_id": body["challenge_id"],
            "credential": authenticator.register(body["options"], **kwargs),
            "name": name,
        },
        headers=ORIGIN,
    )


def login_options(client, return_to=None):
    response = client.post(
        "/auth/passkeys/authentication/options",
        json={"return_to": return_to},
        headers=ORIGIN,
    )
    assert response.status_code == 200, response.text
    return response.json()


def verify_login(client, challenge_id, credential):
    return client.post(
        "/auth/passkeys/authentication/verify",
        json={"challenge_id": challenge_id, "credential": credential},
        headers=ORIGIN,
    )


def handle_of(engine, user_id):
    with Session(engine) as session:
        return session.get(models.FlathubUser, user_id).webauthn_user_handle


def passkey_count(engine, user_id):
    with Session(engine) as session:
        return session.scalar(
            select(func.count()).where(models.PasskeyCredential.user == user_id)
        )


def sign_in(env, authenticator, user_id, return_to=None):
    client = env.client()
    options = login_options(client, return_to)
    response = verify_login(
        client,
        options["challenge_id"],
        authenticator.sign_in(options["options"], handle_of(env.engine, user_id)),
    )
    assert response.status_code == 200, response.text
    return client, response


def enrolled_user(env, provider="email"):
    user = add_user(env.writer, provider, None)
    authenticator = Authenticator()
    assert enroll(env.fresh(user.id), authenticator).status_code == 201
    return user, authenticator


def test_enrollment_keeps_identity_and_cannot_move_credentials(env):
    email_user = add_user(env.writer, "email", None)
    github_user = add_user(env.writer, "github", "Provider Name")
    shared = Authenticator()
    for user in (email_user, github_user):
        client = env.fresh(user.id, user.default_account)
        first = shared if user is email_user else Authenticator()
        created = enroll(client, first, "Laptop")
        assert created.status_code == 201, created.text
        assert created.json()["name"] == "Laptop"
        assert enroll(client, Authenticator(), "  Phone  ").status_code == 201
        listing = client.get("/auth/passkeys")
        assert listing.headers["cache-control"] == "no-store"
        assert [item["name"] for item in listing.json()["credentials"]] == [
            "Laptop",
            "Phone",
        ]
        assert b64(first.credential_id) not in listing.text
        options = client.post(
            "/auth/passkeys/registration/options", json={}, headers=ORIGIN
        ).json()["options"]
        assert len(options["excludeCredentials"]) == 2
        assert options["authenticatorSelection"]["residentKey"] == "required"
        assert options["authenticatorSelection"]["userVerification"] == "required"
        with Session(env.engine) as session:
            expected = session.scalar(
                select(models.EmailAccount.email).where(
                    models.EmailAccount.user == user.id
                )
            )
        expected = expected or "provider-login"
        assert (options["user"]["name"], options["user"]["displayName"]) == (
            expected,
            user.display_name or expected,
        )

    duplicate = enroll(env.fresh(github_user.id, "github"), shared)
    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": "passkey_already_registered"}
    with Session(env.engine) as session:
        owner = session.scalar(
            select(models.PasskeyCredential.user).where(
                models.PasskeyCredential.credential_id == shared.credential_id
            )
        )
        stored = session.get(models.FlathubUser, email_user.id)
        assert owner == email_user.id
        assert (stored.default_account, stored.display_name) == ("email", None)
        assert len(stored.roles) == 0
    assert passkey_count(env.engine, github_user.id) == 2

    anonymous = env.client().post(
        "/auth/passkeys/registration/options", json={}, headers=ORIGIN
    )
    assert anonymous.status_code == 401

    with env.writer() as db, pytest.raises(HTTPException) as restricted:
        require_oauth_upgrade(db, db.session.get(models.FlathubUser, email_user.id))
    assert restricted.value.detail == "oauth_upgrade_required"

    with env.writer() as db:
        upgraded = logins._upgrade_email_user(
            db,
            db.session.get(models.FlathubUser, email_user.id),
            "gitlab",
            SimpleNamespace(
                id=secrets.randbelow(2**31),
                login="reader",
                avatar_url=None,
                name=None,
                email=f"upgrade-{uuid4().hex}@example.com",
            ),
            {"access_token": "token"},
            models.GitlabAccount,
        )
        assert upgraded is not None
    assert passkey_count(env.engine, email_user.id) == 2


@pytest.mark.parametrize(
    "kwargs",
    [
        {"flags": UP | AT},
        {"origin": "https://evil.example"},
        {"cross_origin": True},
    ],
)
def test_registration_rejects_unverified_responses(env, kwargs):
    user = add_user(env.writer, "email", None)
    response = enroll(env.fresh(user.id), Authenticator(), **kwargs)
    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_passkey_response"}
    assert passkey_count(env.engine, user.id) == 0


def test_registration_envelope_and_user_binding(env):
    user = add_user(env.writer, "email", None)
    other = add_user(env.writer, "email", None)
    client = env.fresh(user.id)
    authenticator = Authenticator()
    options = client.post(
        "/auth/passkeys/registration/options", json={}, headers=ORIGIN
    ).json()
    body = {
        "challenge_id": options["challenge_id"],
        "credential": authenticator.register(options["options"]),
    }
    invalid_name = client.post(
        "/auth/passkeys/registration/verify",
        json={**body, "name": "   "},
        headers=ORIGIN,
    )
    assert invalid_name.status_code == 422
    assert invalid_name.json() == {"detail": "invalid_passkey_name"}
    assert invalid_name.headers["cache-control"] == "no-store"
    malformed = client.post(
        "/auth/passkeys/registration/verify",
        json={**body, "challenge_id": "short", "name": "Key"},
        headers=ORIGIN,
    )
    assert malformed.status_code == 400
    assert malformed.json() == {"detail": "invalid_passkey_response"}

    nonce = session_of(client)["passkey-flow"]
    intruder = env.fresh(other.id, **{"passkey-flow": nonce})
    stolen = intruder.post(
        "/auth/passkeys/registration/verify",
        json={**body, "name": "Key"},
        headers=ORIGIN,
    )
    assert stolen.status_code == 400
    assert passkey_count(env.engine, other.id) == 0
    assert passkey_count(env.engine, user.id) == 0


@pytest.mark.parametrize(
    "case",
    [
        "challenge",
        "origin",
        "rp_id",
        "signature",
        "user_presence",
        "user_verification",
        "cross_origin",
        "unknown_credential",
        "wrong_user_handle",
        "missing_user_handle",
        "counter_regression",
        "malformed",
    ],
)
def test_authentication_rejects_invalid_assertions(env, case):
    user, authenticator = enrolled_user(env)
    handle = handle_of(env.engine, user.id)
    if case == "counter_regression":
        with env.writer() as db:
            db.session.scalar(select(models.PasskeyCredential)).sign_count = 10
        authenticator.sign_count = 5
    variants = {
        "challenge": {"challenge": b64(secrets.token_bytes(32))},
        "origin": {"origin": "https://evil.example"},
        "rp_id": {"rp_id": "evil.example"},
        "signature": {"key": ec.generate_private_key(ec.SECP256R1())},
        "user_presence": {"flags": UV},
        "user_verification": {"flags": UP},
        "cross_origin": {"cross_origin": True},
        "unknown_credential": {"credential_id": secrets.token_bytes(32)},
    }
    client = env.client()
    options = login_options(client)
    if case == "malformed":
        credential = {"id": "x", "rawId": "x", "type": "public-key", "response": {}}
    elif case == "wrong_user_handle":
        credential = authenticator.sign_in(options["options"], secrets.token_bytes(64))
    elif case == "missing_user_handle":
        credential = authenticator.sign_in(options["options"], None)
    else:
        credential = authenticator.sign_in(
            options["options"], handle, **variants.get(case, {})
        )
    rejected = verify_login(client, options["challenge_id"], credential)
    assert rejected.status_code == 400
    assert rejected.json() == {"detail": "invalid_passkey_response"}
    assert "user-id" not in session_of(client)
    assert env.audit.call_args.args[2] == models.AuditEventType.LOGIN_FAILURE
    assert env.audit.call_args.kwargs["provider"] == "passkey"
    authenticator.sign_count += 1
    retry = verify_login(
        client,
        options["challenge_id"],
        authenticator.sign_in(options["options"], handle),
    )
    assert retry.status_code == 400


def test_authentication_challenges_are_single_use(env, monkeypatch):
    user, authenticator = enrolled_user(env)
    handle = handle_of(env.engine, user.id)

    for _ in range(2):
        client, response = sign_in(env, authenticator, user.id, "/settings")
        assert response.json() == {"status": "ok", "return_to": "/settings"}
        assert client.get("/current").json() == {"user_id": user.id}

    replayed = env.client()
    options = login_options(replayed)
    before = replayed.cookies["session"]
    assertion = authenticator.sign_in(options["options"], handle)
    assert verify_login(replayed, options["challenge_id"], assertion).status_code == 200
    restored = env.client()
    restored.cookies.set("session", before)
    assert verify_login(restored, options["challenge_id"], assertion).status_code == 400

    browser = env.client()
    options = login_options(browser)
    assertion = authenticator.sign_in(options["options"], handle)
    elsewhere = env.client()
    login_options(elsewhere)
    assert (
        verify_login(elsewhere, options["challenge_id"], assertion).status_code == 400
    )
    assert verify_login(browser, options["challenge_id"], assertion).status_code == 200

    racing = env.client()
    options = login_options(racing)
    assertion = authenticator.sign_in(options["options"], handle)
    racers = [env.client(), env.client()]
    for racer in racers:
        racer.cookies.set("session", racing.cookies["session"])
    with ThreadPoolExecutor(2) as pool:
        statuses = sorted(
            pool.map(
                lambda racer: (
                    verify_login(racer, options["challenge_id"], assertion).status_code
                ),
                racers,
            )
        )
    assert statuses == [200, 400]

    wrong_purpose = env.client()
    options = login_options(wrong_purpose)
    nonce = session_of(wrong_purpose)["passkey-flow"]
    member = env.fresh(user.id, **{"passkey-flow": nonce})
    response = member.post(
        "/auth/passkeys/registration/verify",
        json={
            "challenge_id": options["challenge_id"],
            "credential": Authenticator().register(options["options"]),
            "name": "Key",
        },
        headers=ORIGIN,
    )
    assert response.status_code == 400

    monkeypatch.setattr(logins, "_PASSKEY_CHALLENGE_TTL_SECONDS", 1)
    expiring = env.client()
    options = login_options(expiring)
    time.sleep(1.5)
    expired = verify_login(
        expiring,
        options["challenge_id"],
        authenticator.sign_in(options["options"], handle),
    )
    assert expired.status_code == 400


def test_ceremonies_check_origin_rate_limit_and_redis(env, monkeypatch):
    client = env.client()
    missing = client.post("/auth/passkeys/authentication/options", json={})
    assert missing.status_code == 403
    assert missing.json() == {"detail": "invalid_origin"}
    for _ in range(30):
        login_options(client)
    limited = client.post(
        "/auth/passkeys/authentication/options", json={}, headers=ORIGIN
    )
    assert limited.status_code == 429
    assert limited.json() == {"detail": "passkey_rate_limited"}
    assert limited.headers["retry-after"] == "60"
    assert limited.headers["cache-control"] == "no-store"

    def unavailable(*args, **kwargs):
        raise redis.ConnectionError("down")

    monkeypatch.setattr(logins._email_rate_store, "eval", unavailable)
    down = env.client().post(
        "/auth/passkeys/authentication/options", json={}, headers=ORIGIN
    )
    assert down.status_code == 503
    assert down.json() == {"detail": "passkey_unavailable"}


@pytest.mark.parametrize(
    ("auth_time", "offset", "allowed"),
    [
        ("now", 299, True),
        ("now", 300, False),
        ("now", -5, False),
        (None, 0, False),
        ("abc", 0, False),
        (True, 0, False),
    ],
)
def test_sensitive_actions_require_recent_authentication(
    env, auth_time, offset, allowed
):
    user, _authenticator = enrolled_user(env)
    now = int(time.time())
    session = {"user-id": user.id, "auth-method": "email"}
    if auth_time is not None:
        session["auth-time"] = now if auth_time == "now" else auth_time
    client = env.client(session)
    with env.writer() as db:
        passkey_id = db.session.scalar(select(models.PasskeyCredential.id))
    with clock(now + offset):
        assert client.get("/auth/passkeys").status_code == 200
        assert session_of(client).get("auth-time") == session.get("auth-time")
        options = client.post(
            "/auth/passkeys/registration/options", json={}, headers=ORIGIN
        )
        deleted = client.delete(f"/auth/passkeys/{passkey_id}", headers=ORIGIN)
    assert options.status_code == (200 if allowed else 403)
    assert deleted.status_code == (204 if allowed else 403)
    if not allowed:
        assert deleted.json() == {"detail": "reauthentication_required"}
    assert passkey_count(env.engine, user.id) == (0 if allowed else 1)


def test_enrollment_rechecks_freshness_at_verification(env):
    user = add_user(env.writer, "email", None)
    now = int(time.time())
    client = env.client({"user-id": user.id, "auth-method": "email", "auth-time": now})
    authenticator = Authenticator()
    with clock(now + 200):
        options = client.post(
            "/auth/passkeys/registration/options", json={}, headers=ORIGIN
        ).json()
    body = {
        "challenge_id": options["challenge_id"],
        "credential": authenticator.register(options["options"]),
        "name": "Late",
    }
    with clock(now + 300):
        late = client.post(
            "/auth/passkeys/registration/verify", json=body, headers=ORIGIN
        )
    assert late.status_code == 403
    with clock(now + 200):
        retried = client.post(
            "/auth/passkeys/registration/verify", json=body, headers=ORIGIN
        )
    assert retried.status_code == 400
    assert passkey_count(env.engine, user.id) == 0


def test_passkey_reauthentication_refreshes_auth_time_only(env):
    user, authenticator = enrolled_user(env)
    with env.writer() as db:
        passkey_id = db.session.scalar(select(models.PasskeyCredential.id))
    now = int(time.time())
    client = env.client(
        {
            "user-id": user.id,
            "auth-method": "passkey",
            "passkey-id": passkey_id,
            "auth-time": now,
        }
    )
    pending_authenticator = Authenticator()
    with clock(now):
        pending = client.post(
            "/auth/passkeys/registration/options", json={}, headers=ORIGIN
        ).json()
    flow = session_of(client)["passkey-flow"]
    with clock(now + 400):
        stale = client.post(
            "/auth/passkeys/registration/options", json={}, headers=ORIGIN
        )
        assert stale.status_code == 403
        options = client.post(
            "/auth/passkeys/reauthentication/options", json={}, headers=ORIGIN
        )
        assert options.status_code == 200, options.text
        body = options.json()
        assert body["options"]["allowCredentials"][0]["id"] == b64(
            authenticator.credential_id
        )
        response = client.post(
            "/auth/passkeys/reauthentication/verify",
            json={
                "challenge_id": body["challenge_id"],
                "credential": authenticator.sign_in(
                    body["options"], handle_of(env.engine, user.id)
                ),
            },
            headers=ORIGIN,
        )
        assert response.status_code == 200, response.text
        assert response.json() == {"status": "ok"}
        session = session_of(client)
        assert session["auth-time"] == now + 400
        assert session["auth-method"] == "passkey"
        assert session["passkey-id"] == passkey_id
        assert session["passkey-flow"] == flow
        audit = env.audit.call_args
        assert audit.args[2] == models.AuditEventType.LOGIN_SUCCESS
        assert audit.kwargs["details"]["reauth"] is True
        completed = client.post(
            "/auth/passkeys/registration/verify",
            json={
                "challenge_id": pending["challenge_id"],
                "credential": pending_authenticator.register(pending["options"]),
                "name": "Pending",
            },
            headers=ORIGIN,
        )
        assert completed.status_code == 201, completed.text
        assert (
            client.post(
                "/auth/passkeys/registration/options", json={}, headers=ORIGIN
            ).status_code
            == 200
        )


@pytest.mark.parametrize(
    "invalid",
    [
        "other-user",
        "cross-origin",
        "no-uv",
        "wrong-handle",
        "bad-signature",
        "other-session",
    ],
)
def test_passkey_reauthentication_rejects_invalid_assertions(env, invalid):
    user, authenticator = enrolled_user(env)
    other, other_authenticator = enrolled_user(env)
    now = int(time.time())
    client = env.client({"user-id": user.id, "auth-method": "email", "auth-time": now})
    with clock(now + 400):
        options = client.post(
            "/auth/passkeys/reauthentication/options", json={}, headers=ORIGIN
        ).json()
        handle = handle_of(env.engine, user.id)
        kwargs = {}
        if invalid == "other-session":
            client.post(
                "/seed-session",
                json={**session_of(client), "user-id": other.id},
            )
        if invalid == "other-user":
            authenticator = other_authenticator
            handle = handle_of(env.engine, other.id)
        elif invalid == "cross-origin":
            kwargs["cross_origin"] = True
        elif invalid == "no-uv":
            kwargs["flags"] = UP
        elif invalid == "wrong-handle":
            handle = handle_of(env.engine, other.id)
        elif invalid == "bad-signature":
            kwargs["key"] = other_authenticator.key
        response = client.post(
            "/auth/passkeys/reauthentication/verify",
            json={
                "challenge_id": options["challenge_id"],
                "credential": authenticator.sign_in(
                    options["options"], handle, **kwargs
                ),
            },
            headers=ORIGIN,
        )
    assert response.status_code == 400
    assert response.json() == {"detail": "invalid_passkey_response"}
    assert session_of(client)["auth-time"] == now
    assert env.audit.call_args.args[2] == models.AuditEventType.LOGIN_FAILURE


def test_passkey_reauthentication_requires_login_and_credentials(env):
    logged_out = env.client().post(
        "/auth/passkeys/reauthentication/options", json={}, headers=ORIGIN
    )
    assert logged_out.status_code == 401
    assert logged_out.json() == {"detail": "not_logged_in"}
    user = add_user(env.writer, "email", None)
    no_passkey = env.fresh(user.id).post(
        "/auth/passkeys/reauthentication/options", json={}, headers=ORIGIN
    )
    assert no_passkey.status_code == 404
    assert no_passkey.json() == {"detail": "passkey_not_found"}


def test_removal_revokes_only_sessions_of_that_credential(env, monkeypatch):
    monkeypatch.setattr(
        models.FlathubUser,
        "TABLES_FOR_DELETE",
        [models.EmailAccount, models.PasskeyCredential],
    )
    user = add_user(env.writer, "email", None)
    first, second = Authenticator(), Authenticator()
    setup = env.fresh(user.id)
    assert enroll(setup, first, "A").status_code == 201
    assert enroll(setup, second, "B").status_code == 201
    credentials = setup.get("/auth/passkeys").json()["credentials"]
    first_id, second_id = (item["id"] for item in credentials)

    def deletion_token():
        with env.writer() as db:
            return models.FlathubUser.generate_token(
                db, db.session.get(models.FlathubUser, user.id)
            )

    token = deletion_token()
    first_sessions = [sign_in(env, first, user.id)[0] for _ in range(2)]
    second_session = sign_in(env, second, user.id)[0]
    assert session_of(second_session)["passkey-id"] == second_id
    assert deletion_token() == token

    other = add_user(env.writer, "github", "Other")
    outsider = env.fresh(other.id, "github")
    assert outsider.delete(f"/auth/passkeys/{first_id}", headers=ORIGIN).json() == {
        "detail": "passkey_not_found"
    }
    renamed = outsider.patch(
        f"/auth/passkeys/{first_id}", json={"name": "Mine"}, headers=ORIGIN
    )
    assert renamed.status_code == 404

    stale = env.client({"user-id": user.id, "auth-method": "email", "auth-time": 0})
    renamed = stale.patch(
        f"/auth/passkeys/{second_id}", json={"name": " Desk "}, headers=ORIGIN
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Desk"
    assert deletion_token() != token

    email_session = env.fresh(user.id)
    response = email_session.delete(f"/auth/passkeys/{first_id}", headers=ORIGIN)
    assert response.status_code == 204

    stale_credential = models.PasskeyCredential(id=first_id, user=user.id)
    stale_user = models.FlathubUser(id=user.id, deleted=False, banned=False)
    writer = login_info.get_db

    @contextmanager
    def lagging(db_type="replica"):
        if db_type == "writer":
            with writer() as db:
                yield db
            return
        replica = MagicMock()
        replica.session.get.side_effect = lambda model, _id: (
            stale_user if model is models.FlathubUser else stale_credential
        )
        yield replica

    monkeypatch.setattr(login_info, "get_db", lagging)
    for revoked in first_sessions:
        assert revoked.get("/current").json() == {"user_id": None}
        assert revoked.get("/auth/passkeys").status_code == 401
    assert second_session.get("/current").json() == {"user_id": user.id}
    monkeypatch.setattr(login_info, "get_db", writer)
    assert email_session.get("/current").json() == {"user_id": user.id}

    current = second_session.delete(f"/auth/passkeys/{second_id}", headers=ORIGIN)
    assert current.status_code == 204
    assert second_session.get("/current").json() == {"user_id": None}
    assert email_session.get("/auth/passkeys").json()["credentials"] == []


@pytest.mark.parametrize(
    ("requested", "expected"),
    [
        ("//evil.example", "/"),
        ("https://evil.example/", "/"),
        ("/en/login", "/"),
        ("/settings", "/settings"),
        ("/oidc/authorize", "/oidc/authorize"),
    ],
)
def test_authentication_returns_only_safe_destinations(env, requested, expected):
    user, authenticator = enrolled_user(env)
    client, response = sign_in(env, authenticator, user.id, requested)
    assert response.json()["return_to"] == expected
    session = session_of(client)
    assert session["auth-method"] == "passkey"
    assert 0 <= time.time() - session["auth-time"] < 5
    assert "passkey-flow" not in session
    assert env.audit.call_args.args[2] == models.AuditEventType.LOGIN_SUCCESS
    assert env.audit.call_args.kwargs["provider"] == "passkey"

    again = client.post(
        "/auth/passkeys/authentication/options", json={}, headers=ORIGIN
    )
    assert again.status_code == 409
    assert again.json() == {"detail": "already_logged_in"}

    assert client.post("/auth/logout").status_code == 200
    assert client.get("/current").json() == {"user_id": None}
    assert not {"auth-time", "passkey-id", "passkey-flow", "user-id"} & set(
        session_of(client)
    )


def test_passkey_login_resumes_pending_oidc_authorization(env, monkeypatch):
    enable_oidc(monkeypatch)
    user, authenticator = enrolled_user(env)
    added = []
    get_db_mock = _mock_db_ctx(
        client_obj=_make_client(), user=_make_user(user_id=user.id), added=added
    )
    client = env.client()
    with (
        patch("app.routes.oidc.get_db", side_effect=get_db_mock),
        patch("app.routes.oidc.ensure_oidc_subject", return_value="sub-1"),
        patch("app.routes.oidc.generate_token", return_value="test-auth-code"),
    ):
        pending = client.get(
            "/oidc/authorize", params=AUTHORIZE_PARAMS, follow_redirects=False
        )
        assert pending.status_code == 302
        options = login_options(client, "/oidc/authorize")
        verified = verify_login(
            client,
            options["challenge_id"],
            authenticator.sign_in(options["options"], handle_of(env.engine, user.id)),
        )
        assert verified.json()["return_to"] == "/oidc/authorize"
        assert session_of(client)["oidc_authorize_params"]["_login_flow_started"]
        resumed = client.get("/oidc/authorize", follow_redirects=False)
        assert resumed.status_code == 302
        response = _approve_consent(client)

    assert response.status_code == 302
    assert response.headers["location"].startswith(REDIRECT_URI)
    assert "code=test-auth-code" in response.headers["location"]
    assert added[0].user_id == user.id
