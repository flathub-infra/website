"""Check ambiguous install ordering against the published Flatpak files."""

import os
import re
import subprocess
import sys
import tempfile
from threading import Timer

import gi
import httpx

gi.require_version("OSTree", "1.0")
from gi.repository import Gio, GLib, OSTree  # type: ignore

from . import config, http_client
from .metadata_translations import MetadataError


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
    if not re.fullmatch(r"/app/share/(?:metainfo|appdata)/[\w.-]+\.xml", destination):
        return False
    path = "/files/" + destination.removeprefix("/app/")
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
                            "subdirs": GLib.Variant("as", [path]),
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
                    file = root.resolve_relative_path(path.lstrip("/"))
                    try:
                        info = file.query_info(
                            "standard::type,standard::size",
                            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
                            cancel,
                        )
                        if (
                            info.get_file_type() != Gio.FileType.REGULAR
                            or info.get_size() != len(content)
                        ):
                            return False
                        stream = file.read(cancel)
                        try:
                            offset = 0
                            while offset < len(content):
                                chunk = stream.read_bytes(
                                    len(content) - offset, cancel
                                ).get_data()
                                if not chunk or not content.startswith(chunk, offset):
                                    return False
                                offset += len(chunk)
                        finally:
                            stream.close(cancel)
                    except GLib.Error as error:
                        if error.matches(
                            Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND
                        ):
                            return False
                        raise
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
