from collections.abc import Set as AbstractSet
from urllib.parse import SplitResult, urlsplit

_DEFAULT_PORTS = {
    "bzr+ssh": 22,
    "ftp": 21,
    "git": 9418,
    "git+ssh": 22,
    "http": 80,
    "https": 443,
    "ssh": 22,
    "svn": 3690,
    "svn+ssh": 22,
}

_FIXED_NAMESPACE_FORGES = frozenset(
    {
        "github.com",
        "raw.githubusercontent.com",
        "codeberg.org",
        "git.sr.ht",
        "hg.sr.ht",
        "sr.ht",
    }
)
_GITLAB_FORGES = frozenset({"gitlab.com", "gitlab.gnome.org", "invent.kde.org"})


class InvalidUrlOrigin(ValueError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _normalize_url_parts(
    value: object,
    *,
    allowed_schemes: AbstractSet[str] | None,
    ignored_schemes: AbstractSet[str],
) -> tuple[str | None, SplitResult | None]:
    if not isinstance(value, str):
        raise InvalidUrlOrigin("non-string")
    if not value:
        raise InvalidUrlOrigin("empty")
    if any(
        character.isspace() or ord(character) < 32 or character == "\\"
        for character in value
    ):
        raise InvalidUrlOrigin("invalid-character")

    try:
        parsed = urlsplit(value)
        hostname = parsed.hostname
    except ValueError as exc:
        raise InvalidUrlOrigin("invalid-authority") from exc

    scheme = parsed.scheme.lower()
    if not scheme:
        raise InvalidUrlOrigin("missing-scheme")
    if scheme in ignored_schemes:
        return None, None
    if allowed_schemes is not None and scheme not in allowed_schemes:
        raise InvalidUrlOrigin("unsupported-scheme")
    if not parsed.netloc:
        raise InvalidUrlOrigin("missing-authority")
    if hostname is None:
        raise InvalidUrlOrigin("missing-host")

    authority = parsed.netloc.rsplit("@", 1)[-1]
    if authority.endswith(":"):
        raise InvalidUrlOrigin("invalid-port")
    try:
        port = parsed.port
    except ValueError as exc:
        raise InvalidUrlOrigin("invalid-port") from exc

    hostname = hostname.lower()
    if port == _DEFAULT_PORTS.get(scheme):
        port = None

    serialized_host = f"[{hostname}]" if ":" in hostname else hostname
    origin = f"{scheme}://{serialized_host}" + (f":{port}" if port is not None else "")
    return origin, parsed


def normalize_url_origin(
    value: object,
    *,
    allowed_schemes: AbstractSet[str] | None = frozenset({"http", "https"}),
    ignored_schemes: AbstractSet[str] = frozenset(),
) -> str | None:
    origin, _ = _normalize_url_parts(
        value,
        allowed_schemes=allowed_schemes,
        ignored_schemes=ignored_schemes,
    )
    return origin


def normalize_manifest_source_url(
    value: object,
    *,
    allowed_schemes: AbstractSet[str] | None = frozenset({"http", "https"}),
    ignored_schemes: AbstractSet[str] = frozenset(),
) -> str | None:
    origin, parsed = _normalize_url_parts(
        value,
        allowed_schemes=allowed_schemes,
        ignored_schemes=ignored_schemes,
    )
    if origin is None or parsed is None:
        return None

    hostname = parsed.hostname
    if hostname is None:
        return origin
    hostname = hostname.lower()
    if hostname not in _FIXED_NAMESPACE_FORGES and hostname not in _GITLAB_FORGES:
        return origin

    segments = parsed.path.strip("/").split("/")
    if len(segments) < 2 or any(
        not segment or segment in {".", ".."} for segment in segments
    ):
        return origin

    if hostname in _FIXED_NAMESPACE_FORGES:
        repository_segments = segments[:2]
    else:
        delimiter = segments.index("-") if "-" in segments else len(segments)
        repository_segments = segments[:delimiter]
        if len(repository_segments) < 2:
            return origin

    repository = repository_segments[-1]
    if repository.endswith(".git"):
        repository = repository[:-4]
        if not repository:
            return origin
        repository_segments[-1] = repository

    return f"{origin}/{'/'.join(repository_segments)}"
