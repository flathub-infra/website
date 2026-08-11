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


def test_candidate_manifest_is_read_from_resolved_remote_checksum(source_repos):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"
    checksum_a = candidate.commit(ref_name, {"value": "reported"})
    checksum_b = candidate.commit(ref_name, {"value": "resolved"})

    pair = collect(candidate, published, [candidate_ref(checksum_a)])[0]

    assert pair.candidate_commit == checksum_b
    assert pair.candidate_manifest == {"value": "resolved"}


def test_missing_candidate_ref_fails(source_repos):
    candidate, published = source_repos
    ref_name = "app/org.example.App/x86_64/stable"

    with pytest.raises(ostree_manifest.CandidateRefMissingError) as raised:
        collect(candidate, published, [candidate_ref("a" * 64)])

    assert raised.value.category == "missing_candidate_ref"
    assert raised.value.ref_name == ref_name


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


def manifest_pair(
    candidate_manifest,
    published_manifest,
    *,
    arch="x86_64",
    status=ostree_manifest.PublishedManifestStatus.PRESENT,
):
    return ostree_manifest.ManifestPair(
        app_id="org.example.App",
        ref_name=f"app/org.example.App/{arch}/stable",
        arch=arch,
        branch="stable",
        candidate_commit=f"candidate-{arch}",
        published_commit=f"published-{arch}"
        if published_manifest is not None
        else None,
        candidate_manifest=candidate_manifest,
        published_manifest=published_manifest,
        published_status=status,
    )


def source_manifest(*sources):
    return {"modules": [{"name": "app", "sources": list(sources)}]}


def source(source_type="archive", **values):
    return {"type": source_type, **values}


def source_findings(candidate, published, *, arch="x86_64"):
    pair = manifest_pair(candidate, published, arch=arch)
    return ostree_manifest.find_manifest_source_changes(((pair,),))


@pytest.mark.parametrize(
    ("candidate", "published"),
    [
        (
            source_manifest(source(url="https://example.com/a.tar")),
            source_manifest(source(url="https://example.com/a.tar")),
        ),
        (
            source_manifest(source(url="https://example.com/new.tar")),
            source_manifest(source(url="https://example.com/old.tar")),
        ),
        (
            source_manifest(source(url="https://example.com/a?new=1#fragment")),
            source_manifest(source(url="https://example.com/a?old=1")),
        ),
        (
            source_manifest(
                source(
                    url="https://example.com/a",
                    sha256="new",
                    commit="new",
                    tag="new",
                    branch="new",
                    version="new",
                )
            ),
            source_manifest(
                source(
                    url="https://example.com/a",
                    sha256="old",
                    commit="old",
                    tag="old",
                    branch="old",
                    version="old",
                )
            ),
        ),
        (
            source_manifest(source(url="HTTPS://EXAMPLE.COM/a")),
            source_manifest(source(url="https://example.com/a")),
        ),
        (
            source_manifest(source(url="https://example.com:443/a")),
            source_manifest(source(url="https://example.com/a")),
        ),
        (
            source_manifest(
                source(url="https://example.com/a"),
                source(url="https://example.com/new"),
            ),
            source_manifest(source(url="https://example.com/a")),
        ),
        (
            source_manifest(source("extra-data", url="https://new.example/a")),
            source_manifest(),
        ),
        (
            source_manifest(
                source("file", path="local", paths=["one"], url="file:///tmp/a"),
                source("git", url="../local-repo"),
                source(url="relative/archive"),
            ),
            source_manifest(),
        ),
        (
            source_manifest(
                source(
                    url="https://github.com/foo/bar/releases/download/v2/archive.tar"
                )
            ),
            source_manifest(
                source(url="https://github.com/foo/bar.git?old=1#fragment")
            ),
        ),
        (
            source_manifest(source(url="https://github.com/settings")),
            source_manifest(source(url="https://github.com/login")),
        ),
    ],
)
def test_manifest_changes_without_source_identity_changes_do_not_gate(
    candidate, published
):
    assert source_findings(candidate, published) == ()


def test_manifest_source_removal_gates():
    finding = source_findings(
        source_manifest(),
        source_manifest(source(url="https://old.example/a")),
    )[0]

    assert finding.sources_added == ()
    assert finding.sources_removed == ("https://old.example",)


