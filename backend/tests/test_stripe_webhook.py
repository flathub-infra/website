import asyncio
import hmac
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime
from importlib import import_module
from threading import Barrier, local
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)


class FakeRequest:
    def __init__(self, event):
        self.event = event
        self.headers = {"stripe-signature": "valid-signature"}

    async def body(self):
        return b"event"


def _event(transfer_group):
    return {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": "pi-1",
                "transfer_group": transfer_group,
            }
        },
    }


def _db_for(*, stripe_transaction=None, transaction=None):
    session = MagicMock()
    session.get.side_effect = [stripe_transaction, transaction]
    db = SimpleNamespace(session=session)

    @contextmanager
    def get_db(_db_type):
        yield db

    return get_db, db


def _sdk_event(module, event):
    return module.stripe.Event.construct_from(event, None)


@pytest.fixture
def stripewallet_module(monkeypatch):
    from app.config import settings

    # Load the wallet package in its default fake-wallet mode before importing
    # StripeWallet directly for these unit tests.
    monkeypatch.setattr(settings, "stripe_secret_key", None)
    monkeypatch.setattr(settings, "stripe_public_key", None)
    monkeypatch.setattr(settings, "stripe_webhook_key", None)
    import_module("app.wallet")

    import stripe

    monkeypatch.setattr(stripe, "api_key", stripe.api_key)
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_webhook")
    monkeypatch.setattr(settings, "stripe_public_key", "pk_test_webhook")
    monkeypatch.setattr(settings, "stripe_webhook_key", "whsec_test_webhook")
    return import_module("app.wallet.stripewallet")


@pytest.mark.parametrize("transfer_group", ["flathub-txn-not-an-integer", "other-1"])
def test_webhook_ignores_unusable_transfer_groups(
    monkeypatch, transfer_group, stripewallet_module
):
    wallet = stripewallet_module.StripeWallet()
    monkeypatch.setattr(
        stripewallet_module.stripe.Webhook,
        "construct_event",
        lambda *_args, **_kwargs: _sdk_event(
            stripewallet_module, _event(transfer_group)
        ),
    )
    get_db, db = _db_for()
    monkeypatch.setattr(stripewallet_module, "get_db", get_db)

    response = asyncio.run(wallet.webhook(FakeRequest(_event(transfer_group))))

    assert response.status_code == 201
    db.session.commit.assert_not_called()


@pytest.mark.parametrize(
    ("event_type", "initial", "expected"),
    [
        ("payment_intent.succeeded", "pending", "success"),
        ("payment_intent.payment_failed", "success", "success"),
        ("payment_intent.succeeded", "success", "success"),
        ("payment_intent.canceled", "retry", "cancelled"),
    ],
)
def test_bound_webhook_transition(
    monkeypatch, stripewallet_module, event_type, initial, expected
):
    event = _event("flathub-txn-1")
    event["type"] = event_type
    monkeypatch.setattr(
        stripewallet_module.stripe.Webhook,
        "construct_event",
        lambda *a, **k: _sdk_event(stripewallet_module, event),
    )
    txn = MagicMock(status=initial)
    get_db, _ = _db_for(
        stripe_transaction=SimpleNamespace(stripe_pi="pi-1", transaction=42),
        transaction=txn,
    )
    monkeypatch.setattr(stripewallet_module, "get_db", get_db)
    asyncio.run(stripewallet_module.StripeWallet().webhook(FakeRequest(event)))
    assert txn.status == expected
    assert txn.update_app_ownership.call_count == int(
        initial != expected and expected == "success"
    )


