import bz2
import gzip
import hashlib
import hmac
import http.client
import io
import ipaddress
import logging
import lzma
import os
import posixpath
import re
import shutil
import socket
import ssl
import stat
import tarfile
import tempfile
import time
import zipfile
from collections.abc import Iterable, Mapping
from contextlib import suppress
from dataclasses import dataclass, field
from pathlib import Path
from typing import IO, Any, Self, cast
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

from ..types import JSONObject, JSONValue

logger = logging.getLogger(__name__)

MAX_READ_LINES = 150
MAX_LINE_CHARS = 500
MAX_SEARCH_HITS = 30
MAX_SEARCH_OUTPUT_CHARS = 24 * 1024
MAX_LISTED = 20
MAX_DETAIL_CHARS = 800
MAX_IDENTITY_CHARS = 300
MAX_MODULES = 1000
MAX_NESTING = 32
MAX_MODULE_SOURCES = 500
MAX_MODULE_DOWNLOADS = 50
MAX_DOWNLOAD_URLS = 8
MAX_REDIRECTS = 5
DOWNLOAD_MAX_BYTES = 100 * 1024 * 1024
EXTRACTED_MAX_BYTES = 512 * 1024 * 1024
MAX_FILES = 20000
DOWNLOAD_TIMEOUT_SECONDS = 180
READ_MAX_BYTES = 2 * 1024 * 1024
SEARCH_MAX_BYTES = 20 * 1024 * 1024
SEARCH_MAX_FILES = 500
TAR_HEADER_LIMITS = {
    tarfile.GNUTYPE_LONGNAME: 64 * 1024,
    tarfile.GNUTYPE_LONGLINK: 64 * 1024,
    tarfile.XHDTYPE: 64 * 1024,
    tarfile.SOLARIS_XHDTYPE: 64 * 1024,
    tarfile.XGLTYPE: 8 * 1024,
}
MAX_TAR_HEADER_DEPTH = 4
MAX_TAR_GLOBAL_RECORDS = 256
NAT64 = ipaddress.ip_network("64:ff9b::/96")
USER_AGENT = "flathub-permission-triage"
HEX = re.compile(r"^[0-9a-fA-F]+$")
FULL_COMMIT = re.compile(r"^[0-9a-fA-F]{40}$")
SCP_GIT_URL = re.compile(r"^(?P<user>[A-Za-z0-9._-]+)@(?P<host>[^/:]+):(?P<path>.+)$")
DRIVE_PATH = re.compile(r"^[A-Za-z]:")
DIGEST_SPECS = (
    ("sha512", 128),
    ("sha256", 64),
    ("sha1", 40),
    ("md5", 32),
)
UNSUPPORTED_MAGIC = (
    (b"7z\xbc\xaf\x27\x1c", "7z"),
    (b"Rar!\x1a\x07", "rar"),
    (b"LZIP", "lzip"),
    (b"\x04\x22\x4d\x18", "lz4"),
    (b"\x1f\x9d", "compress"),
    (b"\x28\xb5\x2f\xfd", "zstd"),
)
GITLAB_HOSTS = {
    "invent.kde.org",
    "salsa.debian.org",
    "framagit.org",
    "gitlab.com",
    "gitlab.freedesktop.org",
    "gitlab.gnome.org",
}
STATUS_ORDER = {"error": 0, "not materialized": 1, "ok": 2}


class _SourceError(Exception):
    pass


class _NotMaterialized(Exception):
    pass


@dataclass
class _File:
    path: Path
    source: str
    size: int
    binary: bool


@dataclass
class _Result:
    identity: str
    status: str
    detail: str


@dataclass
class _Module:
    name: str
    index: int
    sources: list[JSONValue] = field(default_factory=list)
    files: dict[str, _File] = field(default_factory=dict)
    results: list[_Result] = field(default_factory=list)
    prepared: bool = False


@dataclass
class _ArchiveStats:
    entries: int = 0
    files: int = 0
    bytes: int = 0


def _clean(value: object) -> str:
    return str(value).replace("\r", " ").replace("\n", " ")


def _truncate(value: str, limit: int) -> str:
    if len(value) <= limit:
        return value
    if limit <= 3:
        return value[:limit]
    return value[: limit - 3] + "..."


def _safe_parts(value: str, allow_empty: bool = False) -> list[str]:
    if not value and not allow_empty:
        raise _SourceError("path is empty")
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise _SourceError("path contains control characters")
    text = value.replace("\\", "/")
    if text.startswith("/") or DRIVE_PATH.match(text):
        raise _SourceError(f"absolute path is not allowed: {value}")
    parts = [part for part in text.split("/") if part not in ("", ".")]
    if any(part == ".." for part in parts):
        raise _SourceError(f"path escapes its root: {value}")
    if not parts and not allow_empty:
        raise _SourceError("path is empty")
    return parts


def _safe_relpath(value: str, allow_empty: bool = False) -> str:
    return "/".join(_safe_parts(value, allow_empty=allow_empty))


def _strip_parts(name: str, strip: int) -> list[str]:
    _safe_parts(name, allow_empty=True)
    components = [part for part in name.replace("\\", "/").split("/") if part]
    return _safe_parts("/".join(components[strip:]), allow_empty=True)


