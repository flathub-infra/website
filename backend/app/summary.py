import datetime
import gzip
import json
import struct
from collections import defaultdict
from typing import Any

import gi
import httpx

gi.require_version("GLib", "2.0")
gi.require_version("OSTree", "1.0")
from gi.repository import GLib, OSTree

from . import apps, config, database, models, search, utils


class JSONSetEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> list[Any]:
        if isinstance(obj, set):
            return list(obj)
        return json.JSONEncoder.default(self, obj)


# "valid" here means it would be displayed on flathub.org
def validate_ref(ref: str):
    fields = ref.split("/")
    if len(fields) != 4:
        return False

    kind, appid, arch, branch = fields

    if arch not in ("x86_64", "aarch64"):
        return False

    if (
        appid.endswith(".Debug")
        or appid.endswith(".Locale")
        or appid.endswith(".Sources")
    ):
        return False

    return kind, appid, arch, branch


def get_parent_id(app_id: str):
    if reverse_lookup := database.get_json_key("summary:reverse_lookup"):
        if parent := reverse_lookup.get(app_id):
            return parent

    return None


def parse_eol_data(metadata):
    eol_rebase: dict[str, list[str]] = {}
    eol_message: dict[str, str] = {}
    for app, eol_dict in metadata["xa.sparse-cache"].items():
        flatpak_type, app_id, arch, branch = app.split("/")
        if (
            not app_id.endswith(".Debug")
            and not app_id.endswith(".Locale")
            and not app_id.endswith(".Sources")
        ):
            if "eolr" in eol_dict:
                new_id = eol_dict["eolr"].split("/")[1]
                if new_id in eol_rebase:
                    app_id_with_branch = f"{app_id}:{branch}"
                    if app_id_with_branch not in eol_rebase[new_id]:
                        eol_rebase[new_id].append(app_id_with_branch)
                else:
                    eol_rebase[new_id] = [f"{app_id}:{branch}"]
            elif "eol" in eol_dict:
                eol_message[f"{app_id}:{branch}"] = eol_dict["eol"]

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


def parse_metadata(ini: str):
    key_file = GLib.KeyFile.new()
    try:
        key_file.load_from_data(ini, len(ini), GLib.KeyFileFlags.NONE)
    except GLib.Error:
        return None

    if key_file.get_start_group() != "Application":
        return None

    metadata = {}
    try:
        keys = key_file.get_keys("Application")[0]
        for key in keys:
            value = key_file.get_value("Application", key)
            metadata[key] = value

        if "tags" in metadata:
            tags = [x for x in metadata["tags"].split(";") if x]
            metadata["tags"] = tags

        permissions = defaultdict(dict)

        try:
            context_keys = key_file.get_keys("Context")[0]
            for key in context_keys:
                value = key_file.get_value("Context", key)
                permissions[key] = [x for x in value.split(";") if x]
        except GLib.Error:
            pass

        try:
            session_bus_keys = key_file.get_keys("Session Bus Policy")[0]
            bus = defaultdict(list)
            for busname in session_bus_keys:
                bus_permission = key_file.get_value("Session Bus Policy", busname)
                bus[bus_permission].append(busname)
            permissions["session-bus"] = bus
        except GLib.Error:
            pass

        try:
            system_bus_keys = key_file.get_keys("System Bus Policy")[0]
            bus = defaultdict(list)
            for busname in system_bus_keys:
                bus_permission = key_file.get_value("System Bus Policy", busname)
                bus[bus_permission].append(busname)
            permissions["system-bus"] = bus
        except GLib.Error:
            pass

        metadata["permissions"] = permissions

        extensions = {}
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


