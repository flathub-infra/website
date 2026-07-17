import asyncio
import importlib
import sys
import types
from contextlib import contextmanager
from datetime import UTC, datetime
from types import SimpleNamespace

import dns.exception
import dns.resolver
import pytest


def _load_verification_module(monkeypatch):
    fake_worker = types.ModuleType("app.worker")
    fake_worker.republish_app = SimpleNamespace(send=lambda _app_id: None)

    fake_logins = types.ModuleType("app.logins")
    fake_logins.LoginInformation = type("LoginInformation", (), {})
    fake_logins.refresh_oauth_token = lambda _account: None

    monkeypatch.setitem(sys.modules, "app.worker", fake_worker)
    monkeypatch.setitem(sys.modules, "app.logins", fake_logins)
    sys.modules.pop("app.verification", None)

    import app.verification as verification_module

    return importlib.reload(verification_module)


class TxtAnswer:
    def __init__(self, *strings: bytes):
        self.strings = strings


def test_dns_record_name_uses_derived_domain(monkeypatch):
    verification = _load_verification_module(monkeypatch)

    assert (
        verification._get_dns_record_name("io.github.ramm_fr.Orion")
        == "_flathub.ramm-fr.github.io"
    )
    assert verification._get_dns_record_name("com.github.example.App") is None


def test_dns_checker_accepts_exact_split_token_among_multiple_records(monkeypatch):
    verification = _load_verification_module(monkeypatch)
    token = "12345678-1234-1234-1234-123456789abc"

    async def resolve(record_name, record_type, lifetime):
        assert record_name == "_flathub.ramm-fr.github.io"
        assert record_type == "TXT"
        assert lifetime == 5
        return [
            TxtAnswer(b"unrelated-token"),
            TxtAnswer(token[:18].encode(), token[18:].encode()),
        ]

    monkeypatch.setattr(verification.dns.asyncresolver, "resolve", resolve)

    result = asyncio.run(
        verification.CheckDnsVerification()(
            "io.github.ramm_fr.Orion",
            token,
        )
    )

    assert result == verification.DnsVerificationResult(verified=True)


def test_dns_checker_rejects_substring_token(monkeypatch):
    verification = _load_verification_module(monkeypatch)
    token = "12345678-1234-1234-1234-123456789abc"

    async def resolve(_record_name, _record_type, lifetime):
        assert lifetime == 5
        return [TxtAnswer(f"prefix-{token}-suffix".encode())]

    monkeypatch.setattr(verification.dns.asyncresolver, "resolve", resolve)

    result = asyncio.run(
        verification.CheckDnsVerification()("io.github.ramm_fr.Orion", token)
    )

    assert result == verification.DnsVerificationResult(
        verified=False,
        detail=verification.ErrorDetail.DNS_TOKEN_NOT_PRESENT,
    )


@pytest.mark.parametrize(
    ("error", "detail"),
    [
        (dns.resolver.NXDOMAIN(), "dns_record_not_found"),
        (dns.resolver.NoAnswer(), "dns_record_not_found"),
        (dns.exception.Timeout(), "dns_lookup_failed"),
        (dns.exception.DNSException("malformed reply"), "dns_lookup_failed"),
    ],
)
def test_dns_checker_maps_resolver_errors(monkeypatch, error, detail):
    verification = _load_verification_module(monkeypatch)

    async def resolve(_record_name, _record_type, lifetime):
        assert lifetime == 5
        raise error

    monkeypatch.setattr(verification.dns.asyncresolver, "resolve", resolve)

    result = asyncio.run(
        verification.CheckDnsVerification()(
            "io.github.ramm_fr.Orion",
            "12345678-1234-1234-1234-123456789abc",
        )
    )

    assert result == verification.DnsVerificationResult(
        verified=False,
        detail=detail,
    )


