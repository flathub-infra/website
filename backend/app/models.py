import enum
from datetime import datetime, timedelta
from math import ceil
from typing import Any, Optional, Union
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    and_,
    delete,
    func,
    or_,
    text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
)

from . import utils


class QualityModerationStatus(BaseModel):
    passes: bool
    unrated: int
    passed: int
    not_passed: int
    last_updated: datetime | None
    review_requested_at: datetime | None = None


class Base(DeclarativeBase):
    pass


ConnectedAccount = Union[
    "GithubAccount",
    "GitlabAccount",
    "GnomeAccount",
    "GoogleAccount",
    "KdeAccount",
]


class ConnectedAccountProvider(str, enum.Enum):
    GITHUB = "github"
    GITLAB = "gitlab"
    GNOME = "gnome"
    GOOGLE = "google"
    KDE = "kde"


class FlathubUser(Base):
    __tablename__ = "flathubuser"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    display_name: Mapped[Optional[str]]
    default_account: Mapped[Optional[str]]
    deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_moderator: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    is_quality_moderator: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    accepted_publisher_agreement_at: Mapped[bool] = mapped_column(
        DateTime, nullable=True, default=None
    )

    invite_code: Mapped[str | None] = mapped_column(
        String, nullable=True, unique=True, index=True
    )

    TABLES_FOR_DELETE = []

    def connected_accounts(self, db) -> list["ConnectedAccount"]:
        result = []
        for table in ConnectedAccountTables:
            if account := table.by_user(db, self):
                result.append(account)
        return result

    def get_connected_account(
        self, db, provider: ConnectedAccountProvider
    ) -> Optional["ConnectedAccount"]:
        for table in ConnectedAccountTables:
            if table.provider == provider:
                return table.by_user(db, self)
        return None

    def get_default_account(self, db) -> Optional["ConnectedAccount"]:
        if self.default_account is not None:
            if account := self.get_connected_account(db, self.default_account):
                return account

        # If no default is set, or if it can't be found for some reason, return the first account we find
        for table in ConnectedAccountTables:
            if account := table.by_user(db, self):
                return account

        return None

    @staticmethod
    def by_id(db, user_id: int) -> Optional["FlathubUser"]:
        return db.session.get(FlathubUser, user_id)

    @staticmethod
    def by_invite_code(db, invite_code: str) -> Optional["FlathubUser"]:
        if invite_code is None:
            return None
        return db.session.query(FlathubUser).filter_by(invite_code=invite_code).first()

    @staticmethod
    def generate_token(db, user) -> str:
        """
        Generate a token which represents this user's state.  This token will be needed
        when attempting to delete the user.
        """
        hasher = utils.Hasher()
        # Add user info to be hashed
        hasher.add_number(user.id)
        if user.display_name is not None:
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

    def dev_flatpaks(self, db):
        """
        Retrieve all the flatpaks this user is theoretically the developer for.

        As we add sources for this information, this function will need extending.
        """
        flatpaks = set()
        gha = GithubAccount.by_user(db, self)
        if gha:
            for repo in GithubRepository.all_by_account(db, gha):
                if utils.is_valid_app_id(repo.reponame):
                    flatpaks.add(repo.reponame)

        direct_upload = DirectUploadAppDeveloper.by_developer(db, self)
        for _dev, app in direct_upload:
            flatpaks.add(app.app_id)

        return flatpaks


class GithubAccount(Base):
    __tablename__ = "githubaccount"

    provider = ConnectedAccountProvider.GITHUB

    id = mapped_column(Integer, primary_key=True)
    user = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    github_userid = mapped_column(Integer, nullable=False)
    login = mapped_column(String)
    avatar_url = mapped_column(String)
    display_name: Mapped[Optional[str]]
    email: Mapped[Optional[str]]
    token = mapped_column(String, nullable=True, default=None)
    last_used = mapped_column(DateTime, nullable=True, default=None)

    @staticmethod
    def by_user(db, user: FlathubUser) -> Optional["GithubAccount"]:
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

    id = mapped_column(Integer, primary_key=True)
    state = mapped_column(String, nullable=False)
    created = mapped_column(DateTime, nullable=False)

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

    id = mapped_column(Integer, primary_key=True)
    github_account = mapped_column(
        Integer, ForeignKey(GithubAccount.id), nullable=False, index=True
    )
    reponame = mapped_column(String, nullable=False)

    @staticmethod
    def unify_repolist(db, accountId: int, repolist: list[str]):
        all_names = set(repolist)
        existing = db.session.query(GithubRepository).filter_by(
            github_account=accountId
        )
        to_remove = [repo for repo in existing if repo.reponame not in all_names]
        existing_names = set(repo.reponame for repo in existing)
        to_add = [repo for repo in repolist if repo not in existing_names]
        for repo in to_remove:
            db.session.delete(repo)
        for repo in to_add:
            new_repo = GithubRepository(github_account=accountId, reponame=repo)
            db.session.add(new_repo)
        db.session.flush()

    @staticmethod
    def all_by_account(db, account: GithubAccount) -> list["GithubRepository"]:
        return db.session.query(GithubRepository).filter_by(github_account=account.id)