def _url_filename(url: str) -> str:
    try:
        path = urlsplit(url).path
    except ValueError:
        path = ""
    name = posixpath.basename(unquote(path).rstrip("/"))
    if not name or name in {".", ".."}:
        return "download"
    return name


def _dest_dir(source: JSONObject) -> str:
    dest = source.get("dest")
    if dest is None:
        return ""
    if not isinstance(dest, str):
        raise _SourceError("dest must be text")
    return _safe_relpath(dest, allow_empty=True)


def _dest_path(source: JSONObject, default_name: str) -> str:
    name = source.get("dest-filename", default_name)
    if not isinstance(name, str) or not name:
        raise _SourceError("dest-filename must be non-empty text")
    dest = _dest_dir(source)
    relpath = _safe_relpath(name)
    return f"{dest}/{relpath}" if dest else relpath


def _int_field(source: JSONObject, name: str, default: int) -> int:
    value = source.get(name, default)
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise _SourceError(f"{name} must be an integer")
    try:
        result = int(value)
    except ValueError as err:
        raise _SourceError(f"{name} must be an integer") from err
    if result < 0:
        raise _SourceError(f"{name} must not be negative")
    return result


def _hash_data(algorithm: str, data: bytes) -> str:
    return hashlib.new(algorithm, data, usedforsecurity=False).hexdigest()


def _declared_digests(source: JSONObject) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    for algorithm, length in DIGEST_SPECS:
        value = source.get(algorithm)
        if value is None:
            continue
        if not isinstance(value, str):
            raise _SourceError(f"{algorithm} digest must be text")
        normalized = value.strip().lower()
        if len(normalized) != length or not HEX.fullmatch(normalized):
            raise _SourceError(f"invalid {algorithm} digest")
        result.append((algorithm, normalized))
    return result


def _verify_digests(data: bytes, digests: list[tuple[str, str]]) -> None:
    for algorithm, expected in digests:
        actual = _hash_data(algorithm, data)
        if not hmac.compare_digest(actual, expected):
            raise _SourceError(
                f"{algorithm} digest mismatch: expected {expected}, got {actual}"
            )


def _source_type(source: JSONObject) -> str:
    value = source.get("type")
    return value.lower() if isinstance(value, str) else ""


def _fetches(source: JSONObject) -> bool:
    kind = _source_type(source)
    url = source.get("url")
    return kind in {"git", "archive"} or (
        kind == "file" and isinstance(url, str) and bool(url)
    )


def _redact_url(url: str) -> str:
    try:
        parts = urlsplit(url)
    except ValueError:
        return url
    if parts.username is None and parts.password is None:
        return url
    host = parts.hostname or ""
    try:
        port = parts.port
    except ValueError:
        port = None
    if port:
        host = f"{host}:{port}"
    return urlunsplit((parts.scheme, host, parts.path, parts.query, parts.fragment))


def _identity(source: JSONObject) -> str:
    kind = _clean(_source_type(source) or "source")
    url = source.get("url")
    path = source.get("path")
    commit = source.get("commit")
    if isinstance(url, str) and url:
        if kind == "git" and isinstance(commit, str):
            return f"git {_redact_url(url)}@{commit.lower()}"
        return f"{kind} {_redact_url(url)}"
    if isinstance(path, str) and path:
        return f"{kind} {path}"
    return kind


def _mirror_urls(source: JSONObject) -> list[str]:
    mirrors = source.get("mirror-urls")
    if mirrors is None:
        return []
    if isinstance(mirrors, str):
        mirrors = [mirrors]
    if not isinstance(mirrors, list):
        raise _SourceError("mirror-urls must be a list")
    return [mirror for mirror in mirrors if isinstance(mirror, str) and mirror]


class _PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host: str, port: int, ip: str, timeout: float) -> None:
        super().__init__(host, port, timeout=timeout)
        self._ip = ip
        self.stream: socket.socket | None = None

    def connect(self) -> None:
        self.sock = socket.create_connection((self._ip, self.port), self.timeout)
        self.stream = self.sock


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(
        self,
        host: str,
        port: int,
        ip: str,
        timeout: float,
        context: ssl.SSLContext,
    ) -> None:
        super().__init__(host, port, timeout=timeout, context=context)
        self._ip = ip
        self._ssl_context = context
        self.stream: socket.socket | None = None

    def connect(self) -> None:
        raw = socket.create_connection((self._ip, self.port), self.timeout)
        try:
            self.sock = self._ssl_context.wrap_socket(raw, server_hostname=self.host)
        except OSError:
            raw.close()
            raise
        self.stream = self.sock


class _LimitedReader:
    def __init__(self, raw: io.BufferedIOBase, limit: int) -> None:
        self._raw = raw
        self._limit = limit
        self._position = 0

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = 65536
        data = self._raw.read(size)
        self._position += len(data)
        if self._position > self._limit:
            raise _SourceError("decompressed archive exceeds the configured limit")
        return data

    def close(self) -> None:
        self._raw.close()


