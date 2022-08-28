from . import apps, db


def generate_text(frontend_url="beta.flathub.org"):
    redis_key = "sitemap_text"

    if sitemap := db.redis_conn.get(redis_key):
        return sitemap

    pages = [
        "/about",
        "/apps",
        "/apps/collection/editors-choice-apps",
        "/apps/collection/editors-choice-games",
        "/apps/collection/popular",
        "/apps/collection/recently-updated",
        "/badges",
        "/feeds",
        "/privacy-policy",
        "/statistics",
        "/terms-and-conditions",
        "/languages",
    ]

    languages = [
        "en_GB",
        "en",
        "de",
        "fr",
        "nb_NO",
        "tr",
        "fi",
        "id",
        "it",
        "pl",
        "pt_BR",
        "ru",
        "si",
        "vi",
        "ar",
        "es",
        "ja",
        "cs",
        "zh_Hans",
        "bg",
        "uk",
        "et",
        "ca",
        "el",
        "ta",
    ]

    applications = [f"/apps/details/{appid}" for appid in apps.list_appstream()]

    categories = [f"/apps/category/{category}" for category in db.get_categories()]

    developers = [
        f"/apps/collection/developer/{developer}" for developer in db.get_developers()
    ]

    projectgroups = [
        f"/apps/collection/project-group/{projectgroup}"
        for projectgroup in db.get_project_groups()
    ]

    sitemap = "\n".join(
        sorted(
            f"https://{frontend_url}{page}"
            for page in pages + applications + projectgroups + developers + categories
        )
    )
    sitemap += "\n"

    for language in languages:
        sitemap += "\n".join(
            sorted(
                f"https://{frontend_url}/{language}{page}"
                for page in pages
                + applications
                + projectgroups
                + developers
                + categories
            )
        )
        sitemap += "\n"

    db.redis_conn.setex(redis_key, 60 * 60 * 24, sitemap)
    return sitemap
