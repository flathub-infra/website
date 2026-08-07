from copy import deepcopy

import pytest

from app.manifest_complexity import (
    MANIFEST_COMPLEXITY_ALGORITHM_VERSION,
    ManifestChangeKind,
    ManifestComplexityNotScored,
    ManifestComplexityNotScoredReason,
    ManifestComplexityResult,
    analyze_manifest_complexity,
)
from app.ostree_manifest import ManifestPair, PublishedManifestStatus


def manifest_pair(
    published: object,
    candidate: object,
    *,
    app_id: str = "org.example.App",
    arch: str = "x86_64",
    status: PublishedManifestStatus = PublishedManifestStatus.PRESENT,
) -> ManifestPair:
    return ManifestPair(
        app_id=app_id,
        ref_name=f"app/{app_id}/{arch}/stable",
        arch=arch,
        branch="stable",
        candidate_commit=f"candidate-{arch}",
        published_commit=None
        if status is PublishedManifestStatus.REF_MISSING
        else f"published-{arch}",
        candidate_manifest=candidate,
        published_manifest=published
        if status is PublishedManifestStatus.PRESENT
        else None,
        published_status=status,
    )


def result(published: dict, candidate: dict) -> ManifestComplexityResult:
    analysis = analyze_manifest_complexity(((manifest_pair(published, candidate),),))
    assert isinstance(analysis, ManifestComplexityResult)
    return analysis


def kinds(analysis: ManifestComplexityResult) -> list[ManifestChangeKind]:
    return [event.kind for event in analysis.events]


def local_sources(count: int, prefix: str = "source") -> list[dict[str, str]]:
    return [{"type": "file", "path": f"{prefix}-{index}"} for index in range(count)]


def module_manifest(
    sources: list[dict[str, str]], name: str = "main"
) -> dict[str, object]:
    return {"modules": [{"name": name, "sources": sources}]}


@pytest.mark.parametrize(
    ("before_source", "after_source"),
    [
        (
            {"type": "archive", "url": "https://example.com/a.tar", "sha256": "a"},
            {"type": "archive", "url": "https://example.com/a.tar", "sha256": "b"},
        ),
        (
            {"type": "git", "url": "https://example.com/repo.git", "commit": "a"},
            {"type": "git", "url": "https://example.com/repo.git", "commit": "b"},
        ),
        (
            {"type": "git", "url": "https://example.com/repo.git", "tag": "1"},
            {"type": "git", "url": "https://example.com/repo.git", "tag": "2"},
        ),
        (
            {"type": "git", "url": "https://example.com/repo.git", "branch": "one"},
            {"type": "git", "url": "https://example.com/repo.git", "branch": "two"},
        ),
        (
            {"type": "archive", "url": "https://example.com/a.tar?one#old"},
            {"type": "archive", "url": "https://example.com/b.tar?two#new"},
        ),
        (
            {"type": "file", "url": "https://example.com/a.txt"},
            {"type": "file", "url": "https://example.com/b.txt"},
        ),
    ],
)
def test_volatile_source_changes_are_zero(before_source, after_source):
    before = {"modules": [{"name": "main", "sources": [before_source]}]}
    after = {"modules": [{"name": "main", "sources": [after_source]}]}
    analysis = result(before, after)
    assert analysis.score_units == 0
    assert analysis.events == ()


@pytest.mark.parametrize(
    ("old_field", "new_field"),
    [
        ({"runtime-version": "45"}, {"runtime-version": "46"}),
        ({"finish-args": ["--share=network"]}, {"finish-args": []}),
        ({"base-version": "1"}, {"base-version": "2"}),
    ],
)
def test_ignored_manifest_fields_are_zero(old_field, new_field):
    analysis = result({"modules": [], **old_field}, {"modules": [], **new_field})
    assert analysis.score_units == 0


def test_ignored_field_change_with_repeated_identical_sources_is_zero():
    sources = [
        {
            "type": "archive",
            "url": f"https://crates.example/{index}.tar.gz",
            "sha256": str(index),
        }
        for index in range(200)
    ]
    before = {
        "finish-args": ["--share=network"],
        "modules": [{"name": "main", "sources": sources}],
    }
    after = {
        "finish-args": [],
        "modules": [{"name": "main", "sources": sources}],
    }

    analysis = result(before, after)

    assert analysis.score_units == 0
    assert analysis.events == ()


