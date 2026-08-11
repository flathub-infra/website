import json
import logging
import tempfile
from collections.abc import Sequence
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from enum import StrEnum
from threading import Timer
from typing import Any, cast

import gi

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import Gio, GLib, OSTree  # type: ignore

from . import summary, url_origin

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


@dataclass(frozen=True)
class ManifestSourceIssue:
    location: str
    reason: str


@dataclass
class _ManifestSourceInventory:
    locations_by_source: dict[str, tuple[str, ...]]
    structural_issues: tuple[ManifestSourceIssue, ...]


@dataclass(frozen=True)
class ManifestSourceFinding:
    app_id: str
    sources_added: tuple[str, ...]
    sources_removed: tuple[str, ...]
    locations_by_source: dict[str, tuple[str, ...]]
    arches: tuple[str, ...]


def _collect_manifest_source_inventory(
    manifest: dict[str, Any],
) -> _ManifestSourceInventory:
    source_locations: dict[str, set[str]] = {}
    structural_issues: set[ManifestSourceIssue] = set()

    def add_structural_issue(location: str, reason: str) -> None:
        structural_issues.add(ManifestSourceIssue(location=location, reason=reason))

    def collect_url(
        value: object,
        location: str,
    ) -> None:
        try:
            source_identity = url_origin.normalize_manifest_source_url(
                value,
                allowed_schemes=None,
                ignored_schemes=frozenset({"file"}),
            )
        except url_origin.InvalidUrlOrigin:
            return
        if source_identity is not None:
            source_locations.setdefault(source_identity, set()).add(location)

    def walk_sources(sources: object, module_location: str) -> None:
        sources_location = f"{module_location}.sources"
        if not isinstance(sources, list):
            add_structural_issue(sources_location, "invalid-sources")
            return
        for source_index, source in enumerate(sources):
            source_location = f"{sources_location}[{source_index}]"
            if isinstance(source, str):
                add_structural_issue(source_location, "unresolved-source-include")
                continue
            if not isinstance(source, dict):
                add_structural_issue(source_location, "invalid-source")
                continue
            source = cast("dict[str, Any]", source)
            if source.get("type") == "extra-data":
                continue
            if "url" in source:
                collect_url(
                    source["url"],
                    f"{source_location}.url",
                )
            if "mirror-urls" in source:
                mirrors = source["mirror-urls"]
                mirrors_location = f"{source_location}.mirror-urls"
                if not isinstance(mirrors, list):
                    add_structural_issue(
                        mirrors_location,
                        "invalid-mirror-urls",
                    )
                else:
                    for mirror_index, mirror in enumerate(mirrors):
                        collect_url(
                            mirror,
                            f"{mirrors_location}[{mirror_index}]",
                        )

    def walk_modules(modules: object, parent: str) -> None:
        modules_location = f"{parent}.modules" if parent else "modules"
        if not isinstance(modules, list):
            add_structural_issue(modules_location, "invalid-modules")
            return

        name_counts: dict[str, int] = {}
        for module in modules:
            if isinstance(module, dict):
                name = module.get("name")
                if isinstance(name, str) and name:
                    name_counts[name] = name_counts.get(name, 0) + 1

        for module_index, module in enumerate(modules):
            if isinstance(module, dict):
                name = module.get("name")
                segment = (
                    f"[{json.dumps(name, ensure_ascii=True)}]"
                    if isinstance(name, str) and name and name_counts.get(name) == 1
                    else f"[{module_index}]"
                )
            else:
                segment = f"[{module_index}]"
            module_location = f"{modules_location}{segment}"
            if isinstance(module, str):
                add_structural_issue(
                    module_location,
                    "unresolved-module-include",
                )
                continue
            if not isinstance(module, dict):
                add_structural_issue(module_location, "invalid-module")
                continue
            walk_sources(module.get("sources", []), module_location)
            walk_modules(module.get("modules", []), module_location)

    if "sources" in manifest:
        add_structural_issue("sources", "unsupported-root-sources")
    walk_modules(manifest.get("modules", []), "")

    return _ManifestSourceInventory(
        locations_by_source={
            source: tuple(sorted(locations))
            for source, locations in sorted(source_locations.items())
        },
        structural_issues=tuple(
            sorted(
                structural_issues,
                key=lambda issue: (issue.location, issue.reason),
            )
        ),
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


class CandidateRefMissingError(ManifestRetrievalError):
    def __init__(self, category: str, ref_name: str):
        super().__init__(category)
        self.ref_name = ref_name


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
    skip_missing_candidate_app_ids: AbstractSet[str] = frozenset(),
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
            candidate_ref_commits: list[tuple[str, str]] = []
            candidate_commits_by_ref: dict[str, str] = {}
            for item in refs:
                if item.ref_name not in candidate_remote_refs:
                    raise CandidateRefMissingError(
                        "missing_candidate_ref", item.ref_name
                    )
                candidate_commit = candidate_remote_refs[item.ref_name]
                candidate_ref_commits.append((item.ref_name, candidate_commit))
                candidate_commits_by_ref[item.ref_name] = candidate_commit

            published_remote_refs = _list_remote_refs(repo, "published", cancellable)
            published_commits = {
                item.ref_name: published_remote_refs[item.ref_name]
                for item in refs
                if item.ref_name in published_remote_refs
            }

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
                candidate_commit = candidate_commits_by_ref[item.ref_name]
                if candidate_commit not in candidate_cache:
                    try:
                        candidate_cache[candidate_commit] = _read_manifest(
                            repo, candidate_commit, cancellable
                        )
                    except _ManifestDataError as exc:
                        raise CandidateManifestError(
                            exc.category, item.ref_name, candidate_commit
                        ) from exc
                candidate_manifest = candidate_cache[candidate_commit]
                if candidate_manifest is None:
                    if item.app_id in skip_missing_candidate_app_ids:
                        logger.warning(
                            "Candidate OSTree manifest is missing for direct-upload app",
                            extra={
                                "app_id": item.app_id,
                                "ref_name": item.ref_name,
                                "arch": item.arch,
                                "candidate_commit": candidate_commit,
                                "category": "missing_candidate_manifest",
                            },
                        )
                        continue
                    raise CandidateManifestError(
                        "missing_candidate_manifest",
                        item.ref_name,
                        candidate_commit,
                    )

                published_commit = published_commits.get(item.ref_name)
                if published_commit is None:
                    pairs.append(
                        ManifestPair(
                            app_id=item.app_id,
                            ref_name=item.ref_name,
                            arch=item.arch,
                            branch=item.branch,
                            candidate_commit=candidate_commit,
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
                        candidate_commit=candidate_commit,
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


def find_manifest_source_changes(
    groups: Sequence[Sequence[ManifestPair]],
) -> tuple[ManifestSourceFinding, ...]:
    merged: dict[
        tuple[
            str,
            tuple[str, ...],
            tuple[str, ...],
            tuple[tuple[str, tuple[str, ...]], ...],
        ],
        ManifestSourceFinding,
    ] = {}

    for group in groups:
        if not group:
            continue
        pair = group[0]
        if (
            pair.published_status is not PublishedManifestStatus.PRESENT
            or pair.published_manifest is None
        ):
            continue

        published = _collect_manifest_source_inventory(pair.published_manifest)
        candidate = _collect_manifest_source_inventory(pair.candidate_manifest)
        arches = tuple(sorted({item.arch for item in group}))
        if published.structural_issues or candidate.structural_issues:
            logger.warning(
                "Manifest source comparison is unreliable",
                extra={
                    "app_id": pair.app_id,
                    "affected_arches": arches,
                    "structural_issues": [
                        {"location": issue.location, "reason": issue.reason}
                        for issue in sorted(
                            (
                                *published.structural_issues,
                                *candidate.structural_issues,
                            ),
                            key=lambda issue: (issue.location, issue.reason),
                        )
                    ],
                },
            )
            continue

        candidate_sources = set(candidate.locations_by_source)
        published_sources = set(published.locations_by_source)
        added = tuple(sorted(candidate_sources - published_sources))
        removed = tuple(sorted(published_sources - candidate_sources))
        if not added and not removed:
            continue

        locations = {source: candidate.locations_by_source[source] for source in added}
        locations.update(
            {source: published.locations_by_source[source] for source in removed}
        )
        merge_key = (
            pair.app_id,
            added,
            removed,
            tuple(sorted(locations.items())),
        )
        existing = merged.get(merge_key)
        if existing is None:
            merged[merge_key] = ManifestSourceFinding(
                app_id=pair.app_id,
                sources_added=added,
                sources_removed=removed,
                locations_by_source=locations,
                arches=arches,
            )
        else:
            merged[merge_key] = ManifestSourceFinding(
                app_id=existing.app_id,
                sources_added=existing.sources_added,
                sources_removed=existing.sources_removed,
                locations_by_source=existing.locations_by_source,
                arches=tuple(sorted(set(existing.arches) | set(arches))),
            )

    return tuple(
        sorted(
            merged.values(),
            key=lambda finding: (
                finding.app_id,
                finding.sources_added,
                finding.sources_removed,
                tuple(sorted(finding.locations_by_source.items())),
                finding.arches,
            ),
        )
    )
