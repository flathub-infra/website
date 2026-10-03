import importlib
import json
import os
import sys
from types import SimpleNamespace

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

moderation = importlib.import_module("app.moderation.review")
ModerationOriginKind = importlib.import_module("app.types").ModerationOriginKind


@pytest.mark.parametrize(
    ("current_extra_data", "build_extra_data", "expected"),
    [
        (None, {"uri": "https://example.com/app.bin"}, (False, True)),
        ({"uri": "https://example.com/app.bin"}, None, (True, False)),
    ],
)
def test_extra_data_addition_and_removal_preserve_boolean_values(
    current_extra_data, build_extra_data, expected
):
    assert (
        moderation._extra_data_moderation_values(current_extra_data, build_extra_data)
        == expected
    )


@pytest.mark.parametrize(
    ("current_extra_data", "build_extra_data"),
    [
        (
            {"uri": "https://example.com/app.bin"},
            {"uri": "https://example.com/app.bin"},
        ),
        (
            {"uri": "https://example.com/old.bin"},
            {"uri": "https://example.com/new.bin"},
        ),
        (
            {"uri": "https://example.com/app.bin?version=1"},
            {"uri": "https://example.com/app.bin?version=2"},
        ),
        (
            {"uri": "https://example.com/app.bin#old"},
            {"uri": "https://example.com/app.bin#new"},
        ),
        (
            {
                "uri": "https://example.com/app.bin",
                "checksum": "old",
                "size": "1",
                "filename": "old.bin",
                "version": "1",
            },
            {
                "uri": "https://example.com/app.bin",
                "checksum": "new",
                "size": "2",
                "filename": "new.bin",
                "version": "2",
            },
        ),
        (
            {"uri": "https://EXAMPLE.com/app.bin"},
            {"uri": "https://example.COM/app.bin"},
        ),
        (
            {"uri": "https://example.com/app.bin"},
            {"uri": "https://example.com:443/app.bin"},
        ),
        (
            {"uri": "https://example.com:443/app.bin"},
            {"uri": "https://example.com/app.bin"},
        ),
        (
            {"uri": "http://example.com/app.bin"},
            {"uri": "http://example.com:80/app.bin"},
        ),
        (
            {
                "uri1": "https://a.example/old.bin",
                "uri2": "https://b.example/one.bin",
            },
            {
                "uriA": "https://b.example/two.bin",
                "uriB": "https://a.example/new.bin",
                "uriC": "https://a.example/duplicate.bin",
            },
        ),
    ],
)
def test_unchanged_extra_data_origins_do_not_require_moderation(
    current_extra_data, build_extra_data
):
    assert (
        moderation._extra_data_moderation_values(current_extra_data, build_extra_data)
        is None
    )


@pytest.mark.parametrize(
    ("current_extra_data", "build_extra_data", "expected"),
    [
        (
            {"uri": "https://downloads.example/app.bin"},
            {"uri": "https://cdn.example/app.bin"},
            (["https://downloads.example"], ["https://cdn.example"]),
        ),
        (
            {"uri": "https://example.com/app.bin"},
            {"uri": "https://sub.example.com/app.bin"},
            (["https://example.com"], ["https://sub.example.com"]),
        ),
        (
            {"uri": "https://example.com/app.bin"},
            {"uri": "http://example.com/app.bin"},
            (["https://example.com"], ["http://example.com"]),
        ),
        (
            {"uri": "https://example.com:8443/app.bin"},
            {"uri": "https://example.com:9443/app.bin"},
            (["https://example.com:8443"], ["https://example.com:9443"]),
        ),
        (
            {
                "uri1": "https://a.example/app.bin",
                "uri2": "https://b.example/app.bin",
            },
            {
                "uri1": "https://a.example/app.bin",
                "uri2": "https://c.example/app.bin",
            },
            (
                ["https://a.example", "https://b.example"],
                ["https://a.example", "https://c.example"],
            ),
        ),
        (
            {"uri": "https://a.example/app.bin"},
            {
                "uri1": "https://a.example/app.bin",
                "uri2": "https://b.example/app.bin",
            },
            (
                ["https://a.example"],
                ["https://a.example", "https://b.example"],
            ),
        ),
        (
            {
                "uri1": "https://a.example/app.bin",
                "uri2": "https://b.example/app.bin",
            },
            {"uri": "https://a.example/app.bin"},
            (
                ["https://a.example", "https://b.example"],
                ["https://a.example"],
            ),
        ),
    ],
)
def test_changed_extra_data_origins_require_moderation(
    current_extra_data, build_extra_data, expected
):
    assert (
        moderation._extra_data_moderation_values(current_extra_data, build_extra_data)
        == expected
    )


@pytest.mark.parametrize(
    ("current_extra_data", "build_extra_data", "expected"),
    [
        (
            {"uri": "https://example.com/app.bin"},
            {"uri": "not a URL"},
            (
                ["https://example.com"],
                ["<invalid or missing new extra-data URL>"],
            ),
        ),
        (
            {"uri": "relative/app.bin"},
            {"uri": "https://example.com/app.bin"},
            (
                ["<invalid or missing current extra-data URL>"],
                ["https://example.com"],
            ),
        ),
        (
            {"checksum": "old", "size": "1"},
            {"uri": "https://example.com/app.bin"},
            (
                ["<invalid or missing current extra-data URL>"],
                ["https://example.com"],
            ),
        ),
        (
            {"uri": "not a URL"},
            {"uri": "also not a URL"},
            (
                ["<invalid or missing current extra-data URL>"],
                ["<invalid or missing new extra-data URL>"],
            ),
        ),
    ],
)
def test_invalid_or_missing_extra_data_urls_require_moderation(
    current_extra_data, build_extra_data, expected
):
    assert (
        moderation._extra_data_moderation_values(current_extra_data, build_extra_data)
        == expected
    )


