import base64
import ctypes
import gzip
import hashlib
import json
import os
import re
from datetime import datetime, timedelta
from typing import Any

import gi
import jwt
import requests
from lxml import etree
from pydantic import BaseModel

from . import config

gi.require_version("AppStream", "1.0")
from gi.repository import AppStream

clean_id_re = re.compile("[^a-zA-Z0-9_-]+")
remove_desktop_re = re.compile(r"\.desktop$")

MAXUINT = ctypes.c_uint(-1).value


class Hasher:
    """
    Wrapper around the hashlib library to provide an ergonomic API
    for hashing a combination of data types
    """

    def __init__(self):
        self.hasher = hashlib.sha256()

    def add_bytes(self, bytes: bytes):
        self.hasher.update(bytes)

    def add_string(self, string: str):
        self.add_bytes(string.encode("utf-8"))

    def add_number(self, num: int):
        self.add_string(f"{num}")

    def hash(self):
        return self.hasher.hexdigest()


def add_translation(apps_locale: dict, language: str, appid: str, key: str, value: str):
    # normalize multi part languages, as the frontend
    #  always asks for the ones with a dash
    language = language.replace("_", "-")
    if language not in apps_locale:
        apps_locale[language] = {}
    apps_locale[language][key] = value


def appstream2dict(appstream_url=None) -> dict[str, dict]:
    if config.settings.appstream_repos:
        appstream_path = os.path.join(
            config.settings.appstream_repos,
            "repo",
            "appstream",
            "x86_64",
            "appstream.xml",
        )
        with open(appstream_path, "rb") as file:
            if appstream_path.endswith(".gz"):
                appstream = gzip.decompress(file.read())
            else:
                appstream = file.read()
    else:
        if not appstream_url:
            appstream_url = (
                "https://hub.flathub.org/repo/appstream/x86_64/appstream.xml.gz"
            )
        r = requests.get(appstream_url, stream=True)
        appstream = gzip.decompress(r.raw.data)

    root = etree.fromstring(appstream)

    apps = {}

    media_base_url = "https://dl.flathub.org/media"

    for component in root:
        appid = re.sub(remove_desktop_re, "", component.find("id").text)
        app = {}

        app["type"] = component.attrib.get("type", "generic")
        app["locales"] = {}

        descriptions = component.findall("description")
        if len(descriptions):
            for desc in descriptions:
                component.remove(desc)

                description = [
                    etree.tostring(tag, encoding=("unicode")) for tag in desc
                ]

                if len(desc.attrib) == 0:
                    app["description"] = "".join(description)
                else:
                    add_translation(
                        app["locales"],
                        desc.get("{http://www.w3.org/XML/1998/namespace}lang"),
                        appid,
                        "description",
                        "".join(description),
                    )

        screenshots = component.find("screenshots")
        if screenshots is not None:
            app["screenshots"] = []
            for i, screenshot in enumerate(screenshots):
                attrs = {}

                if component.attrib.get("type") == "desktop-application":
                    for caption in screenshot.findall("caption"):
                        if caption is not None:
                            if (
                                caption.attrib.get(
                                    "{http://www.w3.org/XML/1998/namespace}lang"
                                )
                                is None
                            ):
                                attrs["caption"] = caption.text
                            else:
                                add_translation(
                                    app["locales"],
                                    caption.attrib.get(
                                        "{http://www.w3.org/XML/1998/namespace}lang"
                                    ),
                                    appid,
                                    f"screenshots_caption_{i}",
                                    "".join(caption.text),
                                )

                if screenshot.attrib.get("type") == "default":
                    attrs["default"] = True

                attrs["sizes"] = []
                for image in screenshot:
                    if (
                        image.attrib.get("type") == "thumbnail"
                        and image.attrib.get(
                            "{http://www.w3.org/XML/1998/namespace}lang"
                        )
                        is None
                        or (
                            image.attrib.get("type") == "source"
                            and image.attrib.get("width") is not None
                            and image.attrib.get("height") is not None
                            and image.attrib.get(
                                "{http://www.w3.org/XML/1998/namespace}lang"
                            )
                            is None
                        )
                    ):
                        scale = None
                        if image.attrib.get("scale") is not None:
                            scale = image.attrib.get("scale")
                        width = image.attrib.get("width")
                        height = image.attrib.get("height")
                        attrs["sizes"].append(
                            {
                                "width": width,
                                "height": height,
                                "scale": scale if scale is not None else "1x",
                                "src": (
                                    f"{media_base_url}/{re.sub('.png$', '.webp', image.text)}"
                                    if not image.text.startswith("http")
                                    else re.sub(".png$", ".webp", image.text)
                                ),
                            }
                        )

                if attrs and len(attrs["sizes"]) > 0:
                    app["screenshots"].append(attrs.copy())
            component.remove(screenshots)

        releases = component.find("releases")
        if releases is not None:
            app["releases"] = []
            for i, release in enumerate(releases):
                attrs = {}
                for attr in release.attrib:
                    attrs[attr] = release.attrib[attr]

                descs = release.findall("description")
                for desc in descs:
                    if desc is not None:
                        description = [
                            etree.tostring(tag, encoding=("unicode")) for tag in desc
                        ]
                        if (
                            desc.attrib.get(
                                "{http://www.w3.org/XML/1998/namespace}lang"
                            )
                            is None
                        ):
                            attrs["description"] = "".join(description)
                        else:
                            add_translation(
                                app["locales"],
                                desc.get("{http://www.w3.org/XML/1998/namespace}lang"),
                                appid,
                                "release_description_" + str(i),
                                "".join(description),
                            )

                url = release.find("url")
                if url is not None:
                    attrs["url"] = url.text

                app["releases"].append(attrs.copy())
            component.remove(releases)

        content_rating = component.find("content_rating")
        if content_rating is not None:
            app["content_rating"] = {}
            app["content_rating"]["type"] = content_rating.attrib.get("type")
            for attr in content_rating:
                attr_name = attr.attrib.get("id")
                if attr_name:
                    app["content_rating"][attr_name] = attr.text
            component.remove(content_rating)

        urls = component.findall("url")
        if len(urls):
            app["urls"] = {}
            for url in urls:
                component.remove(url)
                url_type = url.attrib.get("type")
                if url_type:
                    app["urls"][url_type.replace("-", "_")] = url.text

        icons = component.findall("icon")
        iconListNewLocation = []
        iconListOldLocation = []
        if len(icons):
            for icon in icons:
                icon_type = icon.attrib.get("type")
                if icon_type == "remote":
                    if icon.text.startswith("https://dl.flathub.org/media/"):
                        if "icon" not in app:
                            app["icon"] = icon.text
                        attrs = {}
                        for attr in icon.attrib:
                            attrs[attr] = icon.attrib[attr]
                        attrs.update({"url": icon.text})
                        iconListNewLocation.append(attrs)

            if not app.get("icon"):
                for icon in icons:
                    icon_type = icon.attrib.get("type")
                    if icon_type == "cached":
                        if "icon" not in app:
                            app["icon"] = (
                                f"https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/{icon.text}"
                            )
                        attrs = {}
                        for attr in icon.attrib:
                            attrs[attr] = icon.attrib[attr]
                        scaleSuffix = f"@{attrs['scale']}" if "scale" in attrs else ""
                        attrs.update(
                            {
                                "url": f"https://dl.flathub.org/repo/appstream/x86_64/icons/{attrs['height']}x{attrs['width']}{scaleSuffix}/{icon.text}"
                            }
                        )
                        iconListOldLocation.append(attrs)

            for icon in icons:
                component.remove(icon)

        # Bail out if the loop above didn't find an icon
        if not app.get("icon"):
            app["icon"] = None

        if len(iconListNewLocation) == 0 and len(iconListOldLocation) == 0:
            app["icons"] = None
        elif len(iconListNewLocation):
            app["icons"] = iconListNewLocation
        else:
            app["icons"] = iconListNewLocation

        metadata = component.find("metadata")
        if metadata is not None:
            app["metadata"] = {}
            for value in metadata:
                key = value.attrib.get("key")
                app["metadata"][key] = value.text
            component.remove(metadata)

        custom = component.find("custom")
        if custom is not None:
            if "metadata" not in app:
                app["metadata"] = {}
            for value in custom:
                key = value.attrib.get("key")
                app["metadata"][key] = value.text
            component.remove(custom)

        developers = component.findall(".//developer/name")
        if len(developers):
            app["developers"] = []
            for name in developers:
                # TODO: support translations
                if name.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"):
                    continue
                app["developers"].append(name.text)
            component.remove(component.find("developer"))

        for elem in component:
            if elem.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"):
                if len(elem) == 0 and len(elem.attrib) == 1:
                    add_translation(
                        app["locales"],
                        elem.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"),
                        appid,
                        elem.tag,
                        elem.text,
                    )
                continue

            if len(elem) == 0 and len(elem.attrib) == 0:
                app[elem.tag] = elem.text

            if len(elem) == 0 and len(elem.attrib):
                attrs = {}
                attrs["value"] = elem.text
                for attr in elem.attrib:
                    attrs[attr] = elem.attrib[attr]

                if elem.tag not in app:
                    siblings = component.findall(elem.tag)
                    if len(siblings) > 1:
                        app[elem.tag] = [attrs.copy()]
                    else:
                        app[elem.tag] = attrs
                        continue
                else:
                    app[elem.tag] = attrs.copy()

            if len(elem):
                app[elem.tag] = []
                for tag in elem:
                    if not len(tag.attrib):
                        app[elem.tag].append(tag.text)
                        continue

                    if tag.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"):
                        if len(elem) == 0 and len(elem.attrib) == 1:
                            add_translation(
                                app["locales"],
                                elem.attrib.get(
                                    "{http://www.w3.org/XML/1998/namespace}lang"
                                ),
                                appid,
                                elem.tag,
                                elem.text,
                            )
                        continue

                    attrs = {}
                    attrs["value"] = tag.text
                    for attr in tag.attrib:
                        attrs[attr] = tag.attrib[attr]

                    app[elem.tag].append(attrs.copy())

        # Determine whether the app is FOSS
        app_licence = app.get("project_license", "")
        app["is_free_license"] = app_licence and AppStream.license_is_free_license(
            app_licence
        )

        if app["is_free_license"] == "":
            app["is_free_license"] = False

        # Settings seems to be a lonely, forgotten category with just 3 apps,
        # add them to more popular System
        if "categories" in app and "Settings" in app["categories"]:
            app["categories"].append("System")

        # Backfill developer_name for backwards compatibility
        if app_developers := app.get("developers"):
            app["developer_name"] = ", ".join(app_developers)

        # Some apps append .desktop suffix for legacy reasons, fall back to what
        # Flatpak put into bundle component for actual ID
        appid = app["bundle"]["value"].split("/")[1]
        app["id"] = appid
        apps[appid] = app

    return apps


