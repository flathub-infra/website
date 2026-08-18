import hashlib
import json
import re
import textwrap
from collections import Counter, defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Literal, cast
from urllib.parse import quote, urlsplit, urlunsplit

from .ostree_manifest import ManifestPair, PublishedManifestStatus
from .url_origin import InvalidUrlOrigin, normalize_manifest_source_url

MANIFEST_COMPLEXITY_ALGORITHM_VERSION = 4
MANIFEST_COMPLEXITY_UNITS_PER_POINT = 2
MANIFEST_COMPLEXITY_MAX_SCORE_UNITS = 40
type JSONValue = (
    str | int | float | bool | None | list["JSONValue"] | dict[str, "JSONValue"]
)
type _SourceLocator = str | tuple[str, ...] | None


class ManifestChangeKind(StrEnum):
    MODULE_ADDED = "module_added"
    MODULE_REMOVED = "module_removed"
    MODULE_MATCH_AMBIGUOUS = "module_match_ambiguous"
    SOURCE_TYPE_CHANGED = "source_type_changed"
    SOURCE_OPTIONS_CHANGED = "source_options_changed"
    SOURCE_ORDER_CHANGED = "source_order_changed"
    PATCH_OR_SCRIPT_ADDED = "patch_or_script_added"
    SOURCE_SET_CHANGED = "source_set_changed"
    BUILDSYSTEM_CHANGED = "buildsystem_changed"
    BUILD_COMMANDS_CHANGED = "build_commands_changed"
    POST_INSTALL_CHANGED = "post_install_changed"
    CONFIG_OPTIONS_CHANGED = "config_options_changed"
    BUILD_OPTIONS_CHANGED = "build_options_changed"
    MODULE_LAYOUT_CHANGED = "module_layout_changed"
    TOP_LEVEL_CLEANUP_CHANGED = "top_level_cleanup_changed"
    EXTENSIONS_CHANGED = "extensions_changed"
    RUNTIME_ID_CHANGED = "runtime_id_changed"
    SDK_ID_CHANGED = "sdk_id_changed"
    APPLICATION_COMMAND_CHANGED = "application_command_changed"
    ARCH_SELECTION_CHANGED = "arch_selection_changed"


class ManifestComplexityNotScoredReason(StrEnum):
    INITIAL_SUBMISSION = "initial_submission"
    CANDIDATE_MANIFEST_UNAVAILABLE = "candidate_manifest_unavailable"
    PUBLISHED_REF_MISSING = "published_ref_missing"
    PUBLISHED_MANIFEST_MISSING = "published_manifest_missing"
    PUBLISHED_MANIFEST_INVALID = "published_manifest_invalid"
    NO_MANIFEST_GROUPS = "no_manifest_groups"
    UNSUPPORTED_MANIFEST_STRUCTURE = "unsupported_manifest_structure"


class ManifestComplexityScoreBand(StrEnum):
    ROUTINE = "routine"
    SMALL = "small"
    MODERATE = "moderate"
    LARGE = "large"
    MAJOR = "major"


@dataclass(frozen=True)
class ManifestChange:
    kind: ManifestChangeKind
    location: str
    arches: tuple[str, ...]
    old_summary: JSONValue | None
    new_summary: JSONValue | None
    magnitude: int | None = None


@dataclass(frozen=True)
class BuildCommandChangeTelemetry:
    event_count: int
    distinct_fingerprint_count: int
    fingerprint_group_sizes: tuple[int, ...]


@dataclass(frozen=True)
class ManifestComplexityResult:
    algorithm_version: int
    score_units: int
    raw_score_units: int
    structural_units: int
    recipe_units: int
    breadth_units: int
    ambiguity_units: int
    events: tuple[ManifestChange, ...]
    touched_modules: tuple[str, ...]
    affected_arches: tuple[str, ...]
    changed_categories: tuple[str, ...]
    command_change_telemetry: BuildCommandChangeTelemetry = field(
        default=BuildCommandChangeTelemetry(0, 0, ()), compare=False, repr=False
    )


@dataclass(frozen=True)
class ManifestComplexityNotScored:
    algorithm_version: int
    reason: ManifestComplexityNotScoredReason
    affected_arches: tuple[str, ...]


type ManifestComplexityAnalysis = ManifestComplexityResult | ManifestComplexityNotScored


@dataclass(frozen=True)
class CommandChangeSummary:
    added_commands: int
    removed_commands: int
    replaced_commands: int
    changed_token_count: int


@dataclass(frozen=True)
class _SourceIdentity:
    source_type: str
    locator_kind: Literal["remote", "local", "generated"]
    locator: _SourceLocator


@dataclass(frozen=True)
class _NormalizedSource:
    source_type: str
    identity: _SourceIdentity
    stable_fingerprint: str
    type_agnostic_fingerprint: str
    primary_origin: str | None
    options_json: str
    options: dict[str, JSONValue]


@dataclass(frozen=True)
class _ModuleFingerprint:
    buildsystem: str | None
    sources: tuple[_SourceIdentity, ...]
    subdir: str | None
    children: tuple["_ModuleFingerprint", ...]


@dataclass(frozen=True)
class _NormalizedModule:
    name: str | None
    buildsystem: str | None
    sources: tuple[_NormalizedSource, ...]
    subdir: str | None
    children: tuple["_NormalizedModule", ...]
    build_commands: tuple[str, ...]
    post_install: tuple[str, ...]
    config_bundle: dict[str, JSONValue]
    build_options: dict[str, JSONValue]
    arch_selectors: dict[str, JSONValue]
    layout: dict[str, JSONValue]
    fingerprint: _ModuleFingerprint


@dataclass(frozen=True)
class _NormalizedManifest:
    modules: tuple[_NormalizedModule, ...]
    runtime: str | None
    sdk: str | None
    command: str | None
    cleanup: dict[str, JSONValue]
    extensions: dict[str, JSONValue]
    build_options: dict[str, JSONValue]
    arch_selectors: dict[str, JSONValue]


@dataclass(frozen=True)
class _EventEnvelope:
    event: ManifestChange
    touched_modules: tuple[str, ...]
    command_change_fingerprint: str | None = None


class _Unsupported(ValueError):
    pass