class GitlabFlowToken(Base):
    __tablename__ = "gitlabflowtoken"

    id = mapped_column(Integer, primary_key=True)
    state = mapped_column(String, nullable=False)
    created = mapped_column(DateTime, nullable=False)

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

    provider = ConnectedAccountProvider.GITLAB

    id = mapped_column(Integer, primary_key=True)
    user = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    gitlab_userid = mapped_column(Integer, nullable=False)
    login = mapped_column(String)
    avatar_url = mapped_column(String)
    display_name: Mapped[Optional[str]]
    email: Mapped[Optional[str]]
    token = mapped_column(String, nullable=True, default=None)
    token_expiry = mapped_column(DateTime, nullable=True, default=None)
    refresh_token = mapped_column(String, nullable=True, default=None)
    last_used = mapped_column(DateTime, nullable=True, default=None)

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

    id = mapped_column(Integer, primary_key=True)
    state = mapped_column(String, nullable=False)
    created = mapped_column(DateTime, nullable=False)

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

    provider = ConnectedAccountProvider.GNOME

    id = mapped_column(Integer, primary_key=True)
    user = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    gnome_userid = mapped_column(Integer, nullable=False)
    login = mapped_column(String)
    avatar_url = mapped_column(String)
    display_name: Mapped[Optional[str]]
    email: Mapped[Optional[str]]
    token = mapped_column(String, nullable=True, default=None)
    token_expiry = mapped_column(DateTime, nullable=True, default=None)
    refresh_token = mapped_column(String, nullable=True, default=None)
    last_used = mapped_column(DateTime, nullable=True, default=None)

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

    id = mapped_column(Integer, primary_key=True)
    state = mapped_column(String, nullable=False)
    created = mapped_column(DateTime, nullable=False)

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

    provider = ConnectedAccountProvider.GOOGLE

    id = mapped_column(Integer, primary_key=True)
    user = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    google_userid = mapped_column(String, nullable=False)
    login = mapped_column(String)
    avatar_url = mapped_column(String)
    display_name: Mapped[Optional[str]]
    email: Mapped[Optional[str]]
    token = mapped_column(String, nullable=True, default=None)
    token_expiry = mapped_column(DateTime, nullable=True, default=None)
    refresh_token = mapped_column(String, nullable=True, default=None)
    last_used = mapped_column(DateTime, nullable=True, default=None)

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


class KdeFlowToken(Base):
    __tablename__ = "kdeflowtoken"

    id = mapped_column(Integer, primary_key=True)
    state = mapped_column(String, nullable=False)
    created = mapped_column(DateTime, nullable=False)

    @staticmethod
    def housekeeping(db, minutes=DEFAULT_HOUSEKEEPING_MINUTES):
        """
        Clear out any tokens which are more than the specified age.

        The login flow will also discard flow tokens younger than this, so over-all
        the flow tokens table should be kept pretty clean.
        """
        too_old = datetime.now() - timedelta(minutes=minutes)
        db.session.execute(delete(KdeFlowToken).where(KdeFlowToken.created < too_old))
        db.session.flush()


class KdeAccount(Base):
    __tablename__ = "kdeaccount"

    provider = ConnectedAccountProvider.KDE

    id = mapped_column(Integer, primary_key=True)
    user = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    kde_userid = mapped_column(Integer, nullable=False)
    login = mapped_column(String)
    avatar_url = mapped_column(String)
    display_name: Mapped[Optional[str]]
    email: Mapped[Optional[str]]
    token = mapped_column(String, nullable=True, default=None)
    token_expiry = mapped_column(DateTime, nullable=True, default=None)
    refresh_token = mapped_column(String, nullable=True, default=None)
    last_used = mapped_column(DateTime, nullable=True, default=None)

    @staticmethod
    def by_user(db, user: FlathubUser):
        return db.session.query(KdeAccount).filter_by(user=user.id).first()

    @staticmethod
    def by_provider_id(db, glid):
        return db.session.query(KdeAccount).filter_by(kde_userid=glid).first()

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user):
        """
        Add a user's information from Kde to the hasher for token generation
        """
        if account := KdeAccount.by_user(db, user):
            hasher.add_string("kde")
            hasher.add_number(account.kde_userid)
            hasher.add_string(account.login)

    @staticmethod
    def delete_user(db, user):
        """
        Delete a user's account and information related to Kde
        """
        db.session.execute(delete(KdeAccount).where(KdeAccount.user == user.id))


FlathubUser.TABLES_FOR_DELETE.append(KdeAccount)


ConnectedAccountTables = [
    GithubAccount,
    GitlabAccount,
    GnomeAccount,
    GoogleAccount,
    KdeAccount,
]
ConnectedAccount = (
    GithubAccount | GitlabAccount | GnomeAccount | GoogleAccount | KdeAccount
)


