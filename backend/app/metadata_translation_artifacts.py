"""Check ambiguous install ordering against the published Flatpak files."""

import os
import re
import subprocess
import sys
import tempfile
from threading import Timer

import gi
import httpx
from lxml import etree

gi.require_version("OSTree", "1.0")
from gi.repository import Gio, GLib, OSTree  # type: ignore

from . import config, http_client
from .metadata_translations import MAX_XML_BYTES, MetadataError


def is_listing_destination(path: str) -> bool:
    return (
        re.fullmatch(r"/app/share/(?:metainfo|appdata)/[\w.-]+\.xml", path) is not None
    )


def _same_listing(source: bytes, installed: bytes) -> bool:
    if source == installed:
        return True

    def canonical(xml):
        root = etree.fromstring(
            xml,
            etree.XMLParser(
                resolve_entities=False, no_network=True, remove_comments=True
            ),
        )
        if root.getroottree().docinfo.doctype:
            raise ValueError
        # Only strip indentation in AppStream containers, never mixed content
        # such as a paragraph containing inline markup.
        for node in root.iter(
            "component",
            "description",
            "ul",
            "ol",
            "releases",
            "release",
            "screenshots",
            "screenshot",
            "keywords",
            "categories",
            "provides",
            "branding",
            "content_rating",
            "developer",
            "recommends",
            "requires",
            "supports",
            "custom",
            "artifacts",
            "artifact",
            "issues",
            "languages",
            "mimetypes",
            "kudos",
            "suggests",
            "replaces",
            "tags",
            "references",
            "agreement",
            "agreement_section",
        ):
            if not len(node) or any(
                parent.get("{http://www.w3.org/XML/1998/namespace}space") == "preserve"
                for parent in (node, *node.iterancestors())
            ):
                continue
            if node.text and not node.text.strip(" \t\r\n"):
                node.text = None
            for child in node:
                if child.tail and not child.tail.strip(" \t\r\n"):
                    child.tail = None
        return etree.tostring(root, method="c14n", with_comments=False)

    try:
        return canonical(source) == canonical(installed)
    except (etree.LxmlError, ValueError):
        return False


class PublishedListingUnavailable(MetadataError):
    pass


def published_listing_matches(
    app_id: str,
    revision: str,
    destination: str,
    content: bytes,
    *,
    kind: str = "app",
    branch: str = "stable",
) -> bool:
    # A libostree pull can crash in native error handling. Keep a failed
    # verification from terminating a queue worker or API process.
    try:
        with tempfile.TemporaryDirectory() as tmp:
            result = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    __name__,
                    config.settings.repo_url,
                    app_id,
                    revision,
                    destination,
                    kind,
                    branch,
                ],
                input=content,
                timeout=40,
                check=False,
                env={**os.environ, "TMPDIR": tmp},
            )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise PublishedListingUnavailable("published_listing_unavailable") from error
    if result.returncode not in (0, 3):
        raise PublishedListingUnavailable("published_listing_unavailable")
    return result.returncode == 0


def _check_published_listing(
    url: str,
    app_id: str,
    revision: str,
    destination: str,
    content: bytes,
    kind: str,
    branch: str,
) -> bool:
    if not is_listing_destination(destination):
        return False
    paths = ["/files/" + destination.removeprefix("/app/")]
    if destination == f"/app/share/appdata/{app_id}.appdata.xml":
        paths.append(f"/files/share/metainfo/{app_id}.metainfo.xml")
    url = url.rstrip("/")
    try:
        commits = {}
        for arch in ("x86_64", "aarch64"):
            ref = f"{kind}/{app_id}/{arch}/{branch}"
            response = http_client.get(f"{url}/refs/heads/{ref}", timeout=5)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            checksum = response.text.strip()
            if not re.fullmatch(r"[0-9a-f]{64}", checksum):
                raise PublishedListingUnavailable("published_listing_unavailable")
            commits[ref] = checksum
        if not commits:
            return False
        with tempfile.TemporaryDirectory() as tmp:
            cancel = Gio.Cancellable()
            timer = Timer(20, cancel.cancel)
            timer.daemon = True
            timer.start()
            try:
                repo = OSTree.Repo.new(Gio.File.new_for_path(tmp))
                repo.create(OSTree.RepoMode.BARE_USER_ONLY, cancel)
                repo.remote_add(
                    "published",
                    url,
                    GLib.Variant(
                        "a{sv}",
                        {
                            "gpg-verify": GLib.Variant("b", False),
                        },
                    ),
                    cancel,
                )
                repo.pull_with_options(
                    "published",
                    GLib.Variant(
                        "a{sv}",
                        {
                            "refs": GLib.Variant("as", list(commits.values())),
                            "subdirs": GLib.Variant("as", paths),
                            "disable-static-deltas": GLib.Variant("b", True),
                            "http-headers": GLib.Variant(
                                "a(ss)", [("User-Agent", "flathub-backend")]
                            ),
                        },
                    ),
                    None,
                    cancel,
                )
                for ref, checksum in commits.items():
                    _, commit, _ = repo.load_commit(checksum)
                    bindings = commit.get_child_value(0).lookup_value(
                        "ostree.ref-binding", GLib.VariantType.new("as")
                    )
                    if not bindings or ref not in bindings.unpack():
                        return False
                    subject = commit.get_child_value(3).get_string()
                    if not subject.endswith(f" ({revision[:12]})"):
                        return False
                    _, root, _ = repo.read_commit(checksum, cancel)
                    found = False
                    for path in paths:
                        file = root.resolve_relative_path(path.lstrip("/"))
                        try:
                            info = file.query_info(
                                "standard::type,standard::size",
                                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                                cancel,
                            )
                        except GLib.Error as error:
                            if error.matches(
                                Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND
                            ):
                                continue
                            raise
                        if (
                            info.get_file_type() != Gio.FileType.REGULAR
                            or info.get_size() > MAX_XML_BYTES
                        ):
                            return False
                        stream = file.read(cancel)
                        try:
                            data = bytearray()
                            while len(data) < info.get_size():
                                chunk = stream.read_bytes(
                                    info.get_size() - len(data), cancel
                                )
                                if not chunk.get_size():
                                    return False
                                data.extend(chunk.get_data())
                        finally:
                            stream.close(cancel)
                        if not _same_listing(content, bytes(data)):
                            return False
                        found = True
                    if not found:
                        return False
            finally:
                timer.cancel()
        return True
    except (httpx.HTTPError, GLib.Error) as error:
        raise PublishedListingUnavailable("published_listing_unavailable") from error


if __name__ == "__main__":
    url, app_id, revision, destination, kind, branch = sys.argv[1:]
    try:
        matches = _check_published_listing(
            url, app_id, revision, destination, sys.stdin.buffer.read(), kind, branch
        )
    except PublishedListingUnavailable:
        sys.exit(1)
    sys.exit(0 if matches else 3)