def _validate_download_url(url: str) -> tuple[str, str, int]:
    if any(ord(character) < 32 or ord(character) == 127 for character in url):
        raise _SourceError("URL contains control characters")
    try:
        parts = urlsplit(url)
    except ValueError as err:
        raise _SourceError(f"invalid URL: {url}") from err
    scheme = parts.scheme.lower()
    if scheme not in {"http", "https"}:
        raise _SourceError(f"unsupported URL scheme: {parts.scheme or '(none)'}")
    if parts.username is not None or parts.password is not None:
        raise _SourceError("URL credentials are not allowed")
    if "\\" in parts.netloc:
        raise _SourceError("URL has an invalid host")
    host = parts.hostname
    if not host:
        raise _SourceError("URL has no host")
    try:
        port = parts.port or (443 if scheme == "https" else 80)
    except ValueError as err:
        raise _SourceError("URL has an invalid port") from err
    if not 1 <= port <= 65535:
        raise _SourceError("URL has an invalid port")
    return scheme, host.lower(), port


def _public_ip(host: str, port: int) -> str:
    try:
        literal = ipaddress.ip_address(host)
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except (OSError, UnicodeError) as err:
            raise _SourceError(f"could not resolve host {host}: {err}") from err
        raw_addresses = [str(info[4][0]) for info in infos]
    else:
        raw_addresses = [str(literal)]
    addresses: list[str] = []
    for raw in raw_addresses:
        try:
            address = ipaddress.ip_address(raw.split("%")[0])
        except ValueError as err:
            raise _SourceError(f"host {host} returned an invalid address") from err
        if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
            address = address.ipv4_mapped
        embedded = (
            ipaddress.IPv4Address(int(address) & 0xFFFFFFFF)
            if address in NAT64
            else address
        )
        if not embedded.is_global:
            raise _SourceError(f"host {host} resolves to non-public address {address}")
        addresses.append(str(address))
    if not addresses:
        raise _SourceError(f"host {host} did not resolve")
    return addresses[0]


def _request_target(url: str) -> str:
    parts = urlsplit(url)
    target = parts.path or "/"
    if parts.query:
        target = f"{target}?{parts.query}"
    return target


def _set_socket_timeout(stream: socket.socket | None, deadline: float) -> None:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise _SourceError("download timed out")
    if stream is not None:
        stream.settimeout(remaining)


def _http_get(url: str, max_bytes: int, timeout: float) -> bytes:
    deadline = time.monotonic() + timeout
    current = url
    for redirects in range(MAX_REDIRECTS + 1):
        scheme, host, port = _validate_download_url(current)
        ip = _public_ip(host, port)
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise _SourceError("download timed out")
        connection: _PinnedHTTPConnection | _PinnedHTTPSConnection
        if scheme == "https":
            connection = _PinnedHTTPSConnection(
                host, port, ip, remaining, ssl.create_default_context()
            )
        else:
            connection = _PinnedHTTPConnection(host, port, ip, remaining)
        response: http.client.HTTPResponse | None = None
        try:
            try:
                connection.request(
                    "GET",
                    _request_target(current),
                    headers={
                        "User-Agent": USER_AGENT,
                        "Accept-Encoding": "identity",
                        "Connection": "close",
                    },
                )
                _set_socket_timeout(connection.stream, deadline)
                response = connection.getresponse()
                if response.status in {301, 302, 303, 307, 308}:
                    location = response.getheader("Location")
                    if not location:
                        raise _SourceError(
                            f"HTTP {response.status} redirect without Location"
                        )
                    if redirects >= MAX_REDIRECTS:
                        raise _SourceError("too many redirects")
                    current = urljoin(current, location)
                    continue
                if response.status != 200:
                    raise _SourceError(f"HTTP {response.status} from {host}")
                length = response.getheader("Content-Length")
                expected = int(length) if length and length.isdigit() else None
                if expected is not None and expected > max_bytes:
                    raise _SourceError(f"download exceeds {max_bytes} bytes")
                chunks: list[bytes] = []
                total = 0
                while not response.isclosed():
                    _set_socket_timeout(connection.stream, deadline)
                    chunk = response.read1(65536)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_bytes:
                        raise _SourceError(f"download exceeds {max_bytes} bytes")
                    chunks.append(chunk)
                if expected is not None and total != expected:
                    raise _SourceError(f"download from {host} is incomplete")
                return b"".join(chunks)
            except _SourceError:
                raise
            except (OSError, http.client.HTTPException, ValueError) as err:
                raise _SourceError(f"download from {host} failed: {err}") from err
        finally:
            if response is not None:
                response.close()
            connection.close()
    raise _SourceError("too many redirects")


def _fetch(urls: list[str], digests: list[tuple[str, str]]) -> tuple[bytes, str]:
    attempts: list[str] = []
    for url in urls[:MAX_DOWNLOAD_URLS]:
        try:
            data = _http_get(url, DOWNLOAD_MAX_BYTES, DOWNLOAD_TIMEOUT_SECONDS)
            _verify_digests(data, digests)
        except _SourceError as err:
            if len(urls) == 1:
                raise
            attempts.append(f"{_redact_url(url)}: {err}")
            continue
        return data, _redact_url(url)
    raise _SourceError(
        "all download attempts failed: " + _truncate("; ".join(attempts), 2000)
    )


def _remote(source: JSONObject) -> tuple[bytes, str]:
    url = source.get("url")
    if not isinstance(url, str) or not url:
        raise _SourceError(f"{_source_type(source)} source requires a url")
    digests = _declared_digests(source)
    if not digests:
        raise _SourceError(
            "remote archive or file source has no digest "
            "(sha256/sha512/sha1/md5); refusing mutable content"
        )
    return _fetch([url, *_mirror_urls(source)], digests)


