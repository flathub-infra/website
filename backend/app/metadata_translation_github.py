"""Read recipe-owned AppStream files and publish translations to GitHub."""

import fnmatch
import hashlib
import json
import posixpath
import re
import shlex
from dataclasses import dataclass
from typing import Any

import yaml
from github import GithubException
from github.Repository import Repository

from .metadata_translation_reconciliation import reconcile
from .metadata_translations import (
    MAX_XML_BYTES,
    MetadataDocument,
    MetadataError,
    normalize_locale,
)

SOURCE_BRANCH = "master"


@dataclass
class MetadataSource:
    revision: str
    path: str
    sha: str
    content: bytes


def _load_manifest(text: str, path: str) -> dict[str, Any]:
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
    if not isinstance(manifest, dict):
        raise MetadataError("unsupported_metadata")
    return manifest


def _install_commands(module: dict[str, Any]) -> list[str]:
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
                line.strip()
                for line in value.replace("\\\n", "").splitlines()
                if line.strip() and not line.lstrip().startswith("#")
            )
    return commands


def _owns_metadata(
    manifest: dict[str, Any], filename: str, app_id: str, *, load_module=None
) -> bool:
    modules = [(manifest, False, False, "")]
    seen = {}
    includes = set()
    owned_destinations = set()
    other_destinations = set()
    cleanup = set()
    while modules:
        module, visit, conditional, directory = modules.pop()
        if not visit:
            if isinstance(module, str):
                path = posixpath.normpath(posixpath.join(directory, module))
                if (
                    not load_module
                    or path in includes
                    or len(includes) >= 16
                    or not re.fullmatch(r"(?:[\w.-]+/)*[\w.-]+\.(?:json|ya?ml)", path)
                    or ".." in path.split("/")
                ):
                    return False
                includes.add(path)
                module = load_module(path)
                directory = posixpath.dirname(path)
            if not isinstance(module, dict) or id(module) in seen:
                return False
            seen[id(module)] = module
            children = module.get("modules", [])
            if not isinstance(children, list) or module.get("cleanup-commands"):
                return False
            patterns = module.get("cleanup", [])
            if not isinstance(patterns, list) or not all(
                isinstance(p, str) for p in patterns
            ):
                return False
            if module is manifest:
                cleanup.update(patterns)
            conditional = conditional or any(
                module.get(key) for key in ("disabled", "only-arches", "skip-arches")
            )
            # Flatpak builds nested modules before their enclosing module.
            modules.append((module, True, conditional, directory))
            modules.extend(
                (child, False, conditional, directory) for child in reversed(children)
            )
            continue
        commands = _install_commands(module)
        after_install = bool(owned_destinations)
        if after_install and any(
            not isinstance(s, dict) for s in module.get("sources", [])
        ):
            return False
        directories = set()
        installs = []
        for command in commands:
            mkdir = re.fullmatch(
                r"mkdir -p (/app/share/(?:metainfo|appdata))/?", command
            )
            if mkdir:
                directories.add(mkdir[1])
            installation = _metadata_install(command, app_id, directories)
            installs.append(
                installation is not None
                and installation[0] in (filename, f"./{filename}")
            )
            if _desktop_install(command, app_id):
                continue
            if installation is not None:
                source, destination = installation
                if source in (filename, f"./{filename}"):
                    owned_destinations.add(destination)
                else:
                    other_destinations.add(destination)
            elif (
                after_install
                or any(
                    re.search(
                        r"/share/(?:metainfo|appdata)(?:/|$)", posixpath.normpath(path)
                    )
                    for path in re.findall(r"/[^\s\"';|&<>]+", command)
                )
            ) and not re.fullmatch(
                r"mkdir -p /app/share/(?:metainfo|appdata)/?", command
            ):
                return False
        if not any(installs):
            if (
                owned_destinations
                and module.get("buildsystem") != "simple"
                and (module.get("buildsystem") or module.get("sources"))
            ):
                return False
            continue
        # A patch or build step can replace a local file before installation.
        cleanup.update(module.get("cleanup", []))
        if (
            conditional
            or module.get("buildsystem") != "simple"
            or any(
                module.get(key)
                for key in (
                    "builddir",
                    "subdir",
                    "disabled",
                    "only-arches",
                    "skip-arches",
                )
            )
        ):
            return False
        files = []
        for source in module.get("sources", []):
            if not isinstance(source, dict):
                return False
            if source.get("type") == "shell":
                if set(source) - {"type", "commands"}:
                    return False
                continue
            if source.get("type") != "file" or set(source) - {"type", "path"}:
                return False
            path = source.get("path")
            if path in (filename, f"./{filename}") and not directory:
                files.append(source)
            elif (
                not isinstance(path, str)
                or not re.fullmatch(r"(?:\./)?[\w.-]+", path)
                or path in {".", "..", "./.", "./.."}
            ):
                return False
        if len(files) != 1:
            return False
        for command, direct in zip(commands, installs, strict=True):
            if _desktop_install(command, app_id):
                continue
            if not direct and not re.fullmatch(
                r"mkdir -p /app/share/(?:metainfo|appdata)/?", command
            ):
                return False
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
    return bool(owned_destinations) and not owned_destinations.intersection(
        other_destinations
    )


