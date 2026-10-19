import logging

import dramatiq
from github import Github

from .. import config

logger = logging.getLogger(__name__)


@dramatiq.actor(max_retries=3)
def comment_on_pull_request(repository: str, number: int, body: str, marker: str):
    gh_token = config.settings.github_bot_token
    if not gh_token:
        logger.warning("No GitHub token, not commenting on %s#%s", repository, number)
        return
    issue = Github(gh_token).get_repo(repository).get_issue(number)
    if any(marker in comment.body for comment in issue.get_comments()):
        return
    issue.create_comment(f"{body}\n\n{marker}")
