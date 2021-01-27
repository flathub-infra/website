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

        appid = ref.split('/')[1]

        timestamp_be_uint = struct.pack("<Q", info["ostree.commit.timestamp"])
        timestamp = struct.unpack(">Q", timestamp_be_uint)[0]

        recently_updated_zset[appid] = timestamp
        summary_dict[appid]["timestamp"] = timestamp

    for ref in xa_cache.keys():
        if not validate_ref(ref):
            continue

        appid = ref.split('/')[1]

        download_size_be_uint = struct.pack("<Q", xa_cache[ref][0])
        download_size = struct.unpack(">Q", download_size_be_uint)[0]

        installed_size_be_uint = struct.pack("<Q", xa_cache[ref][1])
        installed_size = struct.unpack(">Q", installed_size_be_uint)[0]

        summary_dict[appid]["download_size"] = download_size
        summary_dict[appid]["installed_size"] = installed_size

        ref_metadata = configparser.ConfigParser()
        ref_metadata.read_string(xa_cache[ref][2])
        summary_dict[appid]["metadata"] = ref_metadata._sections

    for ref in xa_cache.keys():
        if not validate_ref(ref, enforce_arch=False):
            continue

        appid = ref.split('/')[1]
        arch = ref.split('/')[2]

        summary_dict[appid]["arches"].append(arch)

    db.redis_conn.zadd("recently_updated_zset", recently_updated_zset)
    db.redis_conn.mset(
        {
            f"summary:{appid}": json.dumps(summary_dict[appid])
            for appid in summary_dict
        }
    )

    return len(recently_updated_zset)
