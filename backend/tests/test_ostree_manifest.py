import json
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import gi
import pytest

gi.require_version("Gio", "2.0")
gi.require_version("GLib", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import Gio, GLib, OSTree  # type: ignore

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)
sys.modules["app.search"] = SimpleNamespace()

from app import ostree_manifest


class SourceRepo:
    def __init__(self, path: Path):
        self.path = path
        self.repo = OSTree.Repo.new(Gio.File.new_for_path(str(path)))
        self.repo.create(OSTree.RepoMode.ARCHIVE, None)
        self.repo.regenerate_summary(None, None)
        self.commit_index = 0

    @property
    def url(self) -> str:
        return self.path.as_uri()

    def commit(
        self, ref_name: str, manifest: object = None, *, raw: bytes | None = None
    ):
        tree_path = self.path.parent / f"tree-{self.path.name}-{self.commit_index}"
        self.commit_index += 1
        tree_path.mkdir()
        if raw is not None or manifest is not None:
            files_path = tree_path / "files"
            files_path.mkdir()
            contents = raw if raw is not None else json.dumps(manifest).encode("utf-8")
            (files_path / "manifest.json").write_bytes(contents)

        mtree = OSTree.MutableTree.new()
        self.repo.write_directory_to_mtree(
            Gio.File.new_for_path(str(tree_path)), mtree, None, None
        )
        _, root = self.repo.write_mtree(mtree, None)
        _, checksum = self.repo.write_commit(None, None, None, None, root, None)
        self.repo.set_ref_immediate(None, ref_name, checksum, None)
        self.repo.regenerate_summary(None, None)
        return checksum


@pytest.fixture
def source_repos(tmp_path):
    return SourceRepo(tmp_path / "candidate"), SourceRepo(tmp_path / "published")


def candidate_ref(
    checksum: str,
    *,
    app_id: str = "org.example.App",
    arch: str = "x86_64",
    branch: str = "stable",
):
    return ostree_manifest.CandidateManifestRef(
        app_id=app_id,
        ref_name=f"app/{app_id}/{arch}/{branch}",
        arch=arch,
        branch=branch,
        candidate_commit=checksum,
    )


def collect(candidate, published, refs, *, skip_missing_candidate_app_ids=frozenset()):
    return ostree_manifest.collect_manifest_pairs(
        candidate.url,
        published.url,
        refs,
        timeout_seconds=10,
        skip_missing_candidate_app_ids=skip_missing_candidate_app_ids,
    )


def test_candidate_and_published_manifests_are_read_with_exact_pull_options(
    source_repos,
):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    candidate_checksum = candidate.commit(ref_name, {"id": "org.example.App", "n": 1})
    published_checksum = published.commit(ref_name, {"n": 1, "id": "org.example.App"})

    pairs = collect(candidate, published, [candidate_ref(candidate_checksum)])

    assert pairs == (
        ostree_manifest.ManifestPair(
            app_id="org.example.App",
            ref_name=ref_name,
            arch="x86_64",
            branch="stable",
            candidate_commit=candidate_checksum,
            published_commit=published_checksum,
            candidate_manifest={"id": "org.example.App", "n": 1},
            published_manifest={"n": 1, "id": "org.example.App"},
            published_status=ostree_manifest.PublishedManifestStatus.PRESENT,
        ),
    )
    assert pairs[0].changed is False

    published_checksum = published.commit(ref_name, {"id": "org.example.App", "n": 2})
    changed_pair = collect(candidate, published, [candidate_ref(candidate_checksum)])[0]
    assert changed_pair.published_commit == published_checksum
    assert changed_pair.changed is True


def test_candidate_manifest_is_read_from_reported_checksum(source_repos):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum = candidate.commit(ref_name, {"value": "reported"})

    pair = collect(candidate, published, [candidate_ref(checksum)])[0]

    assert pair.candidate_commit == checksum
    assert pair.candidate_manifest == {"value": "reported"}


def test_moved_candidate_ref_is_rejected_before_manifest_read(
    source_repos, monkeypatch
):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum_a = candidate.commit(ref_name, {"value": "a"})
    candidate.commit(ref_name, {"value": "b"})
    monkeypatch.setattr(
        ostree_manifest,
        "_read_manifest",
        lambda *args: pytest.fail("mismatched candidate was read"),
    )

    with pytest.raises(ostree_manifest.CandidateCommitMismatchError) as raised:
        collect(candidate, published, [candidate_ref(checksum_a)])

    assert raised.value.category == "checksum_mismatch"


def test_missing_published_ref_is_explicit(source_repos):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum = candidate.commit(ref_name, {"value": 1})

    pair = collect(candidate, published, [candidate_ref(checksum)])[0]

    assert pair.candidate_manifest == {"value": 1}
    assert pair.published_commit is None
    assert pair.published_manifest is None
    assert pair.published_status is ostree_manifest.PublishedManifestStatus.REF_MISSING
    assert pair.changed is None


