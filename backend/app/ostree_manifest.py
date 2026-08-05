import json
import logging
import tempfile
from collections.abc import Sequence, Set
from dataclasses import dataclass
from enum import StrEnum
from threading import Timer
from typing import Any

import gi

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import Gio, GLib, OSTree  # type: ignore

from . import summary

logger = logging.getLogger(__name__)


class PublishedManifestStatus(StrEnum):
    PRESENT = "present"
    REF_MISSING = "ref_missing"
    MANIFEST_MISSING = "manifest_missing"
    MANIFEST_INVALID = "manifest_invalid"


@dataclass(frozen=True)
class CandidateManifestRef:
    app_id: str
    ref_name: str
    arch: str
    branch: str
    candidate_commit: str


@dataclass
class ManifestPair:
    app_id: str
    ref_name: str
    arch: str
    branch: str
    candidate_commit: str
    published_commit: str | None
    candidate_manifest: dict[str, Any]
    published_manifest: dict[str, Any] | None
    published_status: PublishedManifestStatus

    @property
    def changed(self) -> bool | None:
        return (
            None
            if self.published_manifest is None
            else self.candidate_manifest != self.published_manifest
        )


class InvalidBuildRefError(ValueError):
    pass


class ManifestRetrievalError(Exception):
    def __init__(self, category: str):
        super().__init__(category)
        self.category = category


class ManifestTransportError(ManifestRetrievalError):
    pass


class ManifestTimeoutError(ManifestRetrievalError):
    pass


class CandidateCommitMismatchError(ManifestRetrievalError):
    def __init__(self, category: str, ref_name: str, expected_commit: str):
        super().__init__(category)
        self.ref_name = ref_name
        self.expected_commit = expected_commit


class CommitResolutionError(ManifestRetrievalError):
    def __init__(
        self,
        category: str,
        remote_name: str,
        ref_name: str,
        expected_commit: str,
    ):
        super().__init__(category)
        self.remote_name = remote_name
        self.ref_name = ref_name
        self.expected_commit = expected_commit


class CandidateManifestError(ManifestRetrievalError):
    def __init__(self, category: str, ref_name: str, commit: str):
        super().__init__(category)
        self.ref_name = ref_name
        self.commit = commit


class _ManifestDataError(ManifestRetrievalError):
    def __init__(self, category: str, commit: str):
        super().__init__(category)
        self.commit = commit


def normalize_candidate_refs(build_refs: object) -> tuple[CandidateManifestRef, ...]:
    if not isinstance(build_refs, list):
        raise InvalidBuildRefError("build_refs must be a list")

    normalized: list[CandidateManifestRef] = []
    commits_by_ref: dict[str, str] = {}
    for build_ref in build_refs:
        if not isinstance(build_ref, dict):
            continue

        ref_name = build_ref.get("ref_name")
        if not isinstance(ref_name, str):
            continue
        validated = summary.validate_ref(ref_name)
        if not validated:
            continue
        kind, app_id, arch, branch = validated
        if kind != "app":
            continue

        commit = build_ref.get("commit")
        if not isinstance(commit, str) or not commit:
            raise InvalidBuildRefError(f"invalid commit for {ref_name}")
        try:
            valid_commit = OSTree.validate_checksum_string(commit)
        except GLib.Error as exc:
            raise InvalidBuildRefError(f"invalid commit for {ref_name}") from exc
        if not valid_commit:
            raise InvalidBuildRefError(f"invalid commit for {ref_name}")

        previous_commit = commits_by_ref.get(ref_name)
        if previous_commit is not None:
            if previous_commit != commit:
                raise InvalidBuildRefError(f"conflicting commits for {ref_name}")
            continue
        commits_by_ref[ref_name] = commit
        normalized.append(
            CandidateManifestRef(
                app_id=app_id,
                ref_name=ref_name,
                arch=arch,
                branch=branch,
                candidate_commit=commit,
            )
        )

    return tuple(normalized)


def _list_remote_refs(
    repo: OSTree.Repo, remote_name: str, cancellable: Gio.Cancellable
) -> dict[str, str]:
    _, refs = repo.remote_list_refs(remote_name, cancellable)
    return refs