def test_local_file_source_is_supported():
    manifest = {
        "modules": [
            {
                "name": "main",
                "sources": [{"type": "file", "path": "metadata.xml"}],
            }
        ]
    }

    analysis = result(manifest, manifest)

    assert analysis.score_units == 0
    assert analysis.events == ()


def test_extra_data_sources_are_zero():
    before = {"modules": [{"name": "main", "sources": []}]}
    after = {
        "modules": [
            {
                "name": "main",
                "sources": [
                    {
                        "type": "extra-data",
                        "url": "https://new.example/file",
                        "sha256": "x",
                    }
                ],
            }
        ]
    }
    assert result(before, after).score_units == 0


def test_source_host_replacement_is_origin_owned():
    before = {
        "modules": [
            {
                "name": "main",
                "sources": [{"type": "archive", "url": "https://old.example/a"}],
            }
        ]
    }
    after = {
        "modules": [
            {
                "name": "main",
                "sources": [{"type": "archive", "url": "https://new.example/a"}],
            }
        ]
    }
    assert result(before, after).events == ()


def test_module_added_without_order_cascade():
    before = {"modules": [{"name": "one"}, {"name": "two"}]}
    after = {"modules": [{"name": "new"}, {"name": "one"}, {"name": "two"}]}
    analysis = result(before, after)
    assert kinds(analysis) == [ManifestChangeKind.MODULE_ADDED]
    assert analysis.score_units == 5
    assert analysis.events[0].location == "modules/new"


def test_module_removed():
    analysis = result({"modules": [{"name": "one"}]}, {"modules": []})
    assert kinds(analysis) == [ManifestChangeKind.MODULE_REMOVED]
    assert analysis.score_units == 4


def test_nested_module_added_is_single_event():
    before = {"modules": [{"name": "main", "modules": []}]}
    after = {
        "modules": [
            {"name": "main", "modules": [{"name": "child", "buildsystem": "meson"}]}
        ]
    }
    analysis = result(before, after)
    assert kinds(analysis) == [ManifestChangeKind.MODULE_ADDED]
    assert analysis.events[0].location == "modules/main/modules/child"


def test_module_reorder_is_one_layout_event():
    before = {"modules": [{"name": "one"}, {"name": "two"}]}
    after = {"modules": [{"name": "two"}, {"name": "one"}]}
    analysis = result(before, after)
    assert kinds(analysis) == [ManifestChangeKind.MODULE_LAYOUT_CHANGED]
    assert analysis.score_units == 2


def test_structural_module_rename_is_zero():
    before = {
        "modules": [
            {
                "name": "old",
                "buildsystem": "meson",
                "sources": [{"type": "archive", "url": "https://example.com/a"}],
            }
        ]
    }
    after = {
        "modules": [
            {
                "name": "new",
                "buildsystem": "meson",
                "sources": [{"type": "archive", "url": "https://example.com/b"}],
            }
        ]
    }
    assert result(before, after).events == ()


@pytest.mark.parametrize(
    ("count", "magnitude"),
    [(1, 1), (2, 1), (3, 2), (11, 3)],
)
def test_source_additions_are_aggregated(count, magnitude):
    analysis = result(
        module_manifest([]),
        module_manifest(local_sources(count)),
    )

    assert kinds(analysis) == [ManifestChangeKind.SOURCE_SET_CHANGED]
    event = analysis.events[0]
    assert event.location == "modules/main/sources"
    assert event.old_summary is None
    assert event.new_summary == {
        "added": count,
        "removed": 0,
        "changed": count,
    }
    assert event.magnitude == magnitude
    assert analysis.recipe_units == magnitude
    assert analysis.score_units == magnitude
    assert analysis.breadth_units == 0
    assert analysis.changed_categories == ("sources",)


