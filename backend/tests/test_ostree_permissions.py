import gzip
import hashlib
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import gi
import pytest

gi.require_version("GLib", "2.0")
from gi.repository import GLib  # type: ignore

from app.moderation import ostree_permissions
from app.moderation.ostree_permissions import (
    collect_permissions,
    collect_published_permissions,
)
from app.moderation.permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionSnapshotError,
    fingerprint_snapshot,
)
from tests.shared_fixtures import APP, ARM, REF, SourceRepo


@pytest.fixture
def source(tmp_path):
    return SourceRepo(tmp_path / "source")


def collect(source, **kwargs):
    return collect_permissions(
        source.url, app_id=APP, flatpak_branch="stable", timeout_seconds=10, **kwargs
    )


def candidate(source, x86, arm):
    return collect(
        source,
        expected_commits={REF: x86, ARM: arm},
        expected_arches={"x86_64", "aarch64"},
    )


def fingerprints(snapshot_):
    return fingerprint_snapshot(snapshot_)


def test_complete_architectures_and_immutable_expectations(source):
    x86 = source.commit(REF, "[Context]\nfilesystems=home;\n")
    arm = source.commit(ARM, "[Context]\nfilesystems=home:ro;\n")
    published = collect(source)
    assert [(a.arch, a.commit) for a in published.artifacts] == [
        ("aarch64", arm),
        ("x86_64", x86),
    ]
    assert published.snapshot.architectures["aarch64"]["Context"]["filesystems"] == [
        "home:ro"
    ]
    candidate_snapshot = collect(
        source,
        expected_commits={REF: x86, ARM: arm},
        expected_arches={"x86_64", "aarch64"},
    ).snapshot
    assert published.snapshot.canonicalization_version == CANONICALIZATION_VERSION
    assert fingerprints(published.snapshot) == fingerprints(candidate_snapshot)
    assert published.captured_at
    assert fingerprints(collect(source).snapshot) == fingerprints(published.snapshot)

    source.commit(REF, "[Context]\nfilesystems=host;\n")
    with pytest.raises(PermissionSnapshotError) as error:
        candidate(source, x86, arm)
    assert error.value.code == "checksum_mismatch"


def test_nonpermission_commit_update_keeps_fingerprint(source):
    old = source.commit(REF, "[Context]\nfilesystems=home;\n[Environment]\nMODE=old\n")
    before = collect(source)
    new = source.commit(REF, "[Context]\nfilesystems=home;\n[Environment]\nMODE=new\n")
    after = collect(source)
    assert old != new
    assert fingerprints(before.snapshot) == fingerprints(after.snapshot)


def test_missing_remote_ref_and_unavailable_pinned_commit(source, monkeypatch):
    x86 = source.commit(REF, "")
    arm = source.commit(ARM, "")
    source.repo.set_ref_immediate(None, ARM, None, None)
    source.repo.regenerate_summary(None, None)
    with pytest.raises(PermissionSnapshotError) as error:
        candidate(source, x86, arm)
    assert error.value.code == "missing_architecture"

    list_refs = ostree_permissions._list_remote_refs

    def unavailable(repo, cancellable):
        refs = list_refs(repo, cancellable)
        refs[REF] = "a" * 64
        return refs

    monkeypatch.setattr(ostree_permissions, "_list_remote_refs", unavailable)
    with pytest.raises(PermissionSnapshotError) as error:
        collect(source)
    assert error.value.code == "transport_error"


def test_ref_advance_after_listing_keeps_pinned_commit(source, monkeypatch):
    old = source.commit(REF, "[Context]\nfilesystems=home;\n")
    list_refs = ostree_permissions._list_remote_refs

    def advance_after_listing(repo, cancellable):
        refs = list_refs(repo, cancellable)
        source.commit(REF, "[Context]\nfilesystems=host;\n")
        return refs

    monkeypatch.setattr(ostree_permissions, "_list_remote_refs", advance_after_listing)
    result = collect(source)
    assert result.artifacts[0].commit == old
    assert result.snapshot.architectures["x86_64"]["Context"]["filesystems"] == ["home"]


