from typing import List

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class FlathubUser(Base):
    __tablename__ = "flathubuser"

    id = Column(Integer, primary_key=True)
    display_name = Column(String)


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
    def by_gh_id(db, ghid):
        return db.session.query(GithubAccount).filter_by(github_userid=ghid).first()


class GithubFlowToken(Base):
    __tablename__ = "githubflowtoken"

    id = Column(Integer, primary_key=True)
    state = Column(String, nullable=False)
    created = Column(DateTime, nullable=False)


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