class AppVerification(Base):
    __tablename__ = "appverification"

    app_id = mapped_column(String, primary_key=True, nullable=False)
    account = mapped_column(
        Integer,
        ForeignKey(FlathubUser.id, ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )

    method = mapped_column(
        Enum(
            "manual",
            "website",
            "login_provider",
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    login_is_organization = mapped_column(Boolean)
    token = mapped_column(String)
    verified = mapped_column(Boolean, nullable=False)
    verified_timestamp = mapped_column(DateTime)

    __table_args__ = (
        # An app can only have one verification
        Index(
            "app_verification_unique",
            "app_id",
            postgresql_where=mapped_column("verified"),
            unique=True,
        ),
    )

    @staticmethod
    def by_app_and_user(
        db, app_id: str, user: FlathubUser
    ) -> Optional["AppVerification"]:
        return (
            db.session.query(AppVerification)
            .filter_by(app_id=app_id, account=user.id)
            .first()
        )

    @staticmethod
    def all_by_app(db, app_id: str) -> list["AppVerification"]:
        return db.session.query(AppVerification).filter_by(app_id=app_id)

    @staticmethod
    def all_by_user(db, user: FlathubUser) -> list["AppVerification"]:
        return db.session.query(AppVerification).filter_by(account=user.id)

    @staticmethod
    def all_verified(db) -> list["AppVerification"]:
        return (
            db.session.query(AppVerification)
            .filter_by(verified=True)
            .order_by(AppVerification.verified_timestamp.desc())
        )

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user: FlathubUser):
        """
        Add a user's verified apps to the hasher for token generation
        """
        apps = [app.app_id for app in AppVerification.all_by_user(db, user)]
        apps.sort()
        for app in apps:
            hasher.add_string(app)

    @staticmethod
    def delete_user(db, user: FlathubUser):
        """
        Delete any app verifications associated with this user
        """
        db.session.execute(
            delete(AppVerification).where(AppVerification.account == user.id)
        )


FlathubUser.TABLES_FOR_DELETE.append(AppVerification)


class DirectUploadApp(Base):
    __tablename__ = "directuploadapp"

    id = mapped_column(Integer, primary_key=True)
    app_id = mapped_column(String, nullable=False, unique=True, index=True)

    @staticmethod
    def by_app_id(db, app_id: str) -> Optional["DirectUploadApp"]:
        return db.session.query(DirectUploadApp).filter_by(app_id=app_id).first()


class DirectUploadAppDeveloper(Base):
    __tablename__ = "directuploadappdeveloper"

    id = mapped_column(Integer, primary_key=True)
    app_id = mapped_column(
        Integer, ForeignKey(DirectUploadApp.id), nullable=False, index=True
    )
    developer_id = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    is_primary = mapped_column(Boolean, nullable=False)

    __table_args__ = (
        Index(
            "direct_upload_app_developer_unique", "app_id", "developer_id", unique=True
        ),
        Index(
            "direct_upload_app_only_one_primary",
            "app_id",
            postgresql_where=mapped_column("is_primary"),
            unique=True,
        ),
    )

    @staticmethod
    def by_id(db, id: int) -> Optional["DirectUploadAppDeveloper"]:
        return db.session.query(DirectUploadAppDeveloper).get(id)

    @staticmethod
    def by_developer(
        db, developer: FlathubUser
    ) -> list[tuple["DirectUploadAppDeveloper", DirectUploadApp]]:
        return (
            db.session.query(DirectUploadAppDeveloper, DirectUploadApp)
            .filter_by(
                developer_id=developer.id,
            )
            .join(DirectUploadApp)
        )

    @staticmethod
    def by_developer_and_app(
        db, developer: FlathubUser, app: DirectUploadApp
    ) -> Optional["DirectUploadAppDeveloper"]:
        return (
            db.session.query(DirectUploadAppDeveloper)
            .filter_by(developer_id=developer.id, app_id=app.id)
            .first()
        )

    @staticmethod
    def by_app(
        db, app: DirectUploadApp
    ) -> list[tuple["DirectUploadAppDeveloper", FlathubUser]]:
        return (
            db.session.query(DirectUploadAppDeveloper, FlathubUser)
            .filter_by(app_id=app.id)
            .join(FlathubUser)
        )

    @staticmethod
    def primary_for_app(
        db, app: DirectUploadApp
    ) -> Optional["DirectUploadAppDeveloper"]:
        return (
            db.session.query(DirectUploadAppDeveloper)
            .filter_by(app_id=app.id, is_primary=True)
            .first()
        )

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user: FlathubUser):
        """
        If you are the primary developer of a backend app, you may not delete your account.
        """
        apps = DirectUploadAppDeveloper.by_developer(db, user).filter(
            DirectUploadAppDeveloper.is_primary
        )
        if apps.count() > 0:
            raise HTTPException(status_code=403, detail="cannot_abandon_app")

    @staticmethod
    def delete_user(db, user: FlathubUser):
        db.session.execute(
            delete(DirectUploadAppDeveloper).where(
                DirectUploadAppDeveloper.developer_id == user.id
            )
        )


FlathubUser.TABLES_FOR_DELETE.append(DirectUploadAppDeveloper)


class DirectUploadAppInvite(Base):
    __tablename__ = "directuploadappinvite"

    id = mapped_column(Integer, primary_key=True)
    app_id = mapped_column(
        Integer, ForeignKey(DirectUploadApp.id), nullable=False, index=True
    )
    developer_id = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )

    @staticmethod
    def by_id(db, id: int) -> Optional["DirectUploadAppInvite"]:
        return db.session.query(DirectUploadAppInvite).get(id)

    @staticmethod
    def by_app(
        db, app: DirectUploadApp
    ) -> list[tuple["DirectUploadAppInvite", FlathubUser]]:
        return (
            db.session.query(DirectUploadAppInvite, FlathubUser)
            .filter_by(app_id=app.id)
            .join(FlathubUser)
        )

    @staticmethod
    def by_developer(
        db, developer: FlathubUser
    ) -> list[tuple["DirectUploadAppInvite", DirectUploadApp]]:
        return (
            db.session.query(DirectUploadAppInvite, DirectUploadApp)
            .filter_by(developer_id=developer.id)
            .join(DirectUploadApp)
        )

    @staticmethod
    def by_developer_and_app(
        db, developer: FlathubUser, app: DirectUploadApp
    ) -> Optional["DirectUploadAppInvite"]:
        return (
            db.session.query(DirectUploadAppInvite)
            .filter_by(developer_id=developer.id, app_id=app.id)
            .first()
        )

    @staticmethod
    def delete_hash(hasher: utils.Hasher, db, user: FlathubUser):
        """Don't include invites in the hash"""
        pass

    @staticmethod
    def delete_user(db, user: FlathubUser):
        db.session.execute(
            delete(DirectUploadAppInvite).where(
                DirectUploadAppInvite.developer_id == user.id
            )
        )


