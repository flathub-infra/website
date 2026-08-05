from collections.abc import Set
from urllib.parse import urlsplit

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


class InvalidUrlOrigin(ValueError):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def normalize_url_origin(
    value: object,
    *,
    allowed_schemes: Set[str] | None = frozenset({"http", "https"}),
    ignored_schemes: Set[str] = frozenset(),
) -> str | None:
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
        return None
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
    return f"{scheme}://{serialized_host}" + (f":{port}" if port is not None else "")
