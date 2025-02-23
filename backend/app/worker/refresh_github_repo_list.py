import dramatiq
from github import Github

from .. import models
from ..database import get_db


@dramatiq.actor
def refresh_github_repo_list(gh_access_token: str, accountId: int):
    gh = Github(gh_access_token)
    ghuser = gh.get_user()
    user_repos = [
        repo.full_name.removeprefix("flathub/")
        for repo in ghuser.get_repos(affiliation="collaborator")
        if repo.full_name.startswith("flathub/")
        and repo.permissions.push
        and not repo.archived
    ]

    gh_teams = [
        team for team in ghuser.get_teams() if team.organization.login == "flathub"
    ]
    gh_team_repos = [
        repo.full_name.removeprefix("flathub/")
        for team in gh_teams
        for repo in team.get_repos()
        if repo.permissions.push and not repo.archived
    ]

    repos = list(set(user_repos + gh_team_repos))
    with get_db("writer") as db:
        models.GithubRepository.unify_repolist(db, accountId, repos)