def _git_components(url: str) -> tuple[str, list[str]]:
    value = url.strip()
    match = SCP_GIT_URL.match(value)
    if match and "://" not in value:
        host, path = match.group("host"), match.group("path")
    else:
        try:
            parts = urlsplit(value)
            host, path = parts.hostname or "", parts.path
        except ValueError as err:
            raise _SourceError(f"invalid git URL: {value}") from err
    segments = _safe_parts(unquote(path).strip("/").removesuffix(".git"))
    if len(segments) < 2:
        raise _SourceError("git URL must name a repository")
    return host.lower(), segments


def _forge_archive_url(host: str, parts: list[str], commit: str) -> str:
    label = host.removeprefix("www.")
    quoted = "/".join(quote(part, safe="") for part in parts)
    repo = quote(parts[-1], safe="")
    if label == "github.com":
        if len(parts) != 2:
            raise _SourceError("GitHub git URL must be owner/repo")
        return f"https://codeload.github.com/{quoted}/tar.gz/{commit}"
    if label == "codeberg.org":
        return f"https://{label}/{quoted}/archive/{commit}.tar.gz"
    if label in GITLAB_HOSTS:
        return f"https://{label}/{quoted}/-/archive/{commit}/{repo}-{commit}.tar.gz"
    raise _SourceError(f"git host {host} has no supported pinned archive URL")


def _git_archive_urls(candidates: list[str], commit: str) -> list[str]:
    urls: list[str] = []
    errors: list[str] = []
    for candidate in candidates:
        try:
            host, parts = _git_components(candidate)
            urls.append(_forge_archive_url(host, parts, commit))
        except _SourceError as err:
            errors.append(f"{_redact_url(candidate)}: {err}")
    if not urls:
        raise _SourceError("; ".join(errors))
    return list(dict.fromkeys(urls))


def _is_binary(data: bytes) -> bool:
    return b"\x00" in data[:8192]