def test_webhook_ignores_stripe_transaction_for_different_payment_intent(
    monkeypatch, stripewallet_module
):
    wallet = stripewallet_module.StripeWallet()
    monkeypatch.setattr(
        stripewallet_module.stripe.Webhook,
        "construct_event",
        lambda *_args, **_kwargs: _sdk_event(
            stripewallet_module, _event("flathub-txn-1")
        ),
    )
    stripe_transaction = SimpleNamespace(stripe_pi="pi-other", transaction=42)
    get_db, db = _db_for(stripe_transaction=stripe_transaction)
    monkeypatch.setattr(stripewallet_module, "get_db", get_db)

    response = asyncio.run(wallet.webhook(FakeRequest(_event("flathub-txn-1"))))

    assert response.status_code == 201
    db.session.commit.assert_not_called()


@pytest.mark.parametrize("outcome", ["confirmed", "unconfirmed", "retry", "rejected"])
def test_payout_claim_survives_restart(monkeypatch, stripewallet_module, outcome):
    from app import models
    from app.db_session import DBSession
    from app.utils import utcnow

    engine = create_engine("sqlite://")
    for model in (
        models.Transaction,
        models.StripeTransaction,
        models.StripePendingTransfer,
        models.StripeTransferDelivery,
    ):
        model.__table__.create(engine)

    @contextmanager
    def writer(_):
        with Session(engine) as session, session.begin():
            yield DBSession(session)

    with writer("writer") as db:
        db.add(
            models.Transaction(
                id=1,
                user_id=1,
                value=250,
                currency="usd",
                kind="purchase",
                status="success",
                created=utcnow(),
                updated=utcnow(),
            )
        )
        db.add(models.StripeTransaction(id=2, transaction=1, stripe_pi="pi-fixture"))
        db.add(
            models.StripePendingTransfer(
                id=3,
                stripe_transaction=2,
                amount=200,
                currency="usd",
                recipient="fixture",
            )
        )

    provider = MagicMock(return_value=SimpleNamespace(id="transfer-fixture"))
    monkeypatch.setattr(stripewallet_module, "get_db", writer)
    monkeypatch.setattr(stripewallet_module.stripe.Transfer, "create", provider)
    wallet = stripewallet_module.StripeWallet()
    if outcome == "unconfirmed":
        provider.side_effect = TimeoutError()
    elif outcome in {"rejected", "retry"}:
        provider.side_effect = stripewallet_module.stripe.InvalidRequestError(
            "rejected",
            param=None,
            code="balance_insufficient"
            if outcome == "retry"
            else "invalid_destination",
        )
    wallet.perform_pending_transfers()
    wallet.perform_pending_transfers()
    provider.assert_called_once()
    assert provider.call_args.kwargs["idempotency_key"] == "flathub-transfer-3-1"
    with writer("writer") as db:
        assert db.get(models.StripePendingTransfer, 3) is None
        row = db.get(models.StripeTransferDelivery, 3)
        assert row.claimed_at is not None
        assert row.outcome == outcome
        assert row.stripe_transfer_id == (
            "transfer-fixture" if outcome == "confirmed" else None
        )
        if outcome == "retry":
            from datetime import timedelta

            row.claimed_at -= timedelta(hours=2)
    if outcome == "retry":
        provider.side_effect = None
        wallet.perform_pending_transfers()
        assert provider.call_args.kwargs["idempotency_key"] == "flathub-transfer-3-2"
        with writer("writer") as db:
            assert db.get(models.StripeTransferDelivery, 3).outcome == "confirmed"


def test_invalid_signature_rejected_before_lookup(monkeypatch, stripewallet_module):
    get_db = MagicMock()
    monkeypatch.setattr(stripewallet_module, "get_db", get_db)
    with pytest.raises(stripewallet_module.WalletError):
        asyncio.run(stripewallet_module.StripeWallet().webhook(FakeRequest({})))
    get_db.assert_not_called()