def get_content_rating_details(content_rating: dict, locale: str) -> dict:
    system = AppStream.ContentRatingSystem.from_locale(locale)
    rating = AppStream.ContentRating()
    rating.set_kind(content_rating["kind"])
    details = {"attrs": []}

    for attr, level in content_rating.items():
        if attr == 'kind':
            continue
        c_level = AppStream.ContentRatingValue.from_string(level)
        rating.add_attribute(attr, c_level)
        description = AppStream.ContentRating.attribute_get_description(attr, c_level)
        details["attrs"] = {
            "attr": attr,
            "level": level,
            "description": description,
        }

    min_age = AppStream.ContentRating.get_minimum_age(rating)
    if min_age == MAXUINT:
        details["minimumAge"] = None
    else:
        details["minimumAge"] = AppStream.ContentRatingSystem.format_age(system, min_age)

    return details


def get_clean_app_id(app_id: str):
    return re.sub(clean_id_re, "_", app_id)


class Platform(BaseModel):
    """
    A platform is an expression of dependencies which an application may have.
    Applications nominally express a single platform key for themselves, or
    none at all if they do not need one.  But platforms may depend on one another.

    If no platform is specified for an application, it's worth getting the default
    platform and using that.
    """

    depends: str | None = None
    aliases: list[str]
    keep: int
    stripe_account: str | None = None

    def dict(self, *args, **kwargs) -> dict[str, Any]:
        """
        Override the dict() method to always hide the optional values if None
        """
        kwargs.pop("exclude_none")
        return super().dict(*args, exclude_none=True, **kwargs)


