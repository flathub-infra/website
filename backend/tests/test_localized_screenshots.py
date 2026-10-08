import gzip
import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

sys.modules["app.search"] = SimpleNamespace()

from app import models, utils


def test_appstream_parser_keeps_localized_screenshot_images(monkeypatch):
    appstream = b"""<?xml version="1.0" encoding="UTF-8"?>
    <components>
      <component type="desktop-application">
        <id>org.example.App</id>
        <name>Example</name>
        <summary>Example application</summary>
        <screenshots>
          <screenshot type="default">
            <image type="source" width="1280" height="720">https://example.org/en.png</image>
            <image type="source" width="1280" height="720" xml:lang="de">https://example.org/de.png</image>
          </screenshot>
        </screenshots>
        <bundle type="flatpak">app/org.example.App/x86_64/stable</bundle>
      </component>
    </components>"""

    class Response:
        def read(self):
            return gzip.compress(appstream)

    @contextmanager
    def stream(*args, **kwargs):
        yield Response()

    monkeypatch.setattr(utils.config.settings, "appstream_repos", None)
    monkeypatch.setattr(utils.http_client, "stream", stream)

    parsed = utils.appstream2dict("https://example.org/appstream.xml.gz")

    assert parsed["org.example.App"]["screenshots"][0]["sizes"] == [
        {
            "width": "1280",
            "height": "720",
            "scale": "1x",
            "src": "https://example.org/en.png",
        },
        {
            "width": "1280",
            "height": "720",
            "scale": "1x",
            "src": "https://example.org/de.png",
            "lang": "de",
        },
    ]


def test_appstream_parser_preserves_requirement_kinds_and_comparisons(monkeypatch):
    appstream = b"""<?xml version="1.0" encoding="UTF-8"?>
    <components>
      <component type="desktop-application">
        <id>org.example.App</id>
        <name>Example</name>
        <summary>Example application</summary>
        <requires>
          <memory compare="ge">6GB</memory>
          <display_length compare="ge">medium</display_length>
        </requires>
        <recommends>
          <control>gamepad</control>
        </recommends>
        <supports>
          <control>keyboard</control>
        </supports>
        <bundle type="flatpak">app/org.example.App/x86_64/stable</bundle>
      </component>
    </components>"""

    class Response:
        def read(self):
            return gzip.compress(appstream)

    @contextmanager
    def stream(*args, **kwargs):
        yield Response()

    monkeypatch.setattr(utils.config.settings, "appstream_repos", None)
    monkeypatch.setattr(utils.http_client, "stream", stream)

    app = utils.appstream2dict("https://example.org/appstream.xml.gz")[
        "org.example.App"
    ]

    assert app["requires"] == [
        {"type": "memory", "value": "6GB", "compare": "ge"},
        {"type": "display_length", "value": "medium", "compare": "ge"},
    ]
    assert app["recommends"] == [{"type": "control", "value": "gamepad"}]
    assert app["supports"] == [{"type": "control", "value": "keyboard"}]


def test_translated_appstream_selects_best_screenshot_locale():
    app = models.App(
        appstream={
            "screenshots": [
                {
                    "caption": "Home",
                    "sizes": [
                        {"width": "1280", "height": "720", "src": "/en.png"},
                        {
                            "width": "1280",
                            "height": "720",
                            "src": "/de.png",
                            "lang": "de",
                        },
                    ],
                }
            ]
        },
        localization={"de": {"screenshots_caption_0": "Startseite"}},
    )

    localized = app.get_translated_appstream("de-AT")
    fallback = app.get_translated_appstream("fr")

    assert localized["screenshots"][0]["sizes"][0]["src"] == "/de.png"
    assert localized["screenshots"][0]["caption"] == "Startseite"
    assert "lang" not in localized["screenshots"][0]["sizes"][0]
    assert fallback["screenshots"][0]["sizes"][0]["src"] == "/en.png"
