from datetime import datetime, timedelta
from typing import List

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, delete
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
        account = GithubAccount.by_user(db, user)
        hasher.add_number(account.github_userid)
        hasher.add_string(account.login)
        repos = [repo.reponame for repo in GithubRepository.all_by_account(db, account)]
        repos.sort()
        for repo in repos:
            hasher.add_string(repo)

    @staticmethod
    def delete_user(db, user):
        """
        Delete a user's account and information related to Github
        """
        gha = GithubAccount.by_user(db, user)
        db.session.execute(
            delete(GithubRepository).where(GithubRepository.github_account == gha.id)
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
