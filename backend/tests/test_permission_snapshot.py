import hashlib
import json

import pytest

from app.moderation.permission_snapshot import (
    PermissionSnapshot,
    PermissionSnapshotError,
    compare_snapshots,
    fingerprint_snapshot,
    parse_permission_metadata,
)

APP = b"[Application]\nname=org.example.App\n"


def parse(data: bytes):
    return parse_permission_metadata(data, app_id="org.example.App")


def snapshot(**arches):
    return PermissionSnapshot(1, arches)


def fingerprints(snapshot_):
    return fingerprint_snapshot(snapshot_)


FULL_DATA = (
    APP
    + (
        "required-flatpak=1.14;1.16;\n"
        "[Context]\n"
        "sockets=!x11;x11;if:x11:!has-wayland;\n"
        "filesystems=home:ro;xdg-data/foo:create;home:ro;\n"
        "future=one\\;two;é;\n"
        "[Session Bus Policy]\norg.example.Bus=none\n"
        "[System Bus Policy]\norg.example.Bus=talk\n"
        "[USB Devices]\nenumerable=all;!vnd:1234;\nhidden=vnd:1234+prd:abcd;\n"
        "[Policy new-subsystem]\nfuture=one;two;\n"
        "[Environment]\nFOO=bar\n[Extension named]\ndirectory=ext\n"
    ).encode()
)


def test_complete_metadata_and_canonical_fingerprint():
    permissions = parse(FULL_DATA)
    assert permissions == {
        "Application": {"required-flatpak": ["1.14", "1.16"]},
        "Context": {
            "sockets": ["!x11", "x11", "if:x11:!has-wayland"],
            "filesystems": ["home:ro", "xdg-data/foo:create", "home:ro"],
            "future": ["one;two", "é"],
        },
        "Session Bus Policy": {"org.example.Bus": "none"},
        "System Bus Policy": {"org.example.Bus": "talk"},
        "USB Devices": {
            "enumerable": ["all", "!vnd:1234"],
            "hidden": ["vnd:1234+prd:abcd"],
        },
        "Policy new-subsystem": {"future": ["one", "two"]},
    }
    envelope = {"canonicalization_version": 1, "architectures": {"x86_64": permissions}}
    assert (
        fingerprints(snapshot(x86_64=permissions))
        == hashlib.sha256(
            json.dumps(
                envelope, ensure_ascii=True, sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
    )
    reordered = FULL_DATA.replace(
        b"sockets=!x11;x11;if:x11:!has-wayland;\nfilesystems=home:ro;xdg-data/foo:create;home:ro;",
        b"filesystems=home:ro;xdg-data/foo:create;home:ro;\nsockets=!x11;x11;if:x11:!has-wayland;",
    )
    assert fingerprints(snapshot(x86_64=parse(reordered))) == fingerprints(
        snapshot(x86_64=permissions)
    )
    assert parse(APP) == {}
    assert parse(APP + b"[Context]\nsockets=\n") == {"Context": {"sockets": []}}


def test_dconf_migration_metadata_is_not_a_permission():
    base = APP + b"[Context]\nfilesystems=home:ro;\n"
    migration = b"[X-DConf]\nmigrate-path=/org/example/App/\n"
    without = parse(base)
    assert parse(base + migration) == without
    assert fingerprints(snapshot(x86_64=parse(base + migration))) == fingerprints(
        snapshot(x86_64=without)
    )
    assert parse(APP + migration) == {}


def test_full_tree_comparison():
    before = snapshot(
        x86_64={
            "Context": {"filesystems": ["home"]},
            "Session Bus Policy": {"bus": "none"},
        },
        aarch64={"Context": {"sockets": ["x11"]}},
    )
    after = snapshot(
        x86_64={
            "Context": {"filesystems": ["home:ro"]},
            "USB Devices": {"enumerable": []},
        },
        riscv64={},
    )
    assert [(d.path, d.before, d.after) for d in compare_snapshots(before, after)] == [
        (("aarch64",), {"Context": {"sockets": ["x11"]}}, None),
        (("riscv64",), None, {}),
        (("x86_64", "Context", "filesystems"), ["home"], ["home:ro"]),
        (("x86_64", "Session Bus Policy"), {"bus": "none"}, None),
        (("x86_64", "USB Devices"), None, {"enumerable": []}),
    ]
    assert compare_snapshots(
        snapshot(x86_64={}), snapshot(x86_64={"Context": {"sockets": []}})
    )[0].after == {"sockets": []}
    assert fingerprints(snapshot(x86_64={})) != fingerprints(
        snapshot(x86_64={"Context": {"sockets": []}})
    )
    assert compare_snapshots(
        snapshot(x86_64={"Context": {"sockets": ["x11", "!x11"]}}),
        snapshot(x86_64={"Context": {"sockets": ["!x11", "x11"]}}),
    )


@pytest.mark.parametrize(
    "data,code",
    [
        (b"", "invalid_metadata"),
        (APP + b"[Context]\nfilesystems=\xff\n", "invalid_metadata"),
        (b"[Context]\nsockets=x11;\n" + APP, "invalid_metadata"),
        (APP.replace(b"org.example.App", b"org.other.App"), "identity_mismatch"),
        (APP + b"[Runtime]\nfoo=bar\n", "unsupported_metadata"),
        (APP + b"[Context]\nsockets=bad\\q;\n", "invalid_metadata"),
    ],
)
def test_rejects_invalid_metadata(data, code):
    with pytest.raises(PermissionSnapshotError) as error:
        parse(data)
    assert error.value.code == code


@pytest.mark.parametrize(
    "version,arches,code",
    [(2, {"x86_64": {}}, "unsupported_version"), (1, {}, "missing_architecture")],
)
def test_rejects_invalid_snapshot(version, arches, code):
    value = PermissionSnapshot(version, arches)
    with pytest.raises(PermissionSnapshotError) as error:
        fingerprint_snapshot(value)
    assert error.value.code == code
    with pytest.raises(PermissionSnapshotError, match=error.value.message):
        compare_snapshots(value, snapshot(x86_64={}))