@pytest.mark.parametrize(
    "refs,arches,code",
    [
        ({REF: "bad"}, {"x86_64"}, "invalid_input"),
        ({ARM: "bad"}, {"x86_64"}, "identity_mismatch"),
        ({REF: "bad"}, {"x86_64", "aarch64"}, "invalid_input"),
        (None, {"x86_64"}, "invalid_input"),
        ({}, set(), "invalid_input"),
    ],
)
def test_invalid_candidate_inputs(source, refs, arches, code):
    with pytest.raises(PermissionSnapshotError) as error:
        collect(source, expected_commits=refs, expected_arches=arches)
    assert error.value.code == code


def test_missing_architecture_and_scope_mismatch(source):
    x86 = source.commit(REF, "")
    arm = source.commit(ARM, "")
    with pytest.raises(PermissionSnapshotError) as error:
        collect(
            source, expected_commits={REF: x86}, expected_arches={"x86_64", "aarch64"}
        )
    assert error.value.code == "missing_architecture"
    with pytest.raises(PermissionSnapshotError) as error:
        collect(source, expected_commits={REF: x86}, expected_arches={"x86_64"})
    assert error.value.code == "identity_mismatch"
    assert arm


def test_missing_baseline_metadata_and_transport(source, tmp_path):
    with pytest.raises(PermissionSnapshotError) as error:
        collect(source)
    assert error.value.code == "missing_baseline"
    source.commit(REF, None)
    with pytest.raises(PermissionSnapshotError) as error:
        collect(source)
    assert error.value.code == "missing_metadata"
    with pytest.raises(PermissionSnapshotError) as error:
        collect_permissions(
            (tmp_path / "unavailable").as_uri(),
            app_id=APP,
            flatpak_branch="stable",
            timeout_seconds=1,
        )
    assert error.value.code == "transport_error"


def test_http_collection_and_deadline(source):
    source.commit(REF, "[Context]\nfilesystems=home;\n")

    class Handler(SimpleHTTPRequestHandler):
        slow = False

        def do_GET(self):
            if self.slow and self.path.endswith("/summary"):
                time.sleep(0.2)
            super().do_GET()

    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Handler, directory=str(source.path.parent))
    )
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_port}/{source.path.name}"
        result = collect_permissions(
            url, app_id=APP, flatpak_branch="stable", timeout_seconds=10
        )
        assert result.snapshot.architectures["x86_64"]["Context"]["filesystems"] == [
            "home"
        ]
        Handler.slow = True
        with pytest.raises(PermissionSnapshotError) as error:
            collect_permissions(
                url, app_id=APP, flatpak_branch="stable", timeout_seconds=0.02
            )
        assert error.value.code == "timeout"
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def test_invalid_urls_and_timeout(source):
    for url in (
        "http://example.org/repo",
        "file://otherhost/repo",
        "https://user:pass@example.org/repo",
        "ftp://example.org/repo",
    ):
        with pytest.raises(PermissionSnapshotError) as error:
            collect_permissions(url, app_id=APP, flatpak_branch="stable")
        assert error.value.code == "invalid_input"
    with pytest.raises(PermissionSnapshotError) as error:
        collect_permissions(
            source.url, app_id=APP, flatpak_branch="stable", timeout_seconds=0
        )
    assert error.value.code == "invalid_input"


def summary_subset(source, arch):
    summary = GLib.Variant.new_from_bytes(
        ostree_permissions.SUMMARY_TYPE,
        GLib.Bytes.new((source.path / "summary").read_bytes()),
        False,
    )
    entries = summary.get_child_value(0)
    children = [
        entries.get_child_value(i)
        for i in range(entries.n_children())
        if entries.get_child_value(i).get_child_value(0).get_string().split("/")[2]
        == arch
    ]
    subset = GLib.Variant.new_tuple(
        GLib.Variant.new_array(GLib.VariantType.new("(s(taya{sv}))"), children),
        summary.get_child_value(1),
    )
    return subset.get_data_as_bytes().get_data()


