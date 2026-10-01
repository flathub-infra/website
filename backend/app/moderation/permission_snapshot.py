import hashlib
import json
from dataclasses import dataclass
from typing import cast

import gi

gi.require_version("GLib", "2.0")
from gi.repository import GLib  # type: ignore

CANONICALIZATION_VERSION = 3
CONTEXT_FLAG_KEYS = ("shared", "sockets", "devices", "features")
CONTEXT_PATH_KEYS = ("filesystems", "persistent")
FILESYSTEM_MODES = ("ro", "rw", "create", "reset")

type PermissionValue = str | list[str]
type PermissionMap = dict[str, dict[str, PermissionValue]]
type JSONValue = str | int | bool | None | list[JSONValue] | dict[str, JSONValue]


class PermissionSnapshotError(ValueError):
    def __init__(self, code: str, message: str, *, ref_name: str | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.ref_name = ref_name


@dataclass(frozen=True)
class PermissionSnapshot:
    canonicalization_version: int
    architectures: dict[str, PermissionMap]


@dataclass(frozen=True)
class PermissionDifference:
    path: tuple[str, ...]
    before: JSONValue
    after: JSONValue


def _check_snapshot(snapshot: PermissionSnapshot) -> None:
    version = snapshot.canonicalization_version
    if (
        isinstance(version, bool)
        or not isinstance(version, int)
        or version != CANONICALIZATION_VERSION
    ):
        raise PermissionSnapshotError(
            "unsupported_version", f"Unsupported canonicalization version: {version}"
        )
    if not snapshot.architectures:
        raise PermissionSnapshotError(
            "missing_architecture", "Snapshot contains no architectures"
        )


def _context_entry_name(key: str, item: str) -> str | None:
    if key in CONTEXT_FLAG_KEYS and item.startswith("if:"):
        return item.split(":")[1]
    name = item.removeprefix("!")
    if key == "filesystems":
        path, _, mode = name.rpartition(":")
        if path and mode in FILESYSTEM_MODES:
            if mode == "reset":
                return None
            name = path
        if name == "host-reset":
            return None
    return name


def _sort_independent_entries(key: str, items: list[str]) -> list[str]:
    names = [_context_entry_name(key, item) for item in items]
    if None in names or len(set(names)) != len(names):
        return items
    return sorted(items)


def parse_permission_metadata(metadata: bytes, *, app_id: str) -> PermissionMap:
    if not metadata:
        raise PermissionSnapshotError("invalid_metadata", "Missing or empty metadata")
    try:
        text = metadata.decode("utf-8")
    except UnicodeError as exc:
        raise PermissionSnapshotError(
            "invalid_metadata", f"Invalid UTF-8 metadata: {exc}"
        ) from exc

    key_file = GLib.KeyFile.new()
    try:
        key_file.load_from_data(text, len(metadata), GLib.KeyFileFlags.NONE)
        if key_file.get_start_group() != "Application":
            raise PermissionSnapshotError(
                "invalid_metadata", "First metadata group must be Application"
            )
        name = key_file.get_string("Application", "name")
    except GLib.Error as exc:
        raise PermissionSnapshotError(
            "invalid_metadata", f"Invalid Application metadata: {exc}"
        ) from exc
    if name != app_id:
        raise PermissionSnapshotError(
            "identity_mismatch", f"Application.name {name!r} does not match {app_id!r}"
        )

    result: PermissionMap = {}
    for group in key_file.get_groups()[0]:
        if group in (
            "Application",
            "Context",
            "USB Devices",
            "Session Bus Policy",
            "System Bus Policy",
        ) or (group.startswith("Policy ") and group[7:]):
            values: dict[str, PermissionValue] = {}
            try:
                for key in key_file.get_keys(group)[0]:
                    if group == "Application" and key != "required-flatpak":
                        continue
                    if group in ("Session Bus Policy", "System Bus Policy"):
                        values[key] = key_file.get_string(group, key)
                    else:
                        items = list(key_file.get_string_list(group, key))
                        if group == "USB Devices" and key in ("enumerable", "hidden"):
                            items.sort()
                        elif group == "Context" and key in (
                            *CONTEXT_FLAG_KEYS,
                            *CONTEXT_PATH_KEYS,
                        ):
                            items = _sort_independent_entries(key, items)
                        values[key] = items
            except GLib.Error as exc:
                raise PermissionSnapshotError(
                    "invalid_metadata", f"Invalid {group} key {key!r}: {exc}"
                ) from exc
            if values:
                result[group] = values
        elif group in (
            "Environment",
            "Build",
            "Extra Data",
            "ExtensionOf",
            "X-DConf",
        ) or (group.startswith("Extension ") and group[10:]):
            continue
        else:
            raise PermissionSnapshotError(
                "unsupported_metadata", f"Unsupported metadata group: {group}"
            )
    return result


def fingerprint_snapshot(snapshot: PermissionSnapshot) -> str:
    _check_snapshot(snapshot)
    envelope = {
        "canonicalization_version": snapshot.canonicalization_version,
        "architectures": snapshot.architectures,
    }
    return hashlib.sha256(
        json.dumps(
            envelope, ensure_ascii=True, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
    ).hexdigest()


def compare_snapshots(
    before: PermissionSnapshot, after: PermissionSnapshot
) -> tuple[PermissionDifference, ...]:
    _check_snapshot(before)
    _check_snapshot(after)
    differences: list[PermissionDifference] = []
    missing = object()

    def visit(left: object, right: object, path: tuple[str, ...]) -> None:
        if left is missing or right is missing:
            differences.append(
                PermissionDifference(
                    path,
                    None if left is missing else cast("JSONValue", left),
                    None if right is missing else cast("JSONValue", right),
                )
            )
        elif isinstance(left, dict) and isinstance(right, dict):
            for key in sorted(left.keys() | right.keys()):
                visit(left.get(key, missing), right.get(key, missing), (*path, key))
        elif left != right:
            differences.append(
                PermissionDifference(
                    path, cast("JSONValue", left), cast("JSONValue", right)
                )
            )

    visit(before.architectures, after.architectures, ())
    return tuple(differences)
