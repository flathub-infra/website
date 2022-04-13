"""
Implementation details for a Stripe based wallet for Flathub

This will be used if the app starts with Stripe credentials available
"""

from datetime import datetime
from itertools import dropwhile
from typing import List, Optional

import stripe
from fastapi import Request, Response
from fastapi_sqlalchemy import db

from .. import models
from ..config import settings
from ..models import FlathubUser, StripeCustomer
from .walletbase import (
    CardInfo,
    NascentTransaction,
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

GROUP_PREFIX = "flathub-txn-"


class StripeWallet(WalletBase):
    """
    A wallet which is backed by Stripe
    """

    @classmethod
    def webhook_name(cls):
        return "stripe"

    def stripedata(self) -> StripeKeys:
        return StripeKeys(status="ok", public_key=settings.stripe_public_key)

    def _get_customer(self, user: FlathubUser) -> StripeCustomer:
        cust = StripeCustomer.by_user(db, user)
        if cust is None:
            try:
                cust = stripe.Customer.create(
                    idempotency_key=f"create-user-{user.id}",
                    description=f"Customer record for Flathub User {user.id}",
                )
            except Exception as stripe_error:
                raise WalletError(
                    error="stripe-customer-failed-to-make"
                ) from stripe_error
            db.session.add(StripeCustomer(user_id=user.id, stripe_cust=cust.id))
            db.session.commit()
            return StripeCustomer.by_user(db, user)
        return cust

    def _cardinfo(self, card: dict) -> Optional[CardInfo]:
        return CardInfo(
            id=card["id"],
            brand=card["card"]["brand"].lower().replace(" ", ""),
            exp_month=card["card"]["exp_month"],
            exp_year=card["card"]["exp_year"],
            last4=card["card"]["last4"],
            country=card["card"]["country"].lower(),
        )

    def info(self, request: Request, user: FlathubUser) -> WalletInfo:
        customer = self._get_customer(user)
        pms = stripe.Customer.list_payment_methods(customer.stripe_cust, type="card")
        return WalletInfo(
            status="ok",
            cards=[self._cardinfo(card) for card in pms["data"]],
        )

    def remove_card(self, request: Request, user: FlathubUser, card: CardInfo):
        customer = self._get_customer(user)
        pms = stripe.Customer.list_payment_methods(customer.stripe_cust, type="card")
        cards = [self._cardinfo(card) for card in pms["data"]]
        if card not in cards:
            raise WalletError(error="not found")
        stripe.PaymentMethod.detach(card.id)

    def transactions(
        self,
        request: Request,
        user: FlathubUser,
        sort: TransactionSortOrder,
        since: Optional[str],
        limit: int,
    ) -> List[TransactionSummary]:
        txns = models.Transaction.by_user(db, user)
        if sort == TransactionSortOrder.RECENT:
            txns = txns.order_by(models.Transaction.created.desc())
        else:
            txns = txns.order_by(models.Transaction.created)
        txns = list(txns)
        if since is not None:
            txns = list(dropwhile(lambda txn: str(txn.id) != since, txns))
            txns = txns[1:]
        if limit < len(txns):
            txns = txns[:limit]

        did_update = False
        for txn in txns:
            if self._update_transaction(user, txn):
                db.session.add(txn)
                did_update = True
        if did_update:
            db.session.commit()

        return [
            TransactionSummary(
                id=txn.id,
                value=txn.value,
                currency=txn.currency,
                kind=txn.kind,
                status=txn.status,
                reason=txn.reason,
                created=txn.created.timestamp(),
                updated=txn.updated.timestamp(),
            )
            for txn in txns
        ]

    def _get_transaction(
        self, user: FlathubUser, txn: models.Transaction
    ) -> models.StripeTransaction:
        stxn = models.StripeTransaction.by_transaction(db, txn)
        if stxn is not None:
            return stxn
        try:
            # First a consistency check, are we happy to make this txn.
            # For now, we don't have any support for anything other than
            # Flathub receiving donations, so do not permit anything else.
            for row in txn.rows(db):
                if row.recipient != "org.flathub.Flathub":
                    raise WalletError(error="not found")
            # The transaction isn't there, so let's create a payment intent
            # and then fill it out.
            cust = self._get_customer(user)
            payment_intent = stripe.PaymentIntent.create(
                amount=txn.value,
                currency=txn.currency,
                payment_method_types=["card"],
                customer=cust.stripe_cust,
                transfer_group=f"{GROUP_PREFIX}{txn.id}",
            )
            # TODO: When we support other recipients, this will need amending
            # to iterate the rows.
            stxn = models.StripeTransaction(
                transaction=txn.id, stripe_pi=payment_intent["id"]
            )
            db.session.add(stxn)
            db.session.commit()
            return stxn
        except WalletError:
            raise
        except Exception as stripe_error:
            raise WalletError(
                error="stripe-payment-intent-build-failed"
            ) from stripe_error

    def _update_transaction(self, user: FlathubUser, txn: models.Transaction) -> bool:
        if txn.status not in ["pending", "retry"]:
            return False
        # Pending transactions may need tweaking based on Stripe status
        stxn = self._get_transaction(user, txn)
        try:
            payment_intent = stripe.PaymentIntent.retrieve(stxn.stripe_pi)
            pi_status = payment_intent["status"]
            if pi_status == "succeeded":
                txn.status = "success"
                txn.reason = ""
            elif pi_status == "cancelled":
                txn.status = "cancelled"
                txn.reason = "Cancellation noted from Stripe"
            else:
                print(f"TXN {txn.id} in retry because {pi_status}")
                txn.status = "retry"
                txn.reason = f"Stripe status: {pi_status}"
            db.session.add(txn)
            return True

        except Exception as stripe_error:
            raise WalletError(
                error="stripe-payment-intent-retrieve-failed"
            ) from stripe_error

    def transaction(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> Transaction:
        txn = models.Transaction.by_user_and_id(db, user, transaction)
        if txn is None:
            raise WalletError(error="not found")
        if self._update_transaction(user, txn):
            db.session.add(txn)
            db.session.commit()
        summary = TransactionSummary(
            id=txn.id,
            value=txn.value,
            currency=txn.currency,
            kind=txn.kind,
            status=txn.status,
            reason=txn.reason,
            created=txn.created.timestamp(),
            updated=txn.updated.timestamp(),
        )
        details = [
            TransactionRow(
                recipient=row.recipient,
                amount=row.amount,
                currency=row.currency,
                kind=row.kind,
            )
            for row in txn.rows(db)
        ]
        stxn = self._get_transaction(user, txn)
        card = None
        receipt = None
        try:
            payment_intent = stripe.PaymentIntent.retrieve(stxn.stripe_pi)
            payment_method = payment_intent.get("payment_method")
            if payment_method is not None:
                payment_method = stripe.PaymentMethod.retrieve(payment_method)
                card = self._cardinfo(payment_method)
            if payment_intent["charges"]["total_count"] > 0:
                receipt = payment_intent["charges"]["data"][0].get("receipt_url")
        except Exception as stripe_error:
            raise WalletError(error="not found") from stripe_error

        return Transaction(summary=summary, card=card, details=details, receipt=receipt)

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

        txn = models.Transaction(
            user_id=user.id,
            value=transaction.summary.value,
            currency=transaction.summary.currency,
            kind=transaction.summary.kind,
            status="new",
            created=datetime.now(),
            updated=datetime.now(),
        )

        db.session.add(txn)
        db.session.flush()

        for (idx, row) in enumerate(transaction.details):
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

        return str(txn.id)

    def set_transaction_card(
        self, request: Request, user: FlathubUser, transaction: str, card: CardInfo
    ):
        customer = self._get_customer(user)
        pms = stripe.Customer.list_payment_methods(customer.stripe_cust, type="card")
        cards = [self._cardinfo(card) for card in pms["data"]]
        if card not in cards:
            raise WalletError(error="not found")
        txn = models.Transaction.by_user_and_id(db, user, transaction)
        if txn is None:
            raise WalletError("not found")
        if txn.status not in ["new", "retry"]:
            raise WalletError(error="bad transaction status")
        txn = self._get_transaction(user, txn)
        try:
            stripe.PaymentIntent.modify(
                txn.stripe_pi,
                payment_method=card.id,
            )
        except WalletError:
            raise
        except Exception as stripe_error:
            raise WalletError("not found") from stripe_error

    def get_transaction_stripedata(
        self, request: Request, user: FlathubUser, transaction: str
    ) -> TransactionStripeData:
        txn = models.Transaction.by_user_and_id(db, user, transaction)
        if txn is None:
            raise WalletError(error="not found")
        if txn.status not in ["new", "retry"]:
            raise WalletError(error="bad transaction status")
        txn = self._get_transaction(user, txn)
        card = None
        try:
            payment_intent = stripe.PaymentIntent.retrieve(txn.stripe_pi)
            payment_method = payment_intent.get("payment_method")
            if payment_method is not None:
                payment_method = stripe.PaymentMethod.retrieve(payment_method)
                card = self._cardinfo(payment_method)
        except Exception as stripe_error:
            raise WalletError("stripe error") from stripe_error

        return TransactionStripeData(
            status="ok", client_secret=payment_intent["client_secret"], card=card
        )

    def cancel_transaction(self, request: Request, user: FlathubUser, transaction: str):
        txn = models.Transaction.by_user_and_id(db, user, transaction)
        if txn is None:
            raise WalletError(error="not found")
        if txn.status not in ["new", "retry"]:
            raise WalletError(error="bad transaction status")
        stripe_txn = self._get_transaction(user, txn)
        try:
            pi_data = stripe.PaymentIntent.retrieve(stripe_txn.stripe_pi)
            if pi_data["status"] == "succeeded":
                txn.status = "success"
            else:
                stripe.PaymentIntent.cancel(stripe_txn.stripe_pi)
                txn.status = "cancelled"
            db.session.add(txn)
            db.session.commit()
        except Exception as stripe_error:
            raise WalletError("stripe error") from stripe_error

    def set_savecard(
        self,
        request: Request,
        user: FlathubUser,
        transaction: str,
        state: Optional[TransactionSaveCardKind],
    ):
        txn = models.Transaction.by_user_and_id(db, user, transaction)
        if txn is None:
            raise WalletError(error="not found")
        if txn.status not in ["new", "retry"]:
            raise WalletError(error="bad transaction status")
        stripe_txn = self._get_transaction(user, txn)
        try:
            stripe.PaymentIntent.modify(
                stripe_txn.stripe_pi,
                setup_future_usage=state,
            )
        except Exception as stripe_error:
            raise WalletError("stripe error") from stripe_error

    async def webhook(self, request: Request) -> Response:
        # Deal with the incoming webhook request
        body = await request.body()
        signature = request.headers.get("stripe-signature")
        try:
            event = stripe.Webhook.construct_event(
                body, sig_header=signature, secret=settings.stripe_webhook_key
            )
            data = event["data"]
            event_type = event["type"]
        except Exception as stripe_error:
            raise WalletError(error="stripe error") from stripe_error

        if event_type == "payment_intent.succeeded":
            p_id = data["object"]["id"]
            group = int(data["object"]["transfer_group"][len(GROUP_PREFIX) :])
            stripe_txn = db.session.query(models.StripeTransaction).get(group)
            if stripe_txn is None or stripe_txn.stripe_pi != p_id:
                raise WalletError(error="not found")
            transaction = db.session.query(models.Transaction).get(
                stripe_txn.transaction
            )
            transaction.status = "success"
            transaction.updated = datetime.now()
            transaction.reason = ""
            db.session.add(transaction)
            db.session.commit()

        return Response(None, status_code=201)

    def set_transaction_pending(
        self, request: Request, user: FlathubUser, transaction: str
    ):
        txn = models.Transaction.by_user_and_id(db, user, transaction)
        if txn is None:
            raise WalletError(error="not found")
        if txn.status not in ["new", "retry", "pending"]:
            raise WalletError(error="bad transaction status")
        txn.status = "pending"
        txn.updated = datetime.now()
        db.session.add(txn)
        db.session.commit()


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
