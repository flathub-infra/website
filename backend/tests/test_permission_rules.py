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


@pytest.mark.parametrize(
    "before,after,expected",
    [
        (["dri"], ["all", "if:all:!has-input-device", "dri", "input"], "approved"),
        ([], ["all", "if:all:!has-input-device", "input"], "approved"),
        (
            ["kvm", "dri"],
            ["kvm", "all", "if:all:!has-input-device", "dri", "input"],
            "approved",
        ),
        (["dri"], ["all", "dri"], None),
        (["dri"], ["input", "dri"], None),
        (
            ["dri"],
            ["if:all:!has-input-device", "all", "dri", "input"],
            "approved",
        ),
        (["dri"], ["all", "if:all:!has-usb-device", "dri", "input"], None),
        (["dri"], ["all", "if:all:!has-input-device", "input"], None),
        (["dri"], ["all", "if:all:!has-input-device", "dri", "input", "kvm"], None),
        (["dri"], ["all", "if:all:!has-input-device", "dri", "input", "input"], None),
        (
            ["dri", "kvm"],
            ["kvm", "all", "if:all:!has-input-device", "dri", "input"],
            "approved",
        ),
        (
            ["dri", "!all"],
            ["all", "if:all:!has-input-device", "dri", "input", "!all"],
            None,
        ),
        (
            ["dri", "if:all:false"],
            ["all", "if:all:!has-input-device", "dri", "input", "if:all:false"],
            None,
        ),
    ],
)
def test_grouped_device_delta_is_atomic_and_order_insensitive(before, after, expected):
    grouped = rule(
        5, "approved", "devices", None, group="Context", match_type="grouped-delta"
    )
    grouped.removed = []
    grouped.added = ["all", "if:all:!has-input-device", "input"]
    verdict = evaluate([change(["Context", "devices"], before, after)], [grouped])
    assert (verdict.decision if verdict else None) == expected


def test_grouped_delta_composes_with_other_rules_and_rejection_wins():
    grouped = rule(
        5, "approved", "devices", None, group="Context", match_type="grouped-delta"
    )
    grouped.removed = []
    grouped.added = ["all", "if:all:!has-input-device", "input"]
    differences = [
        change(
            ["Context", "devices"],
            ["dri"],
            ["all", "if:all:!has-input-device", "dri", "input", "kvm"],
        )
    ]
    kvm = rule(6, "approved", "devices", "kvm", group="Context")
    assert evaluate(differences, [grouped, kvm]).decision == "approved"
    kvm.decision = "rejected"
    assert evaluate(differences, [grouped, kvm]).decision == "rejected"
    kvm.decision = "approved"
    grouped.enabled = False
    assert evaluate(differences, [grouped, kvm]) is None
    grouped.enabled = True
    grouped.decision = "rejected"
    assert evaluate(differences, [grouped, kvm]).decision == "rejected"


@pytest.mark.parametrize("before", [["home", "xdg-download"], ["xdg-download", "home"]])
@pytest.mark.parametrize(
    "after", [["home:ro", "xdg-download:ro"], ["xdg-download:ro", "home:ro"]]
)
def test_grouped_reduction_needs_both_endpoints(before, after):
    grouped = rule(
        5, "approved", "filesystems", None, group="Context", match_type="grouped-delta"
    )
    grouped.removed = ["home", "xdg-download"]
    grouped.added = ["home:ro", "xdg-download:ro"]
    exact = [change(["Context", "filesystems"], before, after)]
    assert evaluate(exact, [grouped]).decision == "approved"
    partial = [change(["Context", "filesystems"], ["home"], ["home:ro"])]
    assert evaluate(partial, [grouped]) is None
    reverse = [
        change(
            ["Context", "filesystems"],
            ["home:ro", "xdg-download:ro"],
            ["home", "xdg-download"],
        )
    ]
    assert evaluate(reverse, [grouped]) is None


@pytest.mark.parametrize(
    ("before", "after", "expected"),
    [
        (["all", "dri"], ["all"], "approved"),
        (["dri"], [], None),
        (["all", "dri"], [], None),
        (["dri"], ["all"], None),
        (["all", "dri"], ["all", "kvm"], None),
        (["all", "dri", "kvm"], ["all"], None),
    ],
)
def test_grouped_removal_requires_unchanged_device(before, after, expected):
    grouped = rule(
        5, "approved", "devices", None, group="Context", match_type="grouped-delta"
    )
    grouped.removed = ["dri"]
    grouped.added = []
    grouped.required = ["all"]
    verdict = evaluate([change(["Context", "devices"], before, after)], [grouped])
    assert (verdict.decision if verdict else None) == expected
    if verdict:
        assert verdict.rules[0]["required"] == ["all"]


@pytest.mark.parametrize(
    ("before", "after", "expected"),
    [
        (
            ["all"],
            ["all", "if:all:!has-input-device", "dri", "input"],
            "approved",
        ),
        (
            ["all", "kvm"],
            ["all", "if:all:!has-input-device", "dri", "input", "kvm"],
            "approved",
        ),
        ([], ["all", "if:all:!has-input-device", "dri", "input"], None),
        (["all"], ["if:all:!has-input-device", "dri", "input"], None),
        (["all"], ["all", "if:all:!has-input-device", "input"], None),
        (
            ["all"],
            ["all", "dri", "if:all:!has-input-device", "input"],
            "approved",
        ),
        (
            ["all", "!all"],
            ["all", "if:all:!has-input-device", "dri", "input", "!all"],
            None,
        ),
        (
            ["all", "if:all:false"],
            ["all", "if:all:!has-input-device", "dri", "input", "if:all:false"],
            None,
        ),
        (
            ["all"],
            ["all", "if:all:!has-input-device", "dri", "input", "kvm"],
            None,
        ),
    ],
)
def test_grouped_input_transition_requires_existing_all(before, after, expected):
    grouped = rule(
        9, "approved", "devices", None, group="Context", match_type="grouped-delta"
    )
    grouped.removed = []
    grouped.added = ["if:all:!has-input-device", "dri", "input"]
    grouped.required = ["all"]
    verdict = evaluate([change(["Context", "devices"], before, after)], [grouped])
    assert (verdict.decision if verdict else None) == expected


@pytest.mark.parametrize(
    "differences",
    [
        [
            change(
                ["Context", "sockets"],
                ["x11", "wayland"],
                ["wayland", "pulseaudio", "x11"],
            )
        ],
        [
            change(
                ["Context", "devices"],
                ["all", "if:all:!has-input-device"],
                ["if:all:!has-input-device", "all"],
            ),
            change(["Context", "sockets"], [], ["pulseaudio"]),
        ],
    ],
)
def test_reordering_does_not_block_covered_grants(differences):
    assert evaluate(differences, RULES).decision == "approved"
