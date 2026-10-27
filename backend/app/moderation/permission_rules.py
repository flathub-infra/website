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
            }
            for rule in unique
        ],
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
            removed, added = set(left) - set(right), set(right) - set(left)
            required = {(0, item) for item in removed} | {(1, item) for item in added}
            covered: set[tuple[int, str]] = set()
            ordered = [item for item in left if item in right] == [
                item for item in right if item in left
            ]
            for items in (left, right):
                names = (
                    [
                        permission_snapshot._context_entry_name(path[1], item)
                        for item in items
                    ]
                    if path[0] == "Context"
                    else items
                )
                if None in names or len(set(names)) != len(names):
                    ordered = False
            if not ordered or not required:
                complete = False
            for rule in candidates:
                if rule.match_type == "transition":
                    if (rule.before is not None and rule.before not in removed) or (
                        rule.value is not None and rule.value not in added
                    ):
                        continue
                    tokens = (
                        {(0, rule.before)} if rule.before is not None else set()
                    ) | ({(1, rule.value)} if rule.value is not None else set())
                elif rule.value in added:
                    tokens = {(1, rule.value)}
                else:
                    continue
                if rule.decision == "rejected":
                    rejecting.append(rule)
                else:
                    approving.append(rule)
                    covered.update(tokens)
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
                    else path[0] in BUS_GROUPS
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
