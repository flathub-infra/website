"""
Implementation details for a Stripe based wallet for Flathub

This will be used if the app starts with Stripe credentials available
"""

import logging
from datetime import UTC, datetime, timedelta
from itertools import dropwhile
from typing import TYPE_CHECKING

import stripe
from fastapi import Request, Response
from stripe import PaymentMethod as StripePaymentMethod

from .. import models
from ..config import settings
from ..database import get_db
from ..models import FlathubUser, StripeCustomer
from ..utils import PLATFORMS_WITH_STRIPE, utcnow
from .walletbase import (
    CardDecline,
    ConfirmationOutcome,
    ConfirmNewCard,
    ConfirmSavedCard,
    NascentTransaction,
    PaymentCardInfo,
    StripeKeys,
    Transaction,
    TransactionRow,
    TransactionSaveCardKind,
    TransactionSortOrder,
    TransactionStripeData,
    TransactionSummary,
    WalletBase,
    WalletError,
    WalletInfo,
)

if TYPE_CHECKING:
    from stripe.params import PaymentIntentConfirmParams, PaymentIntentModifyParams

GROUP_PREFIX = "flathub-txn-"
CONFIRMABLE = {"requires_payment_method", "requires_confirmation"}
logger = logging.getLogger(__name__)


def _get_transaction_recipients(
    db, transactions: list[models.Transaction]
) -> dict[int, str]:
    if not transactions:
        return {}

    rows = (
        db.session.query(models.TransactionRow.txn, models.TransactionRow.recipient)
        .filter(models.TransactionRow.txn.in_([txn.id for txn in transactions]))
        .filter(models.TransactionRow.idx == 0)
        .all()
    )
    return dict(rows)


