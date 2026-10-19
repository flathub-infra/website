import json
import logging
from dataclasses import asdict
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from .. import config, models
from ..database import get_db
from ..types import ModerationRequestType
from . import permission_assessment as assessment
from .constants import should_skip_review
from .ostree_permissions import runtime_permissions
from .permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionSnapshot,
    PermissionSnapshotError,
    compare_snapshots,
    fingerprint_snapshot,
)

logger = logging.getLogger(__name__)


def mode_for(repo: str | None) -> str:
    mode = config.settings.permission_publication_mode
    return mode if repo in ("stable", "beta") else "off"


def _refs(build_extended: dict[str, Any]) -> list[list[str]]:
    parts = (ref["ref_name"].split("/") for ref in build_extended["build_refs"])
    return [p for p in parts if len(p) == 4 and p[0] == "app"]


def advance_baseline(session, app_id: str, values: dict[str, Any]) -> None:
    values = {**values, "source": "approved", "captured_at": func.now()}
    session.execute(
        insert(models.PermissionBaseline)
        .values(app_id=app_id, **values)
        .on_conflict_do_update(
            index_elements=["app_id", "channel", "flatpak_branch"],
            set_={**values, "created_at": func.now()},
        )
    )


def _linked_push(build_id: int, app_id: str, channel: str):
    observation = models.PermissionAssessmentObservation
    with get_db("writer") as db:
        return db.session.execute(
            select(
                observation.fingerprint,
                observation.acceptance_basis,
                observation.pull_request_url,
                observation.linked_assessment_id,
            )
            .where(
                observation.candidate_kind == "push",
                observation.build_id == build_id,
                observation.app_id == app_id,
                observation.intended_channel == channel,
                observation.pull_request_url.isnot(None),
                observation.canonicalization_version == CANONICALIZATION_VERSION,
            )
            .order_by(observation.id.desc())
            .limit(1)
        ).first()


def _baseline_values(channel: str, candidate) -> dict[str, Any]:
    return {
        "channel": channel,
        "flatpak_branch": candidate.flatpak_branch,
        "repository_url": candidate.repository_url,
        "canonicalization_version": candidate.snapshot.canonicalization_version,
        "artifacts": [asdict(item) for item in candidate.artifacts],
        "snapshot": asdict(candidate.snapshot),
        "fingerprint": fingerprint_snapshot(candidate.snapshot),
    }


def advance_published(build_id: int, channel: str, app_ids: set[str]) -> None:
    mode = mode_for(channel)
    for app_id in sorted(app_ids):
        if mode == "off" or should_skip_review(app_id):
            continue
        try:
            with get_db("replica") as db:
                direct_upload = models.DirectUploadApp.by_app_id(db, app_id)
            if direct_upload or (
                channel != "stable" and not _linked_push(build_id, app_id, channel)
            ):
                continue
            candidate = assessment.collect_final_candidate(
                build_id, app_id, channel, None, [], []
            )
            with get_db("writer") as db:
                advance_baseline(
                    db.session, app_id, _baseline_values(channel, candidate)
                )
        except Exception:
            logger.exception("Could not advance permission baseline: %s", app_id)


def _existing_request(build_id: int, job_id: int, app_id: str):
    request = models.ModerationRequest
    with get_db("writer") as db:
        return db.session.execute(
            select(request.is_approved).where(
                request.appid == app_id,
                request.build_id == build_id,
                request.job_id == job_id,
                request.request_type == ModerationRequestType.PERMISSIONS,
            )
        ).first()


def _evaluate(
    build_id: int, app_id: str, channel: str, build_extended: dict[str, Any], push
) -> dict[str, Any] | None:
    arches = sorted({p[2] for p in _refs(build_extended) if p[1] == app_id})
    linked = push.linked_assessment_id
    data: dict[str, Any] = {
        "channel": channel,
        "flatpak_branch": None,
        "comparison_source": None,
        "candidate_fingerprint": None,
        "comparison_fingerprint": None,
        "differences": [],
        "error_code": None,
        "error_message": None,
        "linked_assessment_id": linked,
        "linked_review_url": linked and assessment.review_url(linked),
        "pull_request_url": push.pull_request_url,
    }
    try:
        candidate = assessment.collect_final_candidate(
            build_id, app_id, channel, arches, [], []
        )
        approved = _baseline_values(channel, candidate)
        fingerprint = approved["fingerprint"]
        data.update(
            flatpak_branch=candidate.flatpak_branch,
            candidate_fingerprint=fingerprint,
            approved_baseline=approved,
        )
        baseline = assessment._stored_baseline(
            app_id, channel, candidate.flatpak_branch
        )
        if baseline is not None:
            if baseline["fingerprint"] == fingerprint:
                return None
            before = PermissionSnapshot(**baseline["snapshot"])
            differences = [
                asdict(d)
                for d in compare_snapshots(
                    before, candidate.snapshot, runtime_permissions(candidate.runtime)
                )
            ]
            if not differences:
                return None
            data.update(
                comparison_source="baseline",
                comparison_fingerprint=baseline["fingerprint"],
                differences=differences,
            )
        if (push.fingerprint, push.acceptance_basis) == (
            fingerprint,
            "permission_decision",
        ) or assessment.cross_channel_basis(app_id, channel, fingerprint):
            return None
    except PermissionSnapshotError as exc:
        data.update(error_code=exc.code, error_message=exc.message)
    except HTTPException as exc:
        data.update(error_code="collection_failed", error_message=str(exc.detail))
    return data


def check_build(
    *,
    build_id: int,
    job_id: int,
    repo: str,
    build_extended: dict[str, Any],
    build_log_url: str | None,
) -> tuple[list[models.ModerationRequest], set[str], bool]:
    mode = mode_for(repo)
    requests, handled, held = [], set(), False
    app_ids = sorted({p[1] for p in _refs(build_extended)}) if mode != "off" else []
    for app_id in filter(lambda app_id: not should_skip_review(app_id), app_ids):
        try:
            push = _linked_push(build_id, app_id, repo)
            if push is None:
                continue
            if (existing := _existing_request(build_id, job_id, app_id)) is not None:
                handled.add(app_id)
                held = held or not existing.is_approved
                continue
            data = _evaluate(build_id, app_id, repo, build_extended, push)
        except Exception:
            if mode == "enforce":
                raise
            logger.exception("Publication permission check failed: %s", app_id)
            continue
        logger.info("Publication permissions %s: review=%s", app_id, data is not None)
        if mode != "enforce":
            continue
        handled.add(app_id)
        if data is not None:
            requests.append(
                models.ModerationRequest(
                    appid=app_id,
                    request_type=ModerationRequestType.PERMISSIONS,
                    request_data=json.dumps(data),
                    is_new_submission=False,
                    is_observation=False,
                    is_outdated=False,
                    build_id=build_id,
                    job_id=job_id,
                    build_log_url=build_log_url,
                    app_refs=sorted(
                        "/".join(p) for p in _refs(build_extended) if p[1] == app_id
                    ),
                )
            )
    return requests, handled, held
