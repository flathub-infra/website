from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    delete,
)
from sqlalchemy.ext.declarative import declarative_base

from . import utils

Base = declarative_base()


class FlathubUser(Base):
    __tablename__ = "flathubuser"

    id = Column(Integer, primary_key=True)
    display_name = Column(String)
    deleted = Column(Boolean, nullable=False, default=False)
    TABLES_FOR_DELETE = []

    @staticmethod
    def generate_token(db, user) -> str:
        """
        Generate a token which represents this user's state.  This token will be needed
        when attempting to delete the user.
        """
        hasher = utils.Hasher()
        # Add user info to be hashed
        hasher.add_number(user.id)
        hasher.add_string(user.display_name)
        # Delete hash
        for table in user.TABLES_FOR_DELETE:
            table.delete_hash(hasher, db, user)
        return hasher.hash()

    @staticmethod
    def delete_user(db, user, token: str) -> dict:
        """
        Attempt to delete the given user, we expect the user's token to match, otherwise
        we will return an error.
        """
        current_token = FlathubUser.generate_token(db, user)
        if token != current_token:
            return {"status": "error", "error": "token mismatch"}
        for table in user.TABLES_FOR_DELETE:
            table.delete_user(db, user)

        # Clear the user's details
        user.display_name = None
        # Mark the user as deleted
        user.deleted = True
        # Ensure the DB is updated
        db.session.add(user)
        db.session.commit()

        # And we're done
        return {
            "status": "ok",
            "message": "deleted",
        }


class GithubAccount(Base):
    __tablename__ = "githubaccount"

    id = Column(Integer, primary_key=True)
    user = Column(Integer, ForeignKey(FlathubUser.id), nullable=False, index=True)
    github_userid = Column(Integer, nullable=False)
    login = Column(String)
    avatar_url = Column(String)
    token = Column(String, nullable=True, default=None)
    last_used = Column(DateTime, nullable=True, default=None)

    @staticmethod
    def by_user(db, user: FlathubUser):
        return db.session.query(GithubAccount).filter_by(user=user.id).first()

    @staticmethod
    def by_provider_id(db, ghid):
        return db.session.query(GithubAccount).filter_by(github_userid=ghid).first()

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user):
        """
        Add a user's information from Github to the hasher for token generation
        """
        if account := GithubAccount.by_user(db, user):
            hasher.add_string("github")
            hasher.add_number(account.github_userid)
            hasher.add_string(account.login)
            repos = [
                repo.reponame for repo in GithubRepository.all_by_account(db, account)
            ]
            repos.sort()
            for repo in repos:
                hasher.add_string(repo)

    @staticmethod
    def delete_user(db, user):
        """
        Delete a user's account and information related to Github
        """
        if gha := GithubAccount.by_user(db, user):
            db.session.execute(
                delete(GithubRepository).where(
                    GithubRepository.github_account == gha.id
                )
            )
            db.session.delete(gha)


FlathubUser.TABLES_FOR_DELETE.append(GithubAccount)

DEFAULT_HOUSEKEEPING_MINUTES = 20


class GithubFlowToken(Base):
    __tablename__ = "githubflowtoken"

    id = Column(Integer, primary_key=True)
    state = Column(String, nullable=False)
    created = Column(DateTime, nullable=False)

    @staticmethod
    def housekeeping(db, minutes=DEFAULT_HOUSEKEEPING_MINUTES):
        """
        Clear out any tokens which are more than the specified age.

        The login flow will also discard flow tokens younger than this, so over-all
        the flow tokens table should be kept pretty clean.
        """
        too_old = datetime.now() - timedelta(minutes=minutes)
        db.session.execute(
            delete(GithubFlowToken).where(GithubFlowToken.created < too_old)
        )
        db.session.flush()