@pytest.mark.parametrize(
    "status",
    [
        "requires_action",
        "requires_payment_method",
        "requires_confirmation",
        "processing",
        "requires_capture",
    ],
)
def test_interrupted_checkout(monkeypatch, stripewallet_module, status):
    wallet = stripewallet_module.StripeWallet()
    txn = SimpleNamespace(id=42, status="pending", reason="")
    intent = stripewallet_module.stripe.PaymentIntent.construct_from(
        {"status": status, "client_secret": "secret", "payment_method": None}, None
    )
    monkeypatch.setattr(wallet, "_get_transaction", lambda *_: "pi-1")
    monkeypatch.setattr(
        stripewallet_module.stripe.PaymentIntent, "retrieve", lambda _: intent
    )
    monkeypatch.setattr(stripewallet_module, "get_db", _db_for()[0])
    monkeypatch.setattr(
        stripewallet_module.models.Transaction, "by_user_and_id", lambda *_, **__: txn
    )
    monkeypatch.setattr(
        stripewallet_module.models.StripeTransaction,
        "by_transaction",
        lambda *_: SimpleNamespace(stripe_pi="pi-1", checkout_revision=0),
    )
    # The checkout can request its secret before a wallet read reconciles the row.
    actionable = status in {
        "requires_action",
        "requires_payment_method",
        "requires_confirmation",
    }
    if actionable:
        data = wallet.get_transaction_stripedata(None, None, "42")
        assert (data.status, data.client_secret) == (
            status if status == "requires_action" else "ok",
            "secret",
        )
    else:
        with pytest.raises(stripewallet_module.WalletError):
            wallet.get_transaction_stripedata(None, None, "42")
    wallet._update_transaction(None, txn, None)
    assert txn.status == ("retry" if actionable else "pending")


def test_checkout_can_create_intent_with_one_writer_connection(
    monkeypatch, stripewallet_module
):
    from sqlalchemy.pool import QueuePool

    engine = create_engine(
        "sqlite://", poolclass=QueuePool, pool_size=1, max_overflow=0, pool_timeout=0
    )

    @contextmanager
    def writer(_):
        with engine.connect() as conn:
            yield conn

    wallet = stripewallet_module.StripeWallet()

    def create_intent(user, txn_id):
        with writer("writer"):
            assert txn_id == 42
            return "pi-1"

    monkeypatch.setattr(stripewallet_module, "get_db", writer)
    monkeypatch.setattr(
        stripewallet_module.models.Transaction,
        "by_user_and_id",
        lambda *_, **__: SimpleNamespace(id=42, status="new"),
    )
    monkeypatch.setattr(
        stripewallet_module.models.StripeTransaction, "by_transaction", lambda *_: None
    )
    monkeypatch.setattr(wallet, "_create_payment_intent", create_intent)
    monkeypatch.setattr(
        stripewallet_module.stripe.PaymentIntent,
        "retrieve",
        lambda _: SimpleNamespace(
            status="requires_payment_method",
            payment_method=None,
            client_secret="secret",
        ),
    )
    try:
        assert (
            wallet.get_transaction_stripedata(None, None, "42").client_secret
            == "secret"
        )
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "seconds, current, expected",
    [
        (0, "requires_payment_method", "retry"),
        (0, "processing", "pending"),
        (-1, "requires_payment_method", "pending"),
    ],
)
def test_failure_at_pending_boundary(
    monkeypatch, stripewallet_module, seconds, current, expected
):
    created = 1700000000
    event = _event("flathub-txn-1") | {
        "type": "payment_intent.payment_failed",
        "id": "evt_failure",
        "created": created + seconds,
    }
    txn = SimpleNamespace(
        status="pending",
        reason="",
        updated=datetime.fromtimestamp(created, UTC).replace(
            tzinfo=None, microsecond=999999
        ),
    )
    get_db, db = _db_for()
    db.add = MagicMock()
    db.session.get.side_effect = [
        SimpleNamespace(stripe_pi="pi-1", transaction=42),
        txn,
        None,
    ]
    monkeypatch.setattr(stripewallet_module, "get_db", get_db)
    wallet = stripewallet_module.StripeWallet()
    monkeypatch.setattr(stripewallet_module, "utcnow", lambda: txn.updated)
    with pytest.raises(stripewallet_module.WalletError):
        wallet.set_transaction_pending(None, None, "42")
    monkeypatch.setattr(
        stripewallet_module.stripe.Webhook,
        "construct_event",
        lambda *a, **k: _sdk_event(stripewallet_module, event),
    )
    lookup = MagicMock(
        return_value=stripewallet_module.stripe.PaymentIntent.construct_from(
            {"status": current}, None
        )
    )
    monkeypatch.setattr(stripewallet_module.stripe.PaymentIntent, "retrieve", lookup)
    response = asyncio.run(wallet.webhook(FakeRequest(event)))
    assert response.status_code == 201
    assert txn.status == expected
    assert lookup.call_count == int(seconds == 0)
    assert db.add.call_args.args[0].event_id == "evt_failure"


