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
from .checker_selection import SELECTION_NAME, parse_selection
from .config import settings
from .database import get_db
from .db_session import DBSession

logger = logging.getLogger(__name__)
API = "https://api.github.com/repos/flathub/flathub"
ARTIFACT_NAME = re.compile(r"checker-health-(\d+)-(\d+)(?:-(\d+))?$")
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


type ParsedReports = dict[str, tuple[CheckerReport, dict[str, JsonValue]] | None]


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
            selection = SELECTION_NAME.fullmatch(artifact["name"])
            match = ARTIFACT_NAME.fullmatch(artifact["name"]) or selection
            if (
                match
                and (not artifact["expired"] or selection)
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
    if len(content) > MAX_ARCHIVE_SIZE:
        raise ValueError("Checker artifact exceeds download limit")
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        entries = archive.infolist()
        if (
            len(entries) > 20000
            or sum(entry.file_size for entry in entries) > MAX_EXPANDED_SIZE
        ):
            raise ValueError("Checker artifact exceeds expanded size limit")
        for entry in entries:
            if (
                entry.is_dir()
                or entry.flag_bits & 1
                or entry.compress_type not in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED)
                or not REPORT_NAME.fullmatch(entry.filename)
                or entry.file_size > MAX_REPORT_SIZE
            ):
                raise ValueError("Invalid checker report entry")
            app_id = entry.filename.removesuffix(".json")
            if app_id in reports:
                raise ValueError("Duplicate app report")
            content = archive.read(entry)
            try:
                raw: dict[str, JsonValue] = json.loads(content)
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
            except ValueError:
                logger.warning("Invalid or unsupported checker report: %s", app_id)
                reports[app_id] = None
            else:
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
            shard_index=int(match[3]) if match[3] is not None else None,
            rejected_reports=[
                app_id for app_id, report in reports.items() if report is None
            ],
        )
        .on_conflict_do_nothing()
        .returning(models.CheckerHealthArtifact.artifact_id)
    ).scalar_one_or_none()
    if inserted is None:
        return
    for app_id, parsed in reports.items():
        if parsed is None:
            continue
        report, raw = parsed
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


def refresh_selection(
    db: DBSession, client: httpx.Client, artifact: CheckerArtifact, completed: bool
) -> None:
    match = SELECTION_NAME.fullmatch(artifact["name"])
    assert match is not None
    row = db.session.get(models.CheckerSelectionArtifact, artifact["id"])
    if row is None:
        row = models.CheckerSelectionArtifact(
            artifact_id=artifact["id"],
            run_id=int(match[1]),
            run_attempt=int(match[2]),
            shard_index=int(match[3]),
            state="pending",
        )
        db.session.add(row)
    row.run_completed = completed
    if row.state == "available":
        return
    if artifact["expired"]:
        row.state = "expired"
        return
    try:
        inventory, listing, decisions = parse_selection(
            download_archive(client, artifact["id"]), artifact["name"]
        )
    except (ValueError, KeyError, zipfile.BadZipFile):
        row.state = "invalid_or_unsupported"
        logger.exception("Invalid checker selection artifact %s", artifact["id"])
        return
    row.inventory, row.listing, row.decisions = inventory, listing, decisions
    row.state = "available"


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
            for artifact in artifacts:
                selection = SELECTION_NAME.fullmatch(artifact["name"])
                if selection:
                    db.session.execute(
                        insert(models.CheckerSelectionArtifact)
                        .values(
                            artifact_id=artifact["id"],
                            run_id=int(selection[1]),
                            run_attempt=int(selection[2]),
                            shard_index=int(selection[3]),
                            state="expired" if artifact["expired"] else "pending",
                            run_completed=False,
                        )
                        .on_conflict_do_nothing()
                    )
                else:
                    match = ARTIFACT_NAME.fullmatch(artifact["name"])
                    if match and match[3] is not None:
                        db.session.query(models.CheckerHealthArtifact).filter_by(
                            artifact_id=artifact["id"],
                            shard_index=None,
                        ).update({"shard_index": int(match[3])})
            imported = {
                row.artifact_id
                for row in db.session.query(
                    models.CheckerHealthArtifact.artifact_id,
                ).all()
            }
        failed = 0
        completed_attempts: dict[tuple[int, int], bool] = {}
        for artifact in sorted(artifacts, key=lambda a: a["id"]):
            if artifact["id"] in imported:
                continue
            try:
                selection = SELECTION_NAME.fullmatch(artifact["name"])
                if selection:
                    identity = (int(selection[1]), int(selection[2]))
                    if identity not in completed_attempts:
                        response = client.get(
                            f"{API}/actions/runs/{identity[0]}/attempts/{identity[1]}"
                        )
                        response.raise_for_status()
                        body = response.json()
                        if (body["id"], body["run_attempt"]) != identity:
                            raise ValueError("Workflow attempt mismatch")
                        completed_attempts[identity] = body["status"] == "completed"
                    with get_db("writer") as db:
                        refresh_selection(
                            db, client, artifact, completed_attempts[identity]
                        )
                    continue
                reports = parse_archive(download_archive(client, artifact["id"]))
                with get_db("writer") as db:
                    store_artifact(db, artifact, reports)
                imported.add(artifact["id"])
            except (httpx.HTTPError, ValueError, KeyError, zipfile.BadZipFile):
                logger.exception("Could not ingest checker artifact %s", artifact["id"])
                failed += 1
        if failed:
            raise RuntimeError(f"Failed to ingest {failed} checker artifacts")