class GithubRepository(Base):
    __tablename__ = "githubrepository"

    id = Column(Integer, primary_key=True)
    github_account = Column(
        Integer, ForeignKey(GithubAccount.id), nullable=False, index=True
    )
    reponame = Column(String, nullable=False)

    @staticmethod
    def unify_repolist(db, account: GithubAccount, repolist: List[str]):
        all_names = set(repolist)
        existing = db.session.query(GithubRepository).filter_by(
            github_account=account.id
        )
        to_remove = [repo for repo in existing if repo.reponame not in all_names]
        existing_names = set(repo.reponame for repo in existing)
        to_add = [repo for repo in repolist if repo not in existing_names]
        for repo in to_remove:
            db.session.delete(repo)
        for repo in to_add:
            new_repo = GithubRepository(github_account=account.id, reponame=repo)
            db.session.add(new_repo)
        db.session.flush()

    @staticmethod
    def all_by_account(db, account: GithubAccount):
        return db.session.query(GithubRepository).filter_by(github_account=account.id)


class GitlabFlowToken(Base):
    __tablename__ = "gitlabflowtoken"

    id = Column(Integer, primary_key=True)
    state = Column(String, nullable=False)
    created = Column(DateTime, nullable=False)

    @staticmethod
    def housekeeping(db, minutes=DEFAULT_HOUSEKEEPING_MINUTES):
        """
        Clear out any tokens which are more than the specified age.

        The login flow will also discard flow tokens younger than this, so over-all
        the flow tokens table should be kept pretty clean.
        """
        too_old = datetime.now() - timedelta(minutes=minutes)
        db.session.execute(
            delete(GitlabFlowToken).where(GitlabFlowToken.created < too_old)
        )
        db.session.flush()


class GitlabAccount(Base):
    __tablename__ = "gitlabaccount"

    id = Column(Integer, primary_key=True)
    user = Column(Integer, ForeignKey(FlathubUser.id), nullable=False, index=True)
    gitlab_userid = Column(Integer, nullable=False)
    login = Column(String)
    avatar_url = Column(String)
    token = Column(String, nullable=True, default=None)
    token_expiry = Column(DateTime, nullable=True, default=None)
    refresh_token = Column(String, nullable=True, default=None)
    last_used = Column(DateTime, nullable=True, default=None)

    @staticmethod
    def by_user(db, user: FlathubUser):
        return db.session.query(GitlabAccount).filter_by(user=user.id).first()

    @staticmethod
    def by_provider_id(db, glid):
        return db.session.query(GitlabAccount).filter_by(gitlab_userid=glid).first()

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user):
        """
        Add a user's information from Gitlab to the hasher for token generation
        """
        if account := GitlabAccount.by_user(db, user):
            hasher.add_string("gitlab")
            hasher.add_number(account.gitlab_userid)
            hasher.add_string(account.login)

    @staticmethod
    def delete_user(db, user):
        """
        Delete a user's account and information related to Gitlab
        """
        db.session.execute(delete(GitlabAccount).where(GitlabAccount.user == user.id))


FlathubUser.TABLES_FOR_DELETE.append(GitlabAccount)


class GnomeFlowToken(Base):
    __tablename__ = "gnomeflowtoken"

    id = Column(Integer, primary_key=True)
    state = Column(String, nullable=False)
    created = Column(DateTime, nullable=False)

    @staticmethod
    def housekeeping(db, minutes=DEFAULT_HOUSEKEEPING_MINUTES):
        """
        Clear out any tokens which are more than the specified age.

        The login flow will also discard flow tokens younger than this, so over-all
        the flow tokens table should be kept pretty clean.
        """
        too_old = datetime.now() - timedelta(minutes=minutes)
        db.session.execute(
            delete(GnomeFlowToken).where(GnomeFlowToken.created < too_old)
        )
        db.session.flush()


