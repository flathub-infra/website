import hashlib
import json
from collections.abc import Iterable
from dataclasses import dataclass
from typing import cast

import gi

gi.require_version("GLib", "2.0")
from gi.repository import GLib  # type: ignore

CANONICALIZATION_VERSION = 5
REVIEW_ARCH = "x86_64"
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


def review_architectures(
    architectures: dict[str, PermissionMap],
) -> dict[str, PermissionMap]:
    if REVIEW_ARCH not in architectures:
        raise PermissionSnapshotError(
            "missing_architecture", f"Snapshot lacks {REVIEW_ARCH} permissions"
        )
    return {REVIEW_ARCH: architectures[REVIEW_ARCH]}


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


def _drop_compat_x11(items: list[str]) -> list[str]:
    if "fallback-x11" not in items or any(
        item == "!x11" or item.startswith("if:x11:") for item in items
    ):
        return items
    return [item for item in items if item != "x11"]


def parse_permission_metadata(
    metadata: bytes, *, app_id: str, kind: str = "Application"
) -> PermissionMap:
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
        if key_file.get_start_group() != kind:
            raise PermissionSnapshotError(
                "invalid_metadata", f"First metadata group must be {kind}"
            )
        name = key_file.get_string(kind, "name")
    except GLib.Error as exc:
        raise PermissionSnapshotError(
            "invalid_metadata", f"Invalid {kind} metadata: {exc}"
        ) from exc
    if name != app_id:
        raise PermissionSnapshotError(
            "identity_mismatch", f"{kind}.name {name!r} does not match {app_id!r}"
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
                            if key == "sockets":
                                items = _drop_compat_x11(items)
                            items = _sort_independent_entries(key, items)
                        values[key] = items
            except GLib.Error as exc:
                raise PermissionSnapshotError(
                    "invalid_metadata", f"Invalid {group} key {key!r}: {exc}"
                ) from exc
            if values:
                result[group] = values
        elif group in (
            kind,
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


def metadata_runtime(metadata: bytes) -> str | None:
    key_file = GLib.KeyFile.new()
    try:
        key_file.load_from_bytes(GLib.Bytes.new(metadata), GLib.KeyFileFlags.NONE)
        return key_file.get_string("Application", "runtime")
    except GLib.Error:
        return None


def _without_inherited(
    permissions: PermissionMap, inherited: tuple[PermissionMap, ...]
) -> PermissionMap:
    result: PermissionMap = {}
    for group, values in permissions.items():
        kept: dict[str, PermissionValue] = {}
        for key, value in values.items():
            granted = [runtime.get(group, {}).get(key) for runtime in inherited]
            if isinstance(value, list):
                stripped = [
                    item
                    for item in value
                    if not any(isinstance(g, list) and item in g for g in granted)
                ]
                if value and not stripped:
                    continue
                value = stripped
            elif value in granted:
                continue
            kept[key] = value
        if kept or not values:
            result[group] = kept
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
    before: PermissionSnapshot,
    after: PermissionSnapshot,
    inherited: Iterable[PermissionMap] = (),
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

    runtimes = tuple(inherited)
    visit(
        {
            arch: _without_inherited(permissions, runtimes)
            for arch, permissions in before.architectures.items()
        },
        {
            arch: _without_inherited(permissions, runtimes)
            for arch, permissions in after.architectures.items()
        },
        (),
    )
    return tuple(differences)
