import gzip
import hashlib
import json
import os
import re

import requests
from lxml import etree

from . import config


class Hasher:
    """
    Wrapper around the hashlib library to provide an ergonomic API
    for hashing a combination of data types
    """

    def __init__(self):
        self.hasher = hashlib.sha256()

    def add_bytes(self, bytes):
        self.hasher.update(bytes)

    def add_string(self, string):
        self.add_bytes(string.encode("utf-8"))

    def add_number(self, num):
        self.add_string(f"{num}")

    def hash(self):
        return self.hasher.hexdigest()


def add_translation(apps_locale: dict, language: str, appid: str, key: str, value: str):
    if language not in apps_locale:
        apps_locale[language] = {}
    if appid not in apps_locale[language]:
         apps_locale[language][appid] = {}
    apps_locale[language][appid][key] = value


def appstream2dict(reponame: str):
    if config.settings.appstream_repos is not None:
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
    apps_locale = {}

    remove_desktop_re = re.compile(r"\.desktop$")

    for component in root:
        appid = re.sub(remove_desktop_re, "", component.find("id").text)
        app = {}

        if component.attrib.get("type") != "desktop":
            continue

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
                    add_translation(apps_locale, desc.get("{http://www.w3.org/XML/1998/namespace}lang"), appid, "description", "".join(description))

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

        metadata = component.find("metadata")
        if metadata is not None:
            app["metadata"] = {}
            for value in metadata:
                key = value.attrib.get("key")
                app["metadata"][key] = value.text
            component.remove(metadata)

        urls = component.findall("url")
        if len(urls):
            app["urls"] = {}
            for url in urls:
                component.remove(url)
                url_type = url.attrib.get("type")
                if url_type:
                    app["urls"][url_type] = url.text

        icons = component.findall("icon")
        if len(icons):
            icons_dict = {}

            for icon in icons:
                icon_type = icon.attrib.get("type")
                icon_name = icon.text

                icon_size = icon.attrib.get("width")
                if icon_size:
                    icon_size = int(icon_size)
                else:
                    icon_size = 0

                if icon_type not in icons_dict:
                    icons_dict[icon_type] = {}

                icons_dict[icon_type][icon_size] = icon_name
                component.remove(icon)

            if icons_data := icons_dict.get("cached"):
                cdn_baseurl = "https://dl.flathub.org"
                icon_size = max(icons_data)
                icon_name = icons_data[icon_size]
                app[
                    "icon"
                ] = f"{cdn_baseurl}/repo/appstream/x86_64/icons/{icon_size}x{icon_size}/{icon_name}"
            elif icons_data := icons_dict.get("remote"):
                icon_size = max(icons_data)
                app["icon"] = icons_data[icon_size]
        else:
            app["icon"] = None

        for elem in component:
            # TODO: support translations
            if elem.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"):
                if len(elem) == 0 and len(elem.attrib) == 1:
                    add_translation(apps_locale, elem.attrib.get("{http://www.w3.org/XML/1998/namespace}lang"), appid, elem.tag, elem.text)
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
                    app[elem.tag].append(attrs.copy())

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
        if "categories" in app:
            if "Settings" in app["categories"]:
                app["categories"].append("System")

        app["id"] = appid

        apps[appid] = app

    return apps, apps_locale


def get_appids(path):
    try:
        with open(
            path,
        ) as file_:
            return json.load(file_)
    except IOError:
        return []