class GnomeAccount(Base):
    __tablename__ = "gnomeaccount"

    id = Column(Integer, primary_key=True)
    user = Column(Integer, ForeignKey(FlathubUser.id), nullable=False, index=True)
    gnome_userid = Column(Integer, nullable=False)
    login = Column(String)
    avatar_url = Column(String)
    token = Column(String, nullable=True, default=None)
    token_expiry = Column(DateTime, nullable=True, default=None)
    refresh_token = Column(String, nullable=True, default=None)
    last_used = Column(DateTime, nullable=True, default=None)

    @staticmethod
    def by_user(db, user: FlathubUser):
        return db.session.query(GnomeAccount).filter_by(user=user.id).first()

    @staticmethod
    def by_provider_id(db, glid):
        return db.session.query(GnomeAccount).filter_by(gnome_userid=glid).first()

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user):
        """
        Add a user's information from Gnome to the hasher for token generation
        """
        if account := GnomeAccount.by_user(db, user):
            hasher.add_string("gnome")
            hasher.add_number(account.gnome_userid)
            hasher.add_string(account.login)

    @staticmethod
    def delete_user(db, user):
        """
        Delete a user's account and information related to Gnome
        """
        db.session.execute(delete(GnomeAccount).where(GnomeAccount.user == user.id))


FlathubUser.TABLES_FOR_DELETE.append(GnomeAccount)


class GoogleFlowToken(Base):
    __tablename__ = "googleflowtoken"

    id = Column(Integer, primary_key=True)
    state = Column(String, nullable=False)
    created = Column(DateTime, nullable=False)

    @staticmethod
    def housekeeping(db, minutes=DEFAULT_HOUSEKEEPING_MINUTES):
        """
        Clear out any tokens which are more than the specified age.

        The login flow will also discard flow tokens younger than this, so over-all
        the flow tokens table should be kept pretty clean.
        """
        too_old = datetime.now() - timedelta(minutes=minutes)
        db.session.execute(
            delete(GoogleFlowToken).where(GoogleFlowToken.created < too_old)
        )
        db.session.flush()


class GoogleAccount(Base):
    __tablename__ = "googleaccount"

    id = Column(Integer, primary_key=True)
    user = Column(Integer, ForeignKey(FlathubUser.id), nullable=False, index=True)
    google_userid = Column(String, nullable=False)
    login = Column(String)
    avatar_url = Column(String)
    token = Column(String, nullable=True, default=None)
    token_expiry = Column(DateTime, nullable=True, default=None)
    refresh_token = Column(String, nullable=True, default=None)
    last_used = Column(DateTime, nullable=True, default=None)

    @staticmethod
    def by_user(db, user: FlathubUser):
        return db.session.query(GoogleAccount).filter_by(user=user.id).first()

    @staticmethod
    def by_provider_id(db, ggid):
        return db.session.query(GoogleAccount).filter_by(google_userid=ggid).first()

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user):
        """
        Add a user's information from Google to the hasher for token generation
        """
        if account := GoogleAccount.by_user(db, user):
            hasher.add_string("google")
            hasher.add_string(account.google_userid)
            hasher.add_string(account.login)

    @staticmethod
    def delete_user(db, user):
        """
        Delete a user's account and information related to Google
        """
        db.session.execute(delete(GoogleAccount).where(GoogleAccount.user == user.id))


FlathubUser.TABLES_FOR_DELETE.append(GoogleAccount)


class UserVerifiedApp(Base):
    __tablename__ = "userverifiedapp"

    app_id = Column(String, primary_key=True, nullable=False)
    account = Column(
        Integer, ForeignKey(FlathubUser.id, ondelete="CASCADE"), nullable=False
    )
    created = Column(DateTime, nullable=False)

    @staticmethod
    def all_by_user(db, user: FlathubUser):
        return db.session.query(UserVerifiedApp).filter_by(account=user.id)

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user: FlathubUser):
        """
        Add a user's verified apps to the hasher for token generation
        """
        apps = [app.app_id for app in UserVerifiedApp.all_by_user(db, user)]
        apps.sort()
        for app in apps:
            hasher.add_string(app)

    @staticmethod
    def delete_user(db, user: FlathubUser):
        """
        Delete any app verifications associated with this user
        """
        db.session.execute(
            delete(UserVerifiedApp).where(UserVerifiedApp.account == user.id)
        )


