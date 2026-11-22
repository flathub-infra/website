"""Read recipe-owned AppStream files and publish translations to GitHub."""

import fnmatch
import hashlib
import json
import posixpath
import re
import shlex
from base64 import b64decode
from dataclasses import dataclass
from functools import cache
from typing import Any
from urllib.parse import quote

import yaml
from github import GithubException
from github.Repository import Repository

from .metadata_translation_artifacts import published_listing_matches
from .metadata_translation_reconciliation import reconcile
from .metadata_translations import (
    MAX_XML_BYTES,
    MetadataDocument,
    MetadataError,
    normalize_locale,
)

SOURCE_BRANCH = "master"
SHARED_MODULES_PATH = "shared-modules"
SHARED_MODULES_URL = "https://github.com/flathub/shared-modules"


@dataclass
class MetadataSource:
    revision: str
    path: str
    sha: str
    content: bytes


def _load_manifest_data(text: str, path: str):
    if path.endswith(".json"):
        # Flatpak accepts comments and literal newlines in JSON manifests.
        text = re.sub(
            r'("(?:\\.|[^"\\])*")|//[^\n]*|/\*.*?\*/',
            lambda match: match[1] if match[1] is not None else " ",
            text,
            flags=re.DOTALL,
        )
        try:
            manifest = json.loads(text, strict=False)
        except (ValueError, RecursionError):
            raise MetadataError("unsupported_metadata") from None
    else:
        try:
            manifest = yaml.safe_load(text)
        except (yaml.YAMLError, RecursionError):
            raise MetadataError("unsupported_metadata") from None
    return manifest


def _load_manifest(text: str, path: str) -> dict[str, Any]:
    manifest = _load_manifest_data(text, path)
    if not isinstance(manifest, dict):
        raise MetadataError("unsupported_metadata")
    return manifest


def _command_phases(module: dict[str, Any]) -> list[tuple[str, str]]:
    commands = []
    sources = module.get("sources", [])
    if not isinstance(sources, list):
        raise MetadataError("unsupported_metadata")
    sections = [
        (source, "commands")
        for source in sources
        if isinstance(source, dict) and source.get("type") == "shell"
    ]
    sections.extend((module, key) for key in ("build-commands", "post-install"))
    for section, key in sections:
        values = section.get(key, [])
        if not isinstance(values, list) or any(
            not isinstance(value, str) for value in values
        ):
            raise MetadataError("unsupported_metadata")
        for value in values:
            commands.extend(
                (key, line.strip())
                for line in value.replace("\\\n", "").splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            )
    return commands


def _install_commands(module: dict[str, Any]) -> list[str]:
    return [command for _, command in _command_phases(module)]