def parse_summary(summary, sqldb):
    summary_dict = defaultdict(lambda: {"arches": set(), "branch": "stable"})
    updated_at_dict = {}

    if isinstance(summary, bytes):
        summary_data = GLib.Bytes.new(summary)
    else:
        summary_data = summary

    data = GLib.Variant.new_from_bytes(
        GLib.VariantType.new(OSTree.SUMMARY_GVARIANT_STRING), summary_data, True
    )

    refs, metadata = data.unpack()
    xa_cache = metadata["xa.cache"]

    for ref, (_, _, info) in refs:
        if not (valid_ref := validate_ref(ref)):
            continue

        kind, app_id, arch, branch = valid_ref

        timestamp_be_uint = struct.pack("<Q", info["ostree.commit.timestamp"])
        timestamp = struct.unpack(">Q", timestamp_be_uint)[0]

        updated_at_dict[app_id] = timestamp
        models.App.set_last_updated_at(
            sqldb,
            app_id,
            datetime.datetime.fromtimestamp(
                float(timestamp),
            ),
        )
        summary_dict[app_id]["timestamp"] = timestamp

    for ref in xa_cache:
        if not (valid_ref := validate_ref(ref)):
            continue

        kind, app_id, arch, branch = valid_ref

        download_size_be_uint = struct.pack("<Q", xa_cache[ref][1])
        download_size = struct.unpack(">Q", download_size_be_uint)[0]

        installed_size_be_uint = struct.pack("<Q", xa_cache[ref][0])
        installed_size = struct.unpack(">Q", installed_size_be_uint)[0]

        parsed_metadata = parse_metadata(xa_cache[ref][2])

        summary_dict[app_id]["branch"] = branch
        summary_dict[app_id]["download_size"] = download_size
        summary_dict[app_id]["installed_size"] = installed_size

        summary_dict[app_id]["metadata"] = parsed_metadata
        summary_dict[app_id]["arches"].add(arch)

        # flatpak cannot know how much application will weight after
        # apply_extra is executed, so let's estimate it by combining installed
        # and download sizes
        if summary_dict[app_id]["metadata"] and summary_dict[app_id]["metadata"].get(
            "extra-data"
        ):
            summary_dict[app_id]["installed_size"] += download_size

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
            response = httpx.get(url, timeout=(120.05, None))
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.content
        except httpx.HTTPStatusError as e:
            print(f"HTTP error fetching {url}: {str(e)}")
            return None
        except Exception as e:
            print(f"Error fetching {url}: {str(e)}")
            raise


def update(sqldb) -> None:
    current_apps = set(apps.get_appids(include_eol=True))

    repo_url = config.settings.repo_url
    summary_url = f"{repo_url}/summary"

    summary_bytes = fetch_summary_bytes(summary_url)
    if summary_bytes:
        summary = GLib.Bytes.new(summary_bytes)
        summary_dict, updated_at_dict, metadata = parse_summary(summary, sqldb)
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
        updated: list = []

        for app_id in updated_at_dict:
            if app_id not in current_apps:
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
        ]
    )

    # collect all app IDs to update
    apps_to_update = {}
    for app_id, data in summary_dict.items():
        try:
            summary_json = json.loads(json.dumps(data, cls=JSONSetEncoder))
            apps_to_update[app_id] = summary_json
        except Exception as e:
            print(f"Error encoding summary data for {app_id}: {str(e)}")
            continue

    # update all apps in a single transaction
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
    except Exception as e:
        sqldb.session.rollback()
        print(f"Error updating apps: {str(e)}")

    eol_rebase, eol_message = parse_eol_data(metadata)

    try:
        for app_id, old_id_list in eol_rebase.items():
            for old_id_and_branch in old_id_list:
                if ":" in old_id_and_branch:
                    old_id, old_branch = old_id_and_branch.split(":", 1)
                else:
                    old_id, old_branch = old_id_and_branch, None

                if old_branch:
                    models.App.set_eol_data(sqldb, old_id, True, old_branch)
                else:
                    models.App.set_eol_data(sqldb, old_id, True)
    except Exception as e:
        sqldb.session.rollback()
        print(f"Error updating eol values of apps: {str(e)}")

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

    for new_app_id, old_ids in processed_rebases.items():
        models.AppEolRebase.set_rebases(sqldb, new_app_id, old_ids)

    for appid_and_branch, message in eol_message.items():
        if ":" in appid_and_branch:
            app_id = appid_and_branch.split(":", 1)[0]
        else:
            app_id = appid_and_branch

        models.App.set_eol_message(sqldb, app_id, message)

    reverse_lookup = {}
    for ref in metadata["xa.cache"]:
        app_id = ref.split("/")[1]

        ini = metadata["xa.cache"][ref][2]
        key_file = GLib.KeyFile.new()
        try:
            key_file.load_from_data(ini, len(ini), GLib.KeyFileFlags.NONE)

            if "Build" in key_file.get_groups()[0]:
                try:
                    built_extensions = key_file.get_value("Build", "built-extensions")
                    for ext in filter(len, built_extensions.split(";")):
                        reverse_lookup[ext] = app_id
                except GLib.Error:
                    pass
        except GLib.Error:
            pass

    models.AppExtensionLookup.set_all_mappings(sqldb, reverse_lookup)
