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


def rule(
    id,
    decision,
    key,
    value="talk",
    group=SESSION,
    enabled=True,
    match_type="destination",
    before=None,
):
    return models.PermissionRule(
        id=id,
        decision=decision,
        permission_group=group,
        key=key,
        match_type=match_type,
        before=before,
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


@pytest.mark.parametrize(
    ("before", "after", "source", "destination", "expected"),
    [
        (
            ["home", "xdg-run/pipewire-0"],
            ["home", "xdg-run/pipewire-0:ro"],
            "xdg-run/pipewire-0",
            "xdg-run/pipewire-0:ro",
            "approved",
        ),
        (
            ["home", "xdg-run/pipewire-0:ro"],
            ["home", "xdg-run/pipewire-0"],
            "xdg-run/pipewire-0",
            "xdg-run/pipewire-0:ro",
            None,
        ),
        (
            ["other"],
            ["xdg-run/pipewire-0:ro"],
            "xdg-run/pipewire-0",
            "xdg-run/pipewire-0:ro",
            None,
        ),
        (
            [],
            ["xdg-run/pipewire-0:ro"],
            "xdg-run/pipewire-0",
            "xdg-run/pipewire-0:ro",
            None,
        ),
        ([], ["xdg-run/pipewire-0:ro"], None, "xdg-run/pipewire-0:ro", "approved"),
        (["xdg-run/pipewire-0"], [], "xdg-run/pipewire-0", None, "approved"),
        (
            ["home", "xdg-run/pipewire-0"],
            ["xdg-run/pipewire-0:ro"],
            "xdg-run/pipewire-0",
            "xdg-run/pipewire-0:ro",
            None,
        ),
        (
            ["home", "home", "xdg-run/pipewire-0"],
            ["home", "xdg-run/pipewire-0:ro"],
            "xdg-run/pipewire-0",
            "xdg-run/pipewire-0:ro",
            None,
        ),
        (
            ["home", "!home", "xdg-run/pipewire-0"],
            ["!home", "home", "xdg-run/pipewire-0:ro"],
            "xdg-run/pipewire-0",
            "xdg-run/pipewire-0:ro",
            None,
        ),
    ],
)
def test_explicit_list_transitions(before, after, source, destination, expected):
    transition = rule(
        4,
        "approved",
        "filesystems",
        destination,
        group="Context",
        match_type="transition",
        before=source,
    )
    verdict = evaluate(
        [change(["Context", "filesystems"], before, after)], [transition]
    )
    assert (verdict.decision if verdict else None) == expected


def test_destination_rule_does_not_cover_replacement_removal():
    differences = [change(["Context", "filesystems"], ["pipewire"], ["pipewire:ro"])]
    destination = rule(4, "approved", "filesystems", "pipewire:ro", group="Context")
    transition = rule(
        5,
        "approved",
        "filesystems",
        "pipewire:ro",
        group="Context",
        match_type="transition",
        before="pipewire",
    )
    assert evaluate(differences, [destination]) is None
    assert evaluate(differences, [destination, transition]).decision == "approved"
    transition.decision = "rejected"
    assert evaluate(differences, [destination, transition]).decision == "rejected"
    transition.enabled = False
    assert evaluate(differences, [destination, transition]) is None


@pytest.mark.parametrize(
    "before,after", [("own", "talk"), ("talk", None), (None, "talk")]
)
def test_exact_bus_transition_and_rejection_precedence(before, after):
    differences = [change([SESSION, TRAY], before, after)]
    transition = rule(
        4, "approved", TRAY, after, match_type="transition", before=before
    )
    assert evaluate(differences, [*RULES, transition]).decision == "approved"
    transition.decision = "rejected"
    assert evaluate(differences, [*RULES, transition]).decision == "rejected"
