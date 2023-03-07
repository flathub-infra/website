import configparser
import json
import struct
import subprocess
from collections import defaultdict

import gi
from gi.repository import Gio, GLib, OSTree

from . import config, db, search, utils

gi.require_version("OSTree", "1.0")


# "valid" here means it would be displayed on flathub.org
def validate_ref(ref: str):
    if not ref.startswith("app/"):
        return False

    fields = ref.split("/")
    if len(fields) != 4:
        return False

    kind, appid, arch, branch = fields

    if arch not in ("x86_64", "aarch64"):
        return False

    if branch != "stable":
        return False

    return True


def get_parent_id(appid: str):
    if reverse_lookup := db.get_json_key("summary:reverse_lookup"):
        if parent := reverse_lookup.get(appid):
            return parent

    return None


def parse_metadata(ini: str):
    parser = configparser.RawConfigParser()
    parser.read_string(ini)

    metadata = dict(parser["Application"])

    if "tags" in metadata:
        tags = [x for x in metadata["tags"].split(";") if x]
        metadata["tags"] = tags

    permissions = {}

    if "Context" in parser:
        for key in parser["Context"]:
            permissions[key] = [x for x in parser["Context"][key].split(";") if x]
        parser.remove_section("Context")

    if "Session Bus Policy" in parser:
        bus_metadata = parser["Session Bus Policy"]
        bus = defaultdict(list)

        for busname in bus_metadata:
            bus_permission = bus_metadata[busname]
            bus[bus_permission].append(busname)

        permissions["session-bus"] = bus

    if "System Bus Policy" in parser:
        bus_metadata = parser["System Bus Policy"]
        bus = defaultdict(list)

        for busname in bus_metadata:
            bus_permission = bus_metadata[busname]
            bus[bus_permission].append(busname)

        permissions["system-bus"] = bus

    metadata["permissions"] = permissions

    extensions = {}
    for section in parser:
        if section.startswith("Extension "):
            extname = section[10:]
            extensions[extname] = dict(parser[section])

    if extensions:
        metadata["extensions"] = extensions

    if "Build" in parser:
        metadata["built-extensions"] = [
            x for x in parser.get("Build", "built-extensions").split(";") if x
        ]

    if "Extra Data" in parser:
        metadata["extra-data"] = dict(parser["Extra Data"])

    return metadata


def update():
    summary_dict = defaultdict(lambda: {"arches": []})
    recently_updated_zset = {}
    current_apps = {app[5:] for app in db.redis_conn.smembers("apps:index")}

    repo_file = Gio.File.new_for_path(f"{config.settings.flatpak_user_dir}/repo")
    repo = OSTree.Repo.new(repo_file)
    repo.open(None)

    status, summary, signatures = repo.remote_fetch_summary("flathub", None)
    data = GLib.Variant.new_from_bytes(
        GLib.VariantType.new(OSTree.SUMMARY_GVARIANT_STRING), summary, True
    )

    refs, metadata = data.unpack()
    xa_cache = metadata["xa.cache"]

    for ref, (_, _, info) in refs:
        if not validate_ref(ref):
            continue

        appid = ref.split("/")[1]

        timestamp_be_uint = struct.pack("<Q", info["ostree.commit.timestamp"])
        timestamp = struct.unpack(">Q", timestamp_be_uint)[0]

        recently_updated_zset[appid] = timestamp
        summary_dict[appid]["timestamp"] = timestamp

    for ref in xa_cache:
        if not validate_ref(ref):
            continue

        appid = ref.split("/")[1]

        download_size_be_uint = struct.pack("<Q", xa_cache[ref][1])
        download_size = struct.unpack(">Q", download_size_be_uint)[0]

        installed_size_be_uint = struct.pack("<Q", xa_cache[ref][0])
        installed_size = struct.unpack(">Q", installed_size_be_uint)[0]

        summary_dict[appid]["download_size"] = download_size
        summary_dict[appid]["installed_size"] = installed_size
        summary_dict[appid]["metadata"] = parse_metadata(xa_cache[ref][2])

        # flatpak cannot know how much application will weight after
        # apply_extra is executed, so let's estimate it by combining installed
        # and download sizes
        if "extra-data" in summary_dict[appid]["metadata"]:
            summary_dict[appid]["installed_size"] += download_size

    # The main summary file contains only x86_64 refs due to ostree file size
    # limitations. Since 2020, aarch64 is the only additional arch supported,
    # so we need to enrich the data by parsing the output of "flatpak
    # remote-ls", as ostree itself does not expose "sub-sumarries".
    command = [
        "flatpak",
        "remote-ls",
        "--user",
        "--arch=*",
        "--columns=ref",
        "flathub",
    ]
    remote_refs_ret = subprocess.run(command, capture_output=True, text=True)
    if remote_refs_ret.returncode == 0:
        for ref in remote_refs_ret.stdout.splitlines():
            if not validate_ref(ref):
                continue

            appid = ref.split("/")[1]
            arch = ref.split("/")[2]

            summary_dict[appid]["arches"].append(arch)

    if recently_updated_zset:
        db.redis_conn.zadd("recently_updated_zset", recently_updated_zset)
        updated: list = []

        for appid in recently_updated_zset:
            if appid not in current_apps:
                continue

            updated.append(
                {
                    "id": utils.get_clean_app_id(appid),
                    "updated_at": recently_updated_zset[appid],
                }
            )

        search.update_apps(updated)

    db.redis_conn.mset(
        {f"summary:{appid}": json.dumps(summary_dict[appid]) for appid in summary_dict}
    )

    eol_rebase = {}
    for app, eol_dict in metadata["xa.sparse-cache"].items():
        appid = app.split("/")[1]
        if (
            "eolr" in eol_dict
            and not appid.endswith(".Debug")
            and not appid.endswith(".Locale")
            and not appid.endswith(".Sources")
        ):
            new_id = eol_dict["eolr"].split("/")[1]
            if new_id in eol_rebase:
                eol_rebase[new_id].append(appid)
            else:
                eol_rebase[new_id] = [appid]

    # Support changing of App ID multiple times
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

    db.redis_conn.mset({"eol_rebase": json.dumps(eol_rebase)})

    for appid, old_id_list in eol_rebase.items():
        for old_id in old_id_list:
            db.redis_conn.mset({f"eol_rebase:{old_id}": json.dumps(appid)})

    # Build reverse lookup map for flathub-hooks
    reverse_lookup = {}
    for ref in xa_cache:
        appid = ref.split("/")[1]
        reverse_lookup[appid] = appid

        ini = xa_cache[ref][2]
        parser = configparser.RawConfigParser(strict=False)
        parser.read_string(ini)

        if "Build" in parser:
            build = parser["Build"]
            if "built-extensions" in build:
                built_ext = build["built-extensions"].split(";")
                for ext in built_ext:
                    reverse_lookup[ext] = appid

    db.redis_conn.set("summary:reverse_lookup", json.dumps(reverse_lookup))

    return len(recently_updated_zset)
