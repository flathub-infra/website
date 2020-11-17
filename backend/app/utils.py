import os
import json
import gzip
import subprocess
from lxml import etree

import requests

from . import config
from . import db


class Flatpak:
    def __init__(self):
        remote_add_cmd = [
            "flatpak",
            "--user",
            "remote-add",
            "--if-not-exists",
            "flathub",
            "https://flathub.org/repo/flathub.flatpakrepo",
        ]
        subprocess.run(
            remote_add_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )

        update_cache_cmd = [
            "flatpak",
            "--user",
            "remote-info",
            "flathub",
            "org.freedesktop.Sdk//19.08",
        ]
        subprocess.run(
            update_cache_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )

    def remote_info(self, appid):
        command = ["flatpak", "remote-info", "--user", "flathub", appid]
        remote_info = subprocess.run(command, stdout=subprocess.PIPE)

        if remote_info.returncode != 0:
            return None

        output = remote_info.stdout.decode("utf-8").replace("\xa0", " ")

        info = {}
        for line in output.split("\n"):
            if ": " in line:
                key, value = line.split(": ", 1)
                info[key.lstrip()] = value.rstrip()

        return info

    def show_commit(self, appid):
        command = [
            "flatpak",
            "--user",
            "remote-info",
            "--cached",
            "--show-commit",
            "flathub",
            appid,
        ]
        show_commit = subprocess.run(command, stdout=subprocess.PIPE)

        if show_commit.returncode != 0:
            return None

        return show_commit.stdout.decode("utf-8").rstrip()


def appstream2dict(reponame: str):
    if config.settings.appstream_repos is not None:
        appstream_path = os.path.join(
            config.settings.appstream_repos,
            reponame,
            "appstream",
            "x86_64",
            "appstream.xml.gz",
        )
        with open(appstream_path, "rb") as file:
            appstream = gzip.decompress(file.read())
    else:
        appstream_url = (
            f"https://hub.flathub.org/{reponame}/appstream/x86_64/appstream.xml.gz"
        )
        r = requests.get(appstream_url, stream=True)
        appstream = gzip.decompress(r.raw.data)

    root = etree.fromstring(appstream)

    apps = {}

    for component in root:
        app = {}

        if component.attrib.get("type") != "desktop":
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

        custom = component.find("custom")
        if custom is not None:
            app["custom"] = {}
            for value in custom:
                key = value.attrib.get("key")
                app["custom"][key] = value.text
            component.remove(custom)

        urls = component.findall("url")
        if len(urls):
            app["urls"] = {}
            for url in urls:
                component.remove(url)
                url_type = url.attrib.get("type")
                if url_type:
                    app["urls"][url_type] = url.text

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

        # Some apps keep .desktop suffix for legacy reasons, fall back to what
        # Flatpak put into bundle component for actual ID
        appid = app["bundle"]["value"].split("/")[1]
        app["id"] = appid

        apps[appid] = app

    return apps


def get_json_key(key):
    if key := db.redis_conn.get(key):
        return json.loads(key)

    return None
