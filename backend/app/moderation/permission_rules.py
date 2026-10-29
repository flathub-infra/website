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


def _group_tokens(
    path: tuple[str, ...],
    left: list[str],
    right: list[str],
    removed: set[str],
    added: set[str],
    rule: models.PermissionRule,
) -> set[tuple[int, str]] | None:
    if rule.removed is None or rule.added is None:
        return None
    if not set(rule.required or []) <= set(left) & set(right):
        return None
    if not set(rule.removed) <= removed or not set(rule.added) <= added:
        return None
    if path[0] == "Context":
        names = {
            permission_snapshot._context_entry_name(path[1], item)
            for item in (*rule.removed, *rule.added)
        }
        if None in names or any(
            permission_snapshot._context_entry_name(path[1], item) in names
            and item not in endpoints
            and item not in (rule.required or [])
            for items, endpoints in ((left, rule.removed), (right, rule.added))
            for item in items
        ):
            return None
    return {(0, item) for item in rule.removed} | {(1, item) for item in rule.added}


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
                if rule.match_type == "grouped-delta":
                    tokens = _group_tokens(path, left, right, removed, added, rule)
                    if tokens is None:
                        continue
                elif rule.match_type == "transition":
                    if (rule.before is not None and rule.before not in removed) or (
                        rule.value is not None and rule.value not in added
                    ):
                        continue
                    tokens = (
                        {(0, rule.before)} if rule.before is not None else set()
                    ) | ({(1, rule.value)} if rule.value is not None else set())
                elif rule.match_type == "destination" and rule.value in added:
                    tokens = {(1, rule.value)}
                else:
                    continue
                if rule.decision == "rejected":
                    rejecting.append(rule)
                else:
                    approving.append(rule)
                    covered.update(tokens)
                    if rule.match_type == "grouped-delta":
                        grouped.update(tokens)
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
