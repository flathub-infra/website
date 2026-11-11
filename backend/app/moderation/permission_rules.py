from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Literal

from .. import models
from . import permission_snapshot

BUS_GROUPS = ("Session Bus Policy", "System Bus Policy")
BUS_LEVELS = {None: 0, "none": 0, "see": 1, "talk": 2, "own": 3}

type Change = tuple[tuple[str, ...], Any, Any]


@dataclass(frozen=True)
class Verdict:
    decision: Literal["approved", "rejected"]
    rationale: str
    rules: list[dict[str, Any]]


def flatten(differences: list[dict[str, Any]]) -> tuple[list[Change], bool]:
    changes: list[Change] = []
    complete = True

    def visit(path: tuple[str, ...], before: Any, after: Any) -> None:
        nonlocal complete
        if isinstance(before, dict) or isinstance(after, dict):
            before, after = before or {}, after or {}
            if not isinstance(before, dict) or not isinstance(after, dict):
                complete = False
                return
            for key in sorted(before.keys() | after.keys()):
                visit((*path, key), before.get(key), after.get(key))
        elif len(path) != 2:
            complete = False
        elif before != after:
            changes.append((path, before, after))

    for difference in differences:
        visit(tuple(difference["path"][1:]), difference["before"], difference["after"])
    return changes, complete


def _verdict(
    decision: Literal["approved", "rejected"], rules: list[models.PermissionRule]
) -> Verdict:
    unique = list({rule.id: rule for rule in rules}.values())
    return Verdict(
        decision,
        "\n\n".join(dict.fromkeys(rule.rationale for rule in unique)),
        [
            {
                "id": rule.id,
                "decision": rule.decision,
                "permission_group": rule.permission_group,
                "key": rule.key,
                "match_type": rule.match_type,
                "before": rule.before,
                "value": rule.value,
                "removed": rule.removed,
                "added": rule.added,
                "required": rule.required or [],
            }
            for rule in unique
        ],
    )


def _canonical(path: tuple[str, ...], item: str) -> str:
    if path != ("Context", "filesystems"):
        return item
    name, _, mode = item.rpartition(":")
    return name if name and mode == "rw" else item


def _endpoints(
    path: tuple[str, ...], rule: models.PermissionRule
) -> tuple[list[str], list[str], list[str]] | None:
    if rule.match_type == "grouped-delta":
        if rule.removed is None or rule.added is None:
            return None
        removed, added, required = rule.removed, rule.added, rule.required or []
    elif rule.match_type == "transition":
        removed = [] if rule.before is None else [rule.before]
        added = [] if rule.value is None else [rule.value]
        required = []
    elif rule.match_type == "destination" and rule.value is not None:
        removed, added, required = [], [rule.value], []
    else:
        return None
    return (
        [_canonical(path, item) for item in removed],
        [_canonical(path, item) for item in added],
        [_canonical(path, item) for item in required],
    )


def _unambiguous(
    path: tuple[str, ...],
    left: list[str],
    right: list[str],
    removed: list[str],
    added: list[str],
    required: list[str],
) -> bool:
    if path[0] != "Context":
        return True
    names = {
        permission_snapshot._context_entry_name(path[1], item)
        for item in (*removed, *added)
    }
    return None not in names and not any(
        permission_snapshot._context_entry_name(path[1], item) in names
        and item not in endpoints
        and item not in required
        for items, endpoints in ((left, removed), (right, added))
        for item in items
    )


def evaluate(
    differences: list[dict[str, Any]], rules: Iterable[models.PermissionRule]
) -> Verdict | None:
    changes, complete = flatten(differences)
    by_path: dict[tuple[str, ...], list[models.PermissionRule]] = {}
    for rule in rules:
        if rule.enabled:
            by_path.setdefault((rule.permission_group, rule.key), []).append(rule)
    approving: list[models.PermissionRule] = []
    rejecting: list[models.PermissionRule] = []
    for path, before, after in changes:
        candidates = by_path.get(path, [])
        if isinstance(before, list) or isinstance(after, list):
            left = [] if before is None else before
            right = [] if after is None else after
            if (
                not isinstance(left, list)
                or not isinstance(right, list)
                or not all(isinstance(item, str) for item in (*left, *right))
            ):
                complete = False
                continue
            left = [_canonical(path, item) for item in left]
            right = [_canonical(path, item) for item in right]
            left_entries, right_entries = set(left), set(right)
            if len(left_entries) != len(left) or len(right_entries) != len(right):
                complete = False
            removed, added = left_entries - right_entries, right_entries - left_entries
            if not removed and not added:
                continue
            required = {(0, item) for item in removed} | {(1, item) for item in added}
            covered: set[tuple[int, str]] = set()
            grouped: set[tuple[int, str]] = set()
            for rule in candidates:
                endpoints = _endpoints(path, rule)
                if endpoints is None:
                    continue
                rule_removed, rule_added, rule_required = endpoints
                grouped_rule = rule.match_type == "grouped-delta"
                if (
                    not set(rule_required) <= left_entries & right_entries
                    or not set(rule_removed) <= removed
                    or not set(rule_added) <= added
                    or grouped_rule
                    and not _unambiguous(
                        path, left, right, rule_removed, rule_added, rule_required
                    )
                ):
                    continue
                if rule.decision == "rejected":
                    rejecting.append(rule)
                    continue
                tokens = {(0, item) for item in rule_removed}
                tokens |= {(1, item) for item in rule_added}
                approving.append(rule)
                covered |= tokens
                if grouped_rule:
                    grouped |= tokens
            for side, items in enumerate((left, right)):
                remaining = [item for item in items if (side, item) not in grouped]
                names = (
                    [
                        permission_snapshot._context_entry_name(path[1], item)
                        for item in remaining
                    ]
                    if path[0] == "Context"
                    else remaining
                )
                if None in names or len(set(names)) != len(names):
                    complete = False
            if not required <= covered:
                complete = False
        elif (before is None or isinstance(before, str)) and (
            after is None or isinstance(after, str)
        ):
            matched = [
                rule
                for rule in candidates
                if (
                    rule.before == before and rule.value == after
                    if rule.match_type == "transition"
                    else rule.match_type == "destination"
                    and path[0] in BUS_GROUPS
                    and before in BUS_LEVELS
                    and after in BUS_LEVELS
                    and BUS_LEVELS[after] > BUS_LEVELS[before]
                    and rule.value == after
                )
            ]
            rejecting.extend(rule for rule in matched if rule.decision == "rejected")
            approved = [rule for rule in matched if rule.decision == "approved"]
            approving.extend(approved)
            if not approved:
                complete = False
        else:
            complete = False
    if rejecting:
        return _verdict("rejected", rejecting)
    if complete and changes and approving:
        return _verdict("approved", approving)
    return None