FlathubUser.TABLES_FOR_DELETE.append(UserVerifiedApp)


# Wallet related content


class Transaction(Base):
    __tablename__ = "transaction"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey(FlathubUser.id), nullable=False, index=True)
    value = Column(Integer, nullable=False)
    currency = Column(String, nullable=False)
    kind = Column(String, nullable=False)
    status = Column(String, nullable=False)
    reason = Column(String)
    created = Column(DateTime, nullable=False)
    updated = Column(DateTime, nullable=False)

    @classmethod
    def by_user(cls, db, user: FlathubUser):
        return db.session.query(Transaction).filter(Transaction.user_id == user.id)

    @classmethod
    def by_user_and_id(cls, db, user: FlathubUser, txnid: str):
        return (
            db.session.query(Transaction)
            .filter(Transaction.user_id == user.id)
            .filter(Transaction.id == int(txnid))
            .first()
        )

    def rows(self, db):
        return (
            db.session.query(TransactionRow)
            .filter(TransactionRow.txn == self.id)
            .order_by(TransactionRow.idx)
        )

    @classmethod
    def create_from_split(
        cls,
        db,
        user: FlathubUser,
        purchase: bool,
        currency: str,
        splits: List[Tuple[str, int]],
    ) -> "Transaction":
        """
        Create a transaction, and rows, from the given input information
        """
        total = sum(value for (_appid, value) in splits)
        if purchase:
            kind = "purchase"
        else:
            kind = "donation"
        now_date = datetime.now()
        txn = Transaction(
            user_id=user.id,
            value=total,
            currency=currency,
            kind=kind,
            status="new",
            created=now_date,
            updated=now_date,
        )
        db.session.add(txn)
        db.session.flush()
        for (idx, (appid, value)) in enumerate(splits):
            if idx == 0:
                row_kind = kind
            elif appid == "org.flathub.FlatHub":
                row_kind = "purchase"
            else:
                row_kind = "donation"
            txn_row = TransactionRow(
                txn=txn.id,
                idx=idx,
                amount=value,
                currency=currency,
                kind=row_kind,
                recipient=appid,
            )
            db.session.add(txn_row)
        db.session.commit()
        return txn


class TransactionRow(Base):
    __tablename__ = "transactionrow"

    id = Column(Integer, primary_key=True)
    txn = Column(Integer, ForeignKey(Transaction.id), nullable=False, index=True)
    idx = Column(Integer, nullable=False)
    amount = Column(Integer, nullable=False)
    currency = Column(String, nullable=False)
    kind = Column(String, nullable=False)
    recipient = Column(String, nullable=False)


# Stripe-specific wallet models


class StripeCustomer(Base):
    __tablename__ = "stripecustomer"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey(FlathubUser.id), nullable=False, index=True)
    stripe_cust = Column(String, nullable=False, index=True)

    @classmethod
    def by_user(cls, db, user: FlathubUser):
        return (
            db.session.query(StripeCustomer)
            .filter(StripeCustomer.user_id == user.id)
            .first()
        )


class StripeTransaction(Base):
    __tablename__ = "stripetransaction"

    id = Column(Integer, primary_key=True)
    transaction = Column(
        Integer, ForeignKey(Transaction.id), nullable=False, unique=True, index=True
    )
    stripe_pi = Column(String, nullable=False)

    @classmethod
    def by_transaction(cls, db, txn: Transaction):
        return (
            db.session.query(StripeTransaction)
            .filter(StripeTransaction.transaction == txn.id)
            .first()
        )


