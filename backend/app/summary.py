import configparser
import struct
from collections import defaultdict
import json
import gi

gi.require_version("OSTree", "1.0")

from gi.repository import OSTree, Gio, GLib

from . import db
from . import config

# "valid" here means it would be displayed on flathub.org
def validate_ref(ref: str, enforce_arch=True):
    if not ref.startswith("app/"):
        return False

    fields = ref.split("/")
    if len(fields) != 4:
        return False

    kind, appid, arch, branch = fields

    if enforce_arch and arch != "x86_64":
        return False

    if branch != "stable":
        return False

    return True


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

    for ref in xa_cache.keys():
        if not validate_ref(ref):
            continue

        appid = ref.split("/")[1]

        download_size_be_uint = struct.pack("<Q", xa_cache[ref][0])
        download_size = struct.unpack(">Q", download_size_be_uint)[0]

        installed_size_be_uint = struct.pack("<Q", xa_cache[ref][1])
        installed_size = struct.unpack(">Q", installed_size_be_uint)[0]

        summary_dict[appid]["download_size"] = download_size
        summary_dict[appid]["installed_size"] = installed_size
        summary_dict[appid]["metadata"] = parse_metadata(xa_cache[ref][2])

    for ref in xa_cache.keys():
        if not validate_ref(ref, enforce_arch=False):
            continue

        appid = ref.split("/")[1]
        arch = ref.split("/")[2]

        summary_dict[appid]["arches"].append(arch)

    db.redis_conn.zadd("recently_updated_zset", recently_updated_zset)
    db.redis_conn.mset(
        {f"summary:{appid}": json.dumps(summary_dict[appid]) for appid in summary_dict}
    )

    return len(recently_updated_zset)
