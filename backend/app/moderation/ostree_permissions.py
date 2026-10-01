import gzip
import hashlib
import ipaddress
import math
import tempfile
from collections.abc import Mapping
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import Timer
from urllib.parse import unquote, urlsplit

import gi
import httpx

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import Gio, GLib, OSTree  # type: ignore

from .. import http_client
from .permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionMap,
    PermissionSnapshot,
    PermissionSnapshotError,
    parse_permission_metadata,
)


@dataclass(frozen=True)
class PermissionArtifact:
    ref_name: str
    arch: str
    commit: str


@dataclass(frozen=True)
class CollectedPermissions:
    app_id: str
    flatpak_branch: str
    repository_url: str
    captured_at: str
    artifacts: tuple[PermissionArtifact, ...]
    snapshot: PermissionSnapshot


def _invalid(message: str) -> PermissionSnapshotError:
    return PermissionSnapshotError("invalid_input", message)


def _valid_segment(value: object) -> bool:
    return (
        isinstance(value, str)
        and bool(value)
        and "/" not in value
        and not any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value)
    )


def _check_url(url: str) -> None:
    try:
        parsed = urlsplit(url)
        host = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise _invalid(f"Invalid repository URL: {exc}") from exc
    if (
        parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
    ):
        raise _invalid(
            "Repository URL must not contain credentials, query, or fragment"
        )
    if parsed.scheme == "file":
        if parsed.netloc or not parsed.path.startswith("/"):
            raise _invalid("Repository file URL must be absolute and local")
    elif parsed.scheme in ("https", "http") and host and port != 0:
        if parsed.scheme == "http":
            try:
                loopback = ipaddress.ip_address(host).is_loopback
            except ValueError:
                loopback = host == "localhost"
            if not loopback:
                raise _invalid("HTTP repository URL must have a loopback host")
    else:
        raise _invalid(
            "Repository URL must be HTTPS, loopback HTTP, or a local file URL"
        )


def _checksum(commit: str, *, ref_name: str, remote: bool) -> None:
    code = "checksum_mismatch" if remote else "invalid_input"
    try:
        valid = OSTree.validate_checksum_string(commit)
        reason = "" if valid else commit
    except (GLib.Error, TypeError) as exc:
        reason = str(exc)
    if reason:
        raise PermissionSnapshotError(
            code, f"Invalid checksum for {ref_name}: {reason}", ref_name=ref_name
        )


def _arch_for_ref(ref_name: str, app_id: str, branch: str) -> str | None:
    parts = ref_name.split("/")
    if (
        len(parts) == 4
        and parts[0] == "app"
        and parts[1] == app_id
        and parts[3] == branch
        and _valid_segment(parts[2])
    ):
        return parts[2]
    return None


SUMMARY_TYPE = GLib.VariantType.new("(a(s(taya{sv}))a{sv})")
SUMMARY_INDEX_TYPE = GLib.VariantType.new("(a{s(ayaaya{sv})}a{sv})")


def _fetch_repo_file(base_url: str, name: str, *, optional: bool) -> bytes | None:
    url = f"{base_url.rstrip('/')}/{name}"
    try:
        parsed = urlsplit(url)
        if parsed.scheme == "file":
            try:
                return Path(unquote(parsed.path)).read_bytes()
            except FileNotFoundError:
                if optional:
                    return None
                raise
        response = http_client.get(url, headers={"User-Agent": "flathub-backend"})
        if optional and response.status_code == 404:
            return None
        response.raise_for_status()
        return response.content
    except (OSError, httpx.HTTPError) as exc:
        raise PermissionSnapshotError(
            "transport_error", f"Failed to fetch {name}: {exc}"
        ) from exc


def _summary_refs(data: bytes) -> dict[str, str]:
    summary = GLib.Variant.new_from_bytes(SUMMARY_TYPE, GLib.Bytes.new(data), False)
    return {
        name: bytes(checksum).hex() for name, (_, checksum, _) in summary.unpack()[0]
    }