def _owns_metadata(
    manifest: dict[str, Any],
    filename: str,
    app_id: str,
    *,
    load_module=None,
    read_text=None,
    confirm_published=None,
    source_path=None,
) -> bool:
    modules = [(manifest, False, False, "")]
    seen = {}
    includes = set()

    def register_include(path: str) -> bool:
        if path in includes or len(includes) >= 16:
            return False
        includes.add(path)
        return True

    owned_destinations = set()
    other_destinations = set()
    cleanup = set()
    needs_published_check = False
    while modules:
        module, visit, conditional, directory = modules.pop()
        if not visit:
            if isinstance(module, str):
                path = posixpath.normpath(posixpath.join(directory, module))
                if (
                    not load_module
                    or not re.fullmatch(r"(?:[\w.-]+/)*[\w.-]+\.(?:json|ya?ml)", path)
                    or ".." in path.split("/")
                    or not register_include(path)
                ):
                    return False
                module = load_module(path)
                directory = posixpath.dirname(path)
            if not isinstance(module, dict) or id(module) in seen:
                return False
            seen[id(module)] = module
            children = module.get("modules", [])
            if not isinstance(children, list):
                return False
            if cleanup_commands := module.get("cleanup-commands"):
                if not isinstance(cleanup_commands, list) or any(
                    not isinstance(c, str) or _mentions_listing(c)
                    for c in cleanup_commands
                ):
                    return False
                needs_published_check = True
            patterns = module.get("cleanup", [])
            if not isinstance(patterns, list) or not all(
                isinstance(p, str) for p in patterns
            ):
                return False
            if module is manifest:
                cleanup.update(patterns)
            arches = module.get("only-arches")
            conditional = bool(
                conditional
                or module.get("disabled")
                or module.get("skip-arches")
                or (
                    arches
                    and not (
                        isinstance(arches, list)
                        and all(a in arches for a in ("aarch64", "x86_64"))
                    )
                )
            )
            # Flatpak builds nested modules before their enclosing module.
            modules.append((module, True, conditional, directory))
            modules.extend(
                (child, False, conditional, directory) for child in reversed(children)
            )
            continue
        commands = _command_phases(module)
        build_source = _build_source_path(module, filename)
        after_install = bool(owned_destinations)
        if after_install and any(
            not isinstance(s, dict) for s in module.get("sources", [])
        ):
            return False
        directories = set()
        installs = []
        for phase, command in commands:
            created = _install_directories(command, app_id)
            if created:
                directories.update(created)
                installs.append(False)
                continue
            installation = _metadata_install(command, app_id, directories)
            expected = filename if phase == "commands" else build_source
            installs.append(
                installation is not None
                and (
                    installation[0].removeprefix("./") == expected
                    or installation[0] == f"${{FLATPAK_BUILDER_BUILDDIR}}/{filename}"
                )
            )
            if _installs_outside_listing(command, app_id):
                continue
            if installation is not None:
                _, destination = installation
                if installs[-1]:
                    owned_destinations.add(destination)
                else:
                    other_destinations.add(destination)
            elif any(
                re.search(
                    r"/share/(?:metainfo|appdata)(?:/|$)", posixpath.normpath(path)
                )
                for path in re.findall(r"/[^\s\"';|&<>]+", command)
            ):
                return False
            elif owned_destinations and not _composes_catalog(command, app_id):
                needs_published_check = True
        if not any(installs):
            if (
                owned_destinations
                and module.get("buildsystem") != "simple"
                and (module.get("buildsystem") or module.get("sources"))
            ):
                needs_published_check = True
            continue
        cleanup.update(module.get("cleanup", []))
        if conditional:
            return False
        files = []
        sources = list(reversed(module.get("sources", [])))
        while sources:
            source = sources.pop()
            if isinstance(source, str):
                if (
                    not read_text
                    or not re.fullmatch(r"[\w.-]+\.(?:json|ya?ml)", source)
                    or not register_include(source)
                ):
                    return False
                group = _load_manifest_data(read_text(source), source)
                if isinstance(group, dict):
                    group = [group]
                if not isinstance(group, list) or not all(
                    isinstance(s, dict) for s in group
                ):
                    return False
                if any(
                    _mentions_listing(c) for c in _install_commands({"sources": group})
                ):
                    return False
                sources.extend(reversed(group))
                continue
            if not isinstance(source, dict):
                return False
            kind = source.get("type")
            if kind == "shell":
                if set(source) - {"type", "commands"} and any(
                    _direct_install(c, filename, app_id)
                    for c in _install_commands({"sources": [source]})
                ):
                    return False
                continue
            path = source.get("path")
            if kind == "patch":
                patches = source.get("paths", [path])
                if (
                    not read_text
                    or set(source)
                    - {"type", "path", "paths", "strip-components", "use-git"}
                    or ("path" in source and "paths" in source)
                    or not isinstance(patches, list)
                    or not 0 < len(patches) <= 16
                    or any(
                        not isinstance(p, str)
                        or not re.fullmatch(
                            r"(?:[\w-][\w.-]*/)*[\w.-]+\.(?:patch|diff)", p
                        )
                        or _mentions_listing(read_text(posixpath.join(directory, p)))
                        for p in patches
                    )
                ):
                    return False
                continue
            if (
                kind == "file"
                and isinstance(path, str)
                and not path.startswith("/")
                and ".." not in path.split("/")
                and posixpath.normpath(posixpath.join(directory, path))
                == (source_path or filename)
            ):
                if set(source) != {"type", "path"}:
                    return False
                files.append(source)
                continue
            if kind not in ("archive", "git", "file", "inline", "script", "extra-data"):
                return False
            if path is not None and not isinstance(path, str):
                return False
            dest = source.get("dest", "")
            url = source.get("url", "")
            if not isinstance(url, str):
                return False
            name = (
                source.get("dest-filename")
                or source.get("filename")
                or posixpath.basename(path or url.partition("?")[0])
            )
            if (
                not isinstance(dest, str)
                or not isinstance(name, str)
                or dest.startswith("/")
                or ".." in dest.split("/")
                or "/" in name
                or posixpath.normpath(posixpath.join(dest, name)) == filename
            ):
                return False
            if files and kind in ("archive", "git") and posixpath.normpath(dest) == ".":
                return False
        if len(files) != 1:
            return False
        if module.get("buildsystem") != "simple" and not any(
            direct and phase != "build-commands"
            for (phase, _), direct in zip(commands, installs, strict=True)
        ):
            return False
        listing_installed = False
        for (_, command), direct in zip(commands, installs, strict=True):
            if direct:
                listing_installed = True
                continue
            if _installs_outside_listing(command, app_id) or (
                listing_installed and _composes_catalog(command, app_id)
            ):
                continue
            # A pre-install extraction explicitly rooted in /app cannot
            # overwrite the local XML in the module's build directory.
            if _install_directories(command, app_id) or (
                not listing_installed
                and re.fullmatch(
                    r'tar -xf [\w.*-]+(?: --strip [0-9]+)?(?: --exclude=[\w.-]+)? -C "(?:\$\{FLATPAK_DEST\}|/app)/?"',
                    command,
                )
            ):
                continue
            if _mentions_listing(command):
                return False
            needs_published_check = True
    for target in owned_destinations:
        parts = target.removeprefix("/app/").strip("/").split("/")
        for i in range(len(parts)):
            path = "/" + "/".join(parts[: i + 1])
            if any(
                fnmatch.fnmatchcase(
                    path if p.startswith("/") else parts[i], p.rstrip("/")
                )
                for p in cleanup
            ):
                return False
    return (
        bool(owned_destinations)
        and not owned_destinations.intersection(other_destinations)
        and (
            not needs_published_check
            or (
                confirm_published is not None
                and len(owned_destinations) == 1
                and confirm_published(next(iter(owned_destinations)))
            )
        )
    )


