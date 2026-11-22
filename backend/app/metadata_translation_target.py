"""Locate the recipe and published ref belonging to a catalog component."""

import re
from dataclasses import asdict, dataclass, replace

from github import GithubException

from .metadata_translations import MetadataError
from .models import AppExtensionLookup


@dataclass(frozen=True)
class RecipeTarget:
    repository: str
    branch: str = "master"
    kind: str = "app"
    flatpak_branch: str = "stable"

    @classmethod
    def for_app(cls, db, app_id, app_type, appstream):
        if app_type != "addon":
            return cls(app_id)
        bundle = (appstream or {}).get("bundle") or {}
        value = bundle.get("value") if isinstance(bundle, dict) else None
        parts = value.split("/") if isinstance(value, str) else []
        if (
            len(parts) != 4
            or parts[0] not in ("runtime", "app")
            or parts[1] != app_id
            or not re.fullmatch(r"[\w-][\w.-]*", parts[3])
        ):
            raise MetadataError("unsupported_metadata")
        parent = AppExtensionLookup.get_parent(db, app_id)
        repository = parent or app_id
        if parent and not app_id.startswith(parent + "."):
            raise MetadataError("unsupported_metadata")
        branch = parts[3]
        return cls(
            repository,
            "master" if branch == "stable" else f"branch/{branch}",
            parts[0],
            branch,
        )

    def open(self, github, *, discover=False):
        repo = github.get_repo(f"flathub/{self.repository}")
        target = self
        revision = None
        if discover and self.branch != "master":
            try:
                revision = repo.get_branch(self.branch).commit.sha
            except GithubException as error:
                if error.status != 404:
                    raise
                target = replace(self, branch="master")
        return RecipeRepository(repo, target, revision)

    @classmethod
    def saved(cls, app_id, values):
        return cls(**values) if values else cls(app_id)

    def storage(self, app_id):
        return None if self == RecipeTarget(app_id) else asdict(self)

    def matches_saved(self, app_id, values):
        # Older batches only ever targeted the component's own master branch.
        if values is None:
            return (self.repository, self.branch) == (app_id, "master")
        return self == self.saved(app_id, values)


@dataclass
class RecipeRepository:
    repository: object
    target: RecipeTarget
    revision: str | None = None

    def __getattr__(self, name):
        return getattr(self.repository, name)


def target_of(repo, app_id):
    return repo.target if isinstance(repo, RecipeRepository) else RecipeTarget(app_id)
