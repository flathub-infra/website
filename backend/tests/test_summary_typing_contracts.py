import os
import sys
from unittest.mock import patch

import pytest

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)


def _parse_eol_data():
    with patch("meilisearch.Client"):
        from app.summary import parse_eol_data

    return parse_eol_data


def test_parse_eol_data_extracts_rebases_and_messages():
    parse_eol_data = _parse_eol_data()
    metadata = {
        "xa.sparse-cache": {
            "app/org.old.App/x86_64/stable": {"eolr": "app/org.new.App/x86_64/stable"},
            "app/org.retired.App/aarch64/42": {"eol": "No longer supported"},
        }
    }

    rebases, messages = parse_eol_data(metadata)

    assert rebases == {"org.new.App": ["org.old.App:stable"]}
    assert messages == {"org.retired.App:42": "No longer supported"}


def test_parse_eol_data_rejects_malformed_sparse_cache():
    parse_eol_data = _parse_eol_data()
    with pytest.raises(TypeError, match="invalid xa.sparse-cache"):
        parse_eol_data({"xa.sparse-cache": ["not", "a", "mapping"]})


def test_parse_eol_data_accepts_extra_data_sizes():
    parse_eol_data = _parse_eol_data()
    # Flatpak's sparse-cache is a{sa{sv}}, not a string-only dictionary.
    from gi.repository import GLib

    metadata = GLib.Variant(
        "a{sv}",
        {
            "xa.sparse-cache": GLib.Variant(
                "a{sa{sv}}",
                {
                    "app/org.old.App/x86_64/stable": {
                        "eolr": GLib.Variant("s", "app/org.new.App/x86_64/stable"),
                        "xa.extra-data-size": GLib.Variant("(tt)", (1234, 5678)),
                    }
                },
            )
        },
    ).unpack()

    assert parse_eol_data(metadata) == ({"org.new.App": ["org.old.App:stable"]}, {})
