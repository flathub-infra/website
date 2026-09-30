import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

import pytest

from app.moderation import ostree_permissions
from app.moderation.ostree_permissions import collect_permissions
from app.moderation.permission_snapshot import (
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
