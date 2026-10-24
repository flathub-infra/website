from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Literal

from .. import models

BUS_GROUPS = ("Session Bus Policy", "System Bus Policy")
BUS_LEVELS = {None: 0, "none": 0, "see": 1, "talk": 2, "own": 3}

type Grant = tuple[str, str, str]


@dataclass(frozen=True)
class Verdict:
    decision: Literal["approved", "rejected"]
    rationale: str
    rules: list[dict[str, Any]]


def flatten(differences: list[dict[str, Any]]) -> tuple[list[Grant], bool]:
    grants: list[Grant] = []
    only_grants = True

    def visit(path: tuple[str, ...], before: Any, after: Any) -> None:
        nonlocal only_grants
        if isinstance(before, dict) or isinstance(after, dict):
            before, after = before or {}, after or {}
            if not isinstance(before, dict) or not isinstance(after, dict):
                only_grants = False
                return
            for key in sorted(before.keys() | after.keys()):
                visit((*path, key), before.get(key), after.get(key))
        elif len(path) != 2:
            only_grants = False
        elif isinstance(before, list) or isinstance(after, list):
            before, after = before or [], after or []
            if not isinstance(before, list) or not isinstance(after, list):
                only_grants = False
                return
            grants.extend((*path, item) for item in after if item not in before)
            if [item for item in after if item in before] != before:
                only_grants = False
        elif (
            path[0] in BUS_GROUPS
            and before in BUS_LEVELS
            and after in BUS_LEVELS
            and BUS_LEVELS[after] > BUS_LEVELS[before]
        ):
            grants.append((*path, after))
        else:
            only_grants = False

    for difference in differences:
        visit(tuple(difference["path"][1:]), difference["before"], difference["after"])
    return grants, only_grants


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
                "value": rule.value,
            }
            for rule in unique
        ],
    )


def evaluate(
    differences: list[dict[str, Any]], rules: Iterable[models.PermissionRule]
) -> Verdict | None:
    grants, only_grants = flatten(differences)
    by_grant = {
        (rule.permission_group, rule.key, rule.value): rule
        for rule in rules
        if rule.enabled
    }
    matched = [by_grant.get(grant) for grant in grants]
    rejecting = [rule for rule in matched if rule and rule.decision == "rejected"]
    if rejecting:
        return _verdict("rejected", rejecting)
    approving = [rule for rule in matched if rule is not None]
    if only_grants and grants and len(approving) == len(grants):
        return _verdict("approved", approving)
    return None
