from datetime import datetime

from fastapi_sqlalchemy import db as sqldb
from feedgen.feed import FeedGenerator

from . import db, models


def generate_feed(key: str, title: str, description: str, link: str):
    feed = FeedGenerator()
    feed.title(title)
    feed.description(description)
    feed.link(href=link)
    feed.language("en")

    appids = db.redis_conn.zrevrange(key, 0, 10, withscores=True)
    appids_for_frontend = [
        tuple((appid[0], appid[1]))
        for appid in appids
        if db.is_appid_for_frontend(appid[0])
    ]
    apps = [
        (db.get_json_key(f"apps:{appid[0]}"), appid[1]) for appid in appids_for_frontend
    ]

    for app, timestamp in reversed(apps):
        # sanity check: if index includes an app, but apps:ID is null, skip it
        if not app:
            continue

        # sanity check: if application doesn't have the name field, skip it
        if not app.get("name"):
            continue

        entry = feed.add_entry()
        entry.title(app["name"])
        entry.link(href=f"https://flathub.org/apps/{app['id']}")

        timestamp = int(timestamp)
        entry_date = datetime.fromtimestamp(timestamp).strftime("%a, %d %b %Y %H:%M:%S")
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
                if image := list(screenshot["sizes"].values())[0]:
                    content.append(f'<img src="{image}">')

        entry.description("".join(content))

    return feed.rss_str()


def generate_feed_postgres(mode: str, title: str, description: str, link: str):
    feed = FeedGenerator()
    feed.title(title)
    feed.description(description)
    feed.link(href=link)
    feed.language("en")

    if mode == "new":
        appids = (
            sqldb.session.query(models.Apps)
            .order_by(models.Apps.initial_release_at.desc())
            .limit(10)
            .all()
        )
        appids_for_frontend = [
            tuple((app.app_id, app.initial_release_at))
            for app in appids
            if db.is_appid_for_frontend(app.app_id)
        ]
    else:
        appids = (
            sqldb.session.query(models.Apps)
            .order_by(models.Apps.last_updated_at.desc())
            .limit(10)
            .all()
        )
        appids_for_frontend = [
            tuple((app.app_id, app.last_updated_at))
            for app in appids
            if db.is_appid_for_frontend(app.app_id)
        ]

    apps = [
        (db.get_json_key(f"apps:{appid[0]}"), appid[1]) for appid in appids_for_frontend
    ]

    for app, timestamp in reversed(apps):
        # sanity check: if index includes an app, but apps:ID is null, skip it
        if not app:
            continue

        # sanity check: if application doesn't have the name field, skip it
        if not app.get("name"):
            continue

        entry = feed.add_entry()
        entry.title(app["name"])
        entry.link(href=f"https://flathub.org/apps/{app['id']}")

        entry_date = timestamp.strftime("%a, %d %b %Y %H:%M:%S")
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
                if image := list(screenshot["sizes"].values())[0]:
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


def get_recently_updated_apps_feed_postgres():
    return generate_feed_postgres(
        "recently_updated",
        "Flathub – recently updated applications",
        "Recently updated applications published on Flathub",
        "https://flathub.org/apps/collection/recently-updated",
    )


def get_new_apps_feed_postgres():
    return generate_feed_postgres(
        "new_apps",
        "Flathub – recently added applications",
        "Applications recently published on Flathub",
        "https://flathub.org/apps/collection/new",
    )