def test_source_removal_is_aggregated():
    retained = {"type": "archive", "url": "https://example.com/retained"}
    removed = {"type": "file", "path": "removed"}
    analysis = result(
        module_manifest([retained, removed]),
        module_manifest([retained]),
    )

    assert kinds(analysis) == [ManifestChangeKind.SOURCE_SET_CHANGED]
    assert analysis.events[0].new_summary == {
        "added": 0,
        "removed": 1,
        "changed": 1,
    }
    assert analysis.events[0].magnitude == 1
    assert analysis.recipe_units == 1


def test_equal_count_source_replacement_counts_total_churn():
    analysis = result(
        module_manifest(local_sources(10, "old")),
        module_manifest(local_sources(10, "new")),
    )

    assert kinds(analysis) == [ManifestChangeKind.SOURCE_SET_CHANGED]
    assert analysis.events[0].new_summary == {
        "added": 10,
        "removed": 10,
        "changed": 20,
    }
    assert analysis.events[0].magnitude == 3
    assert analysis.recipe_units == 3


def test_mixed_source_set_change_is_one_event():
    analysis = result(
        module_manifest(local_sources(6, "old")),
        module_manifest(local_sources(6, "new")),
    )

    assert kinds(analysis) == [ManifestChangeKind.SOURCE_SET_CHANGED]
    assert analysis.events[0].new_summary == {
        "added": 6,
        "removed": 6,
        "changed": 12,
    }
    assert analysis.events[0].magnitude == 3


def test_origin_owned_source_addition_and_removal_are_zero():
    old_origin = {"type": "archive", "url": "https://old.example/source"}
    new_origin = {"type": "archive", "url": "https://new.example/source"}
    addition = result(
        module_manifest([old_origin]),
        module_manifest([old_origin, new_origin]),
    )
    removal = result(module_manifest([new_origin]), module_manifest([]))

    assert addition.events == ()
    assert addition.score_units == 0
    assert removal.events == ()
    assert removal.score_units == 0


def test_source_set_is_capped_across_modules():
    names = ("main", "one", "two")
    before = {
        "modules": [{"name": name, "sources": local_sources(1, name)} for name in names]
    }
    after = {
        "modules": [
            {
                "name": name,
                "sources": local_sources(1, name) + local_sources(11, f"{name}-new"),
            }
            for name in names
        ]
    }

    analysis = result(before, after)

    assert len(analysis.events) == 3
    assert kinds(analysis) == [ManifestChangeKind.SOURCE_SET_CHANGED] * 3
    assert {event.magnitude for event in analysis.events} == {3}
    assert analysis.recipe_units == 6
    assert analysis.breadth_units == 2
    assert analysis.changed_categories == ("sources",)


def test_generated_source_list_change_is_bounded():
    source = {
        "type": "archive",
        "url": "https://example.com/generated.tar.gz",
        "sha256": "checksum",
    }
    analysis = result(
        module_manifest([source] * 200),
        module_manifest([source] * 300),
    )

    assert kinds(analysis) == [ManifestChangeKind.SOURCE_SET_CHANGED]
    assert analysis.events[0].new_summary == {
        "added": 100,
        "removed": 0,
        "changed": 100,
    }
    assert analysis.events[0].magnitude == 3
    assert analysis.recipe_units == 3


def test_source_type_changed_without_add_remove():
    before = {
        "modules": [
            {
                "name": "main",
                "sources": [
                    {"type": "archive", "url": "https://example.com/a", "dest": "src"}
                ],
            }
        ]
    }
    after = {
        "modules": [
            {
                "name": "main",
                "sources": [
                    {"type": "file", "url": "https://example.com/a", "dest": "src"}
                ],
            }
        ]
    }
    analysis = result(before, after)
    assert kinds(analysis) == [ManifestChangeKind.SOURCE_TYPE_CHANGED]


def test_source_options_changed():
    before = {
        "modules": [
            {
                "name": "main",
                "sources": [
                    {"type": "archive", "url": "https://example.com/a", "dest": "one"}
                ],
            }
        ]
    }
    after = {
        "modules": [
            {
                "name": "main",
                "sources": [
                    {"type": "archive", "url": "https://example.com/a", "dest": "two"}
                ],
            }
        ]
    }
    analysis = result(before, after)
    assert kinds(analysis) == [ManifestChangeKind.SOURCE_OPTIONS_CHANGED]
    assert analysis.score_units == 2