def test_source_move_to_existing_identity_still_reports_removed_repository():
    finding = source_findings(
        source_manifest(source(url="https://evil.example/new")),
        source_manifest(
            source(url="https://github.com/foo/bar.git"),
            source(url="https://evil.example/old"),
        ),
    )[0]

    assert finding.sources_added == ()
    assert finding.sources_removed == ("https://github.com/foo/bar",)
    assert finding.locations_by_source == {
        "https://github.com/foo/bar": ('modules["app"].sources[0].url',)
    }


@pytest.mark.parametrize(
    ("candidate_url", "published_url", "added", "removed"),
    [
        (
            "https://new.example/a",
            "https://old.example/a",
            ("https://new.example",),
            ("https://old.example",),
        ),
        (
            "https://download.example.com/a",
            "https://example.com/a",
            ("https://download.example.com",),
            ("https://example.com",),
        ),
        (
            "http://example.com/a",
            "https://example.com/a",
            ("http://example.com",),
            ("https://example.com",),
        ),
        (
            "https://example.com:8443/a",
            "https://example.com:9443/a",
            ("https://example.com:8443",),
            ("https://example.com:9443",),
        ),
        (
            "https://github.com/fork/bar/releases/download/v2/archive.tar",
            "https://github.com/foo/bar/archive/v1.tar",
            ("https://github.com/fork/bar",),
            ("https://github.com/foo/bar",),
        ),
        (
            "https://gitlab.com/group/subgroup/fork/-/archive/v2/archive.tar",
            "https://gitlab.com/group/subgroup/project/-/archive/v1/archive.tar",
            ("https://gitlab.com/group/subgroup/fork",),
            ("https://gitlab.com/group/subgroup/project",),
        ),
        (
            "https://gitlab.gnome.org/GNOME/gtk-fork/-/archive/v2/archive.tar",
            "https://gitlab.gnome.org/GNOME/gtk/-/archive/v1/archive.tar",
            ("https://gitlab.gnome.org/GNOME/gtk-fork",),
            ("https://gitlab.gnome.org/GNOME/gtk",),
        ),
        (
            "https://invent.kde.org/frameworks/kio-fork/-/archive/v2/archive.tar",
            "https://invent.kde.org/frameworks/kio/-/archive/v1/archive.tar",
            ("https://invent.kde.org/frameworks/kio-fork",),
            ("https://invent.kde.org/frameworks/kio",),
        ),
        (
            "https://codeberg.org/fork/bar/archive/v2.tar",
            "https://codeberg.org/foo/bar/archive/v1.tar",
            ("https://codeberg.org/fork/bar",),
            ("https://codeberg.org/foo/bar",),
        ),
    ],
)
def test_manifest_source_replacements_gate(
    candidate_url, published_url, added, removed
):
    findings = source_findings(
        source_manifest(source(url=candidate_url)),
        source_manifest(source(url=published_url)),
    )

    assert len(findings) == 1
    assert findings[0].sources_added == added
    assert findings[0].sources_removed == removed
    assert findings[0].locations_by_source == {
        added[0]: ('modules["app"].sources[0].url',),
        removed[0]: ('modules["app"].sources[0].url',),
    }


def test_new_source_and_mirror_identities_retain_all_unique_locations():
    candidate = source_manifest(
        source(
            url="https://new.example/a",
            **{
                "mirror-urls": [
                    "https://new.example/mirror",
                    "https://mirror.example/a",
                    "https://new.example/a",
                ]
            },
        )
    )

    finding = source_findings(candidate, source_manifest())[0]

    assert finding.sources_added == (
        "https://mirror.example",
        "https://new.example",
    )
    assert finding.locations_by_source == {
        "https://mirror.example": ('modules["app"].sources[0].mirror-urls[1]',),
        "https://new.example": (
            'modules["app"].sources[0].mirror-urls[0]',
            'modules["app"].sources[0].mirror-urls[2]',
            'modules["app"].sources[0].url',
        ),
    }


def test_nested_unique_module_names_are_used_in_locations():
    candidate = {
        "modules": [
            {
                "name": "outer",
                "modules": [
                    {
                        "name": 'lib"foo',
                        "sources": [source(url="https://new.example/a")],
                    }
                ],
            }
        ]
    }

    finding = source_findings(candidate, {"modules": []})[0]

    assert finding.locations_by_source["https://new.example"] == (
        'modules["outer"].modules["lib\\"foo"].sources[0].url',
    )