def write_summary_index(source, subsummaries):
    (source.path / "summaries").mkdir(exist_ok=True)
    digests = {}
    for name, data in subsummaries.items():
        digest = hashlib.sha256(data).hexdigest()
        (source.path / "summaries" / f"{digest}.gz").write_bytes(gzip.compress(data))
        digests[name] = digest
    index = GLib.Variant(
        "(a{s(ayaaya{sv})}a{sv})",
        ({name: (bytes.fromhex(d), [], {}) for name, d in digests.items()}, {}),
    )
    (source.path / "summary.idx").write_bytes(index.get_data_as_bytes().get_data())
    return digests


@pytest.fixture
def indexed_source(source):
    x86 = source.commit(REF, "[Context]\nfilesystems=home;\n")
    arm = source.commit(ARM, "[Context]\nfilesystems=home:ro;\n")
    subsummaries = {
        "x86_64": summary_subset(source, "x86_64"),
        "aarch64": summary_subset(source, "aarch64"),
    }
    (source.path / "summary").write_bytes(subsummaries["x86_64"])
    return source, x86, arm, subsummaries


def test_summary_index_lists_every_architecture(indexed_source):
    source, x86, arm, subsummaries = indexed_source
    digests = write_summary_index(
        source, {**subsummaries, "floss-aarch64": b"never fetched"}
    )
    (source.path / "summaries" / f"{digests['floss-aarch64']}.gz").unlink()

    published = collect(source)
    assert [(a.arch, a.commit) for a in published.artifacts] == [
        ("aarch64", arm),
        ("x86_64", x86),
    ]
    assert published.snapshot.architectures["aarch64"]["Context"]["filesystems"] == [
        "home:ro"
    ]
    assert fingerprints(candidate(source, x86, arm).snapshot) == fingerprints(
        published.snapshot
    )


def test_legacy_summary_without_index_misses_architectures(indexed_source):
    source, x86, _, _ = indexed_source
    published = collect(source)
    assert [(a.arch, a.commit) for a in published.artifacts] == [("x86_64", x86)]


def test_summary_index_rejects_unverifiable_subsummaries(indexed_source):
    source, _, _, subsummaries = indexed_source
    digests = write_summary_index(source, subsummaries)
    path = source.path / "summaries" / f"{digests['aarch64']}.gz"
    path.write_bytes(gzip.compress(subsummaries["x86_64"]))
    with pytest.raises(PermissionSnapshotError) as error:
        collect(source)
    assert error.value.code == "invalid_summary"

    path.unlink()
    with pytest.raises(PermissionSnapshotError) as error:
        collect(source)
    assert error.value.code == "transport_error"


OTHER = "org.example.Other"
BROKEN = "org.example.Broken"


@pytest.fixture
def published_source(source):
    commits = {
        REF: source.commit(REF, "[Context]\nshared=network;\n"),
        ARM: source.commit(ARM, "[Context]\nshared=ipc;\n"),
        f"app/{APP}/x86_64/24.08": source.commit(
            f"app/{APP}/x86_64/24.08", "[Context]\nsockets=x11;\n"
        ),
        f"app/{OTHER}/x86_64/stable": source.commit(
            f"app/{OTHER}/x86_64/stable", "[Context]\ndevices=dri;\n", name=OTHER
        ),
        f"app/{BROKEN}/x86_64/stable": source.commit(
            f"app/{BROKEN}/x86_64/stable", None, name=BROKEN
        ),
    }
    source.commit(f"runtime/{APP}.Locale/x86_64/stable", "", name=f"{APP}.Locale")
    return source, commits


def summarize(result):
    return {
        (item.app_id, item.flatpak_branch): {
            arch: permissions["Context"]
            for arch, permissions in item.snapshot.architectures.items()
        }
        for item in result.collected
    }


