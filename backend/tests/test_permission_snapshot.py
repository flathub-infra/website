import pytest

from app.moderation.permission_snapshot import (
    CANONICALIZATION_VERSION,
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
    return PermissionSnapshot(CANONICALIZATION_VERSION, arches)


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
            "enumerable": ["!vnd:1234", "all"],
            "hidden": ["vnd:1234+prd:abcd"],
        },
        "Policy new-subsystem": {"future": ["one", "two"]},
    }
    reordered = FULL_DATA.replace(
        b"sockets=!x11;x11;if:x11:!has-wayland;\nfilesystems=home:ro;xdg-data/foo:create;home:ro;",
        b"filesystems=home:ro;xdg-data/foo:create;home:ro;\nsockets=!x11;x11;if:x11:!has-wayland;",
    )
    assert fingerprint_snapshot(snapshot(x86_64=parse(reordered))) == (
        fingerprint_snapshot(snapshot(x86_64=permissions))
    )
    assert parse(APP) == {}


def test_usb_list_order_is_canonicalized():
    first = (
        APP
        + b"[USB Devices]\nenumerable=all;!vnd:1234;all;\n"
        + b"hidden=vnd:1234+prd:abcd;vnd:5678;vnd:5678;\n"
    )
    second = (
        APP
        + b"[USB Devices]\nenumerable=all;all;!vnd:1234;\n"
        + b"hidden=vnd:5678;vnd:1234+prd:abcd;vnd:5678;\n"
    )
    before = parse(first)
    after = parse(second)
    assert before["USB Devices"] == {
        "enumerable": ["!vnd:1234", "all", "all"],
        "hidden": ["vnd:1234+prd:abcd", "vnd:5678", "vnd:5678"],
    }
    assert before == after
    before_snapshot = snapshot(x86_64=before)
    after_snapshot = snapshot(x86_64=after)
    assert compare_snapshots(before_snapshot, after_snapshot) == ()
    assert fingerprint_snapshot(before_snapshot) == fingerprint_snapshot(after_snapshot)


def test_context_socket_order_is_preserved():
    before = parse(APP + b"[Context]\nsockets=x11;!x11;\n")
    after = parse(APP + b"[Context]\nsockets=!x11;x11;\n")
    before_snapshot = snapshot(x86_64=before)
    after_snapshot = snapshot(x86_64=after)
    differences = compare_snapshots(before_snapshot, after_snapshot)
    assert [difference.path for difference in differences] == [
        ("x86_64", "Context", "sockets")
    ]
    assert fingerprint_snapshot(before_snapshot) != fingerprint_snapshot(after_snapshot)


def test_independent_context_entries_are_sorted():
    before = parse(
        APP
        + b"[Context]\nshared=network;ipc;\nsockets=x11;wayland;fallback-x11;\n"
        + b"devices=dri;!kvm;\nfeatures=devel;bluetooth;\n"
        + b"filesystems=xdg-pictures:ro;home;!xdg-music;\npersistent=.foo;.bar;\n"
    )
    after = parse(
        APP
        + b"[Context]\nshared=ipc;network;\nsockets=fallback-x11;wayland;x11;\n"
        + b"devices=!kvm;dri;\nfeatures=bluetooth;devel;\n"
        + b"filesystems=!xdg-music;home;xdg-pictures:ro;\npersistent=.bar;.foo;\n"
    )
    assert before["Context"] == {
        "shared": ["ipc", "network"],
        "sockets": ["fallback-x11", "wayland", "x11"],
        "devices": ["!kvm", "dri"],
        "features": ["bluetooth", "devel"],
        "filesystems": ["!xdg-music", "home", "xdg-pictures:ro"],
        "persistent": [".bar", ".foo"],
    }
    assert before == after
    assert fingerprint_snapshot(snapshot(x86_64=before)) == fingerprint_snapshot(
        snapshot(x86_64=after)
    )


@pytest.mark.parametrize(
    "key,first,second",
    [
        (
            "sockets",
            "x11;wayland;if:x11:!has-wayland;",
            "if:x11:!has-wayland;wayland;x11;",
        ),
        ("filesystems", "home;xdg-music:ro;home:ro;", "home:ro;xdg-music:ro;home;"),
        ("filesystems", "home;!host:reset;", "!host:reset;home;"),
        ("filesystems", "home;host-reset;", "host-reset;home;"),
    ],
)
def test_order_dependent_context_entries_are_preserved(key, first, second):
    before = parse(APP + f"[Context]\n{key}={first}\n".encode())
    after = parse(APP + f"[Context]\n{key}={second}\n".encode())
    assert before["Context"][key] == first.rstrip(";").split(";")
    assert compare_snapshots(snapshot(x86_64=before), snapshot(x86_64=after))


def test_dconf_migration_metadata_is_not_a_permission():
    base = APP + b"[Context]\nfilesystems=home:ro;\n"
    migration = b"[X-DConf]\nmigrate-path=/org/example/App/\n"
    without = parse(base)
    assert parse(base + migration) == without
    assert fingerprint_snapshot(snapshot(x86_64=parse(base + migration))) == (
        fingerprint_snapshot(snapshot(x86_64=without))
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
    assert fingerprint_snapshot(snapshot(x86_64={})) != fingerprint_snapshot(
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
    [
        (1, {"x86_64": {}}, "unsupported_version"),
        (2, {"x86_64": {}}, "unsupported_version"),
        (4, {"x86_64": {}}, "unsupported_version"),
        (True, {"x86_64": {}}, "unsupported_version"),
        (3.0, {"x86_64": {}}, "unsupported_version"),
        (CANONICALIZATION_VERSION, {}, "missing_architecture"),
    ],
)
def test_rejects_invalid_snapshot(version, arches, code):
    value = PermissionSnapshot(version, arches)
    with pytest.raises(PermissionSnapshotError) as error:
        fingerprint_snapshot(value)
    assert error.value.code == code
    with pytest.raises(PermissionSnapshotError, match=error.value.message):
        compare_snapshots(value, snapshot(x86_64={}))