@pytest.mark.parametrize(
    ("raw", "status", "category"),
    [
        (
            None,
            ostree_manifest.PublishedManifestStatus.MANIFEST_MISSING,
            "missing_manifest",
        ),
        (
            b"\xff",
            ostree_manifest.PublishedManifestStatus.MANIFEST_INVALID,
            "invalid_utf8",
        ),
        (
            b"{",
            ostree_manifest.PublishedManifestStatus.MANIFEST_INVALID,
            "malformed_json",
        ),
        (
            b"[]",
            ostree_manifest.PublishedManifestStatus.MANIFEST_INVALID,
            "unexpected_json_type",
        ),
    ],
)
def test_missing_and_invalid_published_manifests_continue(
    source_repos, caplog, raw, status, category
):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    candidate_checksum = candidate.commit(ref_name, {"value": 1})
    if raw is None:
        published_checksum = published.commit(ref_name)
    else:
        published_checksum = published.commit(ref_name, raw=raw)

    pair = collect(candidate, published, [candidate_ref(candidate_checksum)])[0]

    assert pair.published_commit == published_checksum
    assert pair.published_manifest is None
    assert pair.published_status is status
    assert pair.changed is None
    warning = next(record for record in caplog.records if record.levelname == "WARNING")
    assert warning.app_id == "org.example.App"
    assert warning.ref_name == ref_name
    assert warning.arch == "x86_64"
    assert warning.published_commit == published_checksum
    assert warning.published_status == status.value
    assert warning.category == category


def test_missing_candidate_manifest_fails(source_repos):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum = candidate.commit(ref_name)

    with pytest.raises(ostree_manifest.CandidateManifestError) as raised:
        collect(candidate, published, [candidate_ref(checksum)])

    assert raised.value.category == "missing_candidate_manifest"


def test_missing_direct_upload_candidate_manifest_is_skipped(source_repos, caplog):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum = candidate.commit(ref_name)

    pairs = collect(
        candidate,
        published,
        [candidate_ref(checksum)],
        skip_missing_candidate_app_ids={"org.example.App"},
    )

    assert pairs == ()
    warning = next(record for record in caplog.records if record.levelname == "WARNING")
    assert warning.app_id == "org.example.App"
    assert warning.ref_name == ref_name
    assert warning.arch == "x86_64"
    assert warning.candidate_commit == checksum
    assert warning.category == "missing_candidate_manifest"


@pytest.mark.parametrize(
    ("raw", "category"),
    [(b"{", "malformed_json"), (b"\xff", "invalid_utf8")],
)
def test_malformed_candidate_manifest_fails(source_repos, raw, category):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum = candidate.commit(ref_name, raw=raw)

    with pytest.raises(ostree_manifest.CandidateManifestError) as raised:
        collect(candidate, published, [candidate_ref(checksum)])

    assert raised.value.category == category


@pytest.mark.parametrize("manifest", [[], "value", 1, True, None])
def test_non_object_candidate_manifest_fails(source_repos, manifest):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    raw = json.dumps(manifest).encode("utf-8")
    checksum = candidate.commit(ref_name, raw=raw)

    with pytest.raises(ostree_manifest.CandidateManifestError) as raised:
        collect(candidate, published, [candidate_ref(checksum)])

    assert raised.value.category == "unexpected_json_type"


def test_both_architectures_are_returned_in_response_order(source_repos):
    candidate, published = source_repos
    aarch64_ref = "app/org.example.App/aarch64/stable"
    x86_64_ref = "app/org.example.App/x86_64/stable"
    aarch64_checksum = candidate.commit(aarch64_ref, {"arch": "aarch64"})
    x86_64_checksum = candidate.commit(x86_64_ref, {"arch": "x86_64"})

    pairs = collect(
        candidate,
        published,
        [
            candidate_ref(aarch64_checksum, arch="aarch64"),
            candidate_ref(x86_64_checksum),
        ],
    )

    assert [(pair.arch, pair.candidate_manifest) for pair in pairs] == [
        ("aarch64", {"arch": "aarch64"}),
        ("x86_64", {"arch": "x86_64"}),
    ]


def make_pair(app_id, arch, candidate_manifest, published_manifest):
    return ostree_manifest.ManifestPair(
        app_id=app_id,
        ref_name=f"app/{app_id}/{arch}/stable",
        arch=arch,
        branch="stable",
        candidate_commit=arch * 4,
        published_commit=arch * 5,
        candidate_manifest=candidate_manifest,
        published_manifest=published_manifest,
        published_status=ostree_manifest.PublishedManifestStatus.PRESENT,
    )