class UploadToken(Base):
    __tablename__ = "uploadtoken"

    id = mapped_column(Integer, primary_key=True)
    comment = mapped_column(String, nullable=False)

    app_id = mapped_column(String, nullable=False)
    scopes = mapped_column(String, nullable=False)
    repos = mapped_column(String, nullable=False)

    issued_at = mapped_column(DateTime, nullable=False)
    issued_to = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=True, index=True
    )
    expires_at = mapped_column(DateTime, nullable=False)
    revoked = mapped_column(Boolean, nullable=False, default=False)

    @staticmethod
    def by_id(db, token_id: int) -> Optional["UploadToken"]:
        return db.session.query(UploadToken).filter_by(id=token_id).first()


# Wallet related content


class Transaction(Base):
    __tablename__ = "transaction"

    id = mapped_column(Integer, primary_key=True)
    user_id = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    value = mapped_column(Integer, nullable=False)
    currency = mapped_column(String, nullable=False)
    kind = mapped_column(String, nullable=False)
    status = mapped_column(String, nullable=False)
    reason = mapped_column(String)
    created = mapped_column(DateTime, nullable=False)
    updated = mapped_column(DateTime, nullable=False)

    @classmethod
    def by_user(cls, db, user: FlathubUser):
        return db.session.query(Transaction).filter(Transaction.user_id == user.id)

    @classmethod
    def by_user_and_id(cls, db, user: FlathubUser, txnid: str) -> "Transaction":
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
        splits: list[tuple[str, int]],
    ) -> "Transaction":
        """
        Create a transaction, and rows, from the given input information
        """
        total = sum(value for (_appid, value) in splits)
        kind = "purchase" if purchase else "donation"
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
        for idx, (appid, value) in enumerate(splits):
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

    def update_app_ownership(self, db):
        """
        Update application ownership based on this transaction.  If the
        transaction status is not "success" then nothing happens.

        This should be called whenever a transaction is considered complete
        so that relevant notations can be made regarding ownership of
        applications etc.

        It is incumbent upon the caller to commit the database transaction
        """
        if self.status != "success":
            return
        row = self.rows(db)[0]
        if row.kind != "purchase":
            # Nothing to do, this wasn't an application purchase
            return
        if UserOwnedApp.user_owns_app(db, self.user_id, row.recipient):
            # Nothing to do, the user already owns the application, so perhaps
            # this is an additional donation
            return
        app = UserOwnedApp(
            app_id=row.recipient, account=self.user_id, created=datetime.now()
        )
        db.session.add(app)
        db.session.flush()


class TransactionRow(Base):
    __tablename__ = "transactionrow"

    id = mapped_column(Integer, primary_key=True)
    txn = mapped_column(Integer, ForeignKey(Transaction.id), nullable=False, index=True)
    idx = mapped_column(Integer, nullable=False)
    amount = mapped_column(Integer, nullable=False)
    currency = mapped_column(String, nullable=False)
    kind = mapped_column(String, nullable=False)
    recipient = mapped_column(String, nullable=False)


# Stripe-specific wallet models


class StripeCustomer(Base):
    __tablename__ = "stripecustomer"

    id = mapped_column(Integer, primary_key=True)
    user_id = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )
    stripe_cust = mapped_column(String, nullable=False, index=True)

    @classmethod
    def by_user(cls, db, user: FlathubUser):
        return (
            db.session.query(StripeCustomer)
            .filter(StripeCustomer.user_id == user.id)
            .first()
        )


class StripeTransaction(Base):
    __tablename__ = "stripetransaction"

    id = mapped_column(Integer, primary_key=True)
    transaction = mapped_column(
        Integer, ForeignKey(Transaction.id), nullable=False, unique=True, index=True
    )
    stripe_pi = mapped_column(String, nullable=False)

    @classmethod
    def by_transaction(cls, db, txn: Transaction):
        return (
            db.session.query(StripeTransaction)
            .filter(StripeTransaction.transaction == txn.id)
            .first()
        )


class StripePendingTransfer(Base):
    __tablename__ = "stripependingtransfer"

    id = mapped_column(Integer, primary_key=True)
    stripe_transaction = mapped_column(
        Integer,
        ForeignKey(StripeTransaction.id),
        nullable=False,
        unique=False,
        index=True,
    )
    recipient = mapped_column(String, nullable=False)
    currency = mapped_column(String, nullable=False)
    amount = mapped_column(Integer, nullable=False)

    @classmethod
    def all_due(cls, db):
        """
        Return all the pending transfers which are actually due.

        Transfers are considered due if the transaction they are linked to is
        complete. (status == success)
        """
        return (
            db.session.query(StripePendingTransfer)
            .join(StripeTransaction)
            .join(Transaction)
            .filter(Transaction.status == "success")
        )


