"""Read-only Anitya evidence. Unknown versions are not an outdated verdict."""

import re
import time
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, PrivateAttr

ANITYA = "https://release-monitoring.org"
EXCLUDED_APPS = {
    "org.kde.okular.kirigami",
    "io.github.martinrotter.rssguardlite",
    "org.gnome.Crosswords.Editor",
}


def repository_url(value):
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value)
        if (
            url.scheme not in ("https", "http")
            or not url.hostname
            or url.username
            or url.password
        ):
            return None
        return (
            url.scheme,
            url.netloc.lower(),
            url.path.rstrip("/"),
            url.query,
            url.fragment,
        )
    except ValueError:
        return None


def numeric_version(value):
    # Do not guess at epochs, distro suffixes, git hashes or prerelease syntax.
    if (
        not isinstance(value, str)
        or len(value) > 100
        or not re.fullmatch(r"v?[0-9]+(?:\.[0-9]+){0,5}", value)
    ):
        return None
    parts = tuple(int(part) for part in value.removeprefix("v").split("."))
    return parts + (0,) * (6 - len(parts))


def compare_releases(packaged, stable_versions):
    """Only compare known stable numeric releases in the same version family."""
    current = numeric_version(packaged)
    if current is None or not isinstance(stable_versions, list) or not stable_versions:
        return None
    latest = stable_versions[0]
    upstream = numeric_version(latest)
    known = {numeric_version(version) for version in stable_versions}
    # Require Anitya to recognize the packaged version as a stable release.
    # This also avoids comparing prerelease streams or mismatched schemes.
    if (
        upstream is None
        or current not in known
        or (current[0] >= 1900) != (upstream[0] >= 1900)
    ):
        return None
    return latest, upstream > current


class UpstreamEvidence(BaseModel):
    # Internal comparison eligibility is independent of polling freshness and
    # failures. It is not part of the API response or OpenAPI schema.
    _comparison_eligible: bool = PrivateAttr(default=False)

    project_id: int | None = None
    project_url: str | None = None
    packaged_version: str | None = None
    upstream_version: str | None = None
    checked_at: datetime | None = None
    last_attempt_at: datetime
    status: str


def release_evidence(row, releases, source, branch, now):
    if row is None:
        return None
    packaged = None
    if isinstance(releases, list) and releases and isinstance(releases[0], dict):
        release = releases[0]
        if release.get("type", "stable") == "stable":
            packaged = release.get("version")
            if not isinstance(packaged, str):
                packaged = None
    result = UpstreamEvidence(
        project_id=row.project_id,
        project_url=f"{ANITYA}/project/{row.project_id}/" if row.project_id else None,
        packaged_version=packaged,
        upstream_version=row.upstream_version,
        checked_at=row.checked_at,
        last_attempt_at=row.last_attempt_at,
        status=row.status,
    )
    comparison = (
        compare_releases(packaged, row.stable_versions)
        if branch == "stable"
        and repository_url(source)
        and repository_url(source) == repository_url(row.source_url)
        else None
    )
    result._comparison_eligible = comparison is not None
    if row.status != "ok":
        return result
    now = now.replace(tzinfo=UTC) if now.tzinfo is None else now.astimezone(UTC)
    checked = row.checked_at
    if checked is None or now - (
        checked.replace(tzinfo=UTC) if checked.tzinfo is None else checked
    ) > timedelta(days=3):
        result.status = "stale"
    elif comparison is not None:
        result.upstream_version, newer = comparison
        result.status = "newer" if newer else "current"
    else:
        result.status = "unknown"
    return result


class AnityaClient:
    """No credentials, redirects or writes. Bound retries to transient GETs."""

    def __init__(self):
        self.client = httpx.Client(
            timeout=20,
            follow_redirects=False,
            headers={
                "User-Agent": "flathub-maintenance/1.0",
                "Accept": "application/json",
            },
        )

    def close(self):
        self.client.close()

    def get(self, path, params=None):
        for attempt in range(3):
            response = self.client.get(ANITYA + path, params=params)
            if response.status_code in (502, 503, 504) and attempt < 2:
                time.sleep(2**attempt)
                continue
            response.raise_for_status()
            time.sleep(0.5)
            return response.json()
        raise ValueError("Anitya GET retries exhausted")

    def mappings(self):
        rows, total, page = [], None, 1
        while total is None or len(rows) < total:
            data = self.get(
                "/api/v2/packages/",
                {"distribution": "Flathub", "items_per_page": 250, "page": page},
            )
            if (
                type(data.get("total_items")) is not int
                or data["total_items"] < 0
                or not isinstance(data.get("items"), list)
            ):
                raise ValueError("Invalid Anitya mapping pagination")
            if total is not None and total != data["total_items"]:
                raise ValueError("Anitya mapping catalog changed during pagination")
            total = data["total_items"]
            if not data["items"] and len(rows) < total:
                raise ValueError("Incomplete Anitya mapping catalog")
            rows.extend(data["items"])
            page += 1
        if len(rows) != total or any(
            not isinstance(row, dict)
            or row.get("distribution") != "Flathub"
            or not all(
                isinstance(row.get(key), str) and row[key]
                for key in ("name", "project", "ecosystem")
            )
            for row in rows
        ):
            raise ValueError("Invalid Anitya mapping catalog")
        return rows

    def project(self, mapping, app_id, source):
        identity = self.get(
            "/api/v2/projects/",
            {"name": mapping["project"], "ecosystem": mapping["ecosystem"]},
        )
        if identity["total_items"] != 1 or len(identity["items"]) != 1:
            raise ValueError("Ambiguous Anitya project identity")
        project_id = identity["items"][0]["id"]
        if type(project_id) is not int or project_id <= 0:
            raise ValueError("Invalid Anitya project ID")
        project = self.get(f"/api/project/{project_id}")
        if (
            project.get("id") != project_id
            or project.get("name") != mapping["project"]
            or project.get("ecosystem") != mapping["ecosystem"]
            # Public Anitya responses currently omit this optional flag.
            or project.get("archived") is True
        ):
            raise ValueError("Changed or archived Anitya identity")
        if not repository_url(source) or not any(
            repository_url(source) == repository_url(project.get(key))
            for key in ("homepage", "version_url", "ecosystem")
        ):
            raise ValueError("No exact source-repository evidence")
        if not isinstance(project.get("packages"), list):
            raise TypeError("Missing Anitya package ownership evidence")
        if not all(isinstance(p, dict) for p in project["packages"]):
            raise TypeError("Invalid Anitya package ownership evidence")
        if any(
            p.get("distro", "").casefold() == "flathub"
            and p.get("package_name", "").casefold() != app_id.casefold()
            for p in project["packages"]
        ):
            raise ValueError("Shared Anitya release stream")
        if not any(
            p.get("distro") == "Flathub" and p.get("package_name") == app_id
            for p in project["packages"]
        ):
            raise ValueError("Flathub mapping no longer belongs to this project")
        versions = project.get("stable_versions")
        if not isinstance(versions, list) or not all(
            isinstance(v, str) and len(v) <= 100 for v in versions
        ):
            raise ValueError("Missing or invalid stable releases")
        return project_id, versions
