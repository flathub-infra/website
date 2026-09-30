import hashlib
import json
from dataclasses import dataclass
from typing import cast

import gi

gi.require_version("GLib", "2.0")
from gi.repository import GLib  # type: ignore

CANONICALIZATION_VERSION = 1

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
    if snapshot.canonicalization_version != CANONICALIZATION_VERSION:
        raise PermissionSnapshotError(
            "unsupported_version",
            f"Unsupported canonicalization version: {snapshot.canonicalization_version}",
        )
    if not snapshot.architectures:
        raise PermissionSnapshotError(
            "missing_architecture", "Snapshot contains no architectures"
        )


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
                        values[key] = list(key_file.get_string_list(group, key))
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
