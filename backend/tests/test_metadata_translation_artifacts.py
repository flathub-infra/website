from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from types import SimpleNamespace

import pytest

from app import metadata_translation_artifacts as artifacts
from app.metadata_translation_artifacts import Gio, GLib, OSTree


@pytest.mark.parametrize(
    "xml",
    [
        b"<description><p><em>one</em> <em>two</em></p></description>",
        b'<description xml:space="preserve"><p>one</p> <p>two</p></description>',
    ],
)
def test_meaningful_whitespace_must_match(xml):
    assert not artifacts._same_listing(xml, xml.replace(b"> <", b"><"))


def test_native_verifier_failure_is_retryable(monkeypatch):
    monkeypatch.setattr(
        artifacts.subprocess,
        "run",
        lambda *args, **kwargs: SimpleNamespace(returncode=-11),
    )
    with pytest.raises(artifacts.PublishedListingUnavailable):
        artifacts.published_listing_matches(
            "org.example.App",
            "a" * 40,
            "/app/share/metainfo/org.example.App.xml",
            b"<component/>",
        )


def test_formatting_around_custom_values_is_not_part_of_the_value():
    compact = (
        b'<component><custom><value key="example">yes</value></custom></component>'
    )
    formatted = compact.replace(b"><value", b">\n  <value").replace(
        b"></custom", b">\n</custom"
    )
    assert artifacts._same_listing(compact, formatted)
    assert not artifacts._same_listing(compact, formatted.replace(b"yes", b" yes"))


@pytest.mark.parametrize("legacy", [False, True])
@pytest.mark.parametrize(("kind", "branch"), [("app", "stable"), ("runtime", "25.08")])
def test_requires_matching_published_revision_and_xml_on_every_arch(
    tmp_path, monkeypatch, kind, branch, legacy
):
    app = "org.example.App"
    revision = "abc123" * 6 + "abcd"
    destination = (
        f"/app/share/appdata/{app}.appdata.xml"
        if legacy
        else f"/app/share/metainfo/{app}.metainfo.xml"
    )
    repo_dir = tmp_path / "repo"
    repo = OSTree.Repo.new(Gio.File.new_for_path(str(repo_dir)))
    repo.create(OSTree.RepoMode.ARCHIVE, None)
    tree = tmp_path / "tree"
    xml = tree / f"files/share/metainfo/{app}.metainfo.xml"
    xml.parent.mkdir(parents=True)

    def publish(arch, git_revision, content):
        ref = f"{kind}/{app}/{arch}/{branch}"
        xml.write_bytes(content)
        mtree = OSTree.MutableTree.new()
        repo.write_directory_to_mtree(
            Gio.File.new_for_path(str(tree)), mtree, None, None
        )
        _, root = repo.write_mtree(mtree, None)
        metadata = GLib.Variant(
            "a{sv}", {"ostree.ref-binding": GLib.Variant("as", [ref])}
        )
        _, commit = repo.write_commit(
            None, f"Build ({git_revision[:12]})", None, metadata, root, None
        )
        repo.set_ref_immediate(None, ref, commit, None)
        repo.regenerate_summary(None, None)

    source = b'<!-- Copyright --><component><summary>"App"</summary><branding><color>#000000</color></branding></component>\n'
    installed = b"<component>\n  <summary>&quot;App&quot;</summary>\n  <branding>\n    <color>#000000</color>\n  </branding>\n</component>"
    publish("x86_64", revision, installed)
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(repo_dir))
    )
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        monkeypatch.setattr(
            artifacts.config.settings,
            "repo_url",
            f"http://127.0.0.1:{server.server_port}",
        )

        def matches():
            return artifacts.published_listing_matches(
                app, revision, destination, source, kind=kind, branch=branch
            )

        assert matches()
        publish("aarch64", revision, installed.replace(b"App", b"Plugin"))
        assert not matches()
        publish("aarch64", "0" * 40, installed)
        assert not matches()
        publish("aarch64", revision, installed)
        assert matches()
    finally:
        server.shutdown()
        thread.join()
        server.server_close()
