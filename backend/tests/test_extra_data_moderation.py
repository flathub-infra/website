import importlib
import os
import sys
from types import SimpleNamespace

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

moderation = importlib.import_module("app.moderation")



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
        moderation._extra_data_moderation_values(
            current_extra_data, build_extra_data
        )
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
        moderation._extra_data_moderation_values(
            current_extra_data, build_extra_data
        )
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
        moderation._extra_data_moderation_values(
            current_extra_data, build_extra_data
        )
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
        moderation._extra_data_moderation_values(
            current_extra_data, build_extra_data
        )
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