@pytest.mark.parametrize("source_type", ["patch", "script", "shell"])
def test_patch_script_shell_add_has_addon(source_type):
    source = {"type": source_type}
    if source_type == "patch":
        source["path"] = "fix.patch"
    analysis = result(
        module_manifest([]),
        module_manifest([source]),
    )
    assert kinds(analysis) == [ManifestChangeKind.PATCH_OR_SCRIPT_ADDED]
    assert analysis.events[0].new_summary == {"type": source_type}
    assert analysis.score_units == 2


def test_source_reorder():
    one = {"type": "archive", "url": "https://example.com/one"}
    two = {"type": "file", "url": "https://example.com/two"}
    before = {"modules": [{"name": "main", "sources": [one, two]}]}
    after = {"modules": [{"name": "main", "sources": [two, one]}]}
    analysis = result(before, after)
    assert kinds(analysis) == [ManifestChangeKind.SOURCE_ORDER_CHANGED]
    assert analysis.score_units == 2


@pytest.mark.parametrize(
    ("before_module", "after_module", "kind", "units"),
    [
        (
            {"buildsystem": "simple"},
            {"buildsystem": "meson"},
            ManifestChangeKind.BUILDSYSTEM_CHANGED,
            6,
        ),
        (
            {"config-opts": ["-Done"]},
            {"config-opts": ["-Dtwo"]},
            ManifestChangeKind.CONFIG_OPTIONS_CHANGED,
            2,
        ),
        (
            {"build-commands": ["echo one"]},
            {"build-commands": ["echo two"]},
            ManifestChangeKind.BUILD_COMMANDS_CHANGED,
            4,
        ),
        (
            {"post-install": ["echo one"]},
            {"post-install": ["echo two"]},
            ManifestChangeKind.POST_INSTALL_CHANGED,
            4,
        ),
        (
            {"build-options": {"env": {"A": "1"}}},
            {"build-options": {"env": {"A": "2"}}},
            ManifestChangeKind.BUILD_OPTIONS_CHANGED,
            2,
        ),
        (
            {"subdir": "one"},
            {"subdir": "two"},
            ManifestChangeKind.MODULE_LAYOUT_CHANGED,
            1,
        ),
        (
            {"only-arches": ["x86_64"]},
            {"only-arches": ["aarch64"]},
            ManifestChangeKind.ARCH_SELECTION_CHANGED,
            3,
        ),
    ],
)
def test_module_recipe_events(before_module, after_module, kind, units):
    before = {"modules": [{"name": "main", **before_module}]}
    after = {"modules": [{"name": "main", **after_module}]}
    analysis = result(before, after)
    assert kinds(analysis) == [kind]
    assert analysis.score_units == units


def test_command_whitespace_normalization():
    before = {
        "modules": [
            {"name": "main", "build-commands": ["\n  echo one  \r\n  echo two\r\n"]}
        ]
    }
    after = {"modules": [{"name": "main", "build-commands": ["echo one\necho two"]}]}
    assert result(before, after).score_units == 0


@pytest.mark.parametrize(
    ("field", "kind", "units"),
    [
        ("runtime", ManifestChangeKind.RUNTIME_ID_CHANGED, 6),
        ("sdk", ManifestChangeKind.SDK_ID_CHANGED, 6),
        ("command", ManifestChangeKind.APPLICATION_COMMAND_CHANGED, 4),
    ],
)
def test_top_level_identity_events(field, kind, units):
    before = {"modules": [], field: "old"}
    after = {"modules": [], field: "new"}
    analysis = result(before, after)
    assert kinds(analysis) == [kind]
    assert analysis.score_units == units


def test_top_level_cleanup_and_extensions():
    cleanup = result(
        {"modules": [], "cleanup": ["old"]}, {"modules": [], "cleanup": ["new"]}
    )
    assert kinds(cleanup) == [ManifestChangeKind.TOP_LEVEL_CLEANUP_CHANGED]
    extensions = result(
        {"modules": [], "sdk-extensions": ["one"]},
        {"modules": [], "sdk-extensions": ["two"]},
    )
    assert kinds(extensions) == [ManifestChangeKind.EXTENSIONS_CHANGED]


