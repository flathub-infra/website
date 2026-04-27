import base64
import ctypes
import gettext
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

from . import config, http_client, localize, models

gi.require_version("AppStream", "1.0")
from gi.repository import AppStream

clean_id_re = re.compile("[^a-zA-Z0-9_-]+")
remove_desktop_re = re.compile(r"\.desktop$")

MAXUINT = ctypes.c_uint(-1).value

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
        parsed_content_rating = None

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

                # Per the AppStream spec, releases without an explicit type
                # default to "stable"
                if "type" not in attrs:
                    attrs["type"] = "stable"

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
            parsed_content_rating = {"type": content_rating.attrib.get("type")}
            for attr in content_rating:
                attr_name = attr.attrib.get("id")
                if attr_name:
                    parsed_content_rating[attr_name.replace("-", "_")] = attr.text
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

        if parsed_content_rating and parsed_content_rating.get("type") is not None:
            content_rating = {}
            for lang in localize.LOCALES:
                content_rating[lang] = get_content_rating_details(
                    parsed_content_rating, lang
                )

            apps[appid]["content_rating_details"] = content_rating

    return apps


_APPSTREAM_LOCALE_DIR = "/usr/share/locale"
_translation_cache: dict[str, gettext.GNUTranslations | None] = {}


def _get_appstream_translation(
    posix_locale: str,
) -> gettext.GNUTranslations | None:
    """Return a GNUTranslations object for the given POSIX locale (e.g. 'de_DE'),
    or None if no translation is available. Results are cached."""
    if posix_locale in _translation_cache:
        return _translation_cache[posix_locale]

    # Try the full locale first (de_DE), then the language part (de)
    languages = [posix_locale, posix_locale.split("_")[0]]
    try:
        t = gettext.translation(
            "appstream", localedir=_APPSTREAM_LOCALE_DIR, languages=languages
        )
    except FileNotFoundError:
        t = None

    _translation_cache[posix_locale] = t
    return t


# All OARS 1.1 attribute IDs in category order
_ALL_OARS_ATTRS = [
    "violence-cartoon",
    "violence-fantasy",
    "violence-realistic",
    "violence-bloodshed",
    "violence-sexual",
    "violence-desecration",
    "violence-slavery",
    "violence-worship",
    "drugs-alcohol",
    "drugs-narcotics",
    "drugs-tobacco",
    "sex-nudity",
    "sex-themes",
    "sex-homosexuality",
    "sex-prostitution",
    "sex-adultery",
    "sex-appearance",
    "language-profanity",
    "language-humor",
    "language-discrimination",
    "social-chat",
    "social-info",
    "social-audio",
    "social-location",
    "social-contacts",
    "money-purchasing",
    "money-gambling",
]

# Mapping from attr prefix to display category
_ATTR_CATEGORY = {
    "violence": "violence",
    "drugs": "drugs",
    "sex": "sex",
    "language": "language",
    "social": "social",
    "money": "money",
}

# Fixed display order for categories
_CATEGORY_ORDER = ["social", "drugs", "language", "money", "sex", "violence"]

# Attributes added in OARS 1.1 that don't exist in 1.0
_OARS_11_ONLY_ATTRS = {
    "violence-desecration",
    "violence-slavery",
    "violence-worship",
    "sex-homosexuality",
    "sex-prostitution",
    "sex-adultery",
    "sex-appearance",
}


def _attr_to_category(attr: str) -> str | None:
    prefix = attr.split("-", 1)[0]
    return _ATTR_CATEGORY.get(prefix)