def _desktop_install(command: str, app_id: str) -> bool:
    desktop = re.escape(f"{app_id}.desktop")
    return bool(
        re.fullmatch(
            rf"install -Dm644 (?:\./)?{desktop} (?:/app|\$\{{FLATPAK_DEST\}})/share/applications/(?:{desktop})?",
            command,
        )
    )


def _direct_install(command: str, filename: str, app_id: str) -> bool:
    installation = _metadata_install(command, app_id)
    return installation is not None and installation[0] in (filename, f"./{filename}")


def _metadata_install(
    command: str, app_id: str, directories=()
) -> tuple[str, str] | None:
    if re.search(r"'[^']*\$[^']*'", command):
        return None
    command = command.replace("\\\n", "").strip().removesuffix(";")
    command = re.sub(
        r"\$\{(FLATPAK_ID|FLATPAK_DEST)\}|\$(FLATPAK_ID|FLATPAK_DEST)\b",
        lambda match: app_id if (match[1] or match[2]) == "FLATPAK_ID" else "/app",
        command,
    )
    if any(char in command for char in "$`;&|<>\n"):
        return None
    try:
        words = shlex.split(command, comments=True)
    except ValueError:
        return None
    if not words or words[0] not in {"install", "cp", "mv"}:
        return None
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
    directory_operand = target.endswith("/") or target_directory
    target = posixpath.normpath(target)
    if re.fullmatch(r"/app/share/(?:metainfo|appdata)/?", target):
        if not directory_operand and target not in directories:
            return None
        return operands[0], posixpath.join(target, posixpath.basename(operands[0]))
    if target_directory or not re.fullmatch(
        r"/app/share/(?:metainfo|appdata)/[^/]+\.xml", target
    ):
        return None
    return operands[0], target


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
    if len(candidates) != 1:
        raise MetadataError("metadata_not_found")
    metadata = candidates[0]
    if metadata.size > MAX_XML_BYTES:
        raise MetadataError("metadata_too_large")
    manifests = [
        entry
        for entry in entries
        if entry.name in {f"{app_id}.json", f"{app_id}.yml", f"{app_id}.yaml"}
    ]
    if len(manifests) != 1 or manifests[0].size > MAX_XML_BYTES:
        raise MetadataError("unsupported_metadata")
    manifest = repo.get_contents(manifests[0].path, ref=revision)
    if isinstance(manifest, list):
        raise MetadataError("unsupported_metadata")
    try:
        text = manifest.decoded_content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise MetadataError("unsupported_metadata") from error

    def load_module(path):
        try:
            file = repo.get_contents(path, ref=revision)
        except GithubException as error:
            if error.status != 404:
                raise
            raise MetadataError("unsupported_metadata") from error
        if isinstance(file, list) or file.type != "file" or file.size > MAX_XML_BYTES:
            raise MetadataError("unsupported_metadata")
        try:
            return _load_manifest(file.decoded_content.decode(), path)
        except UnicodeDecodeError as error:
            raise MetadataError("unsupported_metadata") from error

    if not _owns_metadata(
        _load_manifest(text, manifests[0].path),
        metadata.name,
        app_id,
        load_module=load_module,
    ):
        raise MetadataError("unsupported_metadata")
    file = repo.get_contents(metadata.path, ref=revision)
    if isinstance(file, list):
        raise MetadataError("unsupported_metadata")
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
