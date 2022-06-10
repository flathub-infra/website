from . import apps, db


def generate_text(frontend_url="beta.flathub.org"):
    redis_key = "sitemap_text"

    if sitemap := db.redis_conn.get(redis_key):
        return sitemap

    pages = [
        "/about",
        "/apps",
        "/apps/collection/editors-choice-apps",
        "/apps/collection/editors-choice-apps",
        "/apps/collection/editors-choice-games",
        "/apps/collection/popular",
        "/apps/collection/recently-updated",
        "/badges",
        "/feeds",
        "/privacy-policy",
        "/statistics",
        "/terms-and-conditions",
    ]

    applications = [f"/apps/details/{appid}" for appid in apps.list_appstream()]
    projectgroups = [
        f"/apps/collection/project-group/{projectgroup}"
        for projectgroup in db.get_project_groups()
    ]

    sitemap = "\n".join(
        sorted(
            f"https://{frontend_url}{page}"
            for page in pages + applications + projectgroups
        )
    )
    db.redis_conn.setex(redis_key, 60 * 60 * 24, sitemap)
    return sitemap