_VOLATILE_SOURCE_KEYS = frozenset(
    {
        "sha256",
        "sha512",
        "sha1",
        "md5",
        "commit",
        "revision",
        "tag",
        "branch",
        "size",
        "download-size",
        "installed-size",
        "timestamp",
        "x-checker-data",
    }
)
_SET_LIKE_FIELDS = frozenset({"only-arches", "skip-arches"})
_EXTENSION_FIELDS = (
    "add-extensions",
    "add-build-extensions",
    "sdk-extensions",
    "platform-extensions",
    "base-extensions",
    "inherit-extensions",
    "inherit-sdk-extensions",
)
_CONFIG_FIELDS = (
    "config-opts",
    "make-args",
    "make-install-args",
    "install-rule",
    "rm-configure",
    "no-autogen",
    "no-parallel-make",
    "no-make-install",
    "builddir",
)
_SOURCE_OPTION_FIELDS = (
    "mirror-urls",
    "dest",
    "dest-filename",
    "subdir",
    "strip-components",
    "archive-type",
    "git-init",
    "disable-http-decompression",
    "referer",
    "disable-submodules",
    "disable-shallow-clone",
    "disable-fsckobjects",
    "use-git-am",
    "use-git",
    "paths",
    "skip",
    "only-arches",
    "skip-arches",
    "commands",
    "command",
    "contents",
)
_REMOTE_TYPES = frozenset({"archive", "git", "bzr", "svn"})
_VCS_TYPES = frozenset({"git", "bzr", "svn"})
_LOCAL_TYPES = frozenset({"dir"})
_GENERATED_TYPES = frozenset({"script", "shell", "inline"})
_SPECIAL_SOURCE_TYPES = frozenset({"patch", "script", "shell"})
_TOKEN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|[^\s]")
_SCORE_TABLE = {
    ManifestChangeKind.MODULE_ADDED: (5, 15),
    ManifestChangeKind.MODULE_REMOVED: (4, 12),
    ManifestChangeKind.MODULE_MATCH_AMBIGUOUS: (6, 12),
    ManifestChangeKind.SOURCE_TYPE_CHANGED: (5, 10),
    ManifestChangeKind.SOURCE_OPTIONS_CHANGED: (2, 6),
    ManifestChangeKind.SOURCE_ORDER_CHANGED: (2, 6),
    ManifestChangeKind.PATCH_OR_SCRIPT_ADDED: (2, 6),
    ManifestChangeKind.SOURCE_SET_CHANGED: (0, 6),
    ManifestChangeKind.BUILDSYSTEM_CHANGED: (6, 12),
    ManifestChangeKind.BUILD_COMMANDS_CHANGED: (4, 12),
    ManifestChangeKind.POST_INSTALL_CHANGED: (4, 8),
    ManifestChangeKind.CONFIG_OPTIONS_CHANGED: (2, 8),
    ManifestChangeKind.BUILD_OPTIONS_CHANGED: (2, 8),
    ManifestChangeKind.MODULE_LAYOUT_CHANGED: (1, 4),
    ManifestChangeKind.TOP_LEVEL_CLEANUP_CHANGED: (2, 4),
    ManifestChangeKind.EXTENSIONS_CHANGED: (2, 4),
    ManifestChangeKind.RUNTIME_ID_CHANGED: (6, 6),
    ManifestChangeKind.SDK_ID_CHANGED: (6, 6),
    ManifestChangeKind.APPLICATION_COMMAND_CHANGED: (4, 4),
    ManifestChangeKind.ARCH_SELECTION_CHANGED: (3, 6),
}
_STRUCTURAL_KINDS = frozenset(
    {
        ManifestChangeKind.MODULE_ADDED,
        ManifestChangeKind.MODULE_REMOVED,
        ManifestChangeKind.SOURCE_TYPE_CHANGED,
        ManifestChangeKind.SOURCE_ORDER_CHANGED,
        ManifestChangeKind.MODULE_LAYOUT_CHANGED,
    }
)
_CATEGORY_BY_KIND = {
    ManifestChangeKind.MODULE_ADDED: "module_structure",
    ManifestChangeKind.MODULE_REMOVED: "module_structure",
    ManifestChangeKind.MODULE_MATCH_AMBIGUOUS: "module_structure",
    ManifestChangeKind.MODULE_LAYOUT_CHANGED: "module_structure",
    ManifestChangeKind.SOURCE_TYPE_CHANGED: "sources",
    ManifestChangeKind.SOURCE_OPTIONS_CHANGED: "sources",
    ManifestChangeKind.SOURCE_ORDER_CHANGED: "sources",
    ManifestChangeKind.PATCH_OR_SCRIPT_ADDED: "sources",
    ManifestChangeKind.SOURCE_SET_CHANGED: "sources",
    ManifestChangeKind.BUILD_COMMANDS_CHANGED: "commands",
    ManifestChangeKind.POST_INSTALL_CHANGED: "commands",
    ManifestChangeKind.BUILDSYSTEM_CHANGED: "build_configuration",
    ManifestChangeKind.CONFIG_OPTIONS_CHANGED: "build_configuration",
    ManifestChangeKind.BUILD_OPTIONS_CHANGED: "build_configuration",
    ManifestChangeKind.TOP_LEVEL_CLEANUP_CHANGED: "build_configuration",
    ManifestChangeKind.EXTENSIONS_CHANGED: "build_configuration",
    ManifestChangeKind.RUNTIME_ID_CHANGED: "runtime_application",
    ManifestChangeKind.SDK_ID_CHANGED: "runtime_application",
    ManifestChangeKind.APPLICATION_COMMAND_CHANGED: "runtime_application",
    ManifestChangeKind.ARCH_SELECTION_CHANGED: "architecture",
}
_BASELINE_REASON = {
    PublishedManifestStatus.REF_MISSING: ManifestComplexityNotScoredReason.PUBLISHED_REF_MISSING,
    PublishedManifestStatus.MANIFEST_MISSING: ManifestComplexityNotScoredReason.PUBLISHED_MANIFEST_MISSING,
    PublishedManifestStatus.MANIFEST_INVALID: ManifestComplexityNotScoredReason.PUBLISHED_MANIFEST_INVALID,
}
_REASON_ORDER = {
    ManifestComplexityNotScoredReason.PUBLISHED_REF_MISSING: 0,
    ManifestComplexityNotScoredReason.PUBLISHED_MANIFEST_MISSING: 1,
    ManifestComplexityNotScoredReason.PUBLISHED_MANIFEST_INVALID: 2,
    ManifestComplexityNotScoredReason.UNSUPPORTED_MANIFEST_STRUCTURE: 3,
}


def _canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def _bounded_string(value: str, limit: int = 160) -> str:
    return value if len(value) <= limit else value[: limit - 1] + "…"


def _summarize(value: JSONValue) -> JSONValue:
    if isinstance(value, str):
        return _bounded_string(value)
    if isinstance(value, list):
        return {"count": len(value), "values": [_summarize(item) for item in value[:3]]}
    if isinstance(value, dict):
        keys = sorted(value)
        return {
            "key_count": len(keys),
            "keys": [_bounded_string(key) for key in keys[:8]],
        }
    return value


def _json_value(value: object, *, set_like: bool = False) -> JSONValue:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    if isinstance(value, list):
        normalized = [_json_value(item) for item in value]
        if set_like:
            if not all(isinstance(item, str) for item in normalized):
                raise _Unsupported
            return cast("JSONValue", sorted(set(cast("list[str]", normalized))))
        return normalized
    if isinstance(value, dict):
        if not all(isinstance(key, str) for key in value):
            raise _Unsupported
        mapping = cast("dict[str, object]", value)
        return {key: _json_value(mapping[key]) for key in sorted(mapping)}
    raise _Unsupported


def _optional_string(mapping: Mapping[str, object], key: str) -> str | None:
    value = mapping.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise _Unsupported
    return value


def _normalize_patch_paths(source: Mapping[str, object]) -> tuple[str, ...]:
    paths: list[str] = []
    if "path" in source:
        path = source["path"]
        if not isinstance(path, str):
            raise _Unsupported
        if path:
            paths.append(path)
    if "paths" in source:
        raw_paths = source["paths"]
        if not isinstance(raw_paths, list) or not all(
            isinstance(item, str) for item in raw_paths
        ):
            raise _Unsupported
        paths.extend(cast("list[str]", raw_paths))
    if not paths:
        raise _Unsupported
    return tuple(paths)


def _normalize_commands(value: object) -> tuple[str, ...]:
    if value is None:
        return ()
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise _Unsupported
    result = []
    for item in cast("list[str]", value):
        text = item.replace("\r\n", "\n").replace("\r", "\n")
        text = "\n".join(line.rstrip() for line in text.split("\n"))
        text = textwrap.dedent(text)
        result.append(text.strip("\n"))
    return tuple(result)


def _command_change_fingerprint(old: Sequence[str], new: Sequence[str]) -> str:
    canonical = _canonical({"old": list(old), "new": list(new)})
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _invalid_locator(value: object) -> str:
    digest = hashlib.sha256(_canonical(_json_value(value)).encode()).hexdigest()
    return f"invalid-url:{digest}"


def _remote_origin(value: object) -> tuple[str, JSONValue]:
    try:
        origin = normalize_manifest_source_url(
            value,
            allowed_schemes=None,
            ignored_schemes=frozenset({"file"}),
        )
    except InvalidUrlOrigin:
        return _invalid_locator(value), "invalid URL"
    if origin is None:
        return _invalid_locator(value), "invalid URL"
    return origin, origin


