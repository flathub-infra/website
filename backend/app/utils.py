import gzip
import hashlib
import json
import os
import re
from typing import Any

import requests
from lxml import etree
from pydantic import BaseModel

from . import config

clean_id_re = re.compile("[^a-zA-Z0-9_-]+")


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


def appstream2dict(reponame: str):
    if config.settings.appstream_repos:
        appstream_path = os.path.join(
            config.settings.appstream_repos,
            reponame,
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
        appstream_url = (
            f"https://hub.flathub.org/{reponame}/appstream/x86_64/appstream.xml.gz"
        )
        r = requests.get(appstream_url, stream=True)
        appstream = gzip.decompress(r.raw.data)

    root = etree.fromstring(appstream)

    apps = {}

    media_base_url = "https://dl.flathub.org/media"

    for component in root:
        app = {}

        if component.attrib.get("type") not in ("desktop", "desktop-application"):
            continue

        descriptions = component.findall("description")
        if len(descriptions):
            for desc in descriptions:
                component.remove(desc)
                if len(desc.attrib) > 0:
                    continue

                description = [
                    etree.tostring(tag, encoding=("unicode")) for tag in desc
                ]
                app["description"] = "".join(description)
                break

        screenshots = component.find("screenshots")
        if screenshots is not None:
            app["screenshots"] = []
            for screenshot in screenshots:
                attrs = {}

                for image in screenshot:
                    if image.attrib.get("type") == "thumbnail":
                        width = image.attrib.get("width")
                        height = image.attrib.get("height")
                        attrs[f"{width}x{height}"] = image.text
                        if not image.text.startswith("http"):
                            attrs[
                                f"{width}x{height}"
                            ] = f"{media_base_url}/{image.text}"

                if attrs:
                    if screenshot.attrib.get("type") == "default":
                        app["screenshots"].insert(0, attrs.copy())
                    else:
                        app["screenshots"].append(attrs.copy())
            component.remove(screenshots)

        releases = component.find("releases")
        if releases is not None:
            app["releases"] = []
            for rel in releases:
                attrs = {}
                for attr in rel.attrib:
                    attrs[attr] = rel.attrib[attr]

                desc = rel.find("description")
                if desc is not None:
                    description = [
                        etree.tostring(tag, encoding=("unicode")) for tag in desc
                    ]
                    attrs["description"] = "".join(description)

                url = rel.find("url")
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
        if len(icons):
            icons_dict = {}

            for icon in icons:
                icon_type = icon.attrib.get("type")
                icon_name = icon.text

                icon_size = icon.attrib.get("width")
                icon_size = int(icon_size) if icon_size else 0

                if icon_type not in icons_dict:
                    icons_dict[icon_type] = {}

                icons_dict[icon_type][icon_size] = icon_name
                component.remove(icon)

            if component.attrib.get("type") == "desktop-application":
                # For libappstream we need to process the remote icon first and bail
                if icons_data := icons_dict.get("remote"):
                    process_remote_icon(media_base_url, app, icons_data)
                elif icons_data := icons_dict.get("cached"):
                    process_cached_icon(app, icons_data)
            else:
                if icons_data := icons_dict.get("cached"):
                    process_cached_icon(app, icons_data)
                elif icons_data := icons_dict.get("remote"):
                    process_remote_icon(media_base_url, app, icons_data)
        else:
            app["icon"] = None

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

        for elem in component:
            # TODO: support translations
            if elem.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"):
                continue
            if elem.tag == "languages":
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

                    # TODO: support translations
                    if tag.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"):
                        continue

        # Settings seems to be a lonely, forgotten category with just 3 apps,
        # add them to more popular System
        if "categories" in app and "Settings" in app["categories"]:
            app["categories"].append("System")

        # Some apps append .desktop suffix for legacy reasons, fall back to what
        # Flatpak put into bundle component for actual ID
        appid = app["bundle"]["value"].split("/")[1]
        app["id"] = appid

        apps[appid] = app

    return apps


def process_cached_icon(app, icons_data):
    cdn_baseurl = "https://dl.flathub.org"
    icon_size = max(icons_data)
    icon_name = icons_data[icon_size]
    app[
        "icon"
    ] = f"{cdn_baseurl}/repo/appstream/x86_64/icons/{icon_size}x{icon_size}/{icon_name}"


def process_remote_icon(media_base_url, app, icons_data):
    icon_size = max(icons_data)
    app["icon"] = icons_data[icon_size]

    if not app["icon"].startswith("http"):
        app["icon"] = f"{media_base_url}/{app['icon']}"


def get_clean_app_id(appid: str):
    return re.sub(clean_id_re, "_", appid)


class Platform(BaseModel):
    """
    A platform is an expression of dependencies which an application may have.
    Applications nominally express a single platform key for themselves, or
    none at all if they do not need one.  But platforms may depend on one another.

    If no platform is specified for an application, it's worth getting the default
    platform and using that.
    """

    depends: str | None
    aliases: list[str]
    keep: int
    stripe_account: str | None

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


def is_valid_app_id(appid: str) -> bool:
    """Ensures that an app ID is correctly formed. The requirements are taken from the D-Bus spec for well-known bus
    names [1], except we require at least 3 segments rather than 2.

    [1] https://dbus.freedesktop.org/doc/dbus-specification.html#message-protocol-names-bus
    """

    if len(appid) > 255:
        return False

    elements = appid.split(".")
    if len(elements) < 3:
        return False
    return all(re.match("^[A-Za-z_][\\w\\-]*$", element) for element in elements)