def _build_source_path(module: dict[str, Any], filename: str) -> str | None:
    subdir = module.get("subdir", "")
    if not isinstance(subdir, str) or (
        subdir and not re.fullmatch(r"(?:[\w-][\w.-]*/)*[\w-][\w.-]*/?", subdir)
    ):
        return None
    system = module.get("buildsystem", "autotools")
    if system in ("meson", "cmake", "cmake-ninja") or module.get("builddir"):
        if system == "simple":
            return None
        subdir = posixpath.join(subdir, "_flatpak_build")
    return posixpath.relpath(filename, subdir or ".")


def _mentions_listing(text: str) -> bool:
    return bool(re.search(r"metainfo|appdata|appstream|[*]\.xml", text, re.IGNORECASE))


def _composes_catalog(command: str, app_id: str) -> bool:
    if not command.startswith(("appstream-compose ", "appstreamcli compose ")):
        return False
    words = _command_words(command, app_id)
    if not words:
        return False
    if words[0] == "appstream-compose":
        options = {f"--basename={app_id}", "--prefix=/app", "--origin=flatpak"}
        return len(words) == 5 and words[-1] == app_id and set(words[1:-1]) == options
    if "--no-net" in words:
        words.remove("--no-net")
    options = {
        f"--components={app_id}",
        "--prefix=/",
        f"--origin={app_id}",
        "--result-root=/app",
        "--data-dir=/app/share/app-info/xmls",
    }
    return (
        len(words) == 8
        and words[:2] == ["appstreamcli", "compose"]
        and words[-1] == "/app"
        and set(words[2:-1]) == options
    )