def _vcs_locator(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = urlsplit(value)
    except ValueError:
        return None
    return urlunsplit((parsed.scheme.lower(), parsed.netloc, parsed.path, "", ""))


def _normalize_source(source: object) -> _NormalizedSource | None:
    if isinstance(source, str) or not isinstance(source, dict):
        raise _Unsupported
    source = cast("dict[str, object]", source)
    source_type = source.get("type")
    if not isinstance(source_type, str) or not source_type:
        raise _Unsupported
    if source_type == "extra-data":
        return None
    options: dict[str, JSONValue] = {}
    primary_origin: str | None = None
    locator_kind: Literal["remote", "local", "generated"]
    locator: _SourceLocator
    if source_type in _REMOTE_TYPES:
        locator_kind = "remote"
        if "url" not in source:
            raise _Unsupported
        locator, url_summary = _remote_origin(source["url"])
        primary_origin = locator if not locator.startswith("invalid-url:") else None
        if source_type in _VCS_TYPES:
            vcs_locator = _vcs_locator(source["url"])
            options["repository"] = vcs_locator or "invalid URL"
        elif url_summary == "invalid URL":
            options["url"] = url_summary
    elif source_type == "patch":
        locator_kind = "local"
        patch_paths = _normalize_patch_paths(source)
        if "paths" in source:
            locator = patch_paths
            options["paths"] = list(patch_paths)
        else:
            locator = patch_paths[0]
    elif source_type in _LOCAL_TYPES:
        locator_kind = "local"
        path = source.get("path")
        if not isinstance(path, str):
            raise _Unsupported
        locator = path
    elif source_type in _GENERATED_TYPES:
        locator_kind = "generated"
        locator = None
    else:
        path = source.get("path")
        if isinstance(path, str):
            locator_kind = "local"
            locator = path
        elif "url" in source:
            locator_kind = "remote"
            locator, url_summary = _remote_origin(source["url"])
            primary_origin = locator if not locator.startswith("invalid-url:") else None
            if url_summary == "invalid URL":
                options["url"] = url_summary
        else:
            locator_kind = "generated"
            locator = None
    if "mirror-urls" in source:
        mirrors = source["mirror-urls"]
        if not isinstance(mirrors, list):
            raise _Unsupported
        normalized_mirrors = sorted({_remote_origin(item)[0] for item in mirrors})
        options["mirror-urls"] = cast("JSONValue", normalized_mirrors)
    for key in _SOURCE_OPTION_FIELDS:
        if key not in source or key == "mirror-urls":
            continue
        if key == "paths" and source_type == "patch":
            continue
        if key == "dest-filename" and source_type == "archive":
            continue
        value = source[key]
        if key in {"commands", "command"}:
            commands = _normalize_commands(
                value if isinstance(value, list) else [value]
            )
            options[key] = [
                "sha256:" + hashlib.sha256(command.encode()).hexdigest()
                for command in commands
            ]
        elif key == "contents":
            if not isinstance(value, str):
                raise _Unsupported
            options[key] = "sha256:" + hashlib.sha256(value.encode()).hexdigest()
        else:
            options[key] = _json_value(value, set_like=key in _SET_LIKE_FIELDS)
    identity = _SourceIdentity(source_type, locator_kind, locator)
    stable = _canonical(
        {
            "type": source_type,
            "locator_kind": locator_kind,
            "locator": locator,
        }
    )
    placement = {
        key: value
        for key, value in options.items()
        if key
        in {
            "dest",
            "dest-filename",
            "subdir",
            "strip-components",
            "archive-type",
            "paths",
        }
    }
    type_agnostic = _canonical(
        {"locator_kind": locator_kind, "locator": locator, "placement": placement}
    )
    return _NormalizedSource(
        source_type=source_type,
        identity=identity,
        stable_fingerprint=stable,
        type_agnostic_fingerprint=type_agnostic,
        primary_origin=primary_origin,
        options_json=_canonical(options),
        options=options,
    )


def _mapping_bundle(
    mapping: Mapping[str, object], fields: Sequence[str]
) -> dict[str, JSONValue]:
    return {
        key: _json_value(mapping[key], set_like=key in _SET_LIKE_FIELDS)
        for key in fields
        if key in mapping
    }


def _split_build_options(
    value: object,
) -> tuple[dict[str, JSONValue], dict[str, JSONValue]]:
    if value is None:
        return {}, {}
    if not isinstance(value, dict):
        raise _Unsupported
    value = cast("dict[str, object]", value)
    normal: dict[str, JSONValue] = {
        key: _json_value(item) for key, item in sorted(value.items()) if key != "arch"
    }
    arch_value = value.get("arch", {})
    if not isinstance(arch_value, dict):
        raise _Unsupported
    arch_value = cast("dict[str, object]", arch_value)
    arch_keys: dict[str, JSONValue] = {
        "build-options.arch": cast("JSONValue", sorted(arch_value))
    }
    common = {key: _json_value(item) for key, item in sorted(arch_value.items())}
    if common:
        normal["arch"] = common
    return normal, arch_keys


def _normalize_module(value: object) -> _NormalizedModule:
    if isinstance(value, str) or not isinstance(value, dict):
        raise _Unsupported
    value = cast("dict[str, object]", value)
    name = _optional_string(value, "name")
    if name == "":
        name = None
    buildsystem = _optional_string(value, "buildsystem")
    if buildsystem is None and value.get("cmake") is True:
        buildsystem = "cmake"
    raw_sources = value.get("sources", [])
    if not isinstance(raw_sources, list):
        raise _Unsupported
    sources = tuple(
        normalized
        for source in raw_sources
        if (normalized := _normalize_source(source)) is not None
    )
    raw_children = value.get("modules", [])
    if not isinstance(raw_children, list):
        raise _Unsupported
    children = tuple(_normalize_module(child) for child in raw_children)
    subdir = _optional_string(value, "subdir")
    build_options, build_arch = _split_build_options(value.get("build-options"))
    selectors = _mapping_bundle(value, ("only-arches", "skip-arches"))
    selectors.update(build_arch)
    layout = _mapping_bundle(value, ("subdir", "cleanup", "disabled"))
    fingerprint = _ModuleFingerprint(
        buildsystem=buildsystem,
        sources=tuple(source.identity for source in sources),
        subdir=subdir,
        children=tuple(child.fingerprint for child in children),
    )
    return _NormalizedModule(
        name=name,
        buildsystem=buildsystem,
        sources=sources,
        subdir=subdir,
        children=children,
        build_commands=_normalize_commands(value.get("build-commands")),
        post_install=_normalize_commands(value.get("post-install")),
        config_bundle=_mapping_bundle(value, _CONFIG_FIELDS),
        build_options=build_options,
        arch_selectors=selectors,
        layout=layout,
        fingerprint=fingerprint,
    )


def _normalize_manifest(manifest: object) -> _NormalizedManifest:
    if not isinstance(manifest, dict):
        raise _Unsupported
    manifest = cast("dict[str, object]", manifest)
    raw_modules = manifest.get("modules", [])
    if not isinstance(raw_modules, list):
        raise _Unsupported
    if "sources" in manifest:
        raise _Unsupported
    build_options, build_arch = _split_build_options(manifest.get("build-options"))
    cleanup = _mapping_bundle(
        manifest,
        (
            "cleanup",
            "cleanup-commands",
            "cleanup-platform",
            "cleanup-platform-commands",
            "prepare-platform-commands",
        ),
    )
    extensions = _mapping_bundle(manifest, _EXTENSION_FIELDS)
    for key, value in list(extensions.items()):
        if isinstance(value, list):
            extensions[key] = cast("JSONValue", sorted(set(cast("list[str]", value))))
    return _NormalizedManifest(
        modules=tuple(_normalize_module(module) for module in raw_modules),
        runtime=_optional_string(manifest, "runtime"),
        sdk=_optional_string(manifest, "sdk"),
        command=_optional_string(manifest, "command"),
        cleanup=cleanup,
        extensions=extensions,
        build_options=build_options,
        arch_selectors=build_arch,
    )


def _fp_json(fingerprint: _ModuleFingerprint) -> str:
    return _canonical(
        {
            "buildsystem": fingerprint.buildsystem,
            "sources": [
                {
                    "source_type": source.source_type,
                    "locator_kind": source.locator_kind,
                    "locator": source.locator,
                }
                for source in fingerprint.sources
            ],
            "subdir": fingerprint.subdir,
            "children": [_fp_json(child) for child in fingerprint.children],
        }
    )


def _module_segment(
    module: _NormalizedModule, siblings: Sequence[_NormalizedModule], index: int
) -> str:
    if module.name:
        encoded = quote(module.name, safe="._-")
        count = sum(item.name == module.name for item in siblings)
        if count == 1:
            return encoded
        ordinal = sum(item.name == module.name for item in siblings[: index + 1])
        return f"{encoded}#{ordinal}"
    buildsystem = module.buildsystem or "unknown"
    source_type = module.sources[0].source_type if module.sources else "no-source"
    locator = module.sources[0].identity.locator if module.sources else None
    if (
        locator
        and isinstance(locator, str)
        and module.sources[0].identity.locator_kind == "remote"
    ):
        try:
            host = urlsplit(locator).hostname or "remote"
        except ValueError:
            host = "remote"
    else:
        host = "local"
    raw = f"unnamed-{buildsystem}-{source_type}-{host}"
    segment = re.sub(r"[^A-Za-z0-9._-]+", "-", raw)[:32].strip("-") or "unnamed"
    collisions = [
        item
        for item in siblings
        if not item.name
        and re.sub(
            r"[^A-Za-z0-9._-]+",
            "-",
            f"unnamed-{item.buildsystem or 'unknown'}-{item.sources[0].source_type if item.sources else 'no-source'}-{urlsplit(item.sources[0].identity.locator).hostname if item.sources[0].identity.locator_kind == 'remote' and isinstance(item.sources[0].identity.locator, str) and item.sources[0].identity.locator else 'local'}",
        )[:32].strip("-")
        == segment
    ]
    if len(collisions) > 1:
        ordinal = sum(item in collisions for item in siblings[: index + 1])
        segment += f"#{ordinal}"
    return segment


def _module_paths(modules: Sequence[_NormalizedModule], parent: str) -> list[str]:
    return [
        f"{parent}/{_module_segment(module, modules, index)}"
        for index, module in enumerate(modules)
    ]


def _source_location(
    module_path: str, sources: Sequence[_NormalizedSource], index: int
) -> str:
    source_type = sources[index].source_type
    occurrence = sum(item.source_type == source_type for item in sources[: index + 1])
    return f"{module_path}/sources/{quote(source_type, safe='._-')}#{occurrence}"


def _event(
    kind: ManifestChangeKind,
    location: str,
    arches: tuple[str, ...],
    old: JSONValue | None,
    new: JSONValue | None,
    magnitude: int | None = None,
    touched: Sequence[str] = (),
    command_change_fingerprint: str | None = None,
) -> _EventEnvelope:
    return _EventEnvelope(
        ManifestChange(kind, location, arches, old, new, magnitude),
        tuple(touched),
        command_change_fingerprint,
    )


def _command_change(old: tuple[str, ...], new: tuple[str, ...]) -> CommandChangeSummary:
    from difflib import SequenceMatcher

    added = removed = replaced = changed_tokens = 0
    matcher = SequenceMatcher(a=old, b=new, autojunk=False)
    for tag, old_start, old_end, new_start, new_end in matcher.get_opcodes():
        old_count = old_end - old_start
        new_count = new_end - new_start
        if tag == "insert":
            added += new_count
            changed_tokens += sum(
                len(_TOKEN_RE.findall(item)) for item in new[new_start:new_end]
            )
        elif tag == "delete":
            removed += old_count
            changed_tokens += sum(
                len(_TOKEN_RE.findall(item)) for item in old[old_start:old_end]
            )
        elif tag == "replace":
            paired = min(old_count, new_count)
            replaced += paired
            removed += old_count - paired
            added += new_count - paired
            for before, after in zip(
                old[old_start : old_start + paired],
                new[new_start : new_start + paired],
                strict=True,
            ):
                token_matcher = SequenceMatcher(
                    a=_TOKEN_RE.findall(before),
                    b=_TOKEN_RE.findall(after),
                    autojunk=False,
                )
                changed_tokens += sum(
                    max(i2 - i1, j2 - j1)
                    for operation, i1, i2, j1, j2 in token_matcher.get_opcodes()
                    if operation != "equal"
                )
    return CommandChangeSummary(added, removed, replaced, changed_tokens)


def _command_magnitude(summary: CommandChangeSummary) -> int:
    return min(2, (max(1, summary.changed_token_count).bit_length() - 1) // 3)


def _summary_for_command(summary: CommandChangeSummary) -> dict[str, JSONValue]:
    return {
        "added_commands": summary.added_commands,
        "removed_commands": summary.removed_commands,
        "replaced_commands": summary.replaced_commands,
        "changed_token_count": summary.changed_token_count,
    }


def _changed_mapping_summaries(
    old: Mapping[str, JSONValue], new: Mapping[str, JSONValue]
) -> tuple[JSONValue, JSONValue]:
    keys = sorted(
        key for key in old.keys() | new.keys() if old.get(key) != new.get(key)
    )
    return (
        cast(
            "JSONValue",
            {
                "changed_keys": keys,
                "values": {key: _summarize(old[key]) for key in keys if key in old},
            },
        ),
        cast(
            "JSONValue",
            {
                "changed_keys": keys,
                "values": {key: _summarize(new[key]) for key in keys if key in new},
            },
        ),
    )


def _module_modifier(module: _NormalizedModule) -> tuple[int, dict[str, JSONValue]]:
    nodes = [module]
    source_count = 0
    has_commands = False
    has_patch_script = False
    while nodes:
        node = nodes.pop()
        source_count += len(node.sources)
        has_commands = has_commands or bool(node.build_commands or node.post_install)
        has_patch_script = has_patch_script or any(
            source.source_type in {"patch", "script", "shell"}
            for source in node.sources
        )
        nodes.extend(node.children)
    magnitude = (
        int(has_commands)
        + int(has_patch_script)
        + int(source_count >= 3)
        + int(source_count >= 8)
    )
    bucket = (
        "0"
        if source_count == 0
        else "1-2"
        if source_count < 3
        else "3-7"
        if source_count < 8
        else "8+"
    )
    return magnitude, {
        "has_commands": has_commands,
        "has_patch_or_script": has_patch_script,
        "source_count": bucket,
    }


def _direct_features(module: _NormalizedModule) -> tuple[object, ...]:
    origins = sorted(
        source.identity.locator
        for source in module.sources
        if source.identity.locator_kind == "remote"
        and isinstance(source.identity.locator, str)
    )
    return (
        tuple(source.source_type for source in module.sources),
        tuple(origins),
        Counter(_fp_json(child.fingerprint) for child in module.children),
    )


def _similarity(
    module_old: _NormalizedModule, module_new: _NormalizedModule
) -> tuple[int, int, int, int]:
    equal = applicable = non_name_equal = 0
    if module_old.name and module_new.name:
        applicable += 4
        if module_old.name == module_new.name:
            equal += 4
    if module_old.buildsystem is not None or module_new.buildsystem is not None:
        applicable += 3
        if module_old.buildsystem == module_new.buildsystem:
            equal += 3
            non_name_equal += 1
    old_types, old_origins, old_children = _direct_features(module_old)
    new_types, new_origins, new_children = _direct_features(module_new)
    if old_types or new_types:
        applicable += 3
        if old_types == new_types:
            equal += 3
            non_name_equal += 1
    if old_origins or new_origins:
        applicable += 3
        if old_origins == new_origins:
            equal += 3
            non_name_equal += 1
    if module_old.subdir is not None or module_new.subdir is not None:
        applicable += 1
        if module_old.subdir == module_new.subdir:
            equal += 1
            non_name_equal += 1
    if old_children or new_children:
        applicable += 2
        if old_children == new_children:
            equal += 2
            non_name_equal += 1
    percentage = (100 * equal) // applicable if applicable else 0
    return equal, applicable, percentage, non_name_equal


def _similarity_edge_is_eligible(
    old: _NormalizedModule, new: _NormalizedModule
) -> bool:
    _, applicable, percentage, non_name_equal = _similarity(old, new)
    return applicable >= 6 and non_name_equal >= 2 and percentage >= 70


def _origin_set(manifest: _NormalizedManifest) -> set[str]:
    result: set[str] = set()
    nodes = list(manifest.modules)
    while nodes:
        node = nodes.pop()
        for source in node.sources:
            if source.primary_origin:
                result.add(source.primary_origin)
            mirrors = source.options.get("mirror-urls", [])
            if isinstance(mirrors, list):
                result.update(
                    item for item in mirrors if isinstance(item, str) and "://" in item
                )
        nodes.extend(node.children)
    return result


def _filtered_options(
    source: _NormalizedSource, introduced: set[str]
) -> dict[str, JSONValue]:
    result = dict(source.options)
    mirrors = result.get("mirror-urls")
    if isinstance(mirrors, list):
        result["mirror-urls"] = [item for item in mirrors if item not in introduced]
    return result


def _compare_source_options(
    old: _NormalizedSource,
    new: _NormalizedSource,
    location: str,
    arches: tuple[str, ...],
    module_path: str,
    introduced: set[str],
) -> list[_EventEnvelope]:
    old_options = _filtered_options(old, introduced)
    new_options = _filtered_options(new, introduced)
    if old_options == new_options:
        return []
    old_summary, new_summary = _changed_mapping_summaries(old_options, new_options)
    return [
        _event(
            ManifestChangeKind.SOURCE_OPTIONS_CHANGED,
            location,
            arches,
            old_summary,
            new_summary,
            touched=(module_path,),
        )
    ]


def _lcs_pairs(
    old: Sequence[_NormalizedSource], new: Sequence[_NormalizedSource]
) -> list[tuple[int, int]]:
    n, m = len(old), len(new)
    if n * m > 16384:
        old_counts = Counter(item.stable_fingerprint for item in old)
        new_counts = Counter(item.stable_fingerprint for item in new)
        candidates = sorted(
            (i, j, old[i].stable_fingerprint)
            for i in range(n)
            for j in range(m)
            if old[i].stable_fingerprint == new[j].stable_fingerprint
            and old_counts[old[i].stable_fingerprint] == 1
            and new_counts[new[j].stable_fingerprint] == 1
        )
        best: list[tuple[int, int, str]] = []
        paths: list[list[tuple[int, int, str]]] = []
        for anchor in candidates:
            choices = [path for path in paths if path[-1][1] < anchor[1]]
            prefix = min(
                (path for path in choices if len(path) == max(map(len, choices))),
                default=[],
            )
            paths.append([*prefix, anchor])
        if paths:
            max_len = max(map(len, paths))
            best = min(path for path in paths if len(path) == max_len)
        return [(i, j) for i, j, _ in best]
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            if old[i].stable_fingerprint == new[j].stable_fingerprint:
                dp[i][j] = 1 + dp[i + 1][j + 1]
            else:
                dp[i][j] = max(dp[i + 1][j], dp[i][j + 1])
    pairs = []
    i = j = 0
    while i < n and j < m:
        if old[i].stable_fingerprint == new[j].stable_fingerprint:
            pairs.append((i, j))
            i += 1
            j += 1
        elif dp[i + 1][j] >= dp[i][j + 1]:
            i += 1
        else:
            j += 1
    return pairs


def _compare_sources(
    old: Sequence[_NormalizedSource],
    new: Sequence[_NormalizedSource],
    module_path: str,
    arches: tuple[str, ...],
    introduced: set[str],
    removed_origins: set[str],
) -> list[_EventEnvelope]:
    if tuple(old) == tuple(new):
        return []
    events: list[_EventEnvelope] = []
    old_fps = [item.stable_fingerprint for item in old]
    new_fps = [item.stable_fingerprint for item in new]
    pairs: list[tuple[int, int]]
    if Counter(old_fps) == Counter(new_fps) and old_fps != new_fps:
        old_by_fp: dict[str, list[int]] = defaultdict(list)
        new_by_fp: dict[str, list[int]] = defaultdict(list)
        for index, fingerprint in enumerate(old_fps):
            old_by_fp[fingerprint].append(index)
        for index, fingerprint in enumerate(new_fps):
            new_by_fp[fingerprint].append(index)
        pairs = sorted(
            (old_index, new_index)
            for fingerprint in sorted(old_by_fp)
            for old_index, new_index in zip(
                old_by_fp[fingerprint], new_by_fp[fingerprint], strict=True
            )
        )
        events.append(
            _event(
                ManifestChangeKind.SOURCE_ORDER_CHANGED,
                f"{module_path}/sources",
                arches,
                {"count": len(old)},
                {"count": len(new)},
                touched=(module_path,),
            )
        )
    else:
        pairs = _lcs_pairs(old, new)
    matched_old = {item[0] for item in pairs}
    matched_new = {item[1] for item in pairs}
    for old_index, new_index in pairs:
        events.extend(
            _compare_source_options(
                old[old_index],
                new[new_index],
                _source_location(module_path, new, new_index),
                arches,
                module_path,
                introduced,
            )
        )
    remaining_old = [index for index in range(len(old)) if index not in matched_old]
    remaining_new = [index for index in range(len(new)) if index not in matched_new]
    for new_index in list(remaining_new):
        candidate = new[new_index]
        if candidate.primary_origin not in introduced:
            continue
        eligible = [
            index
            for index in remaining_old
            if old[index].identity.locator_kind == "remote"
        ]
        if not eligible:
            continue
        old_index = min(
            eligible,
            key=lambda index: (
                old[index].source_type != candidate.source_type,
                abs(index - new_index),
                index,
            ),
        )
        remaining_old.remove(old_index)
        remaining_new.remove(new_index)
        if old[old_index].source_type != candidate.source_type:
            events.append(
                _event(
                    ManifestChangeKind.SOURCE_TYPE_CHANGED,
                    _source_location(module_path, new, new_index),
                    arches,
                    old[old_index].source_type,
                    candidate.source_type,
                    touched=(module_path,),
                )
            )
        old_without_repo = dict(old[old_index].options)
        new_without_repo = dict(candidate.options)
        old_without_repo.pop("repository", None)
        new_without_repo.pop("repository", None)
        old_source = _NormalizedSource(
            old[old_index].source_type,
            old[old_index].identity,
            old[old_index].stable_fingerprint,
            old[old_index].type_agnostic_fingerprint,
            old[old_index].primary_origin,
            _canonical(old_without_repo),
            old_without_repo,
        )
        new_source = _NormalizedSource(
            candidate.source_type,
            candidate.identity,
            candidate.stable_fingerprint,
            candidate.type_agnostic_fingerprint,
            candidate.primary_origin,
            _canonical(new_without_repo),
            new_without_repo,
        )
        events.extend(
            _compare_source_options(
                old_source,
                new_source,
                _source_location(module_path, new, new_index),
                arches,
                module_path,
                introduced,
            )
        )
    for old_index in list(remaining_old):
        matches = [
            new_index
            for new_index in remaining_new
            if old[old_index].type_agnostic_fingerprint
            == new[new_index].type_agnostic_fingerprint
        ]
        if not matches:
            continue
        new_index = min(matches)
        remaining_old.remove(old_index)
        remaining_new.remove(new_index)
        if old[old_index].source_type != new[new_index].source_type:
            events.append(
                _event(
                    ManifestChangeKind.SOURCE_TYPE_CHANGED,
                    _source_location(module_path, new, new_index),
                    arches,
                    old[old_index].source_type,
                    new[new_index].source_type,
                    touched=(module_path,),
                )
            )
        events.extend(
            _compare_source_options(
                old[old_index],
                new[new_index],
                _source_location(module_path, new, new_index),
                arches,
                module_path,
                introduced,
            )
        )
    plural_patch_old = [
        index
        for index in remaining_old
        if old[index].source_type == "patch" and "paths" in old[index].options
    ]
    plural_patch_new = [
        index
        for index in remaining_new
        if new[index].source_type == "patch" and "paths" in new[index].options
    ]
    if len(plural_patch_old) == len(plural_patch_new):
        for old_index, new_index in zip(
            plural_patch_old, plural_patch_new, strict=True
        ):
            remaining_old.remove(old_index)
            remaining_new.remove(new_index)
            events.extend(
                _compare_source_options(
                    old[old_index],
                    new[new_index],
                    _source_location(module_path, new, new_index),
                    arches,
                    module_path,
                    introduced,
                )
            )
    for new_index in remaining_new:
        source = new[new_index]
        if source.source_type not in _SPECIAL_SOURCE_TYPES:
            continue
        location = _source_location(module_path, new, new_index)
        events.append(
            _event(
                ManifestChangeKind.PATCH_OR_SCRIPT_ADDED,
                location,
                arches,
                None,
                {"type": source.source_type},
                touched=(module_path,),
            )
        )

    def _ordinary_residual(
        source: _NormalizedSource, excluded_origins: set[str]
    ) -> bool:
        if source.source_type in _SPECIAL_SOURCE_TYPES:
            return False
        return source.identity.locator_kind != "remote" or (
            source.primary_origin is not None
            and source.primary_origin not in excluded_origins
        )

    old_residual = [
        old[index]
        for index in remaining_old
        if _ordinary_residual(old[index], removed_origins)
    ]
    new_residual = [
        new[index]
        for index in remaining_new
        if _ordinary_residual(new[index], introduced)
    ]
    old_counts = Counter(source.stable_fingerprint for source in old_residual)
    new_counts = Counter(source.stable_fingerprint for source in new_residual)
    removed = sum((old_counts - new_counts).values())
    added = sum((new_counts - old_counts).values())
    changed = added + removed
    if changed:
        magnitude = 1 if changed <= 2 else 2 if changed <= 10 else 3
        events.append(
            _event(
                ManifestChangeKind.SOURCE_SET_CHANGED,
                f"{module_path}/sources",
                arches,
                None,
                {"added": added, "removed": removed, "changed": changed},
                magnitude,
                touched=(module_path,),
            )
        )
    return events


def _compare_matched_module(
    old: _NormalizedModule,
    new: _NormalizedModule,
    old_path: str,
    new_path: str,
    arches: tuple[str, ...],
    introduced: set[str],
    removed_origins: set[str],
    context: "_MatchContext",
) -> list[_EventEnvelope]:
    events: list[_EventEnvelope] = []
    if old.buildsystem != new.buildsystem:
        events.append(
            _event(
                ManifestChangeKind.BUILDSYSTEM_CHANGED,
                new_path,
                arches,
                old.buildsystem,
                new.buildsystem,
                touched=(new_path,),
            )
        )
    for kind, old_commands, new_commands in (
        (
            ManifestChangeKind.BUILD_COMMANDS_CHANGED,
            old.build_commands,
            new.build_commands,
        ),
        (ManifestChangeKind.POST_INSTALL_CHANGED, old.post_install, new.post_install),
    ):
        if old_commands != new_commands:
            summary = _command_change(old_commands, new_commands)
            rendered = _summary_for_command(summary)
            events.append(
                _event(
                    kind,
                    new_path,
                    arches,
                    rendered,
                    rendered,
                    _command_magnitude(summary),
                    (new_path,),
                    (
                        _command_change_fingerprint(old_commands, new_commands)
                        if kind is ManifestChangeKind.BUILD_COMMANDS_CHANGED
                        else None
                    ),
                )
            )
    for kind, old_values, new_values in (
        (
            ManifestChangeKind.CONFIG_OPTIONS_CHANGED,
            old.config_bundle,
            new.config_bundle,
        ),
        (
            ManifestChangeKind.BUILD_OPTIONS_CHANGED,
            old.build_options,
            new.build_options,
        ),
        (ManifestChangeKind.MODULE_LAYOUT_CHANGED, old.layout, new.layout),
        (
            ManifestChangeKind.ARCH_SELECTION_CHANGED,
            old.arch_selectors,
            new.arch_selectors,
        ),
    ):
        if old_values != new_values:
            before, after = _changed_mapping_summaries(old_values, new_values)
            events.append(
                _event(kind, new_path, arches, before, after, touched=(new_path,))
            )
    events.extend(
        _compare_sources(
            old.sources, new.sources, new_path, arches, introduced, removed_origins
        )
    )
    events.extend(
        _compare_module_siblings(
            old.children,
            new.children,
            f"{old_path}/modules",
            f"{new_path}/modules",
            arches,
            introduced,
            removed_origins,
            context,
        )
    )
    return events


@dataclass
class _MatchContext:
    old_fingerprints: dict[str, list[tuple[_NormalizedModule, str]]]
    new_fingerprints: dict[str, list[tuple[_NormalizedModule, str]]]
    consumed_old: set[int]
    consumed_new: set[int]


def _collect_module_fingerprints(
    modules: Sequence[_NormalizedModule], parent: str
) -> dict[str, list[tuple[_NormalizedModule, str]]]:
    result: dict[str, list[tuple[_NormalizedModule, str]]] = defaultdict(list)
    paths = _module_paths(modules, parent)
    for module, path in zip(modules, paths, strict=True):
        result[_fp_json(module.fingerprint)].append((module, path))
        nested = _collect_module_fingerprints(module.children, f"{path}/modules")
        for key, items in nested.items():
            result[key].extend(items)
    return result


def _compare_module_siblings(
    old: Sequence[_NormalizedModule],
    new: Sequence[_NormalizedModule],
    old_parent: str,
    new_parent: str,
    arches: tuple[str, ...],
    introduced: set[str],
    removed_origins: set[str],
    context: _MatchContext,
) -> list[_EventEnvelope]:
    if tuple(old) == tuple(new):
        return []
    events: list[_EventEnvelope] = []
    old_paths = _module_paths(old, old_parent)
    new_paths = _module_paths(new, new_parent)
    old_indices = [
        index
        for index, module in enumerate(old)
        if id(module) not in context.consumed_old
    ]
    new_indices = [
        index
        for index, module in enumerate(new)
        if id(module) not in context.consumed_new
    ]
    matches: list[tuple[int, int]] = []
    old_names: set[str] = set()
    for index in old_indices:
        if name := old[index].name:
            old_names.add(name)
    for name in sorted(old_names):
        old_named = [index for index in old_indices if old[index].name == name]
        new_named = [index for index in new_indices if new[index].name == name]
        if len(old_named) == len(new_named) == 1:
            pair = old_named[0], new_named[0]
            matches.append(pair)
            old_indices.remove(pair[0])
            new_indices.remove(pair[1])
    for fingerprint in sorted(
        {_fp_json(old[index].fingerprint) for index in old_indices}
    ):
        old_fp = [
            index
            for index in old_indices
            if _fp_json(old[index].fingerprint) == fingerprint
        ]
        new_fp = [
            index
            for index in new_indices
            if _fp_json(new[index].fingerprint) == fingerprint
        ]
        if len(old_fp) == len(new_fp) == 1:
            pair = old_fp[0], new_fp[0]
            matches.append(pair)
            old_indices.remove(pair[0])
            new_indices.remove(pair[1])
    if len(old_indices) * len(new_indices) > 4096:
        if old_indices and new_indices:
            touched = tuple(
                sorted(
                    [
                        *(old_paths[index] for index in old_indices),
                        *(new_paths[index] for index in new_indices),
                    ]
                )
            )
            events.append(
                _event(
                    ManifestChangeKind.MODULE_MATCH_AMBIGUOUS,
                    new_parent,
                    arches,
                    {"count": len(old_indices)},
                    {"count": len(new_indices)},
                    touched=touched,
                )
            )
            context.consumed_old.update(id(old[index]) for index in old_indices)
            context.consumed_new.update(id(new[index]) for index in new_indices)
            old_indices = []
            new_indices = []
    else:
        best_old: dict[int, list[int]] = {}
        best_new: dict[int, list[int]] = {}
        for old_index in old_indices:
            eligible = [
                new_index
                for new_index in new_indices
                if _similarity_edge_is_eligible(old[old_index], new[new_index])
            ]
            if eligible:
                best_value = max(
                    _similarity(old[old_index], new[index])[:3] for index in eligible
                )
                best_old[old_index] = [
                    index
                    for index in eligible
                    if _similarity(old[old_index], new[index])[:3] == best_value
                ]
        for new_index in new_indices:
            eligible = [
                old_index
                for old_index in old_indices
                if _similarity_edge_is_eligible(old[old_index], new[new_index])
            ]
            if eligible:
                best_value = max(
                    _similarity(old[index], new[new_index])[:3] for index in eligible
                )
                best_new[new_index] = [
                    index
                    for index in eligible
                    if _similarity(old[index], new[new_index])[:3] == best_value
                ]
        for old_index in list(old_indices):
            candidates = best_old.get(old_index, [])
            if len(candidates) != 1:
                continue
            new_index = candidates[0]
            if best_new.get(new_index) == [old_index]:
                alternatives = sorted(
                    (_similarity(old[old_index], new[index])[2], index)
                    for index in new_indices
                    if index != new_index
                    and _similarity_edge_is_eligible(old[old_index], new[index])
                )
                best_percentage = _similarity(old[old_index], new[new_index])[2]
                if alternatives and best_percentage - alternatives[-1][0] < 15:
                    continue
                matches.append((old_index, new_index))
                old_indices.remove(old_index)
                new_indices.remove(new_index)
        for old_index in list(old_indices):
            fingerprint = _fp_json(old[old_index].fingerprint)
            old_global = context.old_fingerprints.get(fingerprint, [])
            new_global = context.new_fingerprints.get(fingerprint, [])
            if len(old_global) == len(new_global) == 1:
                target, target_path = new_global[0]
                if id(target) not in context.consumed_new and target not in new:
                    context.consumed_old.add(id(old[old_index]))
                    context.consumed_new.add(id(target))
                    events.append(
                        _event(
                            ManifestChangeKind.MODULE_LAYOUT_CHANGED,
                            target_path,
                            arches,
                            {"from": old_paths[old_index]},
                            {"to": target_path},
                            touched=(old_paths[old_index], target_path),
                        )
                    )
                    events.extend(
                        _compare_matched_module(
                            old[old_index],
                            target,
                            old_paths[old_index],
                            target_path,
                            arches,
                            introduced,
                            removed_origins,
                            context,
                        )
                    )
                    old_indices.remove(old_index)
        graph_old = {
            index: [
                new_index
                for new_index in new_indices
                if _similarity_edge_is_eligible(old[index], new[new_index])
            ]
            for index in old_indices
        }
        seen_old: set[int] = set()
        seen_new: set[int] = set()
        for start in old_indices:
            if start in seen_old or not graph_old[start]:
                continue
            component_old: set[int] = set()
            component_new: set[int] = set()
            stack_old = [start]
            while stack_old:
                old_index = stack_old.pop()
                if old_index in component_old:
                    continue
                component_old.add(old_index)
                for new_index in graph_old[old_index]:
                    if new_index not in component_new:
                        component_new.add(new_index)
                        stack_old.extend(
                            index
                            for index in old_indices
                            if new_index in graph_old[index]
                        )
            seen_old.update(component_old)
            seen_new.update(component_new)
            touched = tuple(
                sorted(
                    [
                        *(old_paths[index] for index in component_old),
                        *(new_paths[index] for index in component_new),
                    ]
                )
            )
            events.append(
                _event(
                    ManifestChangeKind.MODULE_MATCH_AMBIGUOUS,
                    new_parent,
                    arches,
                    {
                        "count": len(component_old),
                        "fingerprints": [
                            _bounded_string(_fp_json(old[index].fingerprint))
                            for index in sorted(component_old)[:3]
                        ],
                    },
                    {
                        "count": len(component_new),
                        "fingerprints": [
                            _bounded_string(_fp_json(new[index].fingerprint))
                            for index in sorted(component_new)[:3]
                        ],
                    },
                    touched=touched,
                )
            )
        old_indices = [index for index in old_indices if index not in seen_old]
        new_indices = [index for index in new_indices if index not in seen_new]
    for old_index, new_index in sorted(matches):
        context.consumed_old.add(id(old[old_index]))
        context.consumed_new.add(id(new[new_index]))
        events.extend(
            _compare_matched_module(
                old[old_index],
                new[new_index],
                old_paths[old_index],
                new_paths[new_index],
                arches,
                introduced,
                removed_origins,
                context,
            )
        )
    matched_order = sorted(matches)
    candidate_order = [new_index for _, new_index in matched_order]
    inversions = sum(
        candidate_order[i] > candidate_order[j]
        for i in range(len(candidate_order))
        for j in range(i + 1, len(candidate_order))
    )
    if inversions:
        touched = tuple(new_paths[index] for index in candidate_order)
        events.append(
            _event(
                ManifestChangeKind.MODULE_LAYOUT_CHANGED,
                new_parent,
                arches,
                {"order": "changed"},
                {"inversions": inversions},
                inversions,
                touched,
            )
        )
    for old_index in old_indices:
        context.consumed_old.add(id(old[old_index]))
        events.append(
            _event(
                ManifestChangeKind.MODULE_REMOVED,
                old_paths[old_index],
                arches,
                {"name": old[old_index].name},
                None,
                touched=(old_paths[old_index],),
            )
        )
    for new_index in new_indices:
        context.consumed_new.add(id(new[new_index]))
        magnitude, summary = _module_modifier(new[new_index])
        events.append(
            _event(
                ManifestChangeKind.MODULE_ADDED,
                new_paths[new_index],
                arches,
                None,
                summary,
                magnitude,
                (new_paths[new_index],),
            )
        )
    return events


def _compare_top_level(
    old: _NormalizedManifest, new: _NormalizedManifest, arches: tuple[str, ...]
) -> list[_EventEnvelope]:
    events: list[_EventEnvelope] = []
    for kind, before, after in (
        (ManifestChangeKind.RUNTIME_ID_CHANGED, old.runtime, new.runtime),
        (ManifestChangeKind.SDK_ID_CHANGED, old.sdk, new.sdk),
        (ManifestChangeKind.APPLICATION_COMMAND_CHANGED, old.command, new.command),
    ):
        if before != after:
            events.append(_event(kind, "manifest", arches, before, after))
    for kind, before, after, location in (
        (
            ManifestChangeKind.TOP_LEVEL_CLEANUP_CHANGED,
            old.cleanup,
            new.cleanup,
            "manifest",
        ),
        (
            ManifestChangeKind.EXTENSIONS_CHANGED,
            old.extensions,
            new.extensions,
            "manifest",
        ),
        (
            ManifestChangeKind.BUILD_OPTIONS_CHANGED,
            old.build_options,
            new.build_options,
            "manifest/build-options",
        ),
        (
            ManifestChangeKind.ARCH_SELECTION_CHANGED,
            old.arch_selectors,
            new.arch_selectors,
            "manifest/build-options",
        ),
    ):
        if before != after:
            old_summary, new_summary = _changed_mapping_summaries(before, after)
            events.append(_event(kind, location, arches, old_summary, new_summary))
    return events


def _event_key(event: ManifestChange, *, arches: bool = True) -> tuple[object, ...]:
    key: tuple[object, ...] = (
        event.kind.value,
        event.location,
        _canonical(event.old_summary),
        _canonical(event.new_summary),
        -1 if event.magnitude is None else event.magnitude,
    )
    return (*key, event.arches) if arches else key


def _merge_events(
    events: Sequence[_EventEnvelope],
) -> tuple[tuple[ManifestChange, ...], tuple[str, ...], BuildCommandChangeTelemetry]:
    merged: dict[tuple[object, ...], set[str]] = defaultdict(set)
    prototypes: dict[tuple[object, ...], ManifestChange] = {}
    touches: dict[tuple[object, ...], set[str]] = defaultdict(set)
    command_fingerprints: dict[tuple[object, ...], set[str]] = defaultdict(set)
    for envelope in events:
        key = _event_key(envelope.event, arches=False)
        prototypes[key] = envelope.event
        merged[key].update(envelope.event.arches)
        touches[key].update(envelope.touched_modules)
        if envelope.command_change_fingerprint is not None:
            command_fingerprints[key].add(envelope.command_change_fingerprint)
    result = []
    touched_modules: set[str] = set()
    fingerprint_by_event: list[str] = []
    for key in sorted(prototypes):
        prototype = prototypes[key]
        result.append(
            ManifestChange(
                prototype.kind,
                prototype.location,
                tuple(sorted(merged[key])),
                prototype.old_summary,
                prototype.new_summary,
                prototype.magnitude,
            )
        )
        touched_modules.update(touches[key])
        if (
            prototype.kind is ManifestChangeKind.BUILD_COMMANDS_CHANGED
            and command_fingerprints[key]
        ):
            fingerprint_by_event.append(min(command_fingerprints[key]))
    fingerprint_counts = Counter(fingerprint_by_event)
    return (
        tuple(sorted(result, key=_event_key)),
        tuple(sorted(touched_modules)),
        BuildCommandChangeTelemetry(
            event_count=len(fingerprint_by_event),
            distinct_fingerprint_count=len(fingerprint_counts),
            fingerprint_group_sizes=tuple(
                sorted(fingerprint_counts.values(), reverse=True)
            ),
        ),
    )


def _score(events: Sequence[ManifestChange]) -> tuple[int, int, int]:
    totals: dict[ManifestChangeKind, int] = defaultdict(int)
    source_set_units_by_location: dict[str, int] = {}
    for event in events:
        if event.kind is ManifestChangeKind.SOURCE_SET_CHANGED:
            source_set_units_by_location[event.location] = max(
                source_set_units_by_location.get(event.location, 0),
                event.magnitude or 0,
            )
            continue
        base, _ = _SCORE_TABLE[event.kind]
        modifier = event.magnitude or 0
        if event.kind not in {
            ManifestChangeKind.MODULE_ADDED,
            ManifestChangeKind.BUILD_COMMANDS_CHANGED,
            ManifestChangeKind.POST_INSTALL_CHANGED,
        }:
            modifier = 0
        totals[event.kind] += base + modifier
    if source_set_units_by_location:
        totals[ManifestChangeKind.SOURCE_SET_CHANGED] = sum(
            source_set_units_by_location.values()
        )
    capped = {kind: min(total, _SCORE_TABLE[kind][1]) for kind, total in totals.items()}
    structural = sum(
        value for kind, value in capped.items() if kind in _STRUCTURAL_KINDS
    )
    ambiguity = capped.get(ManifestChangeKind.MODULE_MATCH_AMBIGUOUS, 0)
    recipe = sum(
        value
        for kind, value in capped.items()
        if kind not in _STRUCTURAL_KINDS
        and kind is not ManifestChangeKind.MODULE_MATCH_AMBIGUOUS
    )
    return structural, recipe, ambiguity


def manifest_complexity_score_band(score_units: int) -> ManifestComplexityScoreBand:
    if score_units == 0:
        return ManifestComplexityScoreBand.ROUTINE
    if score_units <= 6:
        return ManifestComplexityScoreBand.SMALL
    if score_units <= 12:
        return ManifestComplexityScoreBand.MODERATE
    if score_units <= 20:
        return ManifestComplexityScoreBand.LARGE
    return ManifestComplexityScoreBand.MAJOR


def _valid_pair(pair: object) -> bool:
    if not isinstance(pair, ManifestPair):
        return False
    if not all(
        isinstance(value, str) and bool(value)
        for value in (
            pair.app_id,
            pair.ref_name,
            pair.arch,
            pair.branch,
            pair.candidate_commit,
        )
    ):
        return False
    if not isinstance(pair.candidate_manifest, dict) or not isinstance(
        pair.published_status, PublishedManifestStatus
    ):
        return False
    if pair.published_status is PublishedManifestStatus.PRESENT:
        return (
            isinstance(pair.published_commit, str)
            and bool(pair.published_commit)
            and isinstance(pair.published_manifest, dict)
        )
    if pair.published_status is PublishedManifestStatus.REF_MISSING:
        return pair.published_commit is None and pair.published_manifest is None
    return (
        isinstance(pair.published_commit, str)
        and bool(pair.published_commit)
        and pair.published_manifest is None
    )


def _group_valid(group: Sequence[ManifestPair], expected_app_id: str) -> bool:
    if not group or not all(_valid_pair(pair) for pair in group):
        return False
    representative = group[0]
    if representative.app_id != expected_app_id:
        return False
    candidate = _canonical(representative.candidate_manifest)
    published = _canonical(representative.published_manifest)
    return all(
        pair.app_id == representative.app_id
        and pair.branch == representative.branch
        and pair.published_status is representative.published_status
        and _canonical(pair.candidate_manifest) == candidate
        and _canonical(pair.published_manifest) == published
        for pair in group
    )


def analyze_manifest_complexity(
    groups: Sequence[Sequence[ManifestPair]],
) -> ManifestComplexityAnalysis:
    nonempty = [group for group in groups if group]
    if not nonempty:
        return ManifestComplexityNotScored(
            MANIFEST_COMPLEXITY_ALGORITHM_VERSION,
            ManifestComplexityNotScoredReason.NO_MANIFEST_GROUPS,
            (),
        )
    first_pair = nonempty[0][0]
    expected_app_id = (
        first_pair.app_id
        if isinstance(first_pair, ManifestPair) and isinstance(first_pair.app_id, str)
        else ""
    )
    blockers: list[tuple[ManifestComplexityNotScoredReason, tuple[str, ...]]] = []
    normalized: list[
        tuple[_NormalizedManifest, _NormalizedManifest, tuple[str, ...]]
    ] = []
    for group in nonempty:
        arches = tuple(
            sorted(
                {
                    pair.arch
                    for pair in group
                    if isinstance(pair, ManifestPair)
                    and isinstance(pair.arch, str)
                    and pair.arch
                }
            )
        )
        statuses = [
            pair.published_status
            for pair in group
            if isinstance(pair, ManifestPair)
            and isinstance(pair.published_status, PublishedManifestStatus)
        ]
        reasons = [
            _BASELINE_REASON[status]
            for status in statuses
            if status in _BASELINE_REASON
        ]
        if reasons:
            blockers.append((min(reasons, key=_REASON_ORDER.__getitem__), arches))
            continue
        if not _group_valid(group, expected_app_id):
            blockers.append(
                (
                    ManifestComplexityNotScoredReason.UNSUPPORTED_MANIFEST_STRUCTURE,
                    arches,
                )
            )
            continue
        representative = group[0]
        try:
            old = _normalize_manifest(representative.published_manifest)
            new = _normalize_manifest(representative.candidate_manifest)
        except (TypeError, ValueError, _Unsupported):
            blockers.append(
                (
                    ManifestComplexityNotScoredReason.UNSUPPORTED_MANIFEST_STRUCTURE,
                    arches,
                )
            )
            continue
        normalized.append((old, new, arches))
    if blockers:
        return ManifestComplexityNotScored(
            MANIFEST_COMPLEXITY_ALGORITHM_VERSION,
            min((reason for reason, _ in blockers), key=_REASON_ORDER.__getitem__),
            tuple(sorted({arch for _, arches in blockers for arch in arches})),
        )
    raw_events: list[_EventEnvelope] = []
    for old, new, arches in normalized:
        if old == new:
            continue
        old_origins = _origin_set(old)
        new_origins = _origin_set(new)
        introduced = new_origins - old_origins
        removed_origins = old_origins - new_origins
        raw_events.extend(_compare_top_level(old, new, arches))
        context = _MatchContext(
            _collect_module_fingerprints(old.modules, "modules"),
            _collect_module_fingerprints(new.modules, "modules"),
            set(),
            set(),
        )
        raw_events.extend(
            _compare_module_siblings(
                old.modules,
                new.modules,
                "modules",
                "modules",
                arches,
                introduced,
                removed_origins,
                context,
            )
        )
    events, touched_modules, command_change_telemetry = _merge_events(raw_events)
    changed_categories = tuple(
        sorted({_CATEGORY_BY_KIND[event.kind] for event in events})
    )
    structural, recipe, ambiguity = _score(events)
    breadth = min(4, max(0, len(touched_modules) - 1)) + min(
        4, max(0, len(changed_categories) - 1)
    )
    raw_score = structural + recipe + ambiguity + breadth
    return ManifestComplexityResult(
        algorithm_version=MANIFEST_COMPLEXITY_ALGORITHM_VERSION,
        score_units=min(raw_score, MANIFEST_COMPLEXITY_MAX_SCORE_UNITS),
        raw_score_units=raw_score,
        structural_units=structural,
        recipe_units=recipe,
        breadth_units=breadth,
        ambiguity_units=ambiguity,
        events=events,
        touched_modules=touched_modules,
        affected_arches=tuple(
            sorted({arch for event in events for arch in event.arches})
        ),
        changed_categories=changed_categories,
        command_change_telemetry=command_change_telemetry,
    )
