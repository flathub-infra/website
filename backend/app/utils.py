import base64
import gzip
import hashlib
import json
import os
import re
from datetime import UTC, datetime, timedelta
from typing import Any

import gi
import jwt
from lxml import etree
from pydantic import BaseModel

from . import config, http_client, models

gi.require_version("AppStream", "1.0")
from gi.repository import AppStream

clean_id_re = re.compile("[^a-zA-Z0-9_-]+")
remove_desktop_re = re.compile(r"\.desktop$")

mobile_min_size = 360
mobile_max_size = 768


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


def add_translation(
    apps_locale: dict, language: str, appid: str, key: str, value: str | list[str]
):
    # normalize multi part languages, as the frontend
    #  always asks for the ones with a dash
    language = language.replace("_", "-")

    # map languages to the ones we use
    if language == "zh-CN":
        language = "zh-Hans"

    if language == "zh-TW":
        language = "zh-Hant"

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
                "https://dl.flathub.org/repo/appstream/x86_64/appstream.xml.gz"
            )
        with http_client.stream("GET", appstream_url) as r:
            appstream = gzip.decompress(r.read())

    root = etree.fromstring(appstream)

    apps = {}

    media_base_url = "https://dl.flathub.org/media"

    for component in root:
        appid = re.sub(remove_desktop_re, "", component.find("id").text)
        app = {}

        app["type"] = component.attrib.get("type", "generic")
        app["locales"] = {}

        isMobileFriendly = False
        hasTouch = False

        for tag_name in ("requires", "recommends"):
            if (tag := component.find(tag_name)) is not None and (
                display_lengths := tag.findall("display_length")
            ):
                isMobileFriendly = display_length_supports_mobile(display_lengths)
                if isMobileFriendly:
                    break

        for requirement in ("supports", "recommends"):
            element = component.find(requirement)
            if element is not None:
                controls = element.findall("control")
                if any(control.text == "touch" for control in controls):
                    hasTouch = True
                    break

        app["isMobileFriendly"] = isMobileFriendly and hasTouch

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

        screenshotsComponent = component.find("screenshots")

        if screenshotsComponent is not None:
            if not all(
                [
                    screenshot.attrib.get("environment")
                    in (
                        "windows",
                        "macos",
                    )
                    for screenshot in screenshotsComponent
                ]
            ):
                screenshots = [
                    screenshot
                    for screenshot in screenshotsComponent
                    if screenshot.attrib.get("environment")
                    not in (
                        "windows",
                        "macos",
                    )
                ]
            else:
                screenshots = [screenshot for screenshot in screenshotsComponent]

            app["screenshots"] = []
            for i, screenshot in enumerate(screenshots):
                attrs = {}

                if screenshot.attrib.get("environment") is not None:
                    attrs["environment"] = screenshot.attrib.get("environment")

                if component.attrib.get("type") == "desktop-application":
                    for caption in screenshot.findall("caption"):
                        if caption is not None and caption.text:
                            caption_lang = caption.get(
                                "{http://www.w3.org/XML/1998/namespace}lang"
                            )
                            if caption_lang is None:
                                attrs["caption"] = caption.text
                            else:
                                add_translation(
                                    app["locales"],
                                    caption_lang,
                                    appid,
                                    f"screenshots_caption_{i}",
                                    caption.text,
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
                            and image.get("{http://www.w3.org/XML/1998/namespace}lang")
                            is None
                        )
                    ):
                        scale = None
                        if image.attrib.get("scale") is not None:
                            scale = image.attrib.get("scale")
                        width = image.attrib.get("width")
                        height = image.attrib.get("height")

                        if image.text.startswith("http"):
                            if image.text.startswith(
                                "https://dl.flathub.org/repo/screenshots/"
                            ):
                                src = image.text.replace(
                                    "https://dl.flathub.org/repo/screenshots/",
                                    "https://dl.flathub.org/media/",
                                    1,
                                )
                            else:
                                src = image.text
                        else:
                            src = f"{media_base_url}/{image.text}"

                        attrs["sizes"].append(
                            {
                                "width": width,
                                "height": height,
                                "scale": scale if scale is not None else "1x",
                                "src": src,
                            }
                        )

                if attrs and len(attrs["sizes"]) > 0:
                    app["screenshots"].append(attrs.copy())
            component.remove(screenshotsComponent)

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
                        desc_lang = desc.get(
                            "{http://www.w3.org/XML/1998/namespace}lang"
                        )
                        if desc_lang is None:
                            attrs["description"] = "".join(description)
                        else:
                            add_translation(
                                app["locales"],
                                desc_lang,
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
                        attrs = {}
                        for attr in icon.attrib:
                            attrs[attr] = icon.attrib[attr]
                        attrs.update({"url": icon.text})
                        iconListNewLocation.append(attrs)

            if not iconListNewLocation:
                for icon in icons:
                    icon_type = icon.attrib.get("type")
                    if icon_type == "cached":
                        attrs = {}
                        for attr in icon.attrib:
                            attrs[attr] = icon.attrib[attr]
                        scaleSuffix = f"@{attrs['scale']}" if "scale" in attrs else ""
                        attrs.update(
                            {
                                "url": f"https://dl.flathub.org/media/icons/{attrs['height']}x{attrs['width']}{scaleSuffix}/{icon.text}"
                            }
                        )
                        iconListOldLocation.append(attrs)

            for icon in icons:
                component.remove(icon)

        # Select the biggest icon by height and scale, or fallback to None
        if len(iconListNewLocation) > 0:
            app["icons"] = iconListNewLocation
            app["icon"] = find_biggest_icon(iconListNewLocation)
        elif len(iconListOldLocation) > 0:
            app["icons"] = iconListOldLocation
            app["icon"] = find_biggest_icon(iconListOldLocation)
        else:
            app["icons"] = None
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

        developers = component.findall(".//developer/name")
        if len(developers):
            app["developers"] = []
            for name in developers:
                # TODO: support translations
                if name.get("{http://www.w3.org/XML/1998/namespace}lang"):
                    continue
                app["developers"].append(name.text)
            component.remove(component.find("developer"))

        for elem in component:
            elem_xml_lang = elem.get("{http://www.w3.org/XML/1998/namespace}lang")
            if elem_xml_lang:
                # Only add translation if element has text content (leaf elements)
                # Container elements like <keywords> with children will be handled below
                if len(elem) == 0 and elem.text and elem.text.strip():
                    add_translation(
                        app["locales"],
                        elem_xml_lang,
                        appid,
                        elem.tag,
                        elem.text.strip(),
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
                # Check if parent element has xml:lang (for container elements with localized children)
                parent_xml_lang = elem.get("{http://www.w3.org/XML/1998/namespace}lang")

                # If parent has xml:lang, all children are translations
                if parent_xml_lang:
                    # Collect all child text values into a list
                    translated_items = [
                        tag.text.strip()
                        for tag in elem
                        if not len(tag.attrib)
                        and tag.text is not None
                        and tag.text.strip()
                    ]

                    if elem.tag == "keywords" and translated_items:
                        translated_items = [
                            item
                            for item in translated_items
                            if isinstance(item, str)
                            and len(item) <= 20
                            and not any(c in item for c in "./")
                        ][:3]

                    if translated_items:
                        add_translation(
                            app["locales"],
                            parent_xml_lang,
                            appid,
                            elem.tag,
                            translated_items,
                        )
                    continue

                # Parent has no xml:lang, process children normally
                if elem.tag not in app:
                    app[elem.tag] = []
                for tag_index, tag in enumerate(elem):
                    # Try to get xml:lang attribute from child
                    xml_lang = tag.get("{http://www.w3.org/XML/1998/namespace}lang")

                    # Check if this is a translated child element
                    if xml_lang:
                        # Add translation for child elements like <keyword xml:lang="de">
                        if tag.text and tag.text.strip():
                            add_translation(
                                app["locales"],
                                xml_lang,
                                appid,
                                f"{elem.tag}_{tag_index}",
                                tag.text.strip(),
                            )
                        continue

                    # No xml:lang attribute - either no attributes or other attributes
                    if not len(tag.attrib):
                        # Simple text element with no attributes
                        if tag.text and tag.text.strip():
                            app[elem.tag].append(tag.text.strip())
                        continue

                    # Has other attributes (not xml:lang)
                    attrs = {}
                    attrs["value"] = tag.text
                    for attr in tag.attrib:
                        attrs[attr] = tag.attrib[attr]

                    app[elem.tag].append(attrs.copy())

                if elem.tag == "keywords" and elem.tag in app:
                    app[elem.tag] = [
                        kw
                        for kw in app[elem.tag]
                        if isinstance(kw, str)
                        and len(kw) <= 10
                        and not any(c in kw for c in " ./")
                    ][:3]

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


def display_length_supports_mobile(display_lengths: list[etree.Element]) -> bool:
    conditions = {
        "ge": lambda value: value <= mobile_min_size,
        "gt": lambda value: value <= (mobile_min_size - 1),
        "le": lambda value: mobile_max_size <= value,
        "lt": lambda value: (mobile_max_size + 1) <= value,
    }
    for display_length in display_lengths:
        if display_length.attrib.get("side", "shortest") == "longest":
            continue
        compare = display_length.attrib.get("compare", "ge")
        displaylen_value = display_length.text
        if displaylen_value is None:
            continue
        try:
            value = int(displaylen_value)
            if conditions.get(compare, lambda x: False)(value):
                return True
        except ValueError:
            continue
    return False


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

    def model_dump(self, *args, **kwargs) -> dict[str, Any]:
        """
        Override the model_dump() method to always hide the optional values if None
        """
        kwargs.pop("exclude_none", None)
        return super().model_dump(*args, exclude_none=True, **kwargs)


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


def find_biggest_icon(icons: list[dict]) -> str | None:
    """
    Find the biggest available icon by height and scale.
    Sorts icons by height (descending), then by scale (descending),
    and returns the URL of the largest icon.
    """
    if not icons:
        return None

    # Convert height to int for comparison, default to 0 if not present
    def get_sort_key(icon: dict):
        height = int(icon.get("height", 0)) if icon.get("height") else 0
        scale = int(icon.get("scale", "1").replace("x", "")) if icon.get("scale") else 1
        return (height, scale)

    sorted_icons = sorted(icons, key=get_sort_key, reverse=True)
    return sorted_icons[0].get("url") if sorted_icons else None


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
    if config.settings.flat_manager_build_secret is None:
        raise ValueError("flat_manager_build_secret is not configured")

    return "Bearer " + jwt.encode(
        {
            "sub": "build",
            "scope": scopes,
            "iat": datetime.now(UTC),
            "exp": datetime.now(UTC) + timedelta(minutes=5),
            "name": f"Backend token for internal use ({use})",
            **kwargs,
        },
        base64.b64decode(config.settings.flat_manager_build_secret),
        algorithm="HS256",
    )


def jti(token: "models.UploadToken") -> str:
    return f"backend_{token.id}"