@pytest.mark.parametrize(
    "url",
    [
        "",
        "not a URL",
        "relative/app.bin",
        "https://exa mple.com/app.bin",
        "https://example.com\\app.bin",
        "https://example.com:/app.bin",
        "https://example.com:70000/app.bin",
        "ftp://example.com/app.bin",
    ],
)
def test_invalid_extra_data_urls_have_no_origin(url):
    assert moderation._extra_data_origins({"uri": url}) is None


def test_ipv6_origin_is_serialized_with_brackets():
    assert moderation._extra_data_origins(
        {"uri": "https://[2001:db8::1]:8443/app.bin"}
    ) == ["https://[2001:db8::1]:8443"]


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "https://user:password@Example.COM/download",
            ["https://example.com"],
        ),
        ("http://192.0.2.1:80/download", ["http://192.0.2.1"]),
        ("https://[2001:db8::1]:443/download", ["https://[2001:db8::1]"]),
        ("https://example.com:8443/download", ["https://example.com:8443"]),
    ],
)
def test_extra_data_url_origins_preserve_supported_parser_behavior(url, expected):
    assert moderation._extra_data_origins({"uri": url}) == expected


def test_non_string_extra_data_url_has_no_origin():
    assert moderation._extra_data_origins({"uri": 42}) is None


@pytest.mark.parametrize(
    ("current_extra_data", "build_extra_data", "allowlisted", "expected"),
    [
        (
            {"uri": "https://a.example/app.bin"},
            {"uri": "https://a.example/app.bin", "uri2": "https://b.example/x"},
            {"https://b.example"},
            None,
        ),
        (
            {"uri": "https://a.example/app.bin"},
            {
                "uri": "https://a.example/app.bin",
                "uri2": "https://b.example/x",
                "uri3": "https://c.example/x",
            },
            {"https://b.example"},
            (
                ["https://a.example"],
                ["https://a.example", "https://b.example", "https://c.example"],
            ),
        ),
        (
            {"uri": "https://a.example/app.bin"},
            {"uri": "https://b.example/app.bin"},
            {"https://b.example"},
            (["https://a.example"], ["https://b.example"]),
        ),
        (
            None,
            {"uri": "https://b.example/app.bin"},
            {"https://b.example"},
            (False, True),
        ),
        (
            {"uri": "not a URL"},
            {"uri": "https://b.example/app.bin"},
            {"https://b.example"},
            (
                ["<invalid or missing current extra-data URL>"],
                ["https://b.example"],
            ),
        ),
    ],
)
def test_allowlisted_extra_data_origins(
    current_extra_data, build_extra_data, allowlisted, expected
):
    assert (
        moderation._extra_data_moderation_values(
            current_extra_data, build_extra_data, allowlisted
        )
        == expected
    )


@pytest.mark.parametrize(
    ("request_type", "request_data", "expected"),
    [
        (
            "manifest",
            json.dumps(
                {
                    "findings": [
                        {
                            "origins_added": ["https://a.example"],
                            "origins_removed": ["https://old.example"],
                            "locations_by_origin": {},
                            "arches": ["x86_64"],
                        },
                        {
                            "origins_added": ["https://github.com/owner/repo"],
                            "origins_removed": [],
                            "locations_by_origin": {},
                            "arches": ["aarch64"],
                        },
                    ]
                }
            ),
            {
                (ModerationOriginKind.MANIFEST_SOURCE, "https://a.example"),
                (
                    ModerationOriginKind.MANIFEST_SOURCE,
                    "https://github.com/owner/repo",
                ),
            },
        ),
        (
            "manifest",
            json.dumps({"findings": [], "complexity": {"score_units": 20}}),
            set(),
        ),
        (
            "summary",
            json.dumps(
                {
                    "keys": {"extra-data": ["https://a.example", "https://b.example"]},
                    "current_values": {"extra-data": ["https://a.example"]},
                }
            ),
            {(ModerationOriginKind.EXTRA_DATA, "https://b.example")},
        ),
        (
            "summary",
            json.dumps(
                {
                    "keys": {"extra-data": ["https://b.example"]},
                    "current_values": {
                        "extra-data": ["<invalid or missing current extra-data URL>"]
                    },
                }
            ),
            {(ModerationOriginKind.EXTRA_DATA, "https://b.example")},
        ),
        (
            "summary",
            json.dumps(
                {
                    "keys": {"extra-data": ["<invalid or missing new extra-data URL>"]},
                    "current_values": {"extra-data": ["https://a.example"]},
                }
            ),
            set(),
        ),
        (
            "summary",
            json.dumps(
                {
                    "keys": {"extra-data": True},
                    "current_values": {"extra-data": False},
                }
            ),
            set(),
        ),
        (
            "appdata",
            json.dumps({"keys": {"name": "App"}, "current_values": {}}),
            set(),
        ),
        ("manifest", "not json", set()),
        ("summary", None, set()),
    ],
)
def test_approved_request_origins(request_type, request_data, expected):
    assert moderation._approved_request_origins(request_type, request_data) == expected