def _list_remote_refs(
    repo: OSTree.Repo, cancellable: Gio.Cancellable
) -> dict[str, str]:
    _, url = repo.remote_get_url("source")
    index = _fetch_repo_file(url, "summary.idx", optional=True)
    if index is None:
        _, refs = repo.remote_list_refs("source", cancellable)
        return refs

    subsummaries = GLib.Variant.new_from_bytes(
        SUMMARY_INDEX_TYPE, GLib.Bytes.new(index), False
    ).unpack()[0]
    digests = {
        name: bytes(digest).hex()
        for name, (digest, _, _) in subsummaries.items()
        if "-" not in name
    }
    if not digests:
        raise PermissionSnapshotError(
            "invalid_summary", "Summary index lists no architecture subsummaries"
        )
    refs: dict[str, str] = {}
    for name, digest in sorted(digests.items()):
        compressed = _fetch_repo_file(url, f"summaries/{digest}.gz", optional=False)
        assert compressed is not None
        try:
            data = gzip.decompress(compressed)
        except (OSError, EOFError) as exc:
            raise PermissionSnapshotError(
                "invalid_summary", f"Invalid {name} subsummary: {exc}"
            ) from exc
        if hashlib.sha256(data).hexdigest() != digest:
            raise PermissionSnapshotError(
                "invalid_summary", f"Subsummary digest differs for {name}"
            )
        for ref_name, commit in _summary_refs(data).items():
            if refs.setdefault(ref_name, commit) != commit:
                raise PermissionSnapshotError(
                    "invalid_summary",
                    f"Subsummaries disagree on {ref_name}",
                    ref_name=ref_name,
                )
    return refs


def _read_root_metadata(
    repo: OSTree.Repo,
    artifact: PermissionArtifact,
    app_id: str,
    cancellable: Gio.Cancellable,
) -> PermissionMap:
    _, root, resolved_commit = repo.read_commit(artifact.commit, cancellable)
    if resolved_commit != artifact.commit:
        raise PermissionSnapshotError(
            "checksum_mismatch",
            f"Read checksum differs for {artifact.ref_name}",
            ref_name=artifact.ref_name,
        )
    try:
        _, contents, _ = root.get_child("metadata").load_contents(cancellable)
    except GLib.Error as exc:
        if exc.matches(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND):
            raise PermissionSnapshotError(
                "missing_metadata",
                f"Root metadata missing for {artifact.ref_name}",
                ref_name=artifact.ref_name,
            ) from exc
        raise
    try:
        return parse_permission_metadata(contents, app_id=app_id)
    except PermissionSnapshotError as exc:
        raise PermissionSnapshotError(
            exc.code, exc.message, ref_name=artifact.ref_name
        ) from exc