def test_signed_webhooks_preserve_settled_purchase(monkeypatch, stripewallet_module):
    from app import models
    from app.db_session import DBSession
    from app.utils import utcnow

    engine = create_engine("sqlite://")
    for model in (
        models.Transaction,
        models.StripeTransaction,
        models.TransactionRow,
        models.UserOwnedApp,
        models.StripeFailedPaymentEvent,
    ):
        model.__table__.create(engine)

    @contextmanager
    def writer(_):
        with Session(engine) as session, session.begin():
            yield DBSession(session)

    with writer("writer") as db:
        db.add(
            models.Transaction(
                id=42,
                user_id=7,
                value=250,
                currency="usd",
                kind="purchase",
                status="pending",
                created=utcnow(),
                updated=utcnow(),
            )
        )
        db.add(models.StripeTransaction(id=1, transaction=42, stripe_pi="pi-1"))
        db.add(
            models.TransactionRow(
                txn=42,
                idx=0,
                amount=250,
                currency="usd",
                kind="purchase",
                recipient="org.example.App",
            )
        )

    monkeypatch.setattr(stripewallet_module, "get_db", writer)
    wallet = stripewallet_module.StripeWallet()
    lookup = MagicMock(
        return_value=stripewallet_module.stripe.PaymentIntent.construct_from(
            {"status": "processing"}, None
        )
    )
    monkeypatch.setattr(stripewallet_module.stripe.PaymentIntent, "retrieve", lookup)
    with writer("writer") as db:
        original_updated = db.get(models.Transaction, 42).updated
    for event_type, event_id in (
        ("payment_intent.payment_failed", "evt_failure"),
        ("payment_intent.payment_failed", "evt_failure"),
        ("payment_intent.succeeded", "evt_success"),
        ("payment_intent.succeeded", "evt_success"),
        ("payment_intent.payment_failed", "evt_late_failure"),
    ):
        event = _event("flathub-txn-1") | {
            "type": event_type,
            "object": "event",
            "id": event_id,
            "created": int(time.time()) + 5,
        }
        payload = json.dumps(event).encode()
        timestamp = int(time.time())
        signature = hmac.digest(
            b"whsec_test_webhook", f"{timestamp}.".encode() + payload, "sha256"
        ).hex()
        request = MagicMock(
            headers={"stripe-signature": f"t={timestamp},v1={signature}"}
        )
        request.body = AsyncMock(return_value=payload)
        assert asyncio.run(wallet.webhook(request)).status_code == 201
        if event_type == "payment_intent.payment_failed" and lookup.call_count:
            with writer("writer") as db:
                txn = db.get(models.Transaction, 42)
                if txn.status != "success":
                    assert txn.status == "pending"
                    assert txn.updated == original_updated
    lookup.assert_called_once_with("pi-1")
    with writer("writer") as db:
        assert db.get(models.Transaction, 42).status == "success"
        assert (
            db.query(models.UserOwnedApp)
            .filter_by(account=7, app_id="org.example.App")
            .count()
            == 1
        )


