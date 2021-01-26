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
        self.run_command("remote-add", "--if-not-exists", "flathub", "https://flathub.org/repo/flathub.flatpakrepo")
        self.remote_info("org.freedesktop.Platform//20.08")

    def run_command(self, *args):
        base_command = ["flatpak", "--user"]

        args = list(args)
        command = base_command + args

        ret = subprocess.run(command, stdout=subprocess.PIPE)
        if ret.returncode != 0:
            return None

        return ret.stdout.decode("utf-8")

    def remote_info(self, appid):
        command = ["remote-info", "--user", "flathub", appid]

        output = self.run_command(*command)
        output = output.replace("\xa0", " ")

        info = {}
        for line in output.split("\n"):
            if ": " in line:
                key, value = line.split(": ", 1)
                info[key.lstrip()] = value.rstrip()

        return info

    def show_commit(self, appid):
        command = ["remote-info", "--cached", "--show-commit", "flathub", appid]
        output = self.run_command(*command)

        return output.rstrip()

    def list_refs(self):
        command = [
                "remote-ls",
                "--arch=*",
                "--app",
                "--columns=ref",
                "flathub",
                ]
        output = self.run_command(*command)
        return output.splitlines()


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
            if appstream_path.endswith('.gz'):
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
                app["icon"] = f"{cdn_baseurl}/repo/appstream/x86_64/icons/{icon_size}x{icon_size}/{icon_name}"
            elif icons_data := icons_dict.get("remote"):
                icon_size = max(icons_data)
                app["icon"] = icons_data[icon_size]
        else:
            app["icon"] = None

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