def get_content_rating_details(content_rating: dict, locale: str) -> dict:
    if content_rating is None or content_rating.get("type") is None:
        return {}
    system = AppStream.ContentRatingSystem.from_locale(locale)
    rating = AppStream.ContentRating()

    rating.set_kind(content_rating["type"])

    translation = _get_appstream_translation(locale)

    # For oars-1.0, the 1.1-only attrs don't exist and are truly unknown
    oars_type = content_rating["type"]
    is_oars_11 = oars_type != "oars-1.0"

    # Collect explicitly set attributes
    explicit_attrs: dict[str, str] = {}
    for attr, level in content_rating.items():
        if attr == "kind" or attr == "type" or attr == "none":
            continue
        hyphen_attr = attr.replace("_", "-")
        explicit_attrs[hyphen_attr] = level

    # Group by category, tracking worst level and descriptions
    categories: dict[str, dict[str, Any]] = {}

    # Track which attrs we've processed from the known list
    processed_attrs: set[str] = set()

    for attr in _ALL_OARS_ATTRS:
        processed_attrs.add(attr)
        is_explicit = attr in explicit_attrs
        # An attr is "known" if explicitly set, or if it exists in the OARS version
        is_known = is_explicit or is_oars_11 or attr not in _OARS_11_ONLY_ATTRS
        level = explicit_attrs.get(attr, "none")
        c_level = AppStream.ContentRatingValue.from_string(level)
        if c_level != AppStream.ContentRatingValue.NONE:
            rating.add_attribute(attr, c_level)

        cat = _attr_to_category(attr)
        if not cat:
            continue

        en_description = AppStream.ContentRating.attribute_get_description(
            attr, c_level
        )
        description = (
            translation.gettext(en_description)
            if translation and en_description
            else en_description
        )

        if cat not in categories:
            categories[cat] = {
                "id": cat,
                "level": "none",
                "all_known": True,
                "descriptions": [],
                "none_descriptions": [],
            }

        entry = categories[cat]

        if not is_known:
            entry["all_known"] = False

        # Track worst level
        level_order = ["none", "mild", "moderate", "intense"]
        if level_order.index(level) > level_order.index(entry["level"]):
            entry["level"] = level

        if description:
            if level != "none":
                entry["descriptions"].append(description)
            else:
                entry["none_descriptions"].append(description)

    # Also process any explicit attrs not in _ALL_OARS_ATTRS (forward compat)
    for attr, level in explicit_attrs.items():
        if attr in processed_attrs:
            continue

        cat = _attr_to_category(attr)
        if not cat:
            continue

        c_level = AppStream.ContentRatingValue.from_string(level)
        if c_level != AppStream.ContentRatingValue.NONE:
            rating.add_attribute(attr, c_level)

        en_description = AppStream.ContentRating.attribute_get_description(
            attr, c_level
        )
        description = (
            translation.gettext(en_description)
            if translation and en_description
            else en_description
        )

        if cat not in categories:
            categories[cat] = {
                "id": cat,
                "level": "none",
                "all_known": True,
                "descriptions": [],
                "none_descriptions": [],
            }

        entry = categories[cat]

        level_order = ["none", "mild", "moderate", "intense"]
        if level in level_order and level_order.index(level) > level_order.index(
            entry["level"]
        ):
            entry["level"] = level

        if description:
            if level != "none":
                entry["descriptions"].append(description)
            else:
                entry["none_descriptions"].append(description)

    # Build final category list:
    # - non-none descriptions always shown (joined with bullet)
    # - all-none categories with ALL attrs explicit: show first none description
    # - incomplete categories (missing attrs): unknown, no description
    result_categories = []
    for cat in _CATEGORY_ORDER:
        entry = categories.get(cat)
        if entry is None:
            result_categories.append(
                {"id": cat, "level": "unknown", "description": None}
            )
            continue

        if entry["descriptions"]:
            desc = " \u2022 ".join(entry["descriptions"])
            level = entry["level"]
        elif entry["all_known"] and entry["none_descriptions"]:
            desc = entry["none_descriptions"][0]
            level = "none"
        else:
            desc = None
            level = "unknown"

        result_categories.append({"id": cat, "level": level, "description": desc})

    # Sort: non-none first, then none, then unknown last
    _level_sort_order = {
        "intense": 0,
        "moderate": 1,
        "mild": 2,
        "none": 3,
        "unknown": 4,
    }
    result_categories.sort(key=lambda c: _level_sort_order.get(c["level"], 5))

    min_age = AppStream.ContentRating.get_minimum_age(rating)
    contentRatingResult: dict[str, Any] = {
        "categories": result_categories,
        "contentRatingSystem": AppStream.ContentRatingSystem.to_string(system),
        "minimumAge": max(min_age, 3) if min_age != MAXUINT else 3,
        "minimumAgeText": (
            AppStream.ContentRatingSystem.format_age(system, max(min_age, 3))
            if min_age != MAXUINT
            else AppStream.ContentRatingSystem.format_age(system, 3)
        ),
    }

    return contentRatingResult


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