@pytest.fixture
def payment_db():
    from pathlib import Path
    from runpy import run_path

    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    from app import models
    from app.db_session import DBSession

    url = os.getenv("PAYMENTS_TEST_DATABASE_URL")
    if not url:
        pytest.skip("PAYMENTS_TEST_DATABASE_URL is not configured")
    schema = f"wallet_{uuid4().hex}"
    admin = create_engine(url)
    with admin.begin() as conn:
        conn.execute(text(f"CREATE SCHEMA {schema}"))
    engine = create_engine(
        url,
        connect_args={"options": f"-c search_path={schema} -c statement_timeout=8000"},
    )
    migration = run_path(
        str(Path(ROOT_DIR) / "alembic/versions/7ca910f76d42_track_transfer_delivery.py")
    )
    attempts = run_path(
        str(
            Path(ROOT_DIR)
            / "alembic/versions/2391df57c86a_record_stripe_payment_attempts.py"
        )
    )

    def migrate(direction):
        with (
            engine.begin() as conn,
            Operations.context(MigrationContext.configure(conn)),
        ):
            for change in (
                [migration, attempts]
                if direction == "upgrade"
                else [attempts, migration]
            ):
                change[direction]()

    @contextmanager
    def writer(_):
        with Session(engine) as session, session.begin():
            yield DBSession(session)

    try:
        with engine.begin() as conn:
            models.FlathubUser.__table__.create(conn)
            conn.execute(text("INSERT INTO flathubuser (id) VALUES (1), (2)"))
            for model in (
                models.Transaction,
                models.TransactionRow,
                models.StripeTransaction,
                models.StripeCustomer,
                models.StripePendingTransfer,
                models.RedeemableAppToken,
                models.UserOwnedApp,
            ):
                model.__table__.create(conn)
            conn.execute(
                text("ALTER TABLE stripetransaction DROP COLUMN checkout_revision")
            )
        migrate("upgrade")
        yield writer, migrate
    finally:
        engine.dispose()
        with admin.begin() as conn:
            conn.execute(text(f"DROP SCHEMA {schema} CASCADE"))
        admin.dispose()