def collect_permissions(
    repository_url: str,
    *,
    app_id: str,
    flatpak_branch: str,
    expected_commits: Mapping[str, str] | None = None,
    expected_arches: AbstractSet[str] | None = None,
    timeout_seconds: float = 60.0,
) -> CollectedPermissions:
    candidate = expected_commits is not None
    if not _valid_segment(app_id) or not _valid_segment(flatpak_branch):
        raise _invalid("App ID and Flatpak branch must be nonempty single segments")
    if not isinstance(repository_url, str):
        raise _invalid("Repository URL must be a string")
    _check_url(repository_url)
    if (
        isinstance(timeout_seconds, bool)
        or not isinstance(timeout_seconds, (int, float))
        or not math.isfinite(timeout_seconds)
        or timeout_seconds <= 0
    ):
        raise _invalid("Timeout must be a positive finite number")
    if (expected_commits is None) != (expected_arches is None) or (
        candidate
        and (
            not isinstance(expected_commits, Mapping)
            or not isinstance(expected_arches, AbstractSet)
        )
    ):
        raise _invalid("Expected commits must be paired with expected architectures")
    if candidate:
        assert expected_commits is not None
        assert expected_arches is not None
        if not expected_arches:
            raise _invalid("Expected architectures must be nonempty")
        if any(not _valid_segment(arch) for arch in expected_arches):
            raise _invalid("Expected architectures must be nonempty single segments")
        if not expected_commits:
            raise _invalid("Expected commits must be nonempty")
        supplied_arches: set[str] = set()
        for ref_name, commit in expected_commits.items():
            if (
                not isinstance(ref_name, str)
                or (arch := _arch_for_ref(ref_name, app_id, flatpak_branch)) is None
            ):
                raise _invalid(f"Candidate ref is outside app/branch scope: {ref_name}")
            if arch not in expected_arches:
                raise PermissionSnapshotError(
                    "identity_mismatch",
                    f"Unexpected candidate architecture: {arch}",
                    ref_name=ref_name,
                )
            supplied_arches.add(arch)
            _checksum(commit, ref_name=ref_name, remote=False)
        if supplied_arches != expected_arches:
            raise PermissionSnapshotError(
                "missing_architecture",
                f"Expected architectures lack refs: {sorted(expected_arches - supplied_arches)}",
            )
    with tempfile.TemporaryDirectory(prefix="ostree-permissions-") as temp_dir:
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
            repo.remote_add("source", repository_url, remote_options, cancellable)
            remote_refs = _list_remote_refs(repo, cancellable)
            captured_at = datetime.now(UTC).isoformat()
            if cancellable.is_cancelled():
                raise PermissionSnapshotError(
                    "timeout", "Permission collection timed out"
                )
            selected: dict[str, tuple[str, str]] = {}
            for ref_name, commit in remote_refs.items():
                arch = _arch_for_ref(ref_name, app_id, flatpak_branch)
                if arch is not None:
                    _checksum(commit, ref_name=ref_name, remote=True)
                    selected[arch] = (ref_name, commit)
            if candidate:
                assert expected_commits is not None
                assert expected_arches is not None
                unexpected = selected.keys() - expected_arches
                if unexpected:
                    arch = min(unexpected)
                    raise PermissionSnapshotError(
                        "identity_mismatch",
                        f"Unexpected remote architecture: {arch}",
                        ref_name=selected[arch][0],
                    )
                missing = expected_arches - selected.keys()
                if missing:
                    raise PermissionSnapshotError(
                        "missing_architecture",
                        f"Remote lacks expected architectures: {sorted(missing)}",
                    )
                for ref_name, expected in expected_commits.items():
                    arch = ref_name.split("/")[2]
                    if selected[arch][1] != expected:
                        raise PermissionSnapshotError(
                            "checksum_mismatch",
                            f"Remote checksum differs for {ref_name}: expected {expected}, got {selected[arch][1]}",
                            ref_name=ref_name,
                        )
            elif not selected:
                raise PermissionSnapshotError(
                    "missing_baseline",
                    f"No published app refs for {app_id}/{flatpak_branch}",
                )

            artifacts = tuple(
                PermissionArtifact(ref_name, arch, commit)
                for arch, (ref_name, commit) in sorted(selected.items())
            )
            options = GLib.Variant(
                "a{sv}",
                {
                    "refs": GLib.Variant("as", [item.ref_name for item in artifacts]),
                    "override-commit-ids": GLib.Variant(
                        "as", [item.commit for item in artifacts]
                    ),
                    "flags": GLib.Variant("i", int(OSTree.RepoPullFlags.NONE)),
                    "subdirs": GLib.Variant("as", ["/metadata"]),
                    "depth": GLib.Variant("i", 0),
                    "disable-static-deltas": GLib.Variant("b", True),
                    "n-network-retries": GLib.Variant("u", 1),
                    "http-headers": GLib.Variant(
                        "a(ss)", [("User-Agent", "flathub-backend")]
                    ),
                },
            )
            repo.pull_with_options("source", options, None, cancellable)
            architectures = {}
            parsed_commits = {}
            for artifact in artifacts:
                _, local_commit = repo.resolve_rev(f"source:{artifact.ref_name}", False)
                if local_commit != artifact.commit:
                    raise PermissionSnapshotError(
                        "checksum_mismatch",
                        f"Local checksum differs for {artifact.ref_name}",
                        ref_name=artifact.ref_name,
                    )
                if artifact.commit not in parsed_commits:
                    parsed_commits[artifact.commit] = _read_root_metadata(
                        repo,
                        artifact,
                        app_id,
                        cancellable,
                    )
                architectures[artifact.arch] = parsed_commits[artifact.commit]
            if cancellable.is_cancelled():
                raise PermissionSnapshotError(
                    "timeout", "Permission collection timed out"
                )
            snapshot = PermissionSnapshot(CANONICALIZATION_VERSION, architectures)
            return CollectedPermissions(
                app_id,
                flatpak_branch,
                repository_url,
                captured_at,
                artifacts,
                snapshot,
            )
        except GLib.Error as exc:
            if cancellable.is_cancelled():
                raise PermissionSnapshotError(
                    "timeout", f"Permission collection timed out: {exc}"
                ) from exc
            raise PermissionSnapshotError(
                "transport_error", f"OSTree transport error: {exc}"
            ) from exc
        finally:
            timer.cancel()