def _load_platforms(with_stripe: bool) -> dict[str, Platform]:
    """
    Load the platform set from disk.  If something goes wrong this will return
    the internal default platform set (flathub only).

    This will do a basic integrity check to ensure that (a) all platform dependencies
    are listed in the set, (b) no aliases overlap, and (c) only one platform is
    marked as default.
    """

    try:
        vending_dir = os.path.join(config.settings.datadir, "vending")
        with open(
            os.path.join(vending_dir, "platforms.json"), encoding="utf-8"
        ) as file_:
            data = json.load(file_)
        aliases = set()
        ret = {}
        for name, item in data.items():
            ret[name] = Platform(
                depends=item.get("depends"),
                aliases=item["aliases"],
                keep=item.get("keep", 100),
            )
            for alias in ret[name].aliases:
                if alias in aliases:
                    raise ValueError(f"Repeated alias: {alias} in {name}")
                aliases.add(alias)
            if (dep := ret[name].depends) and data.get(dep) is None:
                raise ValueError(f"Unknown dependency: {dep} for {name}")
            if with_stripe:
                ret[name].stripe_account = item.get("stripe-account")
        return ret
    except (AttributeError, ValueError, TypeError, json.JSONDecodeError) as error:
        print(f"Unable to load platforms: {error}")
        return {"org.flathub.Flathub": Platform(depends=[], aliases=[])}


PLATFORMS = _load_platforms(False)
PLATFORMS_WITH_STRIPE = _load_platforms(True)


def is_valid_app_id(app_id: str) -> bool:
    """Ensures that an app ID is correctly formed. The requirements are taken from the D-Bus spec for well-known bus
    names [1], except we require at least 3 segments rather than 2.

    [1] https://dbus.freedesktop.org/doc/dbus-specification.html#message-protocol-names-bus
    """

    if len(app_id) > 255:
        return False

    elements = app_id.split(".")
    if len(elements) < 3:
        return False
    return all(re.match("^[A-Za-z_][\\w\\-]*$", element) for element in elements)


def create_flat_manager_token(use: str, scopes: list[str], **kwargs):
    return "Bearer " + jwt.encode(
        {
            "sub": "build",
            "scope": scopes,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(minutes=5),
            "name": f"Backend token for internal use ({use})",
            **kwargs,
        },
        base64.b64decode(config.settings.flat_manager_build_secret),
        algorithm="HS256",
    )
