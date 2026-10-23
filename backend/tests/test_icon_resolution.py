import os
import sys
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)
sys.modules["app.search"] = SimpleNamespace()

from app import (
    models,  # noqa: F401
    utils,
)


def test_find_biggest_icon_uses_effective_resolution():
    icons = [
        {"height": "512", "width": "512", "scale": "1x", "url": "/512.png"},
        {"height": "384", "width": "384", "scale": "2x", "url": "/768.png"},
    ]

    assert utils.find_biggest_icon(icons) == "/768.png"


def test_find_biggest_icon_handles_missing_or_invalid_dimensions():
    icons = [
        {"height": "invalid", "scale": "invalid", "url": "/unknown.png"},
        {"height": "600", "width": "600", "scale": "1x", "url": "/600.png"},
        {"height": "1000", "width": "100", "scale": "1x", "url": "/narrow.png"},
    ]

    assert utils.find_biggest_icon(icons) == "/600.png"
    assert utils.find_biggest_icon([]) is None