def test_identical_manifest_pairs_group_by_app_branch_and_content():
    first = make_pair("org.example.App", "x86_64", {"a": 1, "b": 2}, {"c": 3})
    second = make_pair("org.example.App", "aarch64", {"b": 2, "a": 1}, {"c": 3})

    assert ostree_manifest.group_identical_manifest_pairs([first, second]) == (
        (first, second),
    )

    changed = make_pair("org.example.App", "aarch64", {"a": 2}, {"c": 3})
    other_app = make_pair("org.example.Other", "aarch64", {"a": 1, "b": 2}, {"c": 3})
    assert ostree_manifest.group_identical_manifest_pairs(
        [first, changed, other_app]
    ) == ((first,), (changed,), (other_app,))


def test_normalize_candidate_refs_filters_related_and_invalid_refs():
    checksum = "a" * 64
    valid = {"ref_name": "app/org.example.App/x86_64/stable", "commit": checksum}
    refs = [
        {"ref_name": "app/org.example.App.Debug/x86_64/stable"},
        {"ref_name": "app/org.example.App.Locale/x86_64/stable"},
        {"ref_name": "app/org.example.App.Sources/x86_64/stable"},
        {"ref_name": "runtime/org.example.Platform/x86_64/stable"},
        {"ref_name": "app/org.example.App/i386/stable"},
        {"ref_name": "malformed"},
        {},
        "invalid",
        valid,
        dict(valid),
    ]

    assert ostree_manifest.normalize_candidate_refs(refs) == (candidate_ref(checksum),)


@pytest.mark.parametrize("build_refs", [None, {}, "refs"])
def test_normalize_candidate_refs_rejects_non_list(build_refs):
    with pytest.raises(ostree_manifest.InvalidBuildRefError):
        ostree_manifest.normalize_candidate_refs(build_refs)


def test_normalize_candidate_refs_rejects_invalid_and_conflicting_commits():
    ref_name = "app/org.example.App/x86_64/stable"
    with pytest.raises(ostree_manifest.InvalidBuildRefError):
        ostree_manifest.normalize_candidate_refs(
            [{"ref_name": ref_name, "commit": "invalid"}]
        )
    with pytest.raises(ostree_manifest.InvalidBuildRefError):
        ostree_manifest.normalize_candidate_refs(
            [
                {"ref_name": ref_name, "commit": "a" * 64},
                {"ref_name": ref_name, "commit": "b" * 64},
            ]
        )


@pytest.mark.parametrize("invalid_candidate", [False, True])
def test_temporary_repository_is_removed(source_repos, monkeypatch, invalid_candidate):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    raw = b"{" if invalid_candidate else None
    manifest = None if invalid_candidate else {"value": 1}
    checksum = candidate.commit(ref_name, manifest, raw=raw)
    paths = []
    original = ostree_manifest.tempfile.TemporaryDirectory

    def temporary_directory(*args, **kwargs):
        context = original(*args, **kwargs)
        paths.append(Path(context.name))
        return context

    monkeypatch.setattr(
        ostree_manifest.tempfile, "TemporaryDirectory", temporary_directory
    )
    if invalid_candidate:
        with pytest.raises(ostree_manifest.CandidateManifestError):
            collect(candidate, published, [candidate_ref(checksum)])
    else:
        collect(candidate, published, [candidate_ref(checksum)])

    assert len(paths) == 1
    assert not paths[0].exists()


def test_transport_failure_is_typed(source_repos):
    candidate, _ = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum = candidate.commit(ref_name, {"value": 1})

    with pytest.raises(ostree_manifest.ManifestTransportError) as raised:
        ostree_manifest.collect_manifest_pairs(
            candidate.url,
            "file:///nonexistent-published-repository",
            [candidate_ref(checksum)],
            timeout_seconds=10,
        )

    assert raised.value.category == "ostree_io"


def test_cancelled_gio_failure_is_typed_as_timeout(source_repos, monkeypatch):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum = candidate.commit(ref_name, {"value": 1})

    def cancel_and_fail(repo, remote_name, cancellable):
        cancellable.cancel()
        raise GLib.Error("cancelled")

    monkeypatch.setattr(ostree_manifest, "_list_remote_refs", cancel_and_fail)

    with pytest.raises(ostree_manifest.ManifestTimeoutError) as raised:
        collect(candidate, published, [candidate_ref(checksum)])

    assert raised.value.category == "timeout"


def test_empty_ref_collection_does_not_create_repository(monkeypatch):
    monkeypatch.setattr(
        ostree_manifest.tempfile,
        "TemporaryDirectory",
        lambda *args, **kwargs: pytest.fail("temporary repository created"),
    )

    assert (
        ostree_manifest.collect_manifest_pairs(
            "candidate", "published", [], timeout_seconds=10
        )
        == ()
    )
