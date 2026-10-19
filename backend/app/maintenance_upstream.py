import logging
from collections import defaultdict
from datetime import UTC, datetime

import httpx

from . import models
from .database import get_db
from .upstream import EXCLUDED_APPS, AnityaClient

logger = logging.getLogger(__name__)


def observe(client, app_id, source, mappings):
    matches = [m for m in mappings if m["name"].casefold() == app_id.casefold()]
    if not matches:
        return {
            "status": "unmapped",
            "project_id": None,
            "stable_versions": [],
            "upstream_version": None,
        }
    if len(matches) != 1 or matches[0]["name"] != app_id:
        raise ValueError("Conflicting Flathub mappings")
    mapping = matches[0]
    owners = {
        m["name"].casefold()
        for m in mappings
        if (m["project"], m["ecosystem"]) == (mapping["project"], mapping["ecosystem"])
    }
    if len(owners) != 1:
        raise ValueError("Shared Flathub release stream")
    project_id, versions = client.project(mapping, app_id, source)
    return {
        "status": "ok",
        "project_id": project_id,
        "stable_versions": versions,
        "upstream_version": versions[0] if versions else None,
    }


def store_observation(db, app_id, source, observation, now):
    row = db.session.get(models.MaintenanceUpstream, app_id)
    if row is None:
        row = models.MaintenanceUpstream(app_id=app_id, stable_versions=[])
        db.session.add(row)
    row.last_attempt_at = now
    row.status = observation["status"]
    if row.status != "error":
        row.checked_at = now
        row.source_url = source
        row.project_id = observation["project_id"]
        row.stable_versions = observation["stable_versions"]
        row.upstream_version = observation["upstream_version"]
    # Failed reads preserve the last successful observation without renewing it.


def refresh_maintenance_upstream():
    with get_db("writer") as db:
        query = db.session.query(
            models.App.app_id,
            models.App.appstream["urls"]["vcs_browser"].as_string().label("source"),
        )
        query = query.filter(
            models.App.type.in_(
                ("desktop", "desktop-application", "console-application")
            )
        )
        apps = [
            (a.app_id, a.source)
            for a in query.all()
            if a.app_id.casefold() not in {v.casefold() for v in EXCLUDED_APPS}
        ]
    client = AnityaClient()
    counts = defaultdict(int)
    try:
        try:
            mappings = client.mappings()
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            mappings = None
            logger.warning(
                "Anitya mapping refresh failed; existing evidence will not be renewed"
            )
        for app_id, source in apps:
            now = datetime.now(UTC).replace(tzinfo=None)
            try:
                if mappings is None:
                    raise ValueError("Mapping catalog unavailable")
                observation = observe(client, app_id, source, mappings)
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                observation = {"status": "error"}
                logger.warning("Anitya evidence unavailable for %s", app_id)
            with get_db("writer") as db:
                store_observation(db, app_id, source, observation, now)
            counts[observation["status"]] += 1
    finally:
        client.close()
    logger.info("Anitya maintenance refresh: %s", dict(counts))