def _pull_manifest_paths(
    repo: OSTree.Repo,
    remote_name: str,
    ref_names: Sequence[str],
    commits: Sequence[str],
    cancellable: Gio.Cancellable,
) -> None:
    if not ref_names:
        return

    options = GLib.Variant(
        "a{sv}",
        {
            "refs": GLib.Variant("as", list(ref_names)),
            "override-commit-ids": GLib.Variant("as", list(commits)),
            "flags": GLib.Variant("i", int(OSTree.RepoPullFlags.NONE)),
            "subdirs": GLib.Variant("as", ["/files/manifest.json"]),
            "depth": GLib.Variant("i", 0),
            "disable-static-deltas": GLib.Variant("b", True),
            "n-network-retries": GLib.Variant("u", 1),
        },
    )
    repo.pull_with_options(remote_name, options, None, cancellable)


def _assert_local_refs_match(
    repo: OSTree.Repo,
    remote_name: str,
    ref_commits: Sequence[tuple[str, str]],
) -> None:
    for ref_name, expected_commit in ref_commits:
        resolved, commit = repo.resolve_rev(f"{remote_name}:{ref_name}", False)
        if not resolved or commit != expected_commit:
            raise CommitResolutionError(
                "checksum_mismatch", remote_name, ref_name, expected_commit
            )