class UserOwnedApp(Base):
    __tablename__ = "userownedapp"

    app_id = mapped_column(String, nullable=False, primary_key=True)
    account = mapped_column(
        Integer,
        ForeignKey(FlathubUser.id, ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )
    created = mapped_column(DateTime, nullable=False)

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

    id = mapped_column(Integer, primary_key=True)
    user = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, unique=True, index=True
    )
    stripe_account = mapped_column(String, nullable=False)

    @classmethod
    def by_user(cls, db, user: FlathubUser) -> Optional["StripeExpressAccount"]:
        return (
            db.session.query(StripeExpressAccount)
            .filter(StripeExpressAccount.user == user.id)
            .first()
        )

    @classmethod
    def by_userid(cls, db, user: int) -> Optional["StripeExpressAccount"]:
        return (
            db.session.query(StripeExpressAccount)
            .filter(StripeExpressAccount.user == user)
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

    id = mapped_column(Integer, primary_key=True)
    appid = mapped_column(String, nullable=False, unique=True, index=True)
    user = mapped_column(
        Integer, ForeignKey(FlathubUser.id), nullable=False, index=True
    )

    appshare = mapped_column(Integer, nullable=False)

    currency = mapped_column(String, nullable=False, default="usd")
    recommended_donation = mapped_column(Integer, nullable=False)
    minimum_payment = mapped_column(Integer, nullable=False)

    # Note, Alembic may or may not detect changes here.  If you make changes,
    # and generate a revision, you may need to adjust the constraint code in the
    # revision yourself.  Take care here.
    __table_args__ = (
        CheckConstraint(
            "appshare >= 10 and appshare <= 100",
            name="vending_appshare_in_range",
        ),
        CheckConstraint("currency = 'usd'", name="currency_must_be_dollars"),
        CheckConstraint(
            "recommended_donation >= minimum_payment",
            name="vending_donation_not_too_small",
        ),
        CheckConstraint(
            "recommended_donation > 100", name="vending_donation_at_least_one_dollar"
        ),
        CheckConstraint("minimum_payment >= 0", name="vending_payment_not_negative"),
        CheckConstraint(
            "recommended_donation <= 99999999",
            name="recommended_donation_less_than_million",
        ),
        CheckConstraint(
            "minimum_payment <= 99999999", name="minimum_payment_less_than_million"
        ),
    )

    @classmethod
    def by_appid(cls, db, app_id: str) -> Optional["ApplicationVendingConfig"]:
        """
        Retrieve vending configuration (if available) for a given appid
        """
        return (
            db.session.query(ApplicationVendingConfig)
            .filter(ApplicationVendingConfig.appid == app_id)
            .first()
        )

    @classmethod
    def all_by_user(cls, db, user: FlathubUser) -> list["ApplicationVendingConfig"]:
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


class RedeemableAppTokenState:
    UNREDEEMED = "unredeemed"
    REDEEMED = "redeemed"
    CANCELLED = "cancelled"


class RedeemableAppToken(Base):
    """
    Application tokens which can be redeemed for ownership of an appid
    """

    __tablename__ = "redeemableapptoken"

    id = mapped_column(Integer, primary_key=True)
    appid = mapped_column(String, nullable=False, unique=False, index=True)
    created = mapped_column(DateTime, nullable=False)
    token = mapped_column(String, nullable=True)
    name = mapped_column(String, nullable=False)
    state = mapped_column(String, nullable=False)
    changed = mapped_column(DateTime, nullable=False)

    @classmethod
    def by_appid(cls, db, app_id: str, all: bool) -> list["RedeemableAppToken"]:
        """
        Retrieve tokens for the given app.

        If all is True, we retrieve all the tokens, otherwise only the tokens
        which have not yet been redeemed.
        """
        query = db.session.query(RedeemableAppToken).filter(
            RedeemableAppToken.appid == app_id
        )
        if not all:
            query = query.filter(RedeemableAppToken.token is not None)
        return list(query)

    @classmethod
    def by_appid_and_token(
        cls, db, app_id: str, token: str
    ) -> Optional["RedeemableAppToken"]:
        """
        Retrieve a specific token instance, or None if not found
        """
        return (
            db.session.query(RedeemableAppToken)
            .filter(RedeemableAppToken.appid == app_id)
            .filter(RedeemableAppToken.token == token)
            .first()
        )

    def redeem(self, db, user: FlathubUser) -> bool:
        """
        Redeem the current token.  If this returns False then the user
        already owns the app, so the token was not redeemed.
        """

        if self.state != RedeemableAppTokenState.UNREDEEMED:
            raise ValueError("Token is not available for redemption")

        if UserOwnedApp.user_owns_app(db, user.id, self.appid):
            return False

        app = UserOwnedApp(app_id=self.appid, account=user.id, created=datetime.now())
        db.session.add(app)

        self.token = None
        self.state = RedeemableAppTokenState.REDEEMED
        self.changed = datetime.now()
        db.session.add(self)

        db.session.flush()

        return True

    def cancel(self, db):
        """
        Cancel the current token
        """

        if self.state != RedeemableAppTokenState.UNREDEEMED:
            raise ValueError("Token is not available for cancelling")
        self.token = None
        self.state = RedeemableAppTokenState.CANCELLED
        self.changed = datetime.now()
        db.session.add(self)
        db.session.flush()

    @classmethod
    def create(self, db, app_id: str, name: str) -> "RedeemableAppToken":
        """
        Create a new redeemable app token
        """

        now = datetime.now()
        token = str(uuid4())
        while self.by_appid_and_token(db, app_id, token) is not None:
            token = str(uuid4())
        token = RedeemableAppToken(
            appid=app_id,
            created=now,
            changed=now,
            state=RedeemableAppTokenState.UNREDEEMED,
            token=token,
            name=name,
        )
        db.session.add(token)
        db.session.flush()

        return token


class ModerationRequest(Base):
    """A job from flat-manager that needs to be reviewed by a moderator"""

    __tablename__ = "moderationrequest"

    id = mapped_column(Integer, primary_key=True)
    appid = mapped_column(String, nullable=False, index=True)
    created_at = mapped_column(DateTime, nullable=False, server_default=func.now())

    build_id = mapped_column(Integer, nullable=False)
    job_id = mapped_column(Integer, nullable=False, index=True)
    is_outdated = mapped_column(Boolean, nullable=False, default=False)

    request_type = mapped_column(String, nullable=False)
    request_data = mapped_column(String)
    is_new_submission = mapped_column(Boolean, nullable=False, default=False)

    handled_by = mapped_column(Integer, ForeignKey(FlathubUser.id), index=True)
    handled_at = mapped_column(DateTime)
    is_approved = mapped_column(Boolean)
    comment = mapped_column(String)


class GuidelineCategory(Base):
    """A category of quality guidelines for an app"""

    __tablename__ = "guideline_category"

    id = mapped_column(String, primary_key=True)
    order = mapped_column(Integer, nullable=False)


class Guideline(Base):
    """A quality guideline for an app"""

    __tablename__ = "guideline"

    id = mapped_column(String, primary_key=True)
    url = mapped_column(String, nullable=False)
    needed_to_pass_since = mapped_column(Date, nullable=False)
    read_only = mapped_column(Boolean, nullable=False, default=False)
    show_on_fullscreen_app = mapped_column(Boolean, nullable=False, default=False)
    order = mapped_column(Integer, nullable=False)

    guideline_category_id = mapped_column(
        String, ForeignKey("guideline_category.id"), nullable=False, index=True
    )

    guideline_category = relationship(GuidelineCategory)


class QualityModerationDashboardRow(BaseModel):
    id: str
    quality_moderation_status: QualityModerationStatus
    appstream: Any | None = None
    installs_last_7_days: int | None = None


class QualityModeration(Base):
    """A moderated quality guideline for an app"""

    __tablename__ = "qualitymoderation"

    id = mapped_column(Integer, primary_key=True)
    guideline_id = mapped_column(ForeignKey(Guideline.id), nullable=False, index=True)
    guideline = relationship(Guideline)
    # todo add a foreign key later
    app_id = mapped_column(String, nullable=False, index=True)
    updated_at = mapped_column(DateTime, nullable=False, server_default=func.now())
    updated_by = mapped_column(Integer, ForeignKey(FlathubUser.id), nullable=True)
    passed = mapped_column(Boolean, nullable=False)
    comment = mapped_column(String)

    __table_args__ = (
        Index("qualitymoderation_unique", app_id, guideline_id, unique=True),
    )

    @classmethod
    def group_by_guideline(cls, db) -> list[dict[str, Any]]:
        """
        Return a list of guideline ids and the number of apps which have failed that guideline
        """

        return [
            {
                "guideline_id": row.guideline_id,
                "not_passed": row.not_passed,
            }
            for row in db.session.query(
                QualityModeration.guideline_id,
                func.sum(func.cast(~QualityModeration.passed, Integer)).label(
                    "not_passed"
                ),
            )
            .group_by(QualityModeration.guideline_id)
            .order_by(func.sum(func.cast(~QualityModeration.passed, Integer)).desc())
            .all()
        ]

    @classmethod
    def upsert(
        cls,
        db,
        app_id: str,
        guideline_id: str,
        passed: bool,
        updated_by: int | None,
    ):
        """
        Insert or update a quality moderation
        """
        quality = (
            db.session.query(QualityModeration)
            .filter(QualityModeration.app_id == app_id)
            .filter(QualityModeration.guideline_id == guideline_id)
            .first()
        )

        if quality:
            if quality.passed == passed:
                return
            quality.passed = passed
            quality.updated_by = updated_by
            quality.updated_at = datetime.now()
        else:
            quality = QualityModeration(
                app_id=app_id,
                guideline_id=guideline_id,
                updated_by=updated_by,
                passed=passed,
                comment=None,
            )
            db.session.add(quality)

        db.session.commit()

    @classmethod
    def by_appid(cls, db, app_id: str) -> list["Any"]:
        return (
            db.session.query(Guideline, QualityModeration, Apps)
            .join(
                QualityModeration,
                and_(
                    Guideline.id == QualityModeration.guideline_id,
                    QualityModeration.app_id == app_id,
                ),
                isouter=True,
            )
            .join(
                Apps,
                and_(
                    Apps.app_id == app_id,
                    or_(
                        Apps.is_fullscreen_app == False,  # noqa: E712
                        Apps.is_fullscreen_app == Guideline.show_on_fullscreen_app,
                    ),
                ),
            )
            .order_by(Guideline.order)
            .filter(Guideline.needed_to_pass_since <= datetime.now().date())
            .all()
        )

    @classmethod
    def by_appid_summarized(cls, db, app_id: str) -> QualityModerationStatus:
        """
        Return a summary of the quality moderation status for an app
        """
        status = (
            db.session.query(Guideline)
            .join(
                QualityModeration,
                and_(
                    Guideline.id == QualityModeration.guideline_id,
                    QualityModeration.app_id == app_id,
                ),
                isouter=True,
            )
            .join(
                Apps,
                and_(
                    Apps.app_id == app_id,
                    or_(
                        Apps.is_fullscreen_app == False,  # noqa: E712
                        Apps.is_fullscreen_app == Guideline.show_on_fullscreen_app,
                    ),
                ),
            )
            .filter(Guideline.needed_to_pass_since <= datetime.now().date())
            .with_entities(
                func.count(Guideline.id),
                func.sum(func.cast(QualityModeration.passed, Integer)),
                func.sum(func.cast(~QualityModeration.passed, Integer)),
                func.max(QualityModeration.updated_at),
            )
            .first()
        )

        app_quality_request = QualityModerationRequest.by_appid(db, app_id)

        if (
            status[0] is None
            or status[1] is None
            or status[2] is None
            or status[3] is None
        ):
            return QualityModerationStatus(
                passes=False,
                unrated=0,
                passed=0,
                not_passed=0,
                last_updated=datetime.now(),
                review_requested_at=None,
            )

        return QualityModerationStatus(
            passes=status[0] == status[1],
            unrated=status[0] - status[1] - status[2],
            passed=status[1],
            not_passed=status[2],
            last_updated=status[3],
            review_requested_at=app_quality_request.created_at
            if app_quality_request
            else None,
        )


class QualityModerationRequest(Base):
    """A request to review an app's quality guidelines, probably after changes"""

    __tablename__ = "qualitymoderationrequest"

    id = mapped_column(Integer, primary_key=True)
    app_id = mapped_column(String, nullable=False, index=True, unique=True)
    created_at = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_by = mapped_column(Integer, ForeignKey(FlathubUser.id), nullable=True)

    @classmethod
    def by_appid(cls, db, app_id: str) -> Optional["QualityModerationRequest"]:
        return (
            db.session.query(QualityModerationRequest)
            .filter(QualityModerationRequest.app_id == app_id)
            .first()
        )

    @classmethod
    def create(cls, db, app_id: str, user_id: int) -> "QualityModerationRequest":
        request = QualityModerationRequest(
            app_id=app_id,
            created_by=user_id,
        )
        db.session.add(request)
        db.session.commit()
        return request

    @classmethod
    def delete(cls, db, app_id: str) -> None:
        db.session.execute(
            delete(QualityModerationRequest).where(
                QualityModerationRequest.app_id == app_id
            )
        )
        db.session.commit()


class AppOfTheDay(Base):
    """A curated app of the day"""

    __tablename__ = "appoftheday"

    id = mapped_column(Integer, primary_key=True)
    app_id = mapped_column(String, nullable=False, index=True)
    date = mapped_column(Date, nullable=False, index=True, unique=True)
    created_at = mapped_column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (Index("appoftheday_unique", app_id, date, unique=True),)

    @classmethod
    def by_date(cls, db, date: Date) -> Optional["AppOfTheDay"]:
        return db.session.query(AppOfTheDay).filter(AppOfTheDay.date == date).first()

    @classmethod
    def set_app_of_the_day(cls, db, app_id: str, date: Date) -> Optional["AppOfTheDay"]:
        app = AppOfTheDay.by_date(db, date)
        if app:
            app.app_id = app_id
        else:
            app = AppOfTheDay(
                app_id=app_id,
                date=date,
            )
            db.session.add(app)

        db.session.commit()
        return app

    @classmethod
    def by_appid_last_time_app_of_the_day(cls, db, app_id: str) -> Date:
        latest_date = (
            db.session.query(AppOfTheDay)
            .filter(AppOfTheDay.app_id == app_id)
            .order_by(AppOfTheDay.date.desc())
            .first()
        )

        if latest_date:
            return latest_date.date

        return datetime.min.date()


class AppsOfTheWeek(Base):
    """Curated apps of the week usually five"""

    __tablename__ = "appsoftheweek"

    id = mapped_column(Integer, primary_key=True)
    app_id = mapped_column(String, nullable=False, index=True)
    weekNumber = mapped_column(Integer, nullable=False, index=True)
    year = mapped_column(Integer, nullable=False, index=True)
    created_at = mapped_column(DateTime, nullable=False, server_default=func.now())
    created_by = mapped_column(Integer, ForeignKey(FlathubUser.id), nullable=False)
    position = mapped_column(Integer, nullable=False)

    __table_args__ = (
        Index("appsoftheweek_unique", app_id, weekNumber, year, unique=True),
    )

    @classmethod
    def by_week(cls, db, weekNumber: int, year: int) -> list["AppsOfTheWeek"]:
        return (
            db.session.query(AppsOfTheWeek)
            .filter(AppsOfTheWeek.weekNumber == weekNumber)
            .filter(AppsOfTheWeek.year == year)
            .order_by(AppsOfTheWeek.position)
            .all()
        )

    @classmethod
    def upsert(
        cls,
        db,
        app_id: str,
        weekNumber: int,
        year: int,
        position: int,
        user_id: int,
    ) -> Optional["AppsOfTheWeek"]:
        app = (
            db.session.query(AppsOfTheWeek)
            .filter(AppsOfTheWeek.position == position)
            .filter(AppsOfTheWeek.weekNumber == weekNumber)
            .filter(AppsOfTheWeek.year == year)
            .first()
        )
        if app:
            app.app_id = app_id
            app.created_by = user_id
            db.session.commit()
            return app
        else:
            app = AppsOfTheWeek(
                app_id=app_id,
                weekNumber=weekNumber,
                year=year,
                created_by=user_id,
                position=position,
            )
            db.session.add(app)
            db.session.commit()
            return app


class Pagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class QualityModerationDashboardResponse(BaseModel):
    apps: list[QualityModerationDashboardRow]
    pagination: Pagination


class Apps(Base):
    """An app"""

    __tablename__ = "apps"

    id = mapped_column(Integer, primary_key=True)
    app_id = mapped_column(String, nullable=False, index=True, unique=True)
    type = mapped_column(
        Enum(
            "desktop",
            "localization",
            "console-application",
            "generic",
            "runtime",
            "addon",
            name="app_type",
        ),
        nullable=False,
    )
    installs_last_7_days = mapped_column(Integer, nullable=False, default=0)
    is_fullscreen_app = mapped_column(Boolean, nullable=False, default=False)
    created_at = mapped_column(DateTime, nullable=False, server_default=func.now())

    __table_args__ = (Index("apps_unique", app_id, unique=True),)

    @classmethod
    def by_appid(cls, db, app_id: str) -> Optional["Apps"]:
        return db.session.query(Apps).filter(Apps.app_id == app_id).first()

    @classmethod
    def set_app(cls, db, app_id: str, type) -> Optional["Apps"]:
        app = Apps.by_appid(db, app_id)

        if app:
            if app.type == type:
                return app
            app.type = type
            db.session.commit()
            return app
        else:
            app = Apps(
                app_id=app_id,
                type=type,
            )
            db.session.add(app)
            db.session.commit()
            return app

    @classmethod
    def delete_app(cls, db, app_id: str) -> None:
        db.session.execute(delete(Apps).where(Apps.app_id == app_id))
        db.session.commit()

    @classmethod
    def set_downloads(cls, db, app_id: str, downloads: int) -> None:
        app = Apps.by_appid(db, app_id)
        if app and app.installs_last_7_days != downloads:
            app.installs_last_7_days = downloads
            db.session.commit()

    @classmethod
    def get_fullscreen_app(cls, db, app_id: str) -> bool:
        app = Apps.by_appid(db, app_id)
        if app:
            return app.is_fullscreen_app
        return False

    @classmethod
    def set_fullscreen_app(cls, db, app_id: str, is_fullscreen_app: bool) -> None:
        app = Apps.by_appid(db, app_id)
        if app and app.is_fullscreen_app != is_fullscreen_app:
            db.session.execute(
                delete(QualityModeration).where(
                    and_(
                        QualityModeration.app_id == app_id,
                        QualityModeration.guideline_id.startswith("screenshots-"),
                    )
                )
            )
            db.session.commit()

            app.is_fullscreen_app = is_fullscreen_app
            db.session.commit()

    @classmethod
    def status_summarized(
        cls, db, page, page_size, filter
    ) -> QualityModerationDashboardResponse:
        """
        Return a summary of the quality moderation status for all apps
        """
        query = (
            db.session.query(
                Apps.app_id,
                func.coalesce(
                    func.count(Guideline.id)
                    == func.sum(func.cast(QualityModeration.passed, Integer)),
                    False,
                ),
                func.coalesce(
                    func.count(Guideline.id)
                    - func.sum(func.cast(QualityModeration.passed, Integer))
                    - func.sum(func.cast(~QualityModeration.passed, Integer)),
                    0,
                ),
                func.coalesce(
                    func.sum(func.cast(QualityModeration.passed, Integer)), 0
                ),
                func.coalesce(
                    func.sum(func.cast(~QualityModeration.passed, Integer)), 0
                ),
                func.coalesce(func.max(QualityModeration.updated_at), datetime.min),
                func.max(QualityModerationRequest.created_at),
                Apps.installs_last_7_days,
            )
            .join(
                Guideline,
                and_(
                    Guideline.needed_to_pass_since <= datetime.now().date(),
                    or_(
                        Apps.is_fullscreen_app == False,  # noqa: E712
                        Apps.is_fullscreen_app == Guideline.show_on_fullscreen_app,
                    ),
                ),
            )
            .join(
                QualityModeration,
                and_(
                    QualityModeration.guideline_id == Guideline.id,
                    QualityModeration.app_id == Apps.app_id,
                ),
                isouter=True,
            )
            .join(
                QualityModerationRequest,
                QualityModerationRequest.app_id == Apps.app_id,
                isouter=True,
            )
            .where(
                or_(
                    Apps.type == "desktop",
                    Apps.type == "console-application",
                )
            )
            .having(func.max(QualityModeration.updated_at).isnot(None))
            .group_by(Apps.app_id, Apps.installs_last_7_days)
            # sort by review_requested, passed, then by weekly downloads
            .order_by(
                func.max(QualityModerationRequest.created_at).desc().nulls_last(),
                func.sum(func.cast(QualityModeration.passed, Integer)).desc(),
                Apps.installs_last_7_days.desc(),
            )
        )

        if filter == "passing":
            query = query.having(
                func.count(Guideline.id)
                == func.sum(func.cast(QualityModeration.passed, Integer))
            )
        elif filter == "todo":
            query = query.having(
                or_(
                    func.max(QualityModerationRequest.created_at).isnot(None),
                    and_(
                        func.sum(func.cast(~QualityModeration.passed, Integer)) == 0,
                        func.count(Guideline.id)
                        > func.sum(func.cast(QualityModeration.passed, Integer)),
                    ),
                )
            )

        query_count = query.count()

        query = query.slice((page - 1) * page_size, (page) * page_size)

        return QualityModerationDashboardResponse(
            apps=[
                QualityModerationDashboardRow(
                    id=app_id,
                    quality_moderation_status=QualityModerationStatus(
                        passes=passes,
                        unrated=unrated,
                        passed=passed,
                        not_passed=not_passed,
                        last_updated=last_updated,
                        review_requested_at=review_requested_at,
                    ),
                    installs_last_7_days=installs_last_7_days,
                )
                for (
                    app_id,
                    passes,
                    unrated,
                    passed,
                    not_passed,
                    last_updated,
                    review_requested_at,
                    installs_last_7_days,
                ) in query.all()
            ],
            pagination=Pagination(
                page=page,
                page_size=page_size,
                total=query_count,
                total_pages=ceil(query_count / page_size),
            ),
        )
