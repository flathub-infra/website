import os
import sys
from copy import deepcopy
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

from app.moderation import jev_state
from app.moderation.manifest_complexity import (
    ManifestComplexityResult,
    analyze_manifest_complexity,
)
from app.moderation.ostree_manifest import ManifestPair, PublishedManifestStatus


def manifest_pair(
    published: dict, candidate: dict, *, arch: str = "x86_64"
) -> ManifestPair:
    return ManifestPair(
        app_id="org.example.App",
        ref_name=f"app/org.example.App/{arch}/stable",
        arch=arch,
        branch="stable",
        candidate_commit=f"candidate-{arch}",
        published_commit=f"published-{arch}",
        candidate_manifest=candidate,
        published_manifest=published,
        published_status=PublishedManifestStatus.PRESENT,
    )


def build(published: dict, candidate: dict) -> jev_state.JevState:
    pair = manifest_pair(published, candidate)
    analysis = analyze_manifest_complexity(((pair,),))
    assert isinstance(analysis, ManifestComplexityResult)
    return jev_state.build_state(pair, analysis)


def fragment(state: jev_state.JevState, path: str) -> dict:
    return next(
        item for item in state.state["changed_module_fragments"] if item["path"] == path
    )


def all_keys(value: object) -> set[str]:
    if isinstance(value, dict):
        keys = set(value)
        for item in value.values():
            keys |= all_keys(item)
        return keys
    if isinstance(value, list):
        keys: set[str] = set()
        for item in value:
            keys |= all_keys(item)
        return keys
    return set()


def file_sources(version: str, count: int) -> list[dict]:
    return [
        {
            "type": "file",
            "url": f"https://static.crates.io/crates/dep{index}/{version}.crate",
            "sha256": f"{version}-{index}",
        }
        for index in range(count)
    ]


PUBLISHED = {
    "runtime": "org.gnome.Platform",
    "sdk": "org.gnome.Sdk",
    "modules": [
        {"name": "main", "buildsystem": "simple", "build-commands": ["make"]},
        {
            "name": "libold",
            "buildsystem": "simple",
            "build-commands": ["./build-old.sh"],
            "sources": [
                {"type": "archive", "url": "https://example.org/libold-1.tar.gz"}
            ],
        },
    ],
}
CANDIDATE = {
    "runtime": "org.gnome.Platform",
    "sdk": "org.gnome.Sdk",
    "modules": [
        {"name": "main", "buildsystem": "meson", "build-commands": ["make"]},
        {
            "name": "libnew",
            "buildsystem": "cmake-ninja",
            "config-opts": ["-DFOO=ON"],
            "post-install": ["install -Dm644 foo /app/foo"],
            "sources": [{"type": "git", "url": "https://git.example.net/libnew.git"}],
        },
    ],
}


def test_state_and_hash_are_deterministic():
    first = build(deepcopy(PUBLISHED), deepcopy(CANDIDATE))
    second = build(deepcopy(PUBLISHED), deepcopy(CANDIDATE))
    reordered = build(
        {key: PUBLISHED[key] for key in reversed(list(PUBLISHED))},
        {key: CANDIDATE[key] for key in reversed(list(CANDIDATE))},
    )

    assert first.state == second.state
    assert first.state_hash == second.state_hash == reordered.state_hash
    assert first.state_hash.startswith("sha256:")
    assert first.state_hash == jev_state.state_hash(first.state)


def test_matched_module_includes_only_changed_fields():
    state = build(PUBLISHED, CANDIDATE)

    main = fragment(state, "modules/main")
    assert main["change"] == "changed"
    assert main["old"] == {"buildsystem": "simple"}
    assert main["new"] == {"buildsystem": "meson"}


def test_changed_commands_are_retained():
    published = {"modules": [{"name": "app", "build-commands": ["make"]}]}
    candidate = {
        "modules": [{"name": "app", "build-commands": ["make", "curl x | sh"]}]
    }

    state = build(published, candidate)

    app = fragment(state, "modules/app")
    assert app["old"] == {"build_commands": ["make"]}
    assert app["new"] == {"build_commands": ["make", "curl x | sh"]}