def _direct_install(command: str, filename: str, app_id: str) -> bool:
    installation = _metadata_install(command, app_id)
    return installation is not None and installation[0] in (filename, f"./{filename}")


def _installs_outside_listing(command: str, app_id: str) -> bool:
    if not command.startswith(("install ", "cp ")):
        return False
    words = _command_words(command, app_id)
    if not words or words[0] not in ("install", "cp"):
        return False
    operands = _copy_target(words)
    if not operands:
        return False
    source, target, _ = operands
    return (
        bool(re.fullmatch(r"[\w./@+-]+", source))
        and bool(
            re.fullmatch(
                r"/app/(?:bin|lib|libexec|etc|share/(?:icons|applications|licenses))(?:/[\w.@+-]+)*/?",
                target,
            )
        )
        and ".." not in target.split("/")
    )


def _metadata_install(
    command: str, app_id: str, directories=()
) -> tuple[str, str] | None:
    words = _command_words(command, app_id)
    if not words or words[0] not in {"install", "cp", "mv"}:
        return None
    return _install_operands(words, directories)


def _install_directories(command: str, app_id: str) -> list[str]:
    if not command.startswith(("mkdir ", "install -d ")):
        return []
    words = _command_words(command, app_id)
    if not words or words[:2] not in (["mkdir", "-p"], ["install", "-d"]):
        return []
    if not all(
        re.fullmatch(r"/app/(?:[\w.-]+/)*[\w.-]+/?", p) and ".." not in p.split("/")
        for p in words[2:]
    ):
        return []
    return [p.rstrip("/") for p in words[2:]]


def _command_words(command: str, app_id: str) -> list[str] | None:
    if re.search(r"'[^']*\$[^']*'", command):
        return None
    command = command.replace("\\\n", "").strip().removesuffix(";")
    command = re.sub(
        r"\$\{(FLATPAK_ID|FLATPAK_DEST)\}|\$(FLATPAK_ID|FLATPAK_DEST)\b",
        lambda match: app_id if (match[1] or match[2]) == "FLATPAK_ID" else "/app",
        command,
    )
    if any(
        char in command.replace("${FLATPAK_BUILDER_BUILDDIR}/", "")
        for char in "$`;&|<>\n"
    ):
        return None
    try:
        return shlex.split(command, comments=True)
    except ValueError:
        return None


def _install_operands(words, directories):
    copy = _copy_target(words)
    if copy is None:
        return None
    source, target, target_directory = copy
    directory_operand = target.endswith("/") or target_directory
    target = posixpath.normpath(target)
    if re.fullmatch(r"/app/share/(?:metainfo|appdata)/?", target):
        if not directory_operand and target not in directories:
            return None
        return source, posixpath.join(target, posixpath.basename(source))
    if target_directory or not re.fullmatch(
        r"/app/share/(?:metainfo|appdata)/[^/]+\.xml", target
    ):
        return None
    return source, target