def _read_manifest(
    repo: OSTree.Repo, commit: str, cancellable: Gio.Cancellable
) -> dict[str, Any] | None:
    _, root, resolved_commit = repo.read_commit(commit, cancellable)
    if resolved_commit != commit:
        raise CommitResolutionError("checksum_mismatch", "", "", commit)

    manifest_file = root.get_child("files").get_child("manifest.json")
    try:
        _, contents, _ = manifest_file.load_contents(cancellable)
    except GLib.Error as exc:
        if exc.matches(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND):
            return None
        raise

    try:
        manifest = json.loads(contents.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise _ManifestDataError("invalid_utf8", commit) from exc
    except json.JSONDecodeError as exc:
        raise _ManifestDataError("malformed_json", commit) from exc
    if not isinstance(manifest, dict):
        raise _ManifestDataError("unexpected_json_type", commit)
    return manifest


def collect_manifest_pairs(
    candidate_repo_url: str,
    published_repo_url: str,
    refs: Sequence[CandidateManifestRef],
    *,
    timeout_seconds: float,
    skip_missing_candidate_app_ids: Set[str] = frozenset(),
) -> tuple[ManifestPair, ...]:
    if not refs:
        return ()

    with tempfile.TemporaryDirectory(prefix="ostree-manifest-") as temp_dir:
        cancellable = Gio.Cancellable()
        timer = Timer(timeout_seconds, cancellable.cancel)
        timer.daemon = True
        timer.start()
        try:
            repo = OSTree.Repo.new(Gio.File.new_for_path(temp_dir))
            repo.create(OSTree.RepoMode.BARE_USER_ONLY, cancellable)
            remote_options = GLib.Variant(
                "a{sv}",
                {
                    "gpg-verify": GLib.Variant("b", False),
                    "gpg-verify-summary": GLib.Variant("b", False),
                },
            )
            repo.remote_add(
                "candidate", candidate_repo_url, remote_options, cancellable
            )
            repo.remote_add(
                "published", published_repo_url, remote_options, cancellable
            )

            candidate_remote_refs = _list_remote_refs(repo, "candidate", cancellable)
            for item in refs:
                if candidate_remote_refs.get(item.ref_name) != item.candidate_commit:
                    raise CandidateCommitMismatchError(
                        "checksum_mismatch", item.ref_name, item.candidate_commit
                    )

            published_remote_refs = _list_remote_refs(repo, "published", cancellable)
            published_commits = {
                item.ref_name: published_remote_refs[item.ref_name]
                for item in refs
                if item.ref_name in published_remote_refs
            }

            candidate_ref_commits = [
                (item.ref_name, item.candidate_commit) for item in refs
            ]
            published_ref_commits = list(published_commits.items())
            _pull_manifest_paths(
                repo,
                "candidate",
                [ref_name for ref_name, _ in candidate_ref_commits],
                [commit for _, commit in candidate_ref_commits],
                cancellable,
            )
            _pull_manifest_paths(
                repo,
                "published",
                [ref_name for ref_name, _ in published_ref_commits],
                [commit for _, commit in published_ref_commits],
                cancellable,
            )
            _assert_local_refs_match(repo, "candidate", candidate_ref_commits)
            _assert_local_refs_match(repo, "published", published_ref_commits)

            candidate_cache: dict[str, dict[str, Any] | None] = {}
            published_cache: dict[str, dict[str, Any] | None | _ManifestDataError] = {}
            pairs: list[ManifestPair] = []
            for item in refs:
                if item.candidate_commit not in candidate_cache:
                    try:
                        candidate_cache[item.candidate_commit] = _read_manifest(
                            repo, item.candidate_commit, cancellable
                        )
                    except _ManifestDataError as exc:
                        raise CandidateManifestError(
                            exc.category, item.ref_name, item.candidate_commit
                        ) from exc
                candidate_manifest = candidate_cache[item.candidate_commit]
                if candidate_manifest is None:
                    if item.app_id in skip_missing_candidate_app_ids:
                        logger.warning(
                            "Candidate OSTree manifest is missing for direct-upload app",
                            extra={
                                "app_id": item.app_id,
                                "ref_name": item.ref_name,
                                "arch": item.arch,
                                "candidate_commit": item.candidate_commit,
                                "category": "missing_candidate_manifest",
                            },
                        )
                        continue
                    raise CandidateManifestError(
                        "missing_candidate_manifest",
                        item.ref_name,
                        item.candidate_commit,
                    )

                published_commit = published_commits.get(item.ref_name)
                if published_commit is None:
                    pairs.append(
                        ManifestPair(
                            app_id=item.app_id,
                            ref_name=item.ref_name,
                            arch=item.arch,
                            branch=item.branch,
                            candidate_commit=item.candidate_commit,
                            published_commit=None,
                            candidate_manifest=candidate_manifest,
                            published_manifest=None,
                            published_status=PublishedManifestStatus.REF_MISSING,
                        )
                    )
                    continue

                if published_commit not in published_cache:
                    try:
                        published_cache[published_commit] = _read_manifest(
                            repo, published_commit, cancellable
                        )
                    except _ManifestDataError as exc:
                        published_cache[published_commit] = exc
                published_result = published_cache[published_commit]

                if isinstance(published_result, _ManifestDataError):
                    published_manifest = None
                    published_status = PublishedManifestStatus.MANIFEST_INVALID
                    warning_category = published_result.category
                elif published_result is None:
                    published_manifest = None
                    published_status = PublishedManifestStatus.MANIFEST_MISSING
                    warning_category = "missing_manifest"
                else:
                    published_manifest = published_result
                    published_status = PublishedManifestStatus.PRESENT
                    warning_category = None

                if warning_category is not None:
                    logger.warning(
                        "Published OSTree manifest is unavailable",
                        extra={
                            "app_id": item.app_id,
                            "ref_name": item.ref_name,
                            "arch": item.arch,
                            "published_commit": published_commit,
                            "published_status": published_status.value,
                            "category": warning_category,
                        },
                    )
                pairs.append(
                    ManifestPair(
                        app_id=item.app_id,
                        ref_name=item.ref_name,
                        arch=item.arch,
                        branch=item.branch,
                        candidate_commit=item.candidate_commit,
                        published_commit=published_commit,
                        candidate_manifest=candidate_manifest,
                        published_manifest=published_manifest,
                        published_status=published_status,
                    )
                )
            return tuple(pairs)
        except GLib.Error as exc:
            if cancellable.is_cancelled():
                raise ManifestTimeoutError("timeout") from exc
            raise ManifestTransportError("ostree_io") from exc
        finally:
            timer.cancel()


def group_identical_manifest_pairs(
    pairs: Sequence[ManifestPair],
) -> tuple[tuple[ManifestPair, ...], ...]:
    groups: dict[tuple[str, str, str, str, str], list[ManifestPair]] = {}
    for pair in pairs:
        candidate_json = json.dumps(
            pair.candidate_manifest,
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )
        published_json = json.dumps(
            pair.published_manifest,
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )
        key = (
            pair.app_id,
            pair.branch,
            pair.published_status.value,
            candidate_json,
            published_json,
        )
        groups.setdefault(key, []).append(pair)
    return tuple(tuple(group) for group in groups.values())