class StripeWallet(WalletBase):
    """
    A wallet which is backed by Stripe
    """

    @classmethod
    def webhook_name(cls):
        return "stripe"

    def stripedata(self) -> StripeKeys:
        return StripeKeys(status="ok", public_key=settings.stripe_public_key or "")

    def _get_customer(self, user: FlathubUser) -> str:
        with get_db("replica") as db:
            user = db.session.merge(user)
            customer = StripeCustomer.by_user(db, user)
            if customer is not None:
                return customer.stripe_cust
            user_id = user.id

        # Customer doesn't exist, create a new one
        try:
            stripe_customer = stripe.Customer.create(
                idempotency_key=f"create-user-{user_id}",
                description=f"Customer record for Flathub User {user_id}",
            )
        except Exception as stripe_error:
            raise WalletError(error="stripe-customer-failed-to-make") from stripe_error

        with get_db("writer") as db:
            db.session.add(
                StripeCustomer(user_id=user_id, stripe_cust=stripe_customer.id)
            )
            db.session.commit()
            return stripe_customer.id

    def _cardinfo(self, card: StripePaymentMethod) -> PaymentCardInfo | None:
        if card.card is None:
            return None
        return PaymentCardInfo(
            id=card.id,
            brand=(card.card.brand or "").lower().replace(" ", ""),
            exp_month=card.card.exp_month,
            exp_year=card.card.exp_year,
            last4=card.card.last4,
            country=(card.card.country or "").lower(),
        )

    def info(self, request: Request, user: FlathubUser) -> WalletInfo:
        customer_id = self._get_customer(user)
        pms = stripe.Customer.list_payment_methods(customer_id, type="card")
        return WalletInfo(
            status="ok",
            cards=[c for card in pms.data if (c := self._cardinfo(card)) is not None],
        )

    def remove_card(self, request: Request, user: FlathubUser, card: PaymentCardInfo):
        customer_id = self._get_customer(user)
        pms = stripe.Customer.list_payment_methods(customer_id, type="card")
        cards = [c for pm in pms.data if (c := self._cardinfo(pm)) is not None]
        if card not in cards:
            raise WalletError(error="not found")
        stripe.PaymentMethod.detach(card.id)

    def transactions(
        self,
        request: Request,
        user: FlathubUser,
        sort: TransactionSortOrder,
        since: str | None,
        limit: int,
    ) -> list[TransactionSummary]:
        with get_db("replica") as db:
            user = db.session.merge(user)
            txns = models.Transaction.by_user(db, user)
            if sort == TransactionSortOrder.RECENT:
                txns = txns.order_by(models.Transaction.created.desc())
            else:
                txns = txns.order_by(models.Transaction.created)
            txns = list(txns)
            if since:
                txns = list(dropwhile(lambda txn: str(txn.id) != since, txns))
                txns = txns[1:]
            if limit < len(txns):
                txns = txns[:limit]

            recipients = _get_transaction_recipients(db, txns)

            txns_needing_update = [
                txn.id for txn in txns if txn.status in ["pending", "retry"]
            ]

            if not txns_needing_update:
                return [
                    TransactionSummary(
                        id=str(txn.id),
                        value=txn.value,
                        currency=txn.currency,
                        kind=txn.kind,
                        status=txn.status,
                        recipient=recipients.get(txn.id),
                        reason=txn.reason,
                        created=int(txn.created.timestamp()),
                        updated=int(txn.updated.timestamp()),
                    )
                    for txn in txns
                ]

        for txn_id in txns_needing_update:
            with get_db("writer") as db:
                txn = db.session.get(
                    models.Transaction, txn_id, with_for_update={"key_share": True}
                )
                if txn is not None and self._update_transaction(user, txn, db):
                    db.session.add(txn)
        with get_db("writer") as db:
            user = db.session.merge(user)
            txns = models.Transaction.by_user(db, user)
            if sort == TransactionSortOrder.RECENT:
                txns = txns.order_by(models.Transaction.created.desc())
            else:
                txns = txns.order_by(models.Transaction.created)
            txns = list(txns)
            if since:
                txns = list(dropwhile(lambda txn: str(txn.id) != since, txns))
                txns = txns[1:]
            if limit < len(txns):
                txns = txns[:limit]

            recipients = _get_transaction_recipients(db, txns)

            return [
                TransactionSummary(
                    id=str(txn.id),
                    value=txn.value,
                    currency=txn.currency,
                    kind=txn.kind,
                    status=txn.status,
                    recipient=recipients.get(txn.id),
                    reason=txn.reason,
                    created=int(txn.created.timestamp()),
                    updated=int(txn.updated.timestamp()),
                )
                for txn in txns
            ]

    def _get_transaction(self, user: FlathubUser, txn: models.Transaction) -> str:
        """Get or create a Stripe transaction and return the payment intent ID."""
        try:
            with get_db("replica") as db:
                stxn = models.StripeTransaction.by_transaction(db, txn)
                if stxn is not None:
                    return stxn.stripe_pi

        except Exception as stripe_error:
            raise WalletError(
                error="stripe-payment-intent-build-failed"
            ) from stripe_error
        return self._create_payment_intent(user, txn.id)

    def _create_payment_intent(self, user: FlathubUser, txn_id: int) -> str:
        try:
            with get_db("replica") as db:
                fresh_txn = db.session.get(models.Transaction, txn_id)
                if fresh_txn is None:
                    raise WalletError(error="not found")

                recipients = []
                main_app = None
                flathub_amount = 0
                for row in fresh_txn.rows(db):
                    try:
                        value = row.amount + flathub_amount
                        flathub_amount = 0
                        print(f"Considering: {row.recipient}")
                        # Get main app name for receipt (skip Flathub and platforms)
                        if (
                            main_app is None
                            and row.recipient != "org.flathub.Flathub"
                            and row.recipient not in PLATFORMS_WITH_STRIPE
                        ):
                            main_app = row.recipient
                        appvc = models.ApplicationVendingConfig.by_appid(
                            db, row.recipient
                        )
                        if appvc is not None:
                            acct = models.StripeExpressAccount.by_userid(db, appvc.user)
                            if acct is not None:
                                print("Found user account")
                                recipients.append((acct.stripe_account, value))
                                continue
                        plaf_data = PLATFORMS_WITH_STRIPE.get(row.recipient)
                        if (
                            plaf_data is not None
                            and (stripe_id := plaf_data.stripe_account) is not None
                        ):
                            recipients.append((stripe_id, value))
                            continue
                        flathub_amount = value
                    except WalletError:
                        raise
                    except Exception as base_exc:
                        raise WalletError(error="not found") from base_exc

                txn_value = fresh_txn.value
                txn_currency = fresh_txn.currency
                txn_kind = fresh_txn.kind

            customer_id = self._get_customer(user)

            # Build description for receipt
            if main_app:
                if txn_kind == "purchase":
                    description = f"Flathub purchase: {main_app}"
                else:
                    description = f"Flathub donation: {main_app}"
            else:
                description = "Flathub donation"

            payment_intent = stripe.PaymentIntent.create(
                idempotency_key=f"payment-intent-{txn_id}",
                amount=txn_value,
                currency=txn_currency,
                allowed_payment_method_types=["card"],
                customer=customer_id,
                description=description,
            )

            with get_db("writer") as db:
                stxn = models.StripeTransaction(
                    transaction=txn_id, stripe_pi=payment_intent["id"]
                )
                db.session.add(stxn)
                db.session.flush()

                # This is needed for webhook processing
                stripe.PaymentIntent.modify(
                    payment_intent["id"],
                    transfer_group=f"{GROUP_PREFIX}{stxn.id}",
                )

                for account_id, amount in recipients:
                    transfer = models.StripePendingTransfer(
                        stripe_transaction=stxn.id,
                        recipient=account_id,
                        currency=txn_currency,
                        amount=amount,
                    )
                    db.session.add(transfer)
                db.session.commit()
                return payment_intent["id"]

        except WalletError:
            raise
        except Exception as stripe_error:
            raise WalletError(
                error="stripe-payment-intent-build-failed"
            ) from stripe_error

    def _get_stripe_payment_intent_id(
        self, user: FlathubUser, txn: models.Transaction
    ) -> str:
        with get_db("replica") as db:
            stxn = models.StripeTransaction.by_transaction(db, txn)
            if stxn is not None:
                return stxn.stripe_pi

        return self._get_transaction(user, txn)

    def _update_transaction(
        self, user: FlathubUser, txn: models.Transaction, db
    ) -> bool:
        if txn.status not in ["pending", "retry"]:
            return False
        # Pending transactions may need tweaking based on Stripe status
        stripe_pi = self._get_transaction(user, txn)
        try:
            payment_intent = stripe.PaymentIntent.retrieve(stripe_pi)
            return self._apply_intent(txn, payment_intent, db)

        except Exception as stripe_error:
            raise WalletError(
                error="stripe-payment-intent-retrieve-failed"
            ) from stripe_error

    @staticmethod
    def _apply_intent(txn, intent, db):
        pi_status = intent["status"]
        if pi_status == "succeeded":
            status, reason = "success", ""
        elif pi_status == "canceled":
            status, reason = "cancelled", "Cancellation noted from Stripe"
        elif pi_status in {"processing", "requires_capture"}:
            status, reason = "pending", ""
        else:
            status, reason = "retry", f"Stripe status: {pi_status}"
        if txn.status == status and (txn.reason or "") == reason:
            return False
        txn.status, txn.reason, txn.updated = status, reason, utcnow()
        if status == "success":
            txn.update_app_ownership(db)
        return True

    def transaction(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> Transaction:
        with get_db("writer") as db:
            user = db.session.merge(user)
            txn = models.Transaction.by_user_and_id(db, user, transaction, lock=True)
            if txn is None:
                raise WalletError(error="not found")
            if self._update_transaction(user, txn, db):
                db.session.add(txn)
                db.session.commit()
            rows = list(txn.rows(db))
            summary = TransactionSummary(
                id=str(txn.id),
                value=txn.value,
                currency=txn.currency,
                kind=txn.kind,
                status=txn.status,
                recipient=rows[0].recipient if rows else None,
                reason=txn.reason,
                created=int(txn.created.timestamp()),
                updated=int(txn.updated.timestamp()),
            )
            details = [
                TransactionRow(
                    recipient=row.recipient,
                    amount=row.amount,
                    currency=row.currency,
                    kind=row.kind,
                )
                for row in rows
            ]
            stripe_pi = self._get_stripe_payment_intent_id(user, txn)
            card = None
            receipt = None
            try:
                payment_intent = stripe.PaymentIntent.retrieve(
                    stripe_pi, expand=["latest_charge"]
                )
                pm_field = payment_intent.payment_method
                if pm_field is not None:
                    pm_id = pm_field if isinstance(pm_field, str) else pm_field.id
                    payment_method = stripe.PaymentMethod.retrieve(pm_id)
                    card = self._cardinfo(payment_method)
                charge_field = payment_intent.latest_charge
                if charge_field is not None and not isinstance(charge_field, str):
                    receipt = charge_field.receipt_url
            except Exception as stripe_error:
                raise WalletError(error="not found") from stripe_error

            return Transaction(
                summary=summary, card=card, details=details, receipt=receipt
            )

    def create_transaction(
        self, request: Request, user: FlathubUser, transaction: NascentTransaction
    ) -> str:
        self._check_transaction_consistency(transaction)

        # A consistent transaction is (a) totalling properly (b) a donation
        # and (c) a donation to flathub itself (in part)
        # For now we add an additional constraint for Stripe which is that
        # it is *only* a donation to Flathub
        if len(transaction.details) != 1:
            raise WalletError(error="too complex")

        with get_db("writer") as db:
            user = db.session.merge(user)
            txn = models.Transaction(
                user_id=user.id,
                value=transaction.summary.value,
                currency=transaction.summary.currency,
                kind=transaction.summary.kind,
                status="new",
                created=utcnow(),
                updated=utcnow(),
            )

            db.session.add(txn)
            db.session.flush()

            for idx, row in enumerate(transaction.details):
                db.session.add(
                    models.TransactionRow(
                        txn=txn.id,
                        idx=idx,
                        amount=row.amount,
                        currency=row.currency,
                        kind=row.kind,
                        recipient=row.recipient,
                    )
                )
            db.session.commit()

            # This will commit for us or error if the payment intent is not created with Stripe
            self._get_transaction(user, txn)

            return str(txn.id)

    def set_transaction_card(
        self,
        request: Request,
        user: FlathubUser,
        transaction: str,
        card: PaymentCardInfo,
    ):
        customer_id = self._get_customer(user)
        pms = stripe.Customer.list_payment_methods(customer_id, type="card")
        cards = [c for pm in pms.data if (c := self._cardinfo(pm)) is not None]
        if card not in cards:
            raise WalletError(error="not found")
        self._modify_checkout(user, transaction, {"payment_method": card.id})

    def get_transaction_stripedata(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> TransactionStripeData:
        with get_db("writer") as db:
            txn = models.Transaction.by_user_and_id(db, user, transaction, lock=True)
            if txn is None:
                raise WalletError(error="not found")
            if txn.status not in ["new", "retry", "pending"]:
                raise WalletError(error="bad transaction status")
            stxn = models.StripeTransaction.by_transaction(db, txn)
            if stxn is not None:
                return self._checkout_data(stxn.stripe_pi, stxn.checkout_revision)
            txn_id = txn.id

        stripe_pi = self._create_payment_intent(user, txn_id)
        return self._checkout_data(stripe_pi, 0)

    def _checkout_data(self, stripe_pi: str, revision: int) -> TransactionStripeData:
        card = None
        try:
            payment_intent = stripe.PaymentIntent.retrieve(stripe_pi)
            if payment_intent.status == "requires_action":
                return TransactionStripeData(
                    status="requires_action",
                    checkout_revision=revision,
                    client_secret=payment_intent.client_secret or "",
                )
            if payment_intent.status not in CONFIRMABLE:
                raise WalletError(error="bad transaction status")
            pm_field = payment_intent.payment_method
            if pm_field is not None:
                pm_id = pm_field if isinstance(pm_field, str) else pm_field.id
                payment_method = stripe.PaymentMethod.retrieve(pm_id)
                card = self._cardinfo(payment_method)
        except WalletError:
            raise
        except Exception as stripe_error:
            raise WalletError("stripe error") from stripe_error

        return TransactionStripeData(
            status="ok",
            checkout_revision=revision,
            client_secret=payment_intent.client_secret or "",
            card=card,
        )

    def cancel_transaction(self, request: Request, user: FlathubUser, transaction: str):
        with get_db("writer") as db:
            user = db.session.merge(user)
            txn = models.Transaction.by_user_and_id(db, user, transaction)
            if txn is None:
                raise WalletError(error="not found")
            if txn.status not in ["new", "retry"]:
                raise WalletError(error="bad transaction status")
        stripe_pi = self._get_transaction(user, txn)
        try:
            pi_data = stripe.PaymentIntent.retrieve(stripe_pi)

            with get_db("writer") as db:
                user = db.session.merge(user)
                txn = models.Transaction.by_user_and_id(
                    db, user, transaction, lock=True
                )
                if txn is None:
                    raise WalletError(error="not found")

                if txn.status not in ["new", "retry", "pending"]:
                    return

                if pi_data["status"] == "succeeded":
                    self._apply_intent(txn, pi_data, db)
                    db.session.commit()
                else:
                    stripe.PaymentIntent.cancel(stripe_pi)
                    txn.status = "cancelled"
                    txn.reason = "Cancelled by user"
                    txn.updated = utcnow()
                    db.session.add(txn)
                    db.session.commit()
        except Exception as stripe_error:
            raise WalletError("stripe error") from stripe_error

    def set_savecard(
        self,
        request: Request,
        user: FlathubUser,
        transaction: str,
        state: TransactionSaveCardKind | None,
    ):
        self._modify_checkout(user, transaction, {"setup_future_usage": state or ""})

    def _modify_checkout(
        self, user: FlathubUser, transaction: str, options: "PaymentIntentModifyParams"
    ):
        with get_db("writer") as db:
            txn = models.Transaction.by_user_and_id(db, user, transaction, lock=True)
            if txn is None:
                raise WalletError(error="not found")
            if txn.status not in ["new", "retry"]:
                raise WalletError(error="bad transaction status")
            stxn = models.StripeTransaction.by_transaction(db, txn)
            if stxn is None:
                raise WalletError(error="not found")
            try:
                if (
                    stripe.PaymentIntent.retrieve(stxn.stripe_pi).status
                    not in CONFIRMABLE
                ):
                    raise WalletError(error="bad transaction status")
                stripe.PaymentIntent.modify(stxn.stripe_pi, **options)
                stxn.checkout_revision += 1
            except stripe.StripeError as error:
                raise WalletError("stripe error") from error

    async def webhook(self, request: Request) -> Response:
        # Deal with the incoming webhook request
        body = await request.body()
        signature = request.headers.get("stripe-signature")
        try:
            event = stripe.Webhook.construct_event(
                body, sig_header=signature, secret=settings.stripe_webhook_key
            )
            data = event.to_dict()["data"]
            event_type = event["type"]
        except Exception as stripe_error:
            raise WalletError(error="stripe error") from stripe_error

        if event_type not in {
            "payment_intent.succeeded",
            "payment_intent.payment_failed",
            "payment_intent.canceled",
        }:
            return Response(None, status_code=201)
        obj = data["object"]
        transfer_group = obj.get("transfer_group")
        if not isinstance(transfer_group, str) or not transfer_group.startswith(
            GROUP_PREFIX
        ):
            return Response(None, status_code=201)
        try:
            group = int(transfer_group[len(GROUP_PREFIX) :])
        except ValueError:
            return Response(None, status_code=201)

        with get_db("writer") as db:
            stripe_txn = db.session.get(models.StripeTransaction, group)
            if stripe_txn is None or stripe_txn.stripe_pi != obj["id"]:
                return Response(None, status_code=201)
            transaction = db.session.get(
                models.Transaction, stripe_txn.transaction, with_for_update=True
            )
            if transaction is None or transaction.status in {"success", "cancelled"}:
                return Response(None, status_code=201)
            if event_type == "payment_intent.succeeded":
                self._apply_intent(transaction, {"status": "succeeded"}, db)
            elif event_type == "payment_intent.payment_failed":
                # A failure describes one attempt, not the current intent.
                event_id = event["id"]
                if (
                    db.session.get(models.StripeFailedPaymentEvent, event_id)
                    is not None
                ):
                    return Response(None, status_code=201)
                db.add(models.StripeFailedPaymentEvent(event_id=event_id))
                created = datetime.fromtimestamp(event["created"], UTC).replace(
                    tzinfo=None
                )
                if (
                    transaction.status == "pending"
                    and created < transaction.updated.replace(microsecond=0)
                ):
                    return Response(None, status_code=201)
                current = stripe.PaymentIntent.retrieve(stripe_txn.stripe_pi)
                self._apply_intent(transaction, current, db)
            else:
                self._apply_intent(transaction, {"status": "canceled"}, db)

        return Response(None, status_code=201)

    def confirm_payment(
        self,
        user: FlathubUser,
        transaction: str,
        payment: ConfirmSavedCard | ConfirmNewCard,
    ) -> ConfirmationOutcome:
        with get_db("writer") as db:
            txn = models.Transaction.by_user_and_id(db, user, transaction, lock=True)
            if txn is None:
                raise WalletError(error="not found")
            stxn = models.StripeTransaction.by_transaction(db, txn)
            if stxn is None:
                raise WalletError(error="not found")
            pi = stxn.stripe_pi
            if payment.checkout_revision != stxn.checkout_revision:
                return "view_details"
            stxn.checkout_revision += 1
            try:
                intent = stripe.PaymentIntent.retrieve(pi)
                can_confirm = (
                    txn.status
                    in {
                        "new",
                        "pending",
                        "retry",
                    }
                    and intent.status in CONFIRMABLE
                )
                if can_confirm:
                    options: PaymentIntentConfirmParams = {
                        "use_stripe_sdk": True,
                        "return_url": f"{settings.frontend_url.rstrip('/')}/payment/details/{txn.id}",
                        "idempotency_key": f"confirm-{pi}-{payment.checkout_revision}",
                    }
                    if isinstance(payment, ConfirmSavedCard):
                        customer = StripeCustomer.by_user(db, user)
                        method = stripe.PaymentMethod.retrieve(payment.payment_method)
                        if (
                            customer is None
                            or method.customer != customer.stripe_cust
                            or method.type != "card"
                        ):
                            db.session.commit()
                            raise WalletError(error="not found")
                        options["payment_method"] = payment.payment_method
                    else:
                        options["confirmation_token"] = payment.confirmation_token
                        options["setup_future_usage"] = (
                            "on_session" if payment.save_card else ""
                        )
                    try:
                        intent = stripe.PaymentIntent.confirm(pi, **options)
                    except stripe.CardError as error:
                        # A decline is a completed submission; don't resubmit it on replay.
                        intent = stripe.PaymentIntent.retrieve(pi)
                        self._apply_intent(txn, intent, db)
                        if intent.status != "requires_payment_method":
                            return "view_details"
                        decline_code = (
                            error.error.to_dict().get("decline_code")
                            if error.error
                            else None
                        )
                        return CardDecline(
                            decline_code="generic_decline"
                            if decline_code in {"lost_card", "stolen_card"}
                            else decline_code,
                            code=error.code,
                        )
                if txn.status not in {"success", "cancelled"}:
                    self._apply_intent(txn, intent, db)
                return (
                    "requires_action"
                    if can_confirm and intent.status == "requires_action"
                    else "view_details"
                )
            except stripe.StripeError as error:
                if txn.status == "new":
                    txn.status, txn.updated = "pending", utcnow()
                db.session.commit()
                raise WalletError(error="stripe error") from error

    def set_transaction_pending(
        self, request: Request, user: FlathubUser, transaction: str
    ):
        # Legacy clients must reload before confirming outside the transaction lock.
        raise WalletError(error="failed-to-load-refresh")

    def perform_pending_transfers(self):
        while True:
            with get_db("writer") as db:
                transfer = (
                    models.StripePendingTransfer.all_due(db)
                    .order_by(models.StripePendingTransfer.id)
                    .with_for_update(of=models.StripePendingTransfer, skip_locked=True)
                    .first()
                )
                if transfer is not None:
                    delivery = models.StripeTransferDelivery(
                        id=transfer.id,
                        stripe_transaction=transfer.stripe_transaction,
                        recipient=transfer.recipient,
                        currency=transfer.currency,
                        amount=transfer.amount,
                        attempts=0,
                    )
                    db.add(delivery)
                    db.delete(transfer)
                else:
                    delivery = (
                        db.query(models.StripeTransferDelivery)
                        .filter(
                            models.StripeTransferDelivery.outcome == "retry",
                            models.StripeTransferDelivery.claimed_at
                            < utcnow() - timedelta(hours=1),
                        )
                        .order_by(models.StripeTransferDelivery.id)
                        .with_for_update(skip_locked=True)
                        .first()
                    )
                    if delivery is None:
                        return
                delivery.claimed_at = utcnow()
                delivery.outcome = "unconfirmed"
                delivery.attempts += 1
                transfer_id, attempt = delivery.id, delivery.attempts
                amount, currency, destination = (
                    delivery.amount,
                    delivery.currency,
                    delivery.recipient,
                )

            provider_id = None
            try:
                result = stripe.Transfer.create(
                    amount=amount,
                    currency=currency,
                    destination=destination,
                    metadata={"flathub_transfer_id": str(transfer_id)},
                    idempotency_key=f"flathub-transfer-{transfer_id}-{attempt}",
                )
                provider_id, outcome = result.id, "confirmed"
            except stripe.InvalidRequestError as error:
                outcome = (
                    "retry" if error.code == "balance_insufficient" else "rejected"
                )
            except (stripe.StripeError, OSError):
                outcome = "unconfirmed"
            if outcome != "confirmed":
                logger.error(
                    "Transfer %s attempt %s: %s", transfer_id, attempt, outcome
                )
            with get_db("writer") as db:
                delivery = db.session.get(models.StripeTransferDelivery, transfer_id)
                if delivery is None:
                    raise RuntimeError(f"Missing claimed transfer {transfer_id}")
                delivery.outcome, delivery.stripe_transfer_id = outcome, provider_id


# Refuse to load if stripe configuration unavailable


if any(
    blank
    in [
        settings.stripe_secret_key,
        settings.stripe_public_key,
        settings.stripe_webhook_key,
    ]
    for blank in [None, ""]
):
    raise ImportError("Stripe configuration is missing, refusing to load")
else:
    stripe.api_key = settings.stripe_secret_key