def test_concurrent_checkout_and_delayed_failure(
    payment_db, stripewallet_module, monkeypatch
):
    from threading import Event

    from app import models
    from app.utils import utcnow
    from app.wallet.walletbase import ConfirmNewCard, ConfirmSavedCard

    writer, _ = payment_db
    with writer("writer") as db:
        db.add(
            models.Transaction(
                id=42,
                user_id=1,
                value=250,
                currency="usd",
                kind="purchase",
                status="new",
                created=utcnow(),
                updated=utcnow(),
            )
        )
        db.flush()
        db.add(models.StripeTransaction(id=1, transaction=42, stripe_pi="pi-1"))
        db.add(models.StripeCustomer(user_id=1, stripe_cust="cus_1"))
    monkeypatch.setattr(stripewallet_module, "get_db", writer)
    wallet = stripewallet_module.StripeWallet()
    user = models.FlathubUser(id=1)
    first, second = (
        ConfirmNewCard(checkout_revision=revision, confirmation_token=token)
        for revision, token in enumerate(("ct_first", "ct_second"))
    )
    provider = stripewallet_module.stripe.PaymentIntent

    def intent(status):
        return provider.construct_from({"status": status}, None)

    current = intent("requires_payment_method")
    monkeypatch.setattr(provider, "retrieve", lambda _: current)
    inside_confirm, release = Event(), Event()
    calls = []

    def confirm(pi, **options):
        nonlocal current
        assert pi == "pi-1"
        calls.append(options["idempotency_key"])
        if options["confirmation_token"] == "ct_first":
            raise stripewallet_module.stripe.CardError(
                "declined",
                "card",
                "card_declined",
                json_body={"error": {"decline_code": "insufficient_funds"}},
            )
        inside_confirm.set()
        assert release.wait(timeout=5)
        current = intent("processing")
        return current

    monkeypatch.setattr(provider, "confirm", confirm)
    assert wallet.confirm_payment(user, "42", first) == stripewallet_module.CardDecline(
        code="card_declined", decline_code="insufficient_funds"
    )
    assert (
        wallet.confirm_payment(
            user, "42", first.model_copy(update={"confirmation_token": "ct_delayed"})
        )
        == "view_details"
    )
    event = _event("flathub-txn-1") | {
        "type": "payment_intent.payment_failed",
        "id": "evt_first",
        "created": int(time.time()),
    }
    monkeypatch.setattr(
        stripewallet_module.stripe.Webhook,
        "construct_event",
        lambda *a, **kw: _sdk_event(stripewallet_module, event),
    )

    def deliver():
        return asyncio.run(wallet.webhook(FakeRequest(event))).status_code

    with ThreadPoolExecutor(max_workers=2) as workers:
        next_payment = workers.submit(wallet.confirm_payment, user, "42", second)
        assert inside_confirm.wait(timeout=5)
        late_event = workers.submit(deliver)
        release.set()
        assert next_payment.result(timeout=5) == "view_details"
        assert late_event.result(timeout=5) == 201
    assert deliver() == 201
    assert wallet.confirm_payment(user, "42", first) == "view_details"
    skipped = ConfirmNewCard(checkout_revision=2, confirmation_token="ct_third")
    current = intent("requires_action")
    assert wallet.confirm_payment(user, "42", skipped) == "view_details"
    with pytest.raises(stripewallet_module.WalletError):
        wallet.set_savecard(None, user, "42", "on_session")
    current = intent("requires_payment_method")
    assert wallet.confirm_payment(user, "42", skipped) == "view_details"
    assert wallet.confirm_payment(user, "42", second) == "view_details"
    with monkeypatch.context() as m:
        m.setattr(
            provider,
            "retrieve",
            MagicMock(
                side_effect=stripewallet_module.stripe.APIConnectionError("timeout")
            ),
        )
        failed = skipped.model_copy(update={"checkout_revision": 3})
        with pytest.raises(stripewallet_module.WalletError):
            wallet.confirm_payment(user, "42", failed)
    assert wallet.confirm_payment(user, "42", failed) == "view_details"
    card = SimpleNamespace(customer="cus_other", type="card")
    monkeypatch.setattr(
        stripewallet_module.stripe.PaymentMethod, "retrieve", lambda _: card
    )
    rejected = ConfirmSavedCard(checkout_revision=4, payment_method="pm_saved")
    with pytest.raises(stripewallet_module.WalletError):
        wallet.confirm_payment(user, "42", rejected)
    card.customer = "cus_1"
    assert wallet.confirm_payment(user, "42", rejected) == "view_details"
    assert calls == ["confirm-pi-1-0", "confirm-pi-1-1"]
    with writer("writer") as db:
        assert db.get(models.Transaction, 42).status == "retry"
        assert db.get(models.StripeTransaction, 1).checkout_revision == 5


def test_payout_workers_and_legacy_rollback(
    payment_db, stripewallet_module, monkeypatch
):
    from sqlalchemy.exc import DBAPIError

    from app import models
    from app.utils import utcnow

    writer, migrate = payment_db
    with writer("writer") as db:
        db.add(
            models.Transaction(
                id=1,
                user_id=1,
                value=500,
                currency="usd",
                kind="purchase",
                status="success",
                created=utcnow(),
                updated=utcnow(),
            )
        )
        db.flush()
        db.add(models.StripeTransaction(id=1, transaction=1, stripe_pi="pi-fixture"))
        db.flush()
        for number in (1, 2):
            db.add(
                models.StripePendingTransfer(
                    id=number,
                    stripe_transaction=1,
                    amount=250,
                    currency="usd",
                    recipient="fixture",
                )
            )
    provider = MagicMock(
        side_effect=lambda **kw: SimpleNamespace(
            id="tr-" + kw["metadata"]["flathub_transfer_id"]
        )
    )
    monkeypatch.setattr(stripewallet_module.stripe.Transfer, "create", provider)
    monkeypatch.setattr(stripewallet_module, "get_db", writer)
    worker = stripewallet_module.StripeWallet().perform_pending_transfers
    with ThreadPoolExecutor(max_workers=2) as pool:
        with writer("writer") as db:
            db.get(models.StripePendingTransfer, 1, with_for_update=True)
            pool.submit(worker).result(timeout=5)
            assert [
                call.kwargs["metadata"]["flathub_transfer_id"]
                for call in provider.call_args_list
            ] == ["2"]
        list(pool.map(lambda _: worker(), range(2)))
    assert provider.call_count == 2
    with pytest.raises(DBAPIError, match="Archive and reconcile"):
        migrate("downgrade")
    with writer("writer") as db:
        assert db.query(models.StripePendingTransfer).count() == 0
        assert (
            db.query(models.StripeTransferDelivery)
            .filter_by(outcome="confirmed")
            .count()
            == 2
        )
        db.query(models.StripeTransferDelivery).delete()
    migrate("downgrade")
    with writer("writer") as db:
        assert db.query(models.StripePendingTransfer).count() == 0


