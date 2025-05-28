from fastapi import APIRouter, FastAPI, Response
from feedgen.feed import FeedGenerator

from .. import models
from ..database import get_db

router = APIRouter(prefix="/feed")


def register_to_app(app: FastAPI):
    app.include_router(router)


@router.get("/recently-updated", tags=["feed"])
def get_recently_updated_apps_feed():
    feed = generate_feed(
        "last_updated_at",
        "Flathub – recently updated applications",
        "Recently updated applications published on Flathub",
        "https://flathub.org/apps/collection/recently-updated",
    )

    return Response(
        content=feed,
        media_type="application/rss+xml",
    )


@router.get("/new", tags=["feed"])
def get_new_apps_feed():
    feed = generate_feed(
        "initial_release_at",
        "Flathub – recently added applications",
        "Applications recently published on Flathub",
        "https://flathub.org/apps/collection/new",
    )
    return Response(
        content=feed,
        media_type="application/rss+xml",
    )


def generate_feed(column_name: str, title: str, description: str, link: str):
    feed = FeedGenerator()
    feed.title(title)
    feed.description(description)
    feed.link(href=link)
    feed.language("en")

    column = getattr(models.App, column_name)

    with get_db("replica") as sqldb:
        apps_query = (
            sqldb.query(models.App)
            .filter(column.isnot(None))
            .order_by(column.desc())
            .limit(20)
        )

        apps_data = []
        batch_size = 0

        for app in apps_query:
            # this duplicates is_appid_for_frontend but avoids N+1 queries
            if app.type == "desktop-application":
                apps_data.append((app.app_id, getattr(app, column_name), app.appstream))
                batch_size += 1
            elif (
                app.type == "console-application"
                and app.appstream
                and app.appstream.get("icon")
                and app.appstream.get("screenshots")
            ):
                apps_data.append((app.app_id, getattr(app, column_name), app.appstream))
                batch_size += 1

            if batch_size >= 10:
                break

    apps = [(app_data[2], app_data[1]) for app_data in apps_data]

    for app, timestamp in reversed(apps):
        # sanity check: if index includes an app, but appstream data is null, skip it
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

        if license := app.get("project_license"):
            content.append(f"<li>License: {license}</li>")

        if app_releases := app.get("releases"):
            release = app_releases[0] if len(app_releases) else None
            if release:
                if version := release.get("version"):
                    content.append(f"<li>Version: {version}")

        content.append("</ul>")

        if screenshots := app.get("screenshots"):
            screenshots = screenshots[0:3]

            for screenshot in screenshots:
                if image := screenshot["sizes"][0].get("src"):
                    content.append(f'<img src="{image}">')

        entry.description("".join(content))

    return feed.rss_str()