def _copy_target(words):
    executable = words.pop(0)
    simple_options = {
        "install": "DpvCT",
        "cp": "fpvT",
        "mv": "fvT",
    }[executable]
    operands = []
    target = None
    while words:
        word = words.pop(0)
        if word == "--":
            operands.extend(words)
            break
        if word.startswith("--target-directory="):
            target = word.partition("=")[2]
        elif word in {"--verbose", "--no-target-directory"}:
            continue
        elif executable == "install" and word.startswith("--mode="):
            if not re.fullmatch(r"[0-7]+", word.partition("=")[2]):
                return None
        elif word in {"-t", "--target-directory"} or (
            executable == "install" and word in {"-m", "--mode"}
        ):
            if not words:
                return None
            argument = words.pop(0)
            if word in {"-t", "--target-directory"}:
                target = argument
        elif word.startswith("-") and not word.startswith("--"):
            options = word[1:]
            if executable == "install" and re.fullmatch(r"[DpvCT]*m[0-7]+", options):
                continue
            if executable == "install" and re.fullmatch(r"[DpvCT]*m", options):
                if not words or not re.fullmatch(r"[0-7]+", words.pop(0)):
                    return None
                continue
            if options.endswith("t") and set(options[:-1]) <= set(simple_options):
                if not words:
                    return None
                target = words.pop(0)
            elif not options or not set(options) <= set(simple_options):
                return None
        elif word.startswith("--"):
            return None
        else:
            operands.append(word)
    target_directory = target is not None
    if target is None:
        if len(operands) != 2:
            return None
        target = operands.pop()
    if len(operands) != 1:
        return None
    return operands[0], target, target_directory


def _nested_listing_paths(manifest: dict[str, Any], app_id: str) -> set[str]:
    """Look for recipe-local XML sources, not files in an upstream checkout."""
    paths = set()
    modules = [manifest]
    seen = set()
    while modules:
        module = modules.pop()
        if not isinstance(module, dict) or id(module) in seen:
            continue
        seen.add(id(module))
        if isinstance(children := module.get("modules"), list):
            modules.extend(children)
        if not isinstance(sources := module.get("sources"), list):
            continue
        for source in sources:
            if not isinstance(source, dict) or source.get("type") != "file":
                continue
            path = source.get("path")
            if isinstance(path, str):
                path = path.removeprefix("./")
                if re.fullmatch(
                    rf"(?:[\w-][\w.-]*/)+{re.escape(app_id)}\.(?:metainfo|appdata)\.xml",
                    path,
                ):
                    paths.add(path)
    return paths