@pytest.mark.parametrize("batch_size", [1, 2, 200])
def test_published_permissions_cover_every_app_and_branch(published_source, batch_size):
    source, commits = published_source
    result = collect_published_permissions(
        source.url, batch_size=batch_size, timeout_seconds=10
    )
    assert summarize(result) == {
        (APP, "24.08"): {"x86_64": {"sockets": ["x11"]}},
        (APP, "stable"): {
            "aarch64": {"shared": ["ipc"]},
            "x86_64": {"shared": ["network"]},
        },
        (OTHER, "stable"): {"x86_64": {"devices": ["dri"]}},
    }
    stable = next(
        item
        for item in result.collected
        if (item.app_id, item.flatpak_branch) == (APP, "stable")
    )
    assert [(a.arch, a.commit) for a in stable.artifacts] == [
        ("aarch64", commits[ARM]),
        ("x86_64", commits[REF]),
    ]
    assert stable.captured_at == result.captured_at
    assert [(f.app_id, f.flatpak_branch, f.code) for f in result.failures] == [
        (BROKEN, "stable", "missing_metadata")
    ]


def test_published_permissions_filter_app_ids(published_source):
    source, _ = published_source
    result = collect_published_permissions(
        source.url, app_ids={OTHER}, timeout_seconds=10
    )
    assert list(summarize(result)) == [(OTHER, "stable")]
    assert result.failures == ()


def test_unavailable_commit_fails_only_its_app(published_source, monkeypatch):
    source, _ = published_source
    list_refs = ostree_permissions._list_remote_refs

    def unavailable(repo, cancellable):
        refs = list_refs(repo, cancellable)
        refs[f"app/{OTHER}/x86_64/stable"] = "a" * 64
        return refs

    monkeypatch.setattr(ostree_permissions, "_list_remote_refs", unavailable)
    result = collect_published_permissions(source.url, timeout_seconds=10)
    assert (APP, "stable") in summarize(result)
    assert (OTHER, "stable") not in summarize(result)
    assert [(f.app_id, f.code) for f in result.failures] == [
        (BROKEN, "missing_metadata"),
        (OTHER, "transport_error"),
    ]


def test_invalid_published_checksum_fails_its_app(published_source, monkeypatch):
    source, _ = published_source
    list_refs = ostree_permissions._list_remote_refs

    def invalid(repo, cancellable):
        refs = list_refs(repo, cancellable)
        refs[f"app/{OTHER}/x86_64/stable"] = "bad"
        return refs

    monkeypatch.setattr(ostree_permissions, "_list_remote_refs", invalid)
    result = collect_published_permissions(
        source.url, app_ids={OTHER}, timeout_seconds=10
    )
    assert result.collected == ()
    assert [(f.app_id, f.code) for f in result.failures] == [
        (OTHER, "checksum_mismatch")
    ]


def test_published_permissions_use_summary_index(indexed_source):
    source, x86, arm, subsummaries = indexed_source
    write_summary_index(source, subsummaries)
    result = collect_published_permissions(source.url, timeout_seconds=10)
    assert [(a.arch, a.commit) for a in result.collected[0].artifacts] == [
        ("aarch64", arm),
        ("x86_64", x86),
    ]


@pytest.mark.parametrize(
    "kwargs",
    [
        {"batch_size": 0},
        {"batch_size": True},
        {"timeout_seconds": 0},
        {"app_ids": {"a/b"}},
    ],
)
def test_published_permissions_reject_invalid_inputs(source, kwargs):
    with pytest.raises(PermissionSnapshotError) as error:
        collect_published_permissions(source.url, **kwargs)
    assert error.value.code == "invalid_input"


def test_published_permissions_listing_failure(tmp_path):
    with pytest.raises(PermissionSnapshotError) as error:
        collect_published_permissions(
            (tmp_path / "unavailable").as_uri(), timeout_seconds=1
        )
    assert error.value.code == "transport_error"