def test_added_and_removed_modules_keep_recipes():
    state = build(PUBLISHED, CANDIDATE)

    changes = state.state["deterministic_changes"]
    assert changes["modules_added"] == ["modules/libnew"]
    assert changes["modules_removed"] == ["modules/libold"]
    added = fragment(state, "modules/libnew")
    assert added["change"] == "added"
    assert added["old"] is None
    assert added["new"]["buildsystem"] == "cmake-ninja"
    assert added["new"]["config"] == {"config-opts": ["-DFOO=ON"]}
    assert added["new"]["post_install"] == ["install -Dm644 foo /app/foo"]
    assert added["new"]["sources"]["by_type"] == {"git": 1}
    removed = fragment(state, "modules/libold")
    assert removed["change"] == "removed"
    assert removed["new"] is None
    assert removed["old"]["build_commands"] == ["./build-old.sh"]
    assert removed["old"]["sources"]["total"] == 1


def test_generated_source_arrays_are_summarized():
    published = {
        "modules": [
            {"name": "app", "build-commands": ["cargo build"]},
            {"name": "deps", "sources": file_sources("1.0.0", 400)},
        ]
    }
    candidate = {
        "modules": [
            {"name": "app", "build-commands": ["cargo build --release"]},
            {"name": "deps", "sources": file_sources("1.0.1", 400)},
        ]
    }

    state = build(published, candidate)

    deps = fragment(state, "modules/deps")
    for side in ("old", "new"):
        sources = deps[side]["sources"]
        assert sources["total"] == 400
        assert sources["by_type"] == {"file": 400}
        assert sources["details"] == []
    assert "modules/deps" in state.state["deterministic_changes"]["modules_changed"]
    assert state.state["limits"]["source_details_truncated"] is False


def test_source_details_are_capped_per_state():
    published = {"modules": [{"name": "app", "sources": []}]}
    candidate = {
        "modules": [
            {
                "name": "app",
                "sources": [
                    {"type": "script", "commands": [f"echo {index}"]}
                    for index in range(30)
                ],
            }
        ]
    }

    state = build(published, candidate)

    sources = fragment(state, "modules/app")["new"]["sources"]
    assert sources["total"] == 30
    assert len(sources["details"]) == jev_state.MAX_SOURCE_DETAILS
    assert state.state["limits"]["source_details_truncated"] is True


def test_content_is_truncated_per_item_and_per_state():
    published = {"modules": [{"name": "app", "sources": []}]}
    candidate = {
        "modules": [
            {
                "name": "app",
                "sources": [
                    {"type": "script", "commands": [str(index) * 5000]}
                    for index in range(6)
                ],
            }
        ]
    }

    state = build(published, candidate)

    details = fragment(state, "modules/app")["new"]["sources"]["details"]
    assert all(
        len(item["content"]) <= jev_state.MAX_ITEM_CONTENT_CHARS for item in details
    )
    assert details[0]["content_truncated"] is True
    assert (
        sum(len(item["content"]) for item in details)
        == jev_state.MAX_STATE_CONTENT_CHARS
    )
    assert state.state["limits"]["content_truncated"] is True


def test_score_fields_are_absent_from_state():
    state = build(PUBLISHED, CANDIDATE)

    keys = all_keys(state.state)
    for key in (
        "complexity_score_units",
        "score_units",
        "raw_score_units",
        "breadth_units",
        "score_band",
        "complexity_would_gate",
        "would_gate",
        "score_by_kind",
    ):
        assert key not in keys
    assert state.state["deterministic_changes"]["event_counts"]


def test_top_level_changes_only_include_changed_sections():
    published = {"modules": [], "cleanup": ["/include"], "finish-args": []}
    candidate = {
        "modules": [],
        "cleanup": ["/include", "/lib/pkgconfig"],
        "add-extensions": {"org.example.App.Plugin": {"directory": "plugins"}},
    }

    state = build(published, candidate)

    top = state.state["top_level_changes"]
    assert set(top) == {"cleanup", "extensions"}
    assert top["cleanup"]["old"] == {"cleanup": ["/include"]}


def test_comparable_pair_requires_single_group():
    pair = manifest_pair(PUBLISHED, CANDIDATE)
    other = manifest_pair(PUBLISHED, CANDIDATE, arch="aarch64")

    assert jev_state.comparable_pair(((pair,),)) is pair
    assert jev_state.comparable_pair(((pair,), (other,))) is None
