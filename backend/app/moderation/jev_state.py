import hashlib
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast

from . import manifest_complexity
from .manifest_complexity import ManifestChangeKind, ManifestComplexityResult
from .ostree_manifest import ManifestPair, PublishedManifestStatus

STATE_SCHEMA_VERSION = 2
MAX_SOURCE_DETAILS = 24
MAX_ITEM_CONTENT_CHARS = 2048
MAX_STATE_CONTENT_CHARS = 8192

_CONTENT_SOURCE_TYPES = frozenset({"script", "shell", "inline"})
_CONTENT_OPTION_KEYS = frozenset({"commands", "command", "contents"})


@dataclass(frozen=True)
class JevState:
    state: dict[str, Any]
    state_hash: str


@dataclass(frozen=True)
class _IndexedModule:
    module: manifest_complexity._NormalizedModule
    raw_sources: tuple[dict[str, Any], ...]
    children: tuple[str, ...]


class _ContentBudget:
    def __init__(self) -> None:
        self.remaining = MAX_STATE_CONTENT_CHARS
        self.truncated = False

    def take(self, text: str) -> tuple[str, bool]:
        limit = min(MAX_ITEM_CONTENT_CHARS, self.remaining)
        truncated = len(text) > limit
        if truncated:
            self.truncated = True
            text = text[:limit]
        self.remaining -= len(text)
        return text, truncated


def _index_modules(
    raw_modules: Sequence[dict[str, Any]],
    modules: Sequence[manifest_complexity._NormalizedModule],
    parent: str,
    index: dict[str, _IndexedModule],
) -> None:
    paths = manifest_complexity._module_paths(modules, parent)
    for raw, module, path in zip(raw_modules, modules, paths, strict=True):
        child_parent = f"{path}/modules"
        index[path] = _IndexedModule(
            module,
            tuple(
                source
                for source in raw.get("sources", [])
                if source.get("type") != "extra-data"
            ),
            tuple(manifest_complexity._module_paths(module.children, child_parent)),
        )
        _index_modules(raw.get("modules", []), module.children, child_parent, index)


def _recipe(module: manifest_complexity._NormalizedModule) -> dict[str, Any]:
    return {
        "buildsystem": module.buildsystem,
        "build_commands": list(module.build_commands),
        "post_install": list(module.post_install),
        "config": module.config_bundle,
        "build_options": module.build_options,
        "architecture": module.arch_selectors,
        "layout": module.layout,
    }


def _source_content(raw: dict[str, Any]) -> str | None:
    if raw.get("type") not in _CONTENT_SOURCE_TYPES:
        return None
    commands = raw.get("commands")
    if isinstance(commands, list):
        return "\n".join(item for item in commands if isinstance(item, str))
    contents = raw.get("contents")
    if isinstance(contents, str):
        return contents
    return None


def _unmatched_indices(
    sources: Sequence[dict[str, Any]], other: Sequence[dict[str, Any]]
) -> list[int]:
    available = Counter(manifest_complexity._canonical(source) for source in other)
    result = []
    for index, source in enumerate(sources):
        key = manifest_complexity._canonical(source)
        if available[key]:
            available[key] -= 1
        else:
            result.append(index)
    return result


def _source_details(
    indexed: _IndexedModule, indices: Sequence[int], change: str | None
) -> list[dict[str, Any]]:
    details = []
    for index in indices:
        raw = indexed.raw_sources[index]
        normalized = indexed.module.sources[index]
        if normalized.identity.locator_kind == "remote":
            continue
        detail: dict[str, Any] = {"index": index, "type": normalized.source_type}
        if change is not None:
            detail["change"] = change
        for key in ("url", "path"):
            value = raw.get(key)
            if isinstance(value, str):
                detail[key] = manifest_complexity._bounded_string(value)
        options = {
            key: value
            for key, value in normalized.options.items()
            if key not in _CONTENT_OPTION_KEYS
        }
        if options:
            detail["options"] = options
        content = _source_content(raw)
        if content is not None:
            detail["content"] = content
        details.append(detail)
    return details


def _source_summary(indexed: _IndexedModule) -> dict[str, Any]:
    return {
        "total": len(indexed.raw_sources),
        "by_type": dict(
            sorted(Counter(item.source_type for item in indexed.module.sources).items())
        ),
        "details": [],
    }


def _full_side(indexed: _IndexedModule) -> dict[str, Any]:
    recipe = _recipe(indexed.module)
    recipe["modules"] = list(indexed.children)
    recipe["sources"] = _source_summary(indexed)
    recipe["sources"]["details"] = _source_details(
        indexed, range(len(indexed.raw_sources)), None
    )
    return recipe


def _matched_sides(
    old: _IndexedModule, new: _IndexedModule
) -> tuple[dict[str, Any], dict[str, Any]]:
    old_side: dict[str, Any] = {}
    new_side: dict[str, Any] = {}
    old_recipe = _recipe(old.module)
    new_recipe = _recipe(new.module)
    for key in old_recipe:
        if old_recipe[key] != new_recipe[key]:
            old_side[key] = old_recipe[key]
            new_side[key] = new_recipe[key]
    if manifest_complexity._canonical(
        list(old.raw_sources)
    ) != manifest_complexity._canonical(list(new.raw_sources)):
        for side, indexed, other, change in (
            (new_side, new, old, "added"),
            (old_side, old, new, "removed"),
        ):
            side["sources"] = _source_summary(indexed)
            side["sources"]["details"] = _source_details(
                indexed,
                _unmatched_indices(indexed.raw_sources, other.raw_sources),
                change,
            )
    return old_side, new_side