def test_architecture_merge_scores_once():
    before = {"modules": [{"name": "main", "buildsystem": "simple"}]}
    after = {"modules": [{"name": "main", "buildsystem": "meson"}]}
    groups = tuple(
        (manifest_pair(before, after, arch=arch),) for arch in ("x86_64", "aarch64")
    )
    analysis = analyze_manifest_complexity(groups)
    assert isinstance(analysis, ManifestComplexityResult)
    assert analysis.score_units == 6
    assert analysis.events[0].arches == ("aarch64", "x86_64")
    assert analysis.affected_arches == ("aarch64", "x86_64")


def test_source_set_architecture_variants_merge_once():
    before = module_manifest(local_sources(1))
    after = module_manifest(local_sources(2))
    groups = tuple(
        (manifest_pair(before, after, arch=arch),) for arch in ("x86_64", "aarch64")
    )

    analysis = analyze_manifest_complexity(groups)

    assert isinstance(analysis, ManifestComplexityResult)
    assert kinds(analysis) == [ManifestChangeKind.SOURCE_SET_CHANGED]
    assert analysis.events[0].arches == ("aarch64", "x86_64")
    assert analysis.events[0].new_summary == {
        "added": 1,
        "removed": 0,
        "changed": 1,
    }
    assert analysis.events[0].magnitude == 1
    assert analysis.recipe_units == 1
    assert analysis.score_units == 1


def test_broad_score_is_capped_with_raw_score():
    before = {"runtime": "old", "sdk": "old", "command": "old", "modules": []}
    after = {
        "runtime": "new",
        "sdk": "new",
        "command": "new",
        "cleanup": ["x"],
        "sdk-extensions": ["ext"],
        "modules": [
            {
                "name": f"module-{index}",
                "buildsystem": "meson",
                "build-commands": ["echo one two three four five six seven eight"],
            }
            for index in range(10)
        ],
    }
    analysis = result(before, after)
    assert analysis.raw_score_units > 40
    assert analysis.score_units == 40


def test_dictionary_order_is_deterministic():
    before = {
        "modules": [{"name": "main", "build-options": {"env": {"A": "1", "B": "2"}}}]
    }
    after = {
        "modules": [{"name": "main", "build-options": {"env": {"A": "2", "B": "3"}}}]
    }
    reordered = deepcopy(after)
    reordered["modules"][0]["build-options"]["env"] = {"B": "3", "A": "2"}
    assert result(before, after) == result(before, reordered)


def test_not_scored_reasons_and_version():
    empty = analyze_manifest_complexity(((),))
    assert empty == ManifestComplexityNotScored(
        MANIFEST_COMPLEXITY_ALGORITHM_VERSION,
        ManifestComplexityNotScoredReason.NO_MANIFEST_GROUPS,
        (),
    )
    missing = analyze_manifest_complexity(
        ((manifest_pair({}, {}, status=PublishedManifestStatus.REF_MISSING),),)
    )
    assert isinstance(missing, ManifestComplexityNotScored)
    assert missing.reason is ManifestComplexityNotScoredReason.PUBLISHED_REF_MISSING
    malformed = analyze_manifest_complexity(((manifest_pair([], {}),),))
    assert isinstance(malformed, ManifestComplexityNotScored)
    assert (
        malformed.reason
        is ManifestComplexityNotScoredReason.UNSUPPORTED_MANIFEST_STRUCTURE
    )


def test_mixed_apps_are_not_scored():
    group_one = (manifest_pair({}, {}, app_id="org.example.One"),)
    group_two = (manifest_pair({}, {}, app_id="org.example.Two"),)
    analysis = analyze_manifest_complexity((group_one, group_two))
    assert isinstance(analysis, ManifestComplexityNotScored)
    assert (
        analysis.reason
        is ManifestComplexityNotScoredReason.UNSUPPORTED_MANIFEST_STRUCTURE
    )
