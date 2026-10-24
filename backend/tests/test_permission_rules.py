import os
import sys

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import models
from app.moderation.permission_rules import evaluate

SESSION = "Session Bus Policy"
TRAY = "org.kde.StatusNotifierWatcher"
NOTIFICATIONS = "org.freedesktop.Notifications"


def rule(id, decision, key, value="talk", group=SESSION, enabled=True):
    return models.PermissionRule(
        id=id,
        decision=decision,
        permission_group=group,
        key=key,
        value=value,
        rationale=f"{decision} {key}",
        enabled=enabled,
    )


RULES = [
    rule(1, "approved", TRAY),
    rule(2, "rejected", NOTIFICATIONS),
    rule(3, "approved", "sockets", "pulseaudio", group="Context"),
]


def change(path, before, after):
    return {"path": ["x86_64", *path], "before": before, "after": after}


@pytest.mark.parametrize(
    "differences",
    [
        [change([SESSION, TRAY], None, "talk")],
        [change([SESSION], None, {TRAY: "talk"})],
        [change([SESSION, TRAY], "see", "talk")],
    ],
)
def test_covered_grants_are_approved(differences):
    verdict = evaluate(differences, RULES)
    assert verdict is not None
    assert (verdict.decision, verdict.rationale) == ("approved", f"approved {TRAY}")
    assert [item["id"] for item in verdict.rules] == [1]


def test_rejection_wins_over_approvals_and_unrelated_changes():
    verdict = evaluate(
        [
            change(["Context", "sockets"], ["x11"], ["wayland"]),
            change([SESSION], None, {NOTIFICATIONS: "talk", TRAY: "talk"}),
        ],
        RULES,
    )
    assert verdict is not None
    assert (verdict.decision, verdict.rationale) == (
        "rejected",
        f"rejected {NOTIFICATIONS}",
    )
    assert [item["id"] for item in verdict.rules] == [2]


@pytest.mark.parametrize(
    ("differences", "rules"),
    [
        ([change([SESSION], None, {TRAY: "talk", "org.example.Other": "talk"})], RULES),
        ([change(["Context", "sockets"], ["x11"], ["pulseaudio"])], RULES),
        (
            [change(["Context", "sockets"], ["x11", "wayland"], ["wayland", "x11"])],
            RULES,
        ),
        ([change([SESSION, TRAY], "own", "talk")], RULES),
        ([change([SESSION, NOTIFICATIONS], "talk", None)], RULES),
        ([change([SESSION, TRAY], None, "own")], RULES),
        (
            [change([SESSION, TRAY], None, "talk")],
            [rule(1, "approved", TRAY, enabled=False)],
        ),
        ([], RULES),
    ],
)
def test_changes_outside_the_rules_stay_with_moderators(differences, rules):
    assert evaluate(differences, rules) is None