def read_source(repo: Repository, app_id: str) -> MetadataSource:
    if repo.archived or repo.private:
        raise MetadataError("unsupported_repository")
    revision = repo.get_branch(SOURCE_BRANCH).commit.sha
    entries = repo.get_contents("", ref=revision)
    if not isinstance(entries, list):
        raise MetadataError("unsupported_metadata")
    candidates = [
        entry
        for entry in entries
        if entry.type == "file"
        and entry.name in {f"{app_id}.metainfo.xml", f"{app_id}.appdata.xml"}
    ]
    if not candidates:
        candidates = [
            entry
            for entry in entries
            if entry.type == "file"
            and (
                entry.name == f"{app_id}.xml"
                or re.fullmatch(r"(?:[\w.-]+\.)?(?:metainfo|appdata)\.xml", entry.name)
            )
        ]
    if len(candidates) > 1 or (
        not candidates and not any(entry.type == "dir" for entry in entries)
    ):
        raise MetadataError("metadata_not_found")
    if candidates and candidates[0].size > MAX_XML_BYTES:
        raise MetadataError("metadata_too_large")
    manifests = [
        entry
        for entry in entries
        if entry.name in {f"{app_id}.json", f"{app_id}.yml", f"{app_id}.yaml"}
    ]
    if len(manifests) != 1 or manifests[0].size > MAX_XML_BYTES:
        raise MetadataError("unsupported_metadata")
    manifest = repo.get_contents(manifests[0].path, ref=revision)
    if isinstance(manifest, list) or manifest.type != "file":
        raise MetadataError("unsupported_metadata")
    try:
        text = manifest.decoded_content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise MetadataError("unsupported_metadata") from error
    parsed = _load_manifest(text, manifests[0].path)
    if candidates:
        metadata_path = candidates[0].path
    else:
        paths = _nested_listing_paths(parsed, app_id)
        if len(paths) != 1:
            raise MetadataError("metadata_not_found")
        metadata_path = paths.pop()

    shared_revision = None

    def load_shared_module(path: str) -> bytes:
        nonlocal shared_revision
        if shared_revision is None:
            gitlink = repo.get_contents(SHARED_MODULES_PATH, ref=revision)
            if (
                isinstance(gitlink, list)
                or gitlink.type != "submodule"
                or gitlink.submodule_git_url.removesuffix(".git") != SHARED_MODULES_URL
                or not re.fullmatch(r"[0-9a-f]{40}", gitlink.sha)
            ):
                raise MetadataError("unsupported_metadata")
            shared_revision = gitlink.sha

        relative_path = path.removeprefix(f"{SHARED_MODULES_PATH}/")
        _, data = repo.requester.requestJsonAndCheck(
            "GET",
            f"/repos/flathub/shared-modules/contents/{quote(relative_path)}",
            parameters={"ref": shared_revision},
        )
        if (
            not isinstance(data, dict)
            or data.get("type") != "file"
            or data.get("encoding") != "base64"
            or not isinstance(size := data.get("size"), int)
            or size > MAX_XML_BYTES
            or not isinstance(content := data.get("content"), str)
        ):
            raise MetadataError("unsupported_metadata")
        try:
            return b64decode("".join(content.split()), validate=True)
        except ValueError as error:
            raise MetadataError("unsupported_metadata") from error

    def read_module(path: str) -> bytes:
        try:
            file = repo.get_contents(path, ref=revision)
        except GithubException as error:
            if error.status != 404 or not path.startswith(f"{SHARED_MODULES_PATH}/"):
                raise
            return load_shared_module(path)
        if isinstance(file, list) or file.type != "file" or file.size > MAX_XML_BYTES:
            raise MetadataError("unsupported_metadata")
        return file.decoded_content

    def read_text(path: str):
        try:
            return read_module(path).decode()
        except GithubException as error:
            if error.status != 404:
                raise
            raise MetadataError("unsupported_metadata") from error
        except UnicodeDecodeError as error:
            raise MetadataError("unsupported_metadata") from error

    @cache
    def xml_file():
        if "/" in metadata_path:
            listing = entries
            prefix = ""
            for part in metadata_path.split("/")[:-1]:
                if not any(e.type == "dir" and e.name == part for e in listing):
                    raise MetadataError("unsupported_metadata")
                prefix = posixpath.join(prefix, part)
                listing = repo.get_contents(prefix, ref=revision)
                if not isinstance(listing, list):
                    raise MetadataError("unsupported_metadata")
            if not any(e.type == "file" and e.path == metadata_path for e in listing):
                raise MetadataError("unsupported_metadata")
        file = repo.get_contents(metadata_path, ref=revision)
        if isinstance(file, list) or file.type != "file":
            raise MetadataError("unsupported_metadata")
        if file.size > MAX_XML_BYTES:
            raise MetadataError("metadata_too_large")
        return file

    if not _owns_metadata(
        parsed,
        posixpath.basename(metadata_path),
        app_id,
        load_module=lambda path: _load_manifest(read_text(path), path),
        read_text=read_text,
        source_path=metadata_path,
        confirm_published=lambda dest: published_listing_matches(
            app_id, revision, dest, xml_file().decoded_content
        ),
    ):
        raise MetadataError("unsupported_metadata")
    file = xml_file()
    return MetadataSource(revision, file.path, file.sha, file.decoded_content)


def _translation_branch(
    source: MetadataSource, locale: str, generation: int = 0
) -> str:
    digest = hashlib.sha256(source.sha.encode() + source.path.encode()).hexdigest()[:20]
    branch = f"translations/{normalize_locale(locale)}/{digest}"
    return f"{branch}-{generation}" if generation else branch


