import dramatiq

from .. import logins
from .core import WorkerDB


@dramatiq.actor
def refresh_github_repo_list(gh_access_token: str, accountId: int):
    with WorkerDB() as sqldb:
        if not gh_access_token:
            return

        logins.refresh_repo_list(gh_access_token, accountId)
        sqldb.session.commit()
