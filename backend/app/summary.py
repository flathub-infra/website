import datetime
import gzip
import json
import logging
import re
import struct
from collections import defaultdict
from typing import Literal, TypedDict, TypeGuard

logger = logging.getLogger(__name__)

import gi
import httpx

gi.require_version("GLib", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import GLib, OSTree  # type: ignore

from . import (
    apps,
    config,
    database,
    http_client,
    models,
    permission_stats,
    search,
    utils,
)
from .db_session import DBSession
from .types import JSONValue


class _SummaryBranch(TypedDict, total=False):
    download_size: int
    installed_size: int
    name: str


class _AppSummary(TypedDict, total=False):
    arches: set[str]
    branch: str
    timestamp: int
    download_size: int
    installed_size: int
    metadata: dict[str, JSONValue] | None
    branches: dict[str, _SummaryBranch]


def _is_xa_cache(value: object) -> TypeGuard[dict[str, tuple[int, int, str]]]:
    return isinstance(value, dict) and all(
        isinstance(app, str)
        and isinstance(item, tuple)
        and len(item) == 3
        and isinstance(item[0], int)
        and isinstance(item[1], int)
        and isinstance(item[2], str)
        for app, item in value.items()
    )


def _is_string_object_dict(value: object) -> TypeGuard[dict[str, object]]:
    return isinstance(value, dict) and all(isinstance(key, str) for key in value)


class JSONSetEncoder(json.JSONEncoder):
    def default(self, o: object) -> object:
        if isinstance(o, set):
            return list(o)
        return json.JSONEncoder.default(self, o)


# "valid" here means it would be displayed on flathub.org
def validate_ref(ref: str) -> tuple[str, str, str, str] | Literal[False]:
    fields = ref.split("/")
    if len(fields) != 4:
        return False

    kind, appid, arch, branch = fields

    if arch not in ("x86_64", "aarch64"):
        return False

    if appid.endswith((".Debug", ".Locale", ".Sources")):
        return False

    return kind, appid, arch, branch


def get_parent_id(app_id: str) -> str | None:
    if (
        reverse_lookup := database.get_json_key("summary:reverse_lookup")
    ) and isinstance(reverse_lookup, dict):
        parent = reverse_lookup.get(app_id)
        if isinstance(parent, str) and parent:
            return parent

    return None


def _is_eol_cache(value: object) -> TypeGuard[dict[str, dict[str, object]]]:
    return isinstance(value, dict) and all(
        isinstance(app, str)
        and isinstance(eol_data, dict)
        and all(isinstance(key, str) for key in eol_data)
        for app, eol_data in value.items()
    )


def parse_eol_data(
    metadata: dict[str, object],
) -> tuple[dict[str, list[str]], dict[str, str]]:
    eol_rebase: dict[str, list[str]] = {}
    eol_message: dict[str, str] = {}
    sparse_cache = metadata.get("xa.sparse-cache")
    if not _is_eol_cache(sparse_cache):
        raise TypeError("Summary metadata has an invalid xa.sparse-cache")

    for app, eol_dict in sparse_cache.items():
        _flatpak_type, app_id, _arch, branch = app.split("/")
        if (
            not app_id.endswith(".Debug")
            and not app_id.endswith(".Locale")
            and not app_id.endswith(".Sources")
        ):
            if "eolr" in eol_dict:
                rebase = eol_dict["eolr"]
                if not isinstance(rebase, str):
                    raise TypeError("Summary EOL rebase must be a string")
                new_id = rebase.split("/")[1]
                if new_id == app_id:
                    logger.warning(
                        "Skipping self-referential eolr for %s/%s", app_id, branch
                    )
                    continue
                if new_id in eol_rebase:
                    app_id_with_branch = f"{app_id}:{branch}"
                    if app_id_with_branch not in eol_rebase[new_id]:
                        eol_rebase[new_id].append(app_id_with_branch)
                else:
                    eol_rebase[new_id] = [f"{app_id}:{branch}"]
            elif "eol" in eol_dict:
                message = eol_dict["eol"]
                if not isinstance(message, str):
                    raise TypeError("Summary EOL message must be a string")
                eol_message[f"{app_id}:{branch}"] = message

    while True:
        found = False
        remove_list = []
        for app_id, old_id_list in eol_rebase.items():
            for new_app_id, check_id_list in eol_rebase.items():
                if app_id in check_id_list:
                    eol_rebase[new_app_id] += old_id_list
                    remove_list.append(app_id)
                    found = True
        for i in remove_list:
            del eol_rebase[i]
        if not found:
            break

    return eol_rebase, eol_message


def parse_metadata(ini: str) -> dict[str, JSONValue] | None:
    key_file = GLib.KeyFile.new()
    try:
        key_file.load_from_data(ini, len(ini), GLib.KeyFileFlags.NONE)
    except GLib.Error:
        return None

    if key_file.get_start_group() != "Application":
        return None

    metadata: dict[str, JSONValue] = {}
    try:
        keys = key_file.get_keys("Application")[0]
        for key in keys:
            value = key_file.get_value("Application", key)
            metadata[key] = value

        if "tags" in metadata:
            tags_value = metadata["tags"]
            if not isinstance(tags_value, str):
                raise TypeError("Application tags must be a string")
            tags: list[JSONValue] = [x for x in tags_value.split(";") if x]
            metadata["tags"] = tags

        permissions: defaultdict[str, JSONValue] = defaultdict(dict)

        try:
            context_keys = key_file.get_keys("Context")[0]
            for key in context_keys:
                value = key_file.get_value("Context", key)
                permissions[key] = [x for x in value.split(";") if x]
        except GLib.Error:
            pass

        try:
            session_bus_keys = key_file.get_keys("Session Bus Policy")[0]
            bus: defaultdict[str, list[JSONValue]] = defaultdict(list)
            for busname in session_bus_keys:
                bus_permission = key_file.get_value("Session Bus Policy", busname)
                bus[bus_permission].append(busname)
            permissions["session-bus"] = dict(bus)
        except GLib.Error:
            pass

        try:
            system_bus_keys = key_file.get_keys("System Bus Policy")[0]
            bus: defaultdict[str, list[JSONValue]] = defaultdict(list)
            for busname in system_bus_keys:
                bus_permission = key_file.get_value("System Bus Policy", busname)
                bus[bus_permission].append(busname)
            permissions["system-bus"] = dict(bus)
        except GLib.Error:
            pass

        metadata["permissions"] = permissions

        extensions: dict[str, JSONValue] = {}
        groups = key_file.get_groups()[0]
        for group in groups:
            if group.startswith("Extension "):
                extname = group[10:]
                ext_keys = key_file.get_keys(group)[0]
                extensions[extname] = {
                    key: key_file.get_value(group, key) for key in ext_keys
                }

        if extensions:
            metadata["extensions"] = extensions

        try:
            built_extensions = key_file.get_value("Build", "built-extensions")
            metadata["built-extensions"] = [x for x in built_extensions.split(";") if x]
        except GLib.Error:
            pass

        try:
            extra_data_keys = key_file.get_keys("Extra Data")[0]
            metadata["extra-data"] = {
                key: key_file.get_value("Extra Data", key) for key in extra_data_keys
            }
        except GLib.Error:
            pass

        return metadata
    except GLib.Error:
        return None


def _unpack_summary(summary):
    summary_data = GLib.Bytes.new(summary) if isinstance(summary, bytes) else summary
    data = GLib.Variant.new_from_bytes(
        GLib.VariantType.new(OSTree.SUMMARY_GVARIANT_STRING), summary_data, True
    )
    return data.unpack()


def parse_summary_metadata(summary: GLib.Bytes | bytes) -> dict[str, object]:
    _, metadata = _unpack_summary(summary)
    if not _is_string_object_dict(metadata):
        raise TypeError("Summary metadata must be a string-keyed dictionary")
    return metadata


def parse_summary(
    summary: GLib.Bytes | bytes,
    sqldb: DBSession,
    stable_permissions_by_app: dict[str, dict[str, JSONValue]] | None = None,
) -> tuple[
    defaultdict[str, _AppSummary],
    dict[str, int],
    dict[str, object],
]:
    summary_dict: defaultdict[str, _AppSummary] = defaultdict(
        lambda: {"arches": set(), "branch": "stable"}
    )
    updated_at_dict: dict[str, int] = {}

    refs, metadata = _unpack_summary(summary)
    if not _is_string_object_dict(metadata):
        raise TypeError("Summary metadata must be a string-keyed dictionary")
    xa_cache_value = metadata.get("xa.cache")
    if not _is_xa_cache(xa_cache_value):
        raise TypeError("Summary metadata has an invalid xa.cache")
    xa_cache = xa_cache_value
    stable_metadata_arch: dict[str, str] = {}

    last_updated_updates: dict[str, datetime.datetime] = {}

    for ref, (_, _, info) in refs:
        if not (valid_ref := validate_ref(ref)):
            continue

        _kind, app_id, arch, branch = valid_ref

        timestamp_be_uint = struct.pack("<Q", info["ostree.commit.timestamp"])
        timestamp = struct.unpack(">Q", timestamp_be_uint)[0]

        updated_at_dict[app_id] = timestamp
        last_updated_updates[app_id] = datetime.datetime.fromtimestamp(
            float(timestamp), datetime.UTC
        ).replace(tzinfo=None)
        summary_dict[app_id]["timestamp"] = timestamp

    if last_updated_updates:
        models.App.bulk_set_last_updated_at(sqldb, last_updated_updates)

    for ref in xa_cache:
        if not (valid_ref := validate_ref(ref)):
            continue

        _kind, app_id, arch, branch = valid_ref

        download_size_be_uint = struct.pack("<Q", xa_cache[ref][1])
        download_size = struct.unpack(">Q", download_size_be_uint)[0]

        installed_size_be_uint = struct.pack("<Q", xa_cache[ref][0])
        installed_size = struct.unpack(">Q", installed_size_be_uint)[0]

        parsed_metadata = parse_metadata(xa_cache[ref][2])

        if stable_permissions_by_app is not None:
            permission_stats.add_stable_permissions(
                stable_permissions_by_app,
                stable_metadata_arch,
                app_id=app_id,
                branch=branch,
                arch=arch,
                metadata=parsed_metadata,
            )

        summary_dict[app_id]["branch"] = branch
        summary_dict[app_id]["download_size"] = download_size
        summary_dict[app_id]["installed_size"] = installed_size

        summary_dict[app_id]["metadata"] = parsed_metadata
        summary_dict[app_id]["arches"].add(arch)

        # Store per-branch size data so multiple branches don't overwrite each other
        if "branches" not in summary_dict[app_id]:
            summary_dict[app_id]["branches"] = {}
        branch_sizes: _SummaryBranch = {
            "download_size": download_size,
            "installed_size": installed_size,
        }

        # flatpak cannot know how much application will weight after
        # apply_extra is executed, so let's estimate it by combining installed
        # and download sizes
        if parsed_metadata and parsed_metadata.get("extra-data"):
            summary_dict[app_id]["installed_size"] += download_size
            branch_sizes["installed_size"] += download_size

        summary_dict[app_id]["branches"][branch] = branch_sizes

    # Resolve runtime installed size for each app using the branch-specific data
    for app_id, data in summary_dict.items():
        app_metadata = data.get("metadata")
        runtime = app_metadata.get("runtime") if app_metadata else None
        if isinstance(runtime, str):
            runtime_appid, _, runtime_branch = runtime.split("/")
            runtime_data = summary_dict.get(runtime_appid)
            if runtime_data:
                branches = runtime_data.get("branches", {})
                if app_metadata is not None and runtime_branch in branches:
                    app_metadata["runtimeInstalledSize"] = branches[runtime_branch][
                        "installed_size"
                    ]

    return summary_dict, updated_at_dict, metadata


def fetch_summary_bytes(url: str) -> bytes | None:
    if url.startswith("file://"):
        # Handle local file URLs for tests
        filepath = url[7:]
        try:
            with open(filepath, "rb") as f:
                data = f.read()
                return data
        except FileNotFoundError:
            return None
    else:
        try:
            response = http_client.get(url, timeout=http_client.LONG_READ_TIMEOUT)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.content
        except httpx.HTTPStatusError as e:
            print(f"HTTP error fetching {url}: {e!s}")
            return None
        except Exception as e:
            print(f"Error fetching {url}: {e!s}")
            raise


def update(sqldb) -> None:
    all_apps = set(apps.get_appids(include_eol=True))
    non_eol_apps = set(apps.get_appids(include_eol=False))

    repo_url = config.settings.repo_url
    summary_url = f"{repo_url}/summary"

    summary_bytes = fetch_summary_bytes(summary_url)
    if summary_bytes:
        summary = GLib.Bytes.new(summary_bytes)
        stable_permissions_by_app: dict[str, dict[str, JSONValue]] = {}
        summary_dict, updated_at_dict, metadata = parse_summary(
            summary, sqldb, stable_permissions_by_app
        )
    else:
        return

    summary_idx_url = f"{repo_url}/summary.idx"
    idx_bytes = fetch_summary_bytes(summary_idx_url)

    if isinstance(idx_bytes, bytes):
        idx_data = GLib.Variant.new_from_bytes(
            GLib.VariantType.new("(a{s(ayaaya{sv})}a{sv})"),
            GLib.Bytes.new(idx_bytes),
            True,
        )

        aarch64_checksum = None
        aarch64_value = idx_data.get_child_value(0).lookup_value(
            "aarch64", GLib.VariantType.new("(ayaaya{sv})")
        )
        if aarch64_value:
            aarch64_checksum = OSTree.checksum_from_bytes(
                aarch64_value.get_child_value(0)
            )

        if aarch64_checksum:
            aarch64_url = f"{repo_url}/summaries/{aarch64_checksum}.gz"
            gzipped_bytes = fetch_summary_bytes(aarch64_url)
            if gzipped_bytes:
                aarch64_summary_bytes = gzip.decompress(gzipped_bytes)

                aarch64_summary = GLib.Bytes.new(aarch64_summary_bytes)
                aarch64_data = GLib.Variant.new_from_bytes(
                    GLib.VariantType.new(OSTree.SUMMARY_GVARIANT_STRING),
                    aarch64_summary,
                    True,
                )
                aarch64_refs, _ = aarch64_data.unpack()

                for ref, _ in aarch64_refs:
                    if not (valid_ref := validate_ref(ref)):
                        continue

                    _, app_id, arch, branch = valid_ref
                    if app_id in summary_dict:
                        summary_dict[app_id]["arches"].add(arch)

    if updated_at_dict:
        updated: list[dict[str, object]] = []

        for app_id in updated_at_dict:
            if app_id not in all_apps:
                continue

            if app_id not in non_eol_apps:
                continue

            updated.append(
                {
                    "id": utils.get_clean_app_id(app_id),
                    "updated_at": updated_at_dict[app_id],
                }
            )

        search.create_or_update_apps(updated)

    search.create_or_update_apps(
        [
            {
                "id": utils.get_clean_app_id(app_id),
                "arches": list(summary_dict[app_id]["arches"]),
            }
            for app_id in summary_dict
            if app_id in non_eol_apps
        ]
    )

    # Resolve runtime names from the DB and store on per-branch data
    runtime_appids = set()
    for app_id, data in summary_dict.items():
        app_metadata = data.get("metadata")
        runtime = app_metadata.get("runtime") if app_metadata else None
        if isinstance(runtime, str):
            runtime_appid = runtime.split("/")[0]
            runtime_appids.add(runtime_appid)

    runtime_names = {}
    for runtime_appid in runtime_appids:
        runtime_app = models.App.by_appid(sqldb, runtime_appid)
        if runtime_app and runtime_app.appstream:
            runtime_name = runtime_app.appstream.get("name")
            if isinstance(runtime_name, str):
                runtime_names[runtime_appid] = runtime_name

    # Store versioned names on each branch of the runtime entries
    for runtime_appid, base_name in runtime_names.items():
        # Strip existing version suffix (e.g. "GNOME Application Platform version 50")
        clean_name = re.sub(r"\s+version\s+\S+$", "", base_name)
        runtime_data = summary_dict.get(runtime_appid)
        if runtime_data and runtime_data.get("branches"):
            for branch, branch_data in runtime_data["branches"].items():
                branch_data["name"] = f"{clean_name} version {branch}"

    # Inject runtimeName into each app's metadata from the branch-specific data
    for app_id, data in summary_dict.items():
        app_metadata = data.get("metadata")
        runtime = app_metadata.get("runtime") if app_metadata else None
        if isinstance(runtime, str):
            runtime_appid, _, runtime_branch = runtime.split("/")
            runtime_data = summary_dict.get(runtime_appid)
            if runtime_data:
                branch_data = runtime_data.get("branches", {}).get(runtime_branch, {})
                if app_metadata is not None and "name" in branch_data:
                    app_metadata["runtimeName"] = branch_data["name"]

    # collect all app IDs to update
    apps_to_update = {}
    for app_id, data in summary_dict.items():
        try:
            summary_json = json.loads(json.dumps(data, cls=JSONSetEncoder))
            apps_to_update[app_id] = summary_json
        except Exception:
            logger.exception("Error encoding summary data for %s", app_id)
            continue

    # update all apps in a single transaction
    summary_apps_updated = False
    try:
        for app_id, summary_json in apps_to_update.items():
            app = models.App.by_appid(sqldb, app_id)
            if app:
                app.summary = summary_json
                sqldb.session.add(app)
            else:
                app = models.App(
                    app_id=app_id,
                    type="generic",
                    summary=summary_json,
                )
                sqldb.session.add(app)

        sqldb.session.commit()
        summary_apps_updated = True
    except Exception:
        sqldb.session.rollback()
        logger.exception("Error updating apps")

    eol_rebase, eol_message = parse_eol_data(metadata)

    eol_reconciliation_succeeded = False
    try:
        summary_eol_map = defaultdict(set)
        for new_app_id, old_id_list in eol_rebase.items():
            for old_id_and_branch in old_id_list:
                old_id, _, old_branch = old_id_and_branch.partition(":")
                summary_eol_map[old_id].add(old_branch or "stable")

        for appid_and_branch, message in eol_message.items():
            app_id, _, branch = appid_and_branch.partition(":")
            summary_eol_map[app_id].add(branch or "stable")
            models.App.set_eol_message(sqldb, app_id, message)

        db_eol_apps = set(models.App.get_eol_apps(sqldb))
        apps_to_process = set(summary_eol_map.keys()).union(db_eol_apps)

        for app_id in apps_to_process:
            app = models.App.by_appid(sqldb, app_id)
            if not app:
                continue

            if app_id in summary_eol_map:
                app.is_eol = True
                app.eol_branches = list(summary_eol_map[app_id])
                existing = dict(app.eol_dates or {})
                now_iso = datetime.datetime.now(datetime.UTC).isoformat()
                for branch in summary_eol_map[app_id]:
                    existing.setdefault(branch, now_iso)
                existing = {
                    b: d for b, d in existing.items() if b in summary_eol_map[app_id]
                }
                app.eol_dates = existing
                sqldb.session.add(app)
            else:
                app.is_eol = False
                app.eol_branches = None
                app.eol_message = None
                app.eol_dates = None
                sqldb.session.add(app)
        sqldb.session.commit()
        eol_reconciliation_succeeded = True
    except Exception:
        sqldb.session.rollback()
        logger.exception("Error updating EOL values of apps")

    if summary_apps_updated and eol_reconciliation_succeeded:
        permission_stats.record_permission_snapshot(sqldb, stable_permissions_by_app)

    processed_rebases = {}
    for new_app_id, old_id_list in eol_rebase.items():
        processed_old_ids = []
        for old_id_and_branch in old_id_list:
            if ":" in old_id_and_branch:
                old_id = old_id_and_branch.split(":", 1)[0]
            else:
                old_id = old_id_and_branch

            if old_id not in processed_old_ids:
                processed_old_ids.append(old_id)

        processed_rebases[new_app_id] = processed_old_ids

    try:
        models.AppEolRebase.reconcile(sqldb, processed_rebases)
    except Exception:
        sqldb.session.rollback()
        logger.exception("Error reconciling EOL rebases")

    xa_cache = metadata.get("xa.cache")
    if not _is_xa_cache(xa_cache):
        raise TypeError("Summary metadata has an invalid xa.cache")

    reverse_lookup: dict[str, str] = {}
    for ref in xa_cache:
        app_id = ref.split("/")[1]

        ini = xa_cache[ref][2]
        key_file = GLib.KeyFile.new()
        try:
            key_file.load_from_data(ini, len(ini), GLib.KeyFileFlags.NONE)

            if "Build" in key_file.get_groups()[0]:
                try:
                    built_extensions = key_file.get_value("Build", "built-extensions")
                    for ext in built_extensions.split(";"):
                        if ext:
                            reverse_lookup[ext] = app_id
                except GLib.Error:
                    pass
        except GLib.Error:
            pass

    models.AppExtensionLookup.set_all_mappings(sqldb, reverse_lookup)