def _compression_magic(data: bytes) -> str:
    if data[:4] in {b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"}:
        return "zip"
    if data[:2] == b"\x1f\x8b":
        return "gzip"
    if data[:3] == b"BZh":
        return "bz2"
    if data[:6] == b"\xfd7zXZ\x00":
        return "xz"
    return "none"


def _archive_format(data: bytes) -> str:
    for magic, name in UNSUPPORTED_MAGIC:
        if data.startswith(magic):
            raise _SourceError(f"unsupported archive type: {name}")
    return "zip" if _compression_magic(data) == "zip" else "tar"


def _tar_reader(data: bytes) -> io.BufferedIOBase:
    magic = _compression_magic(data)
    stream = io.BytesIO(data)
    if magic == "gzip":
        return gzip.GzipFile(fileobj=stream)
    if magic == "bz2":
        return bz2.BZ2File(stream)
    if magic == "xz":
        return lzma.LZMAFile(stream)
    return stream


class _StreamTarFile(tarfile.TarFile):
    members: list[tarfile.TarInfo]
    header_depth = 0

    def next(self) -> tarfile.TarInfo | None:
        member = super().next()
        self.members.clear()
        if len(self.pax_headers) > MAX_TAR_GLOBAL_RECORDS:
            raise _SourceError("archive header is too large")
        return member


class _GuardedTarInfo(tarfile.TarInfo):
    def _proc_member(self, archive: _StreamTarFile) -> tarfile.TarInfo:
        if self.type == tarfile.GNUTYPE_SPARSE:
            raise _SourceError("sparse archive members are unsupported")
        limit = TAR_HEADER_LIMITS.get(self.type)
        if limit is None:
            return cast("Any", super())._proc_member(archive)
        if self.size > limit or archive.header_depth >= MAX_TAR_HEADER_DEPTH:
            raise _SourceError("archive header is too large")
        archive.header_depth += 1
        try:
            return cast("Any", super())._proc_member(archive)
        finally:
            archive.header_depth -= 1

    def _proc_gnusparse_10(
        self,
        following: tarfile.TarInfo,
        pax_headers: dict[str, str],
        archive: _StreamTarFile,
    ) -> None:
        raise _SourceError("sparse archive members are unsupported")


def _zip_entry_count(data: bytes) -> int:
    if len(data) < 22:
        raise _SourceError("invalid zip archive")
    first = max(0, len(data) - 22 - 65535)
    for position in range(len(data) - 22, first - 1, -1):
        if data[position : position + 4] != b"PK\x05\x06":
            continue
        comment = int.from_bytes(data[position + 20 : position + 22], "little")
        if position + 22 + comment != len(data):
            continue
        count = int.from_bytes(data[position + 10 : position + 12], "little")
        if count != 0xFFFF:
            return count
        locator = position - 20
        if locator < 0 or data[locator : locator + 4] != b"PK\x06\x07":
            raise _SourceError("zip64 archive has no valid locator")
        zip64_position = int.from_bytes(data[locator + 8 : locator + 16], "little")
        if (
            zip64_position + 56 > len(data)
            or data[zip64_position : zip64_position + 4] != b"PK\x06\x06"
        ):
            raise _SourceError("zip64 archive has no valid end record")
        return int.from_bytes(data[zip64_position + 32 : zip64_position + 40], "little")
    raise _SourceError("invalid zip archive")


def _safe_target(root: Path, relpath: str) -> Path:
    parts = _safe_parts(relpath)
    current = root
    for part in parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise _SourceError(f"path traverses a symlink: {relpath}")
        if current.exists():
            if not current.is_dir():
                raise _SourceError(f"path component is not a directory: {relpath}")
        else:
            current.mkdir(mode=0o700)
    target = current / parts[-1]
    if target.is_symlink():
        raise _SourceError(f"path is a symlink: {relpath}")
    if target.is_dir():
        raise _SourceError(f"path is a directory: {relpath}")
    return target


def _stage_hardlink(stage: Path, relpath: str, target: str) -> None:
    source = _safe_target(stage, target)
    try:
        info = source.lstat()
    except OSError as err:
        raise _SourceError(f"archive hardlink target is missing: {target}") from err
    if not stat.S_ISREG(info.st_mode):
        raise _SourceError(f"unsafe archive hardlink target: {target}")
    link = _safe_target(stage, relpath)
    link.unlink(missing_ok=True)
    os.link(source, link)


def _make_read_only(root: Path) -> None:
    with suppress(OSError):
        for current, _directories, names in os.walk(root, topdown=False):
            for name in names:
                os.chmod(os.path.join(current, name), 0o400)
            os.chmod(current, 0o500)


def _make_writable(root: Path) -> None:
    with suppress(OSError):
        os.chmod(root, 0o700)
        for current, directories, _names in os.walk(root):
            for name in directories:
                os.chmod(os.path.join(current, name), 0o700)


def _decode_lines(data: bytes) -> list[str]:
    text = data.decode("utf-8", errors="replace").replace("\x00", "\ufffd")
    lines = text.split("\n")
    if lines[-1] == "":
        lines.pop()
    return [line.removesuffix("\r") for line in lines]


def _top_directory(paths: Iterable[str]) -> str | None:
    tops = {path.partition("/")[0] if "/" in path else "" for path in paths}
    top = next(iter(tops), "")
    return top if len(tops) == 1 and top else None


def _candidates(module: _Module, path: str) -> list[str]:
    top = _top_directory(module.files)
    return [path, f"{top}/{path}"] if top else [path]


def _lookup(module: _Module, relpath: str) -> tuple[str, _File] | None:
    for candidate in _candidates(module, relpath):
        file = module.files.get(candidate)
        if file is not None:
            return candidate, file
    return None


def _in_prefix(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


def _similar(module: _Module, relpath: str) -> list[str]:
    for candidate in _candidates(module, relpath):
        inside = [path for path in module.files if _in_prefix(path, candidate)]
        if inside:
            return inside
    name = posixpath.basename(relpath)
    return [path for path in module.files if posixpath.basename(path) == name]


def _status_lines(module: _Module, problems_only: bool) -> list[str]:
    results = sorted(
        (
            result
            for result in module.results
            if not (problems_only and result.status == "ok")
        ),
        key=lambda result: STATUS_ORDER[result.status],
    )
    lines = [
        f"[{result.status}] {_truncate(_clean(result.identity), MAX_IDENTITY_CHARS)}: "
        f"{_truncate(_clean(result.detail), MAX_DETAIL_CHARS)}"
        for result in results[:MAX_LISTED]
    ]
    if len(results) > MAX_LISTED:
        lines.append(f"({len(results) - MAX_LISTED} more sources omitted)")
    return lines


def _missing(module: _Module, relpath: str) -> str:
    name = _clean(module.name)
    if not module.files:
        head = f"module {name} has no materialized files"
    else:
        similar = _similar(module, relpath)
        shown = sorted(similar or module.files)
        label = "similar paths" if similar else "available files"
        head = (
            f"{_truncate(relpath, 500)} is not a file of module {name}; "
            f"{label}: {_truncate(', '.join(shown[:MAX_LISTED]), 2000)}"
        )
        if len(shown) > MAX_LISTED:
            head += f" ({len(shown) - MAX_LISTED} more)"
    return "\n".join([head, *_status_lines(module, False)])


class SourceWorkspace:
    def __init__(self, manifest: Mapping[str, JSONValue]) -> None:
        self._modules: dict[str, _Module] = {}
        self._collect(manifest.get("modules"), 0)
        self._total_bytes = 0
        self._file_count = 0
        self._closed = False
        self._root = Path(tempfile.mkdtemp(prefix="flathub-sources-")).resolve()

    def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        _make_writable(self._root)
        shutil.rmtree(self._root, ignore_errors=True)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def modules(self) -> list[str]:
        return list(self._modules)

    def search(self, module: str, text: str, path_prefix: str = "") -> str:
        if self._closed:
            return "source workspace is closed"
        if not text:
            return "search text is empty"
        try:
            prefix = _safe_relpath(path_prefix, allow_empty=True)
        except _SourceError as err:
            return f"invalid path_prefix: {err}"
        entry = self._modules.get(module)
        if entry is None:
            return self._unknown(module)
        self._prepare(entry)
        if not entry.files:
            return _missing(entry, prefix)
        if prefix:
            for candidate in _candidates(entry, prefix):
                if any(_in_prefix(path, candidate) for path in entry.files):
                    prefix = candidate
                    break
            else:
                return (
                    f"no files under {_truncate(prefix, 500)} "
                    f"in module {_clean(entry.name)}"
                )
        needle = text.casefold()
        hits: list[str] = []
        scanned_bytes = 0
        scanned_files = 0
        unreadable = 0
        stop = ""
        for relpath, file in entry.files.items():
            if file.binary or (prefix and not _in_prefix(relpath, prefix)):
                continue
            if scanned_files >= SEARCH_MAX_FILES:
                stop = "file limit"
                break
            remaining = SEARCH_MAX_BYTES - scanned_bytes
            if remaining <= 0:
                stop = "byte limit"
                break
            data = self._read_bytes(entry, file, min(file.size, remaining) + 1)
            if data is None:
                unreadable += 1
                continue
            partial = len(data) > remaining
            if partial:
                data = data[:remaining]
            scanned_bytes += len(data)
            scanned_files += 1
            for number, line in enumerate(_decode_lines(data), 1):
                if needle not in line.casefold():
                    continue
                shown = line
                if len(shown) > MAX_LINE_CHARS:
                    shown = shown[:MAX_LINE_CHARS] + " [line truncated]"
                hits.append(f"{_truncate(relpath, 300)}:{number}: {shown}")
                if len(hits) >= MAX_SEARCH_HITS:
                    stop = "hit limit"
                    break
            if stop:
                break
            if partial:
                stop = "byte limit"
                break
        output = hits or [
            f"no hits for {_truncate(text, 200)!r} ({scanned_files} files scanned)"
        ]
        if stop == "hit limit":
            output.append(f"(hit limit reached; only {MAX_SEARCH_HITS} hits shown)")
        elif stop:
            output.append(
                f"(search stopped at the {stop}: {scanned_files} files, "
                f"{scanned_bytes} bytes scanned; narrow it with path_prefix)"
            )
        if unreadable:
            output.append(f"(skipped {unreadable} files that are not safely readable)")
        output.extend(_status_lines(entry, True))
        joined = "\n".join(output)
        if len(joined) > MAX_SEARCH_OUTPUT_CHARS:
            return _truncate(joined, MAX_SEARCH_OUTPUT_CHARS) + "\n(output truncated)"
        return joined

    def read(
        self,
        module: str,
        path: str,
        start_line: int = 1,
        end_line: int = MAX_READ_LINES,
    ) -> str:
        if self._closed:
            return "source workspace is closed"
        try:
            relpath = _safe_relpath(path)
        except _SourceError as err:
            return f"invalid path: {err}"
        entry = self._modules.get(module)
        if entry is None:
            return self._unknown(module)
        self._prepare(entry)
        found = _lookup(entry, relpath)
        if found is None:
            return _missing(entry, relpath)
        relpath, file = found
        start = max(1, start_line)
        window = start + MAX_READ_LINES - 1
        requested = end_line if end_line >= start else window
        header = (
            f"module: {_clean(entry.name)} | "
            f"source: {_truncate(_clean(file.source), MAX_IDENTITY_CHARS)} | "
            f"path: {_truncate(relpath, 500)}"
        )
        if file.binary:
            return f"{header}\n(binary file, {file.size} bytes; not shown)"
        data = self._read_bytes(entry, file, READ_MAX_BYTES + 1)
        if data is None:
            return f"{relpath} is not safely readable"
        truncated = len(data) > READ_MAX_BYTES
        lines = _decode_lines(data[:READ_MAX_BYTES])
        if not lines:
            return f"{header}\n(empty file)"
        if start > len(lines):
            return (
                f"{header}\n(file has {len(lines)} lines; start_line "
                f"{start} is beyond the end)"
            )
        end = min(requested, window, len(lines))
        output = [header]
        for number in range(start, end + 1):
            line = lines[number - 1]
            if len(line) > MAX_LINE_CHARS:
                line = line[:MAX_LINE_CHARS] + " [line truncated]"
            output.append(f"{number}: {line}")
        if truncated:
            output.append(f"(read truncated at {READ_MAX_BYTES} bytes)")
        else:
            output.append(f"(file has {len(lines)} lines)")
        if requested > end and end < len(lines) and not truncated:
            output.append(f"(read window ended at line {end})")
        return "\n".join(output)

    def lines(self, module: str, path: str) -> list[str] | None:
        entry = self._modules.get(module)
        if self._closed or entry is None:
            return None
        try:
            found = _lookup(entry, _safe_relpath(path))
        except _SourceError:
            return None
        if found is None or found[1].binary:
            return None
        data = self._read_bytes(entry, found[1], READ_MAX_BYTES)
        return None if data is None else _decode_lines(data)

    def _collect(self, value: JSONValue, depth: int) -> None:
        if not isinstance(value, list) or depth >= MAX_NESTING:
            return
        for item in value:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            if isinstance(name, str) and name:
                module = self._modules.get(name)
                if module is None:
                    if len(self._modules) >= MAX_MODULES:
                        return
                    module = _Module(name, len(self._modules))
                    self._modules[name] = module
                sources = item.get("sources")
                if isinstance(sources, list):
                    module.sources.extend(sources)
            self._collect(item.get("modules"), depth + 1)

    def _unknown(self, module: str) -> str:
        names = ", ".join(_clean(name) for name in self._modules)
        return (
            f"module {_truncate(_clean(module), 200)} not found; "
            f"modules: {_truncate(names, 2000) or 'none'}"
        )

    def _module_root(self, module: _Module) -> Path:
        return self._root / str(module.index)

    def _read_bytes(self, module: _Module, file: _File, limit: int) -> bytes | None:
        try:
            resolved = file.path.resolve(strict=True)
            resolved.relative_to(self._module_root(module))
            if not resolved.is_file():
                return None
            with resolved.open("rb") as handle:
                return handle.read(limit)
        except (OSError, ValueError):
            return None

    def _prepare(self, module: _Module) -> None:
        if module.prepared:
            return
        module.prepared = True
        root = self._module_root(module)
        root.mkdir(mode=0o700)
        downloads = 0
        skipped = max(0, len(module.sources) - MAX_MODULE_SOURCES)
        for item in module.sources[:MAX_MODULE_SOURCES]:
            if not isinstance(item, dict):
                module.results.append(
                    _Result("source entry", "error", "source entry is not an object")
                )
                continue
            identity = _identity(item)
            if _fetches(item):
                if downloads >= MAX_MODULE_DOWNLOADS:
                    skipped += 1
                    continue
                downloads += 1
            status = "ok"
            try:
                detail = self._materialize(item, module)
            except _NotMaterialized as err:
                status, detail = "not materialized", str(err)
            except _SourceError as err:
                status, detail = "error", str(err)
            except Exception as err:
                logger.exception(
                    "Unexpected source failure: %s",
                    _truncate(_clean(identity), MAX_IDENTITY_CHARS),
                )
                status, detail = "error", f"unexpected {type(err).__name__}: {err}"
            module.results.append(_Result(identity, status, detail))
        if skipped:
            module.results.append(
                _Result(
                    "further sources",
                    "error",
                    f"{skipped} more sources were not attempted; the limits are "
                    f"{MAX_MODULE_SOURCES} sources and {MAX_MODULE_DOWNLOADS} "
                    "downloads per module",
                )
            )
        _make_read_only(root)

    def _materialize(self, source: JSONObject, module: _Module) -> str:
        kind = _source_type(source)
        if not kind:
            raise _SourceError("source has no type")
        if not _fetches(source):
            raise _NotMaterialized(f"{kind} source is not materialized")
        if kind == "git":
            return self._git_source(source, module)
        if kind == "archive":
            return self._archive_source(source, module)
        return self._file_source(source, module)

    def _archive_source(self, source: JSONObject, module: _Module) -> str:
        dest = _dest_dir(source)
        strip = _int_field(source, "strip-components", 1)
        data, url = _remote(source)
        stats = self._extract(data, module, _identity(source), dest, strip)
        return f"extracted {stats.files} files ({stats.bytes} bytes) from {url}"

    def _git_source(self, source: JSONObject, module: _Module) -> str:
        url = source.get("url")
        if not isinstance(url, str) or not url:
            raise _SourceError("git source requires a url")
        commit = source.get("commit")
        if not isinstance(commit, str) or not FULL_COMMIT.fullmatch(commit):
            if source.get("tag") or source.get("branch"):
                raise _SourceError(
                    "git source is not pinned; tags and branches are not resolved"
                )
            raise _SourceError("git source requires a full 40-hex commit")
        commit = commit.lower()
        dest = _dest_dir(source)
        urls = _git_archive_urls([url, *_mirror_urls(source)], commit)
        data, archive_url = _fetch(urls, [])
        stats = self._extract(data, module, _identity(source), dest, 1)
        return (
            f"extracted {stats.files} files ({stats.bytes} bytes) from pinned "
            f"commit {commit} at {archive_url}"
        )

    def _file_source(self, source: JSONObject, module: _Module) -> str:
        url = source.get("url")
        if not isinstance(url, str) or not url:
            raise _SourceError("file source requires a url")
        dest = _dest_path(source, _url_filename(url))
        data, used = _remote(source)
        self._write_bytes(module, dest, data, _identity(source))
        return f"downloaded {dest} from {used}"

    def _budget(self, module: _Module, relpath: str, size: int) -> int:
        existing = module.files.get(relpath)
        total = self._total_bytes - (existing.size if existing else 0) + size
        if total > EXTRACTED_MAX_BYTES:
            raise _SourceError("materialized content exceeds the configured byte limit")
        if existing is None and self._file_count >= MAX_FILES:
            raise _SourceError("materialized file count exceeds the configured limit")
        return total

    def _add_file(
        self,
        module: _Module,
        relpath: str,
        file: _File,
        total: int,
    ) -> None:
        if relpath not in module.files:
            self._file_count += 1
        module.files[relpath] = file
        self._total_bytes = total

    def _write_bytes(
        self, module: _Module, relpath: str, data: bytes, source: str
    ) -> None:
        target = _safe_target(self._module_root(module), relpath)
        total = self._budget(module, relpath, len(data))
        target.unlink(missing_ok=True)
        with target.open("xb") as handle:
            handle.write(data)
        file = _File(target, source, len(data), _is_binary(data))
        self._add_file(module, relpath, file, total)

    def _extract(
        self,
        data: bytes,
        module: _Module,
        identity: str,
        dest: str,
        strip: int,
    ) -> _ArchiveStats:
        staging = self._root / ".staging"
        staging.mkdir(mode=0o700, exist_ok=True)
        stage = Path(tempfile.mkdtemp(dir=staging))
        stats = _ArchiveStats()
        try:
            if _archive_format(data) == "zip":
                self._stage_zip(data, stage, strip, stats)
            else:
                self._stage_tar(data, stage, strip, stats)
            self._merge(stage, module, dest, identity)
        except _SourceError:
            raise
        except Exception as err:
            raise _SourceError(
                f"could not extract archive ({type(err).__name__}): {err}"
            ) from err
        finally:
            shutil.rmtree(stage, ignore_errors=True)
        return stats

    def _decompression_limit(self) -> int:
        remaining_bytes = max(0, EXTRACTED_MAX_BYTES - self._total_bytes)
        remaining_files = max(0, MAX_FILES - self._file_count)
        return remaining_bytes + remaining_files * 2048 + 8 * 1024 * 1024

    def _count_entry(self, stats: _ArchiveStats) -> None:
        stats.entries += 1
        if self._file_count + stats.entries > MAX_FILES:
            raise _SourceError("archive file count exceeds the configured limit")

    def _stage_tar(
        self, data: bytes, stage: Path, strip: int, stats: _ArchiveStats
    ) -> None:
        reader = _LimitedReader(_tar_reader(data), self._decompression_limit())
        try:
            with _StreamTarFile.open(
                fileobj=cast("IO[bytes]", reader),
                mode="r|",
                tarinfo=_GuardedTarInfo,
            ) as archive:
                hardlinks: list[tuple[str, str]] = []
                for member in archive:
                    parts = _strip_parts(member.name, strip)
                    self._count_entry(stats)
                    if not parts:
                        continue
                    relpath = "/".join(parts)
                    if member.isdir() or member.issym():
                        continue
                    if member.islnk():
                        target_parts = _strip_parts(member.linkname, strip)
                        if not target_parts:
                            raise _SourceError(
                                f"unsafe archive hardlink target: {member.linkname}"
                            )
                        hardlinks.append((relpath, "/".join(target_parts)))
                        continue
                    if member.isdev():
                        raise _SourceError(f"unsafe archive member type: {member.name}")
                    handle = archive.extractfile(member)
                    if not member.isfile() or handle is None:
                        raise _SourceError(f"unsupported archive member: {member.name}")
                    self._stage_regular(stage, relpath, handle, member.size, stats)
                for relpath, target in hardlinks:
                    _stage_hardlink(stage, relpath, target)
        finally:
            reader.close()

    def _stage_zip(
        self, data: bytes, stage: Path, strip: int, stats: _ArchiveStats
    ) -> None:
        entries = _zip_entry_count(data)
        if self._file_count + entries > MAX_FILES:
            raise _SourceError("archive file count exceeds the configured limit")
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            infos = archive.infolist()
            if len(infos) != entries:
                raise _SourceError("zip archive entry count is inconsistent")
            for info in infos:
                if info.flag_bits & 0x1:
                    raise _SourceError("encrypted zip archives are unsupported")
                parts = _strip_parts(info.filename, strip)
                self._count_entry(stats)
                if not parts:
                    continue
                mode = (info.external_attr >> 16) & 0xFFFF
                if info.is_dir() or stat.S_ISDIR(mode) or stat.S_ISLNK(mode):
                    continue
                file_type = stat.S_IFMT(mode)
                if file_type in {
                    stat.S_IFCHR,
                    stat.S_IFBLK,
                    stat.S_IFIFO,
                    stat.S_IFSOCK,
                }:
                    raise _SourceError(f"unsafe archive member type: {info.filename}")
                if file_type not in {0, stat.S_IFREG}:
                    raise _SourceError(f"unsupported archive member: {info.filename}")
                with archive.open(info) as handle:
                    self._stage_regular(
                        stage, "/".join(parts), handle, info.file_size, stats
                    )

    def _stage_regular(
        self,
        stage: Path,
        relpath: str,
        handle: IO[bytes],
        expected_size: int,
        stats: _ArchiveStats,
    ) -> None:
        if expected_size < 0:
            raise _SourceError(f"archive member has an invalid size: {relpath}")
        remaining = EXTRACTED_MAX_BYTES - self._total_bytes
        if stats.bytes + expected_size > remaining:
            raise _SourceError("archive content exceeds the configured byte limit")
        target = _safe_target(stage, relpath)
        actual = 0
        with target.open("wb") as output:
            while chunk := handle.read(65536):
                actual += len(chunk)
                if stats.bytes + actual > remaining:
                    raise _SourceError(
                        "archive content exceeds the configured byte limit"
                    )
                output.write(chunk)
        stats.files += 1
        stats.bytes += actual

    def _merge(self, stage: Path, module: _Module, dest: str, identity: str) -> None:
        root = self._module_root(module)
        for current, directories, names in os.walk(stage):
            directories.sort()
            base = Path(current).relative_to(stage).as_posix()
            for name in sorted(names):
                relpath = name if base == "." else f"{base}/{name}"
                final = f"{dest}/{relpath}" if dest else relpath
                staged = Path(current) / name
                info = staged.lstat()
                if not stat.S_ISREG(info.st_mode):
                    raise _SourceError(f"unsupported staged archive member: {relpath}")
                target = _safe_target(root, final)
                total = self._budget(module, final, info.st_size)
                os.replace(staged, target)
                with target.open("rb") as handle:
                    binary = _is_binary(handle.read(8192))
                file = _File(target, identity, info.st_size, binary)
                self._add_file(module, final, file, total)