def translation_pull_request(repo, source, locale, generation=0):
    branch = _translation_branch(source, locale, generation)
    pulls = list(repo.get_pulls(state="all", head=f"{repo.owner.login}:{branch}"))
    return pulls[0] if pulls else None


def merged_translation_content(repo, pull, path: str) -> bytes | None:
    if not pull.merged or not pull.merge_commit_sha:
        return None
    try:
        merged = repo.get_contents(path, ref=pull.merge_commit_sha)
    except GithubException as error:
        if error.status == 404:
            return None
        raise
    if isinstance(merged, list) or getattr(merged, "encoding", "base64") != "base64":
        return None
    return merged.decoded_content


def read_translation_document(
    repo: Repository,
    source: MetadataSource,
    app_id: str,
    locale: str,
    generation: int = 0,
    *,
    include_unpublished: bool = False,
    pull_number: int | None = None,
    pull=None,
) -> MetadataDocument:
    document = MetadataDocument(source.content, app_id, locale)
    branch = _translation_branch(source, locale, generation)
    if pull is None:
        pull = (
            repo.get_pull(pull_number)
            if pull_number is not None
            else translation_pull_request(repo, source, locale, generation)
        )
    if pull is not None and pull.base.ref != SOURCE_BRANCH:
        raise MetadataError("source_changed")
    if pull is not None and pull.merged:
        return document
    if pull is None:
        if not include_unpublished:
            return document
        try:
            repo.get_git_ref(f"heads/{branch}")
        except GithubException as error:
            if error.status != 404:
                raise
            return document
        _check_branch_diff(repo, source, branch)
    try:
        current = repo.get_contents(source.path, ref=branch)
    except GithubException as error:
        if error.status == 404:
            raise MetadataError("source_changed") from error
        raise
    if isinstance(current, list) or getattr(current, "encoding", "base64") != "base64":
        raise MetadataError("source_changed")
    return document.with_pending(current.decoded_content, unpublished=pull is None)


class ClosedTranslationPull(MetadataError):
    def __init__(self, url):
        super().__init__("pull_request_closed")
        self.url = url


class ReviewedFieldsChanged(MetadataError):
    def __init__(self, document, fields, url):
        super().__init__("reviewed_fields_changed")
        self.document = document
        self.fields = fields
        self.url = url


def read_reviewed_fields(repo, path, app_id, locale, pull):
    """Read the reviewed commit, including after the PR branch was deleted."""
    try:
        file = repo.get_contents(path, ref=pull.head.sha)
        if (
            not isinstance(file, list)
            and getattr(file, "encoding", "base64") == "base64"
        ):
            return MetadataDocument(file.decoded_content, app_id, locale)
    except GithubException as error:
        if error.status != 404:
            raise
    except MetadataError:
        pass
    return None


