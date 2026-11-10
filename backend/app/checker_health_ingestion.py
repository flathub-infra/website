import io
import json
import logging
import re
import zipfile
from collections.abc import Iterator
from typing import TypedDict

import httpx
from pydantic import JsonValue
from sqlalchemy.dialects.postgresql import insert

from . import models
from .checker_health import CheckerReport, report_branches, source_identity, utc
from .config import settings
from .database import get_db
from .db_session import DBSession

logger = logging.getLogger(__name__)
API = "https://api.github.com/repos/flathub/flathub"
ARTIFACT_NAME = re.compile(r"checker-health-(\d+)-(\d+)(?:-\d+)?$")
REPORT_NAME = re.compile(r"[A-Za-z0-9_-][A-Za-z0-9._-]*\.json$")
MAX_ARCHIVE_SIZE = 64 * 1024 * 1024
MAX_REPORT_SIZE = 16 * 1024 * 1024
MAX_EXPANDED_SIZE = 256 * 1024 * 1024


class ArtifactWorkflowRun(TypedDict):
    id: int
    head_repository_id: int


class CheckerArtifact(TypedDict):
    id: int
    name: str
    expired: bool
    workflow_run: ArtifactWorkflowRun


class ArtifactPage(TypedDict):
    total_count: int
    artifacts: list[CheckerArtifact]


type ParsedReports = dict[str, tuple[CheckerReport, dict[str, JsonValue]]]


def list_artifacts(client: httpx.Client) -> Iterator[CheckerArtifact]:
    page = 1
    while True:
        response = client.get(
            f"{API}/actions/artifacts", params={"per_page": 100, "page": page}
        )
        response.raise_for_status()
        body: ArtifactPage = response.json()
        artifacts = body["artifacts"]
        for artifact in artifacts:
            match = ARTIFACT_NAME.fullmatch(artifact["name"])
            if (
                match
                and not artifact["expired"]
                and int(match[1]) == artifact["workflow_run"]["id"]
                and artifact["workflow_run"]["head_repository_id"] == 88860262
            ):
                yield artifact
        if not artifacts or page * 100 >= body["total_count"]:
            return
        page += 1


def download_archive(client: httpx.Client, artifact_id: int) -> bytes:
    # httpx strips Authorization when following the cross-origin storage redirect.
    with client.stream(
        "GET", f"{API}/actions/artifacts/{artifact_id}/zip", follow_redirects=True
    ) as response:
        response.raise_for_status()
        content = bytearray()
        for chunk in response.iter_bytes():
            content.extend(chunk)
            if len(content) > MAX_ARCHIVE_SIZE:
                raise ValueError("Checker artifact exceeds download limit")
        return bytes(content)


def parse_archive(content: bytes) -> ParsedReports:
    reports: ParsedReports = {}
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if sum(entry.file_size for entry in entries) > MAX_EXPANDED_SIZE:
            raise ValueError("Checker artifact exceeds expanded size limit")
        for entry in entries:
            if entry.is_dir():
                continue
            if (
                not REPORT_NAME.fullmatch(entry.filename)
                or entry.file_size > MAX_REPORT_SIZE
            ):
                raise ValueError("Invalid checker report entry")
            app_id = entry.filename.removesuffix(".json")
            if app_id in reports:
                raise ValueError("Duplicate app report")
            raw: dict[str, JsonValue] = json.loads(archive.read(entry))
            report = CheckerReport.model_validate(raw)
            if utc(report.finished_at) < utc(report.started_at):
                raise ValueError("Invalid checker report timestamps")
            keys = [
                source_identity(branch.branch, source)
                for branch in report_branches(report)
                for source in branch.sources
                if source.source_pointer is not None
            ]
            if len(keys) != len(set(keys)):
                raise ValueError("Duplicate checker source location")
            reports[app_id] = (report, raw)
    if not reports:
        raise ValueError("Empty checker artifact")
    return reports


def store_artifact(
    db: DBSession, artifact: CheckerArtifact, reports: ParsedReports
) -> None:
    match = ARTIFACT_NAME.fullmatch(artifact["name"])
    if match is None:
        raise ValueError("Invalid checker artifact name")
    attempt = int(match[2])
    inserted = db.session.execute(
        insert(models.CheckerHealthArtifact)
        .values(
            artifact_id=artifact["id"],
            run_id=artifact["workflow_run"]["id"],
            run_attempt=attempt,
        )
        .on_conflict_do_nothing()
        .returning(models.CheckerHealthArtifact.artifact_id)
    ).scalar_one_or_none()
    if inserted is None:
        return
    for app_id, (report, raw) in reports.items():
        db.session.add(
            models.CheckerHealthObservation(
                artifact_id=artifact["id"],
                app_id=app_id,
                run_id=artifact["workflow_run"]["id"],
                run_attempt=attempt,
                observed_at=utc(report.finished_at).replace(tzinfo=None),
                report=raw,
            )
        )


def refresh_checker_health() -> None:
    if not settings.github_bot_token:
        logger.warning(
            "Checker health ingestion requires GITHUB_BOT_TOKEN with Actions read access"
        )
        return
    with httpx.Client(
        headers={
            "Authorization": f"Bearer {settings.github_bot_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=60,
    ) as client:
        # Always scan every page: unrelated artifacts can push checks far back.
        artifacts = list(list_artifacts(client))
        with get_db("writer") as db:
            imported = {
                row.artifact_id
                for row in db.session.query(
                    models.CheckerHealthArtifact.artifact_id,
                ).all()
            }
        failed = 0
        for artifact in sorted(artifacts, key=lambda a: a["id"]):
            if artifact["id"] in imported:
                continue
            try:
                reports = parse_archive(download_archive(client, artifact["id"]))
                with get_db("writer") as db:
                    store_artifact(db, artifact, reports)
                imported.add(artifact["id"])
            except (httpx.HTTPError, ValueError, KeyError, zipfile.BadZipFile):
                logger.exception("Could not ingest checker artifact %s", artifact["id"])
                failed += 1
        if failed:
            raise RuntimeError(f"Failed to ingest {failed} checker artifacts")
