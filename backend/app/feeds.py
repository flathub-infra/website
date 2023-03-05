from datetime import datetime

from feedgen.feed import FeedGenerator

from . import db


def generate_feed(key: str, title: str, description: str, link: str):
    feed = FeedGenerator()
    feed.title(title)
    feed.description(description)
    feed.link(href=link)
    feed.language("en")

    appids = db.redis_conn.zrevrange(key, 0, 10, withscores=True)
    apps = [(db.get_json_key(f"apps:{appid[0]}"), appid[1]) for appid in appids]

    for app, timestamp in reversed(apps):
        # sanity check: if index includes an app, but apps:ID is null, skip it
        if not app:
            continue

        # sanity check: if application doesn't have the name field, skip it
        if not app.get("name"):
            continue

        entry = feed.add_entry()
        entry.title(app["name"])
        entry.link(href=f"https://flathub.org/apps/details/{app['id']}")

        timestamp = int(timestamp)
        entry_date = datetime.utcfromtimestamp(timestamp).strftime(
            "%a, %d %b %Y %H:%M:%S"
        )
        entry.pubDate(f"{entry_date} UTC")

        content = [
            '<img src="https://dl.flathub.org/repo/appstream/x86_64/icons/128x128/{}.png">'.format(
                app["id"]
            ),
            f"<p>{app['summary']}</p>",
        ]

        if description := app.get("description"):
            content.append(f"<p>{description}</p>")

        content.append("<h3>Additional information:</h3>")
        content.append("<ul>")

        if developer_name := app.get("developer_name"):
            content.append(f"<li>Developer: {developer_name}</li>")

        if license := app.get("license"):
            content.append(f"<li>License: {license}")

        if app_releases := app.get("releases"):
            release = app_releases[0] if len(app_releases) else None
            if release:
                content.append(f"<li>Version: {release['version']}")

        content.append("</ul>")

        if screenshots := app.get("screenshots"):
            screenshots = screenshots[0:3]

            for screenshot in screenshots:
                if image := screenshot.get("624x351"):
                    content.append(f'<img src="{image}">')

        entry.description("".join(content))

    return feed.rss_str()


def get_recently_updated_apps_feed():
    return generate_feed(
        "recently_updated_zset",
        "Flathub – recently updated applications",
        "Recently updated applications published on Flathub",
        "https://flathub.org/apps/collection/recently-updated",
    )


def get_new_apps_feed():
    return generate_feed(
        "new_apps_zset",
        "Flathub – recently added applications",
        "Applications recently published on Flathub",
        "https://flathub.org/apps/collection/new",
    )