def submit_translation(
    repo: Repository,
    app_id: str,
    locale: str,
    revision: str,
    changes: dict[str, str],
    generation: int = 0,
    *,
    pull_number: int | None = None,
    source: MetadataSource | None = None,
    expected: dict[str, str] | None = None,
    attempted=None,
    before_write=None,
) -> dict[str, str]:
    source = source or read_source(repo, app_id)
    if source.revision != revision:
        raise MetadataError("source_changed")
    document = MetadataDocument(source.content, app_id, locale)
    if not document.license:
        raise MetadataError("missing_license")
    # Restoring the original text can still change an open PR.
    source_unchanged = False
    try:
        MetadataDocument(source.content, app_id, locale).apply(changes)
    except MetadataError as error:
        if str(error) != "no_changes":
            raise
        source_unchanged = True
    branch = _translation_branch(source, locale, generation)
    pull = (
        repo.get_pull(pull_number)
        if pull_number is not None
        else translation_pull_request(repo, source, locale, generation)
    )
    if pull is not None and pull.base.ref != SOURCE_BRANCH:
        raise MetadataError("source_changed")
    if pull is not None and pull.state != "open":
        raise ClosedTranslationPull(pull.html_url)
    reused = False
    if pull is None:
        if source_unchanged:
            try:
                repo.get_git_ref(f"heads/{branch}")
            except GithubException as error:
                if error.status != 404:
                    raise
                raise MetadataError("no_changes") from error
            reused = True
        else:
            reused = not _create_branch(repo, branch, source.revision)
        if reused:
            _check_branch_diff(repo, source, branch)
    try:
        current = repo.get_contents(source.path, ref=branch)
    except GithubException as error:
        if error.status == 404:
            raise MetadataError("source_changed") from error
        raise
    if isinstance(current, list) or getattr(current, "encoding", "base64") != "base64":
        raise MetadataError("source_changed")
    pending = document.with_pending(current.decoded_content, unpublished=reused)
    confirmed = {}
    if expected is not None:
        expected = dict(expected)
        for key, values in (attempted or {}).items():
            if key in changes and pending.nodes[key].unit.translation in values:
                expected[key] = pending.nodes[key].unit.translation
        result = reconcile(document, pending, changes, expected=expected)
        if attempted:
            confirmed = {
                k: [changes[k]]
                for k in result.satisfied
                if changes[k] in attempted.get(k, ())
            }
        if result.retain:
            raise ReviewedFieldsChanged(
                pending, [u.id for u in result.retain], pull.html_url if pull else None
            )
        changes = result.apply
    try:
        if not changes:
            raise MetadataError("no_changes")
        output = pending.apply(changes)
    except MetadataError as error:
        if str(error) != "no_changes":
            raise
        if pull is None and current.decoded_content == source.content:
            raise
        output = current.decoded_content
    title = f"AppStream translation: {document.locale}"
    if current.decoded_content != output:
        if before_write is not None:
            written = document.with_pending(output)
            before_write(
                {
                    k: [
                        pending.nodes[k].unit.translation,
                        written.nodes[k].unit.translation,
                    ]
                    for k in changes
                }
                | confirmed
            )
        try:
            repo.update_file(
                source.path,
                title,
                output,
                current.sha,
                branch=branch,
            )
        except GithubException as error:
            if error.status == 409:
                raise MetadataError("source_changed") from error
            raise
    if pull is not None:
        # The branch can still accept commits after the PR has closed.
        pull = repo.get_pull(pull.number)
        if pull.base.ref != SOURCE_BRANCH:
            raise MetadataError("source_changed")
        if pull.state != "open" and not pull.merged:
            raise ClosedTranslationPull(pull.html_url)
        if pull.merged:
            return {"url": pull.html_url, "state": "merged"}
        return {"url": pull.html_url, "state": pull.state}
    _check_branch_diff(repo, source, branch)
    try:
        pull = repo.create_pull(
            title=title,
            body=(
                "Translators edited this app listing on Flathub. "
                "Merge to include their changes in the next build."
            ),
            head=branch,
            base=SOURCE_BRANCH,
        )
    except GithubException as error:
        if error.status != 422:
            raise
        existing = list(
            repo.get_pulls(
                state="open", head=f"{repo.owner.login}:{branch}", base=SOURCE_BRANCH
            )
        )
        if not existing:
            raise
        pull = existing[0]
    return {"url": pull.html_url, "state": pull.state}


def _create_branch(repo, branch, revision):
    try:
        repo.create_git_ref(f"refs/heads/{branch}", revision)
        return True
    except GithubException as error:
        if error.status != 422:
            raise
        repo.get_git_ref(f"heads/{branch}")
        return False


def _check_branch_diff(repo, source, branch):
    comparison = repo.compare(SOURCE_BRANCH, branch)
    if any(
        file.filename != source.path or file.status != "modified"
        for file in comparison.files
    ):
        raise MetadataError("source_changed")