def _commands(side: dict[str, Any] | None) -> list[list[str]]:
    if side is None:
        return []
    return [side[key] for key in ("build_commands", "post_install") if key in side]


def state_hash(state: dict[str, Any]) -> str:
    canonical = manifest_complexity._canonical(state)
    return "sha256:" + hashlib.sha256(canonical.encode()).hexdigest()


def comparable_pair(groups: Sequence[Sequence[ManifestPair]]) -> ManifestPair | None:
    comparable = [
        group
        for group in groups
        if group
        and all(
            pair.published_status is PublishedManifestStatus.PRESENT for pair in group
        )
    ]
    if len(comparable) != 1:
        return None
    return comparable[0][0]


def build_state(pair: ManifestPair, result: ManifestComplexityResult) -> JevState:
    raw_old = cast("dict[str, Any]", pair.published_manifest)
    raw_new = pair.candidate_manifest
    old = manifest_complexity._normalize_manifest(raw_old)
    new = manifest_complexity._normalize_manifest(raw_new)
    old_index: dict[str, _IndexedModule] = {}
    new_index: dict[str, _IndexedModule] = {}
    _index_modules(raw_old.get("modules", []), old.modules, "modules", old_index)
    _index_modules(raw_new.get("modules", []), new.modules, "modules", new_index)

    added = sorted(
        {
            event.location
            for event in result.events
            if event.kind is ManifestChangeKind.MODULE_ADDED
        }
    )
    removed = sorted(
        {
            event.location
            for event in result.events
            if event.kind is ManifestChangeKind.MODULE_REMOVED
        }
    )
    moved_from: dict[str, str] = {}
    for event in result.events:
        if (
            event.kind is ManifestChangeKind.MODULE_LAYOUT_CHANGED
            and isinstance(event.old_summary, dict)
            and isinstance(event.old_summary.get("from"), str)
        ):
            moved_from[event.location] = cast("str", event.old_summary["from"])
    changed_paths = (
        set(result.touched_modules)
        - set(added)
        - set(removed)
        - set(moved_from.values())
    )
    changed_paths.update(
        path
        for path, indexed in new_index.items()
        if path in old_index
        and path not in moved_from
        and path not in added
        and path not in removed
        and manifest_complexity._canonical(list(indexed.raw_sources))
        != manifest_complexity._canonical(list(old_index[path].raw_sources))
    )
    changed = sorted(changed_paths)

    fragments: list[dict[str, Any]] = []
    for path in added:
        if path in new_index:
            new_side = _full_side(new_index[path])
            fragments.append(
                {"path": path, "change": "added", "old": None, "new": new_side}
            )
    for path in removed:
        if path in old_index:
            old_side = _full_side(old_index[path])
            fragments.append(
                {"path": path, "change": "removed", "old": old_side, "new": None}
            )
    for path in changed:
        old_module = old_index.get(moved_from.get(path, path))
        new_module = new_index.get(path)
        fragment: dict[str, Any] = {"path": path, "change": "changed"}
        if path in moved_from:
            fragment["moved_from"] = moved_from[path]
        if old_module is not None and new_module is not None:
            old_side, new_side = _matched_sides(old_module, new_module)
            if not old_side and not new_side:
                continue
            fragment["old"] = old_side
            fragment["new"] = new_side
        elif new_module is not None:
            fragment["old"] = None
            fragment["new"] = _full_side(new_module)
        elif old_module is not None:
            fragment["old"] = _full_side(old_module)
            fragment["new"] = None
        else:
            continue
        fragments.append(fragment)
    fragments.sort(key=lambda item: (item["path"], item["change"]))

    budget = _ContentBudget()
    for fragment in fragments:
        for side_name in ("old", "new"):
            for commands in _commands(fragment[side_name]):
                for position, command in enumerate(commands):
                    commands[position], _ = budget.take(command)

    remaining_details = MAX_SOURCE_DETAILS
    source_details_truncated = False
    for fragment in fragments:
        for side_name in ("new", "old"):
            side = fragment[side_name]
            if side is None or "sources" not in side:
                continue
            details = side["sources"]["details"]
            if len(details) > remaining_details:
                source_details_truncated = True
                del details[remaining_details:]
            remaining_details -= len(details)
            for detail in details:
                if "content" in detail:
                    detail["content"], truncated = budget.take(detail["content"])
                    if truncated:
                        detail["content_truncated"] = True

    top_level_changes: dict[str, Any] = {}
    for key, before, after in (
        ("build_options", old.build_options, new.build_options),
        ("extensions", old.extensions, new.extensions),
        ("cleanup", old.cleanup, new.cleanup),
        ("architecture", old.arch_selectors, new.arch_selectors),
    ):
        if before != after:
            top_level_changes[key] = {"old": before, "new": after}

    state: dict[str, Any] = {
        "old": {"runtime": old.runtime, "sdk": old.sdk, "modules": list(old_index)},
        "new": {"runtime": new.runtime, "sdk": new.sdk, "modules": list(new_index)},
        "deterministic_changes": {
            "modules_added": added,
            "modules_removed": removed,
            "modules_changed": changed,
            "source_count_before": sum(
                len(item.raw_sources) for item in old_index.values()
            ),
            "source_count_after": sum(
                len(item.raw_sources) for item in new_index.values()
            ),
            "runtime_changed": old.runtime != new.runtime,
            "sdk_changed": old.sdk != new.sdk,
            "event_counts": {
                kind.value: count for kind, count in result.event_count_by_kind.items()
            },
        },
        "changed_module_fragments": fragments,
        "top_level_changes": top_level_changes,
        "limits": {
            "source_details_truncated": source_details_truncated,
            "content_truncated": budget.truncated,
        },
    }
    return JevState(state=state, state_hash=state_hash(state))