def test_domain_setup_and_available_methods_share_pending_token(monkeypatch):
    verification_module = _load_verification_module(monkeypatch)
    token = "12345678-1234-1234-1234-123456789abc"
    pending = SimpleNamespace(method="website", token=token, verified=False)
    replica_db = SimpleNamespace()

    @contextmanager
    def fake_get_db(db_type="replica"):
        assert db_type == "replica"
        yield replica_db

    monkeypatch.setattr(verification_module, "_check_app_id", lambda *args: None)
    monkeypatch.setattr(verification_module, "get_db", fake_get_db)
    monkeypatch.setattr(
        verification_module.models.AppVerification,
        "by_app_and_user",
        lambda _db, _app_id, _user: pending,
    )

    login = SimpleNamespace(user=SimpleNamespace(id=42))
    website = verification_module.setup_website_verification(
        login=login, app_id="org.example.App", new_app=False
    )
    dns_token = verification_module.setup_dns_verification(
        login=login, app_id="org.example.App", new_app=False
    )
    methods = verification_module.get_available_methods(
        login=login, app_id="org.example.App", new_app=False
    ).methods

    assert website.token == token
    assert dns_token == verification_module.DnsVerificationToken(
        domain="example.org",
        record_name="_flathub.example.org",
        token=token,
    )
    assert methods == [
        verification_module.AvailableMethod(
            method=verification_module.AvailableMethodType.WEBSITE,
            website="example.org",
            website_token=token,
        ),
        verification_module.AvailableMethod(
            method=verification_module.AvailableMethodType.DNS,
            dns_domain="example.org",
            dns_record_name="_flathub.example.org",
            dns_token=token,
        ),
    ]


def test_dns_verification_status_reports_domain(monkeypatch):
    verification_module = _load_verification_module(monkeypatch)
    persisted = SimpleNamespace(
        method="dns",
        verified=True,
        verified_timestamp=datetime.fromtimestamp(123, UTC),
    )
    monkeypatch.setattr(
        verification_module,
        "_get_existing_verification",
        lambda _app_id: persisted,
    )

    result = asyncio.run(
        verification_module.get_verification_status.__wrapped__(
            "io.github.ramm_fr.Orion"
        )
    )

    assert result == verification_module.VerificationStatusDns(
        verified=True,
        timestamp="123",
        method=verification_module.VerificationMethod.DNS,
        website="ramm-fr.github.io",
    )


@pytest.mark.parametrize("new_app", [False, True])
def test_confirm_dns_verification_persists_expected_effects(monkeypatch, new_app):
    verification_module = _load_verification_module(monkeypatch)

    class FakeSession:
        def merge(self, merged_verification):
            assert merged_verification is pending
            events.append("merge")

        def commit(self):
            events.append("commit")

    events = []
    pending = SimpleNamespace(
        method="website",
        token="12345678-1234-1234-1234-123456789abc",
        verified=False,
        verified_timestamp=None,
    )
    writer_db = SimpleNamespace(session=FakeSession())
    replica_db = SimpleNamespace()

    @contextmanager
    def fake_get_db(db_type="replica"):
        yield writer_db if db_type == "writer" else replica_db

    monkeypatch.setattr(verification_module, "_check_app_id", lambda *args: None)
    monkeypatch.setattr(verification_module, "get_db", fake_get_db)
    monkeypatch.setattr(
        verification_module.models.AppVerification,
        "by_app_and_user",
        lambda _db, _app_id, _user: pending,
    )
    monkeypatch.setattr(
        verification_module,
        "_cleanup_stale_verifications",
        lambda _db, app_id, account: events.append(("cleanup", app_id, account)),
    )
    monkeypatch.setattr(
        verification_module,
        "_create_direct_upload_app",
        lambda _user, app_id: events.append(("create", app_id)),
    )
    monkeypatch.setattr(
        verification_module.worker.republish_app,
        "send",
        lambda app_id: events.append(("republish", app_id)),
    )

    async def mark_stale(pattern):
        events.append(("cache", pattern))

    async def check(_app_id, _token):
        return verification_module.DnsVerificationResult(verified=True)

    monkeypatch.setattr(
        verification_module.cache,
        "mark_stale_by_pattern",
        mark_stale,
    )

    result = asyncio.run(
        verification_module.confirm_dns_verification(
            login=SimpleNamespace(user=SimpleNamespace(id=42)),
            app_id="org.example.App",
            new_app=new_app,
            check=check,
        )
    )

    assert result == verification_module.DnsVerificationResult(verified=True)
    assert pending.method == "dns"
    assert pending.verified is True
    assert pending.verified_timestamp is not None
    common_events = [
        "merge",
        ("cleanup", "org.example.App", 42),
        "commit",
    ]
    if new_app:
        assert events == [("create", "org.example.App"), *common_events]
    else:
        assert events == [
            *common_events,
            ("republish", "org.example.App"),
            ("cache", "cache:endpoint:get_verification_status:*"),
        ]
