from types import MappingProxyType

import orjson
import pytest

from app.types import is_json_object, is_json_value


@pytest.mark.parametrize(
    "value",
    [
        b"bytes",
        bytearray(b"bytes"),
        memoryview(b"bytes"),
        range(3),
        (1, 2),
        MappingProxyType({"name": "Example"}),
        {"x86_64"},
    ],
)
def test_non_json_containers_are_rejected(value):
    assert not is_json_value(value)
    assert not is_json_object({"nested": value})


def test_nested_json_survives_serialization():
    value = {
        "name": "Example",
        "enabled": True,
        "count": 3,
        "score": 1.5,
        "items": [{"optional": None}, "text", 4],
    }
    assert is_json_object(value)
    assert orjson.loads(orjson.dumps(value)) == value


def test_non_string_object_keys_are_rejected():
    assert not is_json_object({1: "value"})