def test_history_reconciliation_in_opposite_orders(
    payment_db, stripewallet_module, monkeypatch
):
    from datetime import timedelta

    from app import models
    from app.utils import utcnow
    from app.wallet.walletbase import TransactionSortOrder

    writer, _ = payment_db
    original = utcnow() - timedelta(days=1)
    with writer("writer") as db:
        for number in (1, 2):
            db.add(
                models.Transaction(
                    id=number,
                    user_id=1,
                    value=250,
                    currency="usd",
                    kind="donation",
                    status="pending",
                    created=original + timedelta(seconds=number),
                    updated=original,
                )
            )
    wallet = stripewallet_module.StripeWallet()
    barrier = Barrier(2)
    thread = local()

    def retrieve(_):
        if not getattr(thread, "started", False):
            thread.started = True
            barrier.wait(timeout=5)
        return {"status": "succeeded"}

    monkeypatch.setattr(stripewallet_module, "get_db", writer)
    monkeypatch.setattr(wallet, "_get_transaction", lambda user, txn: str(txn.id))
    monkeypatch.setattr(stripewallet_module.stripe.PaymentIntent, "retrieve", retrieve)

    def history(order):
        return wallet.transactions(None, models.FlathubUser(id=1), order, None, 2)

    with ThreadPoolExecutor(max_workers=2) as pool:
        recent, oldest = pool.map(
            history, [TransactionSortOrder.RECENT, TransactionSortOrder.OLDEST]
        )
    assert [row.id for row in recent] == ["2", "1"]
    assert [row.id for row in oldest] == ["1", "2"]
    with writer("writer") as db:
        for txn in db.query(models.Transaction):
            assert txn.status == "success"
            assert txn.updated > original


@pytest.mark.parametrize("same_token", [True, False])
def test_concurrent_vending_redemption(payment_db, same_token):
    from app import models
    from app.utils import utcnow

    writer, _ = payment_db
    tokens = ["first"] if same_token else ["first", "second"]
    with writer("writer") as db:
        for token in tokens:
            db.add(
                models.RedeemableAppToken(
                    appid="org.example.App",
                    token=token,
                    state="unredeemed",
                    name="test",
                    created=utcnow(),
                    changed=utcnow(),
                )
            )
    barrier = Barrier(2)

    def redeem(index):
        with writer("writer") as db:
            barrier.wait(timeout=5)
            token = models.RedeemableAppToken.by_appid_and_token(
                db, "org.example.App", tokens[index % len(tokens)]
            )
            return token is not None and token.redeem(
                db, SimpleNamespace(id=index + 1 if same_token else 1)
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(redeem, range(2))) == [False, True]
    with writer("writer") as db:
        assert db.query(models.UserOwnedApp).count() == 1
        assert (
            db.query(models.RedeemableAppToken).filter_by(state="redeemed").count() == 1
        )