class UserOwnedApp(Base):
    __tablename__ = "userownedapp"

    app_id = Column(String, nullable=False, primary_key=True)
    account = Column(
        Integer,
        ForeignKey(FlathubUser.id, ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )
    created = Column(DateTime, nullable=False)

    @staticmethod
    def user_owns_app(db, user_id: int, app_id: str):
        return (
            db.session.query(UserOwnedApp)
            .filter_by(account=user_id, app_id=app_id)
            .first()
            is not None
        )

    @staticmethod
    def all_owned_by_user(db, user: FlathubUser):
        return db.session.query(UserOwnedApp).filter_by(account=user.id)

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user: FlathubUser):
        """
        Add a user's owned apps to the hasher for token generation
        """
        apps = [app.app_id for app in UserOwnedApp.all_owned_by_user(db, user)]
        apps.sort()
        for app in apps:
            hasher.add_string(app)

    @staticmethod
    def delete_user(db, user: FlathubUser):
        """
        Delete any app ownerships associated with this user
        """
        db.session.execute(delete(UserOwnedApp).where(UserOwnedApp.account == user.id))


FlathubUser.TABLES_FOR_DELETE.append(UserOwnedApp)


# Vending related tables, including Stripe-only stuff


class StripeExpressAccount(Base):
    __tablename__ = "stripeexpressaccount"

    id = Column(Integer, primary_key=True)
    user = Column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, unique=True, index=True
    )
    stripe_account = Column(String, nullable=False)

    @classmethod
    def by_user(cls, db, user: FlathubUser) -> Optional["StripeExpressAccount"]:
        return (
            db.session.query(StripeExpressAccount)
            .filter(StripeExpressAccount.user == user.id)
            .first()
        )

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user: FlathubUser):
        """
        Add a user's vendor setup to the hash
        """
        account = StripeExpressAccount.by_user(db, user)
        if account:
            hasher.add_string(account.stripe_account)

    @staticmethod
    def delete_user(db, user: FlathubUser):
        """
        Delete any vendor setup for the user
        """
        db.session.execute(
            delete(StripeExpressAccount).where(StripeExpressAccount.user == user.id)
        )


FlathubUser.TABLES_FOR_DELETE.append(StripeExpressAccount)


class ApplicationVendingConfig(Base):
    __tablename__ = "applicationvendingconfig"

    id = Column(Integer, primary_key=True)
    appid = Column(String, nullable=False, unique=True, index=True)
    user = Column(Integer, ForeignKey(FlathubUser.id), nullable=False, index=True)

    appshare = Column(Integer, nullable=False)
    CheckConstraint(
        "appshare >= 10 && appshare <= 100", name="vending_appshare_in_range"
    )

    currency = Column(String, nullable=False, default="usd")
    recommended_donation = Column(Integer, nullable=False)
    minimum_payment = Column(Integer, nullable=False)
    CheckConstraint("currency = 'usd'", name="currency_must_be_dollars")
    CheckConstraint(
        "recommended_donation >= minimum_payment", name="vending_donation_not_too_small"
    )
    CheckConstraint(
        "recommended_donation > 100", name="vending_donation_at_least_one_dollar"
    )
    CheckConstraint("minimum_payment >= 0", name="vending_payment_not_negative")

    @classmethod
    def by_appid(cls, db, appid: str) -> Optional["ApplicationVendingConfig"]:
        """
        Retrieve vending configuration (if available) for a given appid
        """
        return (
            db.session.query(ApplicationVendingConfig)
            .filter(ApplicationVendingConfig.appid == appid)
            .first()
        )

    @classmethod
    def all_by_user(cls, db, user: FlathubUser) -> List["ApplicationVendingConfig"]:
        """
        Retrieve all the vending configurations for a given user
        """
        return db.session.query(ApplicationVendingConfig).filter(
            ApplicationVendingConfig.user == user.id
        )

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user: FlathubUser):
        """
        Add a user's configured-for-vending apps to the hash
        """
        apps = [app.appid for app in ApplicationVendingConfig.all_by_user(db, user)]
        for app in apps:
            hasher.add_string(app)

    @staticmethod
    def delete_user(db, user: FlathubUser):
        """
        Delete any configured-for-vending apps for the user
        """
        db.session.execute(
            delete(ApplicationVendingConfig).where(
                ApplicationVendingConfig.user == user.id
            )
        )


FlathubUser.TABLES_FOR_DELETE.append(ApplicationVendingConfig)
