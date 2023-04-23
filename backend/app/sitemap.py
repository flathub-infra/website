from . import apps, db, schemas


def generate_text(frontend_url="flathub.org"):
    redis_key = "sitemap_text"

    if sitemap := db.redis_conn.get(redis_key):
        return sitemap

    pages = [
        "/about",
        "/apps",
        "/apps/collection/popular",
        "/apps/collection/recently-updated",
        "/apps/collection/recently-added",
        "/apps/collection/verified",
        "/badges",
        "/feeds",
        "/privacy-policy",
        "/statistics",
        "/terms-and-conditions",
        "/languages",
        "/login",
    ]

    languages = [
        "en-GB",
        "en",
        "de",
        "fr",
        "nb-NO",
        "tr",
        "fi",
        "id",
        "it",
        "pl",
        "pt-BR",
        "ru",
        "si",
        "vi",
        "ar",
        "es",
        "ja",
        "cs",
        "zh-Hans",
        "bg",
        "uk",
        "et",
        "ca",
        "el",
        "ta",
        "fa",
        "hi",
        "bn",
        "eo",
        "lt",
        "hr",
        "be",
        "hu",
        "nl",
        "pt",
        "zh-Hant",
        "oc",
    ]

    applications = [f"/apps/{appid}" for appid in apps.list_appstream()]

    categories = [
        f"/apps/category/{category}" for category in schemas.get_main_categories()
    ]

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

    # Google doesn't accept sitemaps longer than 50k lines
    sitemap = sitemap[0:50001]
    db.redis_conn.setex(redis_key, 60 * 60 * 24, sitemap)
    return sitemap