@pytest.mark.parametrize(
    "modules",
    [
        [
            {"sources": [source(url="https://new.example/a")]},
        ],
        [
            {"name": "duplicate", "sources": [source(url="https://new.example/a")]},
            {"name": "duplicate", "sources": []},
        ],
    ],
)
def test_unnamed_and_duplicate_module_names_use_indexes(modules):
    finding = source_findings({"modules": modules}, {"modules": []})[0]
    assert finding.locations_by_source["https://new.example"] == (
        "modules[0].sources[0].url",
    )


@pytest.mark.parametrize(
    "source_value",
    [
        source(url="ssh:repository"),
        source(url="https://example.com:70000/a"),
        source(url=42),
        source(**{"mirror-urls": [False]}),
    ],
)
def test_candidate_only_malformed_urls_do_not_gate(source_value):
    assert source_findings(source_manifest(source_value), source_manifest()) == ()


def test_unchanged_malformed_signature_does_not_gate_and_valid_replacement_does():
    malformed = source_manifest(source(url="https://example.com:70000/a"))
    assert source_findings(malformed, malformed) == ()

    finding = source_findings(
        source_manifest(source(url="https://new.example/a")),
        malformed,
    )[0]
    assert finding.sources_added == ("https://new.example",)


def test_identical_arch_groups_merge_and_different_groups_remain_separate():
    published = source_manifest()
    common_candidate = source_manifest(source(url="https://common.example/a"))
    common_group = (
        manifest_pair(common_candidate, published, arch="x86_64"),
        manifest_pair(common_candidate, published, arch="aarch64"),
    )
    different_group = (
        manifest_pair(
            source_manifest(source(url="https://other.example/a")),
            published,
            arch="riscv64",
        ),
    )

    findings = ostree_manifest.find_manifest_source_changes(
        (common_group, different_group)
    )

    assert [finding.arches for finding in findings] == [
        ("aarch64", "x86_64"),
        ("riscv64",),
    ]


@pytest.mark.parametrize(
    "status",
    [
        ostree_manifest.PublishedManifestStatus.REF_MISSING,
        ostree_manifest.PublishedManifestStatus.MANIFEST_MISSING,
        ostree_manifest.PublishedManifestStatus.MANIFEST_INVALID,
    ],
)
def test_missing_or_invalid_published_manifest_does_not_gate(status):
    pair = manifest_pair(
        source_manifest(source(url="https://new.example/a")),
        None,
        status=status,
    )
    assert ostree_manifest.find_manifest_source_changes(((pair,),)) == ()


@pytest.mark.parametrize(
    "manifest",
    [
        {"sources": []},
        {"modules": "module.json"},
        {"modules": ["module.json"]},
        {"modules": [42]},
        {"modules": [{"sources": "sources.json"}]},
        {"modules": [{"sources": ["source.json"]}]},
        {"modules": [{"sources": [42]}]},
        {"modules": [{"sources": [{"mirror-urls": "mirror"}]}]},
    ],
)
def test_structural_blind_spots_make_comparison_unreliable(manifest):
    assert (
        source_findings(
            source_manifest(source(url="https://new.example/a")),
            manifest,
        )
        == ()
    )
    assert (
        source_findings(
            manifest,
            source_manifest(source(url="https://old.example/a")),
        )
        == ()
    )


@pytest.mark.parametrize(
    ("url", "origin"),
    [
        ("git://user:password@example.com:9418/repo", "git://example.com"),
        ("ssh://user@example.com:22/repo", "ssh://example.com"),
        ("svn://example.com:3690/repo", "svn://example.com"),
        ("svn+ssh://user@example.com:22/repo", "svn+ssh://example.com"),
        ("bzr+ssh://user@example.com:22/repo", "bzr+ssh://example.com"),
    ],
)
def test_hierarchical_builder_protocols_normalize_without_credentials(url, origin):
    inventory = ostree_manifest._collect_manifest_source_inventory(
        source_manifest(source(url=url))
    )
    assert tuple(inventory.locations_by_source) == (origin,)
    assert "user" not in repr(inventory.locations_by_source)
    assert "password" not in repr(inventory.locations_by_source)
