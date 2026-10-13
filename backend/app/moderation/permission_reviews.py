from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, model_validator
from sqlalchemy import exists, func, select, update
from sqlalchemy.orm import aliased

from .. import audit_log, models
from ..database import get_db
from ..login_info import ModeratorDep
from . import permission_assessment as assessment

router = APIRouter(prefix="/moderation/permission-reviews", tags=["moderation"])

PR_CANDIDATE_KINDS = ("head", "merge")


class PermissionReviewSummary(BaseModel):
    assessment_id: int
    app_id: str
    created_at: datetime
    outcome: Literal["accepted", "pending", "rejected", "error"]
    acceptance_basis: Literal["baseline", "permission_decision"] | None
    candidate_kind: str
    forge_instance: str
    source_repository: str
    pull_request_number: int | None
    pull_request_url: str | None
    target_git_branch: str
    destination_channel: str
    flatpak_branch: str
    difference_count: int | None
    review_finding_count: int
    superseded_by: int | None


class PermissionDecisionEntry(BaseModel):
    id: int
    created_at: datetime
    decision: Literal["approved", "rejected"]
    rationale: str | None
    reviewer_id: int
    reviewer_name: str | None
    fingerprint: str
    assessment_id: int
    applies: bool


class PermissionReviewDetail(PermissionReviewSummary):
    review_url: str
    pipeline_id: str
    build_id: int
    built_revision: str
    pull_request_head_revision: str | None
    base_revision: str
    expected_arches: list[str]
    snapshot_fingerprint: str | None
    comparison_fingerprint: str | None
    comparison_source: Literal["baseline", "published"] | None
    candidate_artifacts: list[dict[str, Any]]
    comparison_artifacts: list[dict[str, Any]]
    candidate_snapshot: dict[str, Any] | None
    comparison_snapshot: dict[str, Any] | None
    differences: list[dict[str, Any]] | None
    review_findings: list[dict[str, Any]]
    linter_reports_present: bool
    build_checks: list[dict[str, Any]]
    error_code: str | None
    error_message: str | None
    linked_assessment_id: int | None
    decision_id: int | None
    decisions: list[PermissionDecisionEntry]


class PermissionDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    fingerprint: str
    rationale: str | None = None

    @model_validator(mode="after")
    def check_rationale(self):
        if self.decision == "rejected" and not (self.rationale or "").strip():
            raise ValueError("A rejection requires a rationale")
        return self


def _findings(row: models.PermissionAssessmentObservation) -> list[dict[str, Any]]:
    keys = ("rule_code", "explanation", "affected_permissions", "ref")
    return [
        {"kind": entry["kind"], "arch": entry["arch"]}
        | {key: finding[key] for key in keys}
        for entry in row.linter_reports
        for finding in entry["report"]["review_findings"]
    ]


def _fields(session, row: models.PermissionAssessmentObservation) -> dict[str, Any]:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns} | {
        "assessment_id": row.id,
        "destination_channel": row.intended_channel,
        "difference_count": None if row.differences is None else len(row.differences),
        "review_finding_count": len(_findings(row)),
        "superseded_by": assessment.superseded_by(session, row),
    }


def _detail(
    session, row: models.PermissionAssessmentObservation
) -> PermissionReviewDetail:
    decision = models.PermissionDecision
    source = aliased(models.PermissionAssessmentObservation)
    decisions = session.execute(
        select(decision, source, models.FlathubUser.display_name)
        .join(source, source.id == decision.assessment_id)
        .join(models.FlathubUser, models.FlathubUser.id == decision.reviewer_id)
        .where(
            source.app_id == row.app_id,
            source.forge_instance == row.forge_instance,
            source.source_repository == row.source_repository,
            source.pull_request_number == row.pull_request_number,
        )
        .order_by(decision.id.desc())
    ).all()
    kind = "baseline" if row.baseline_id is not None else "published"
    return PermissionReviewDetail(
        **_fields(session, row),
        review_url=assessment.review_url(row.id),
        snapshot_fingerprint=row.fingerprint,
        comparison_fingerprint=row.published_fingerprint,
        comparison_source=None if row.published_snapshot is None else kind,
        comparison_artifacts=row.published_artifacts,
        comparison_snapshot=row.published_snapshot,
        review_findings=_findings(row),
        linter_reports_present=bool(row.linter_reports),
        decisions=[
            PermissionDecisionEntry(
                **{c.name: getattr(item, c.name) for c in item.__table__.columns},
                fingerprint=origin.fingerprint,
                reviewer_name=reviewer_name,
                applies=all(assessment.same_scope(row, origin)),
            )
            for item, origin, reviewer_name in decisions
        ],
    )


@router.get("")
def list_permission_reviews(
    _moderator: ModeratorDep,
    outcome: Annotated[
        Literal["accepted", "pending", "rejected", "error", "all"], Query()
    ] = "pending",
    include_superseded: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, Any]:
    observation = models.PermissionAssessmentObservation
    newer = aliased(observation)
    query = select(observation).where(
        observation.candidate_kind.in_(PR_CANDIDATE_KINDS)
    )
    if outcome != "all":
        query = query.where(observation.outcome == outcome)
    if not include_superseded:
        query = query.where(
            ~exists().where(
                newer.forge_instance == observation.forge_instance,
                newer.source_repository == observation.source_repository,
                newer.pull_request_number == observation.pull_request_number,
                newer.id > observation.id,
            )
        )
    with get_db("replica") as db:
        total = db.session.execute(
            select(func.count()).select_from(query.subquery())
        ).scalar_one()
        rows = db.session.execute(
            query.order_by(observation.id.desc()).limit(limit).offset(offset)
        ).scalars()
        items = [PermissionReviewSummary(**_fields(db.session, row)) for row in rows]
    return {"items": items, "total": total}


@router.get("/{assessment_id}")
def read_permission_review(
    assessment_id: int, _moderator: ModeratorDep
) -> PermissionReviewDetail:
    with get_db("replica") as db:
        row = db.session.get(models.PermissionAssessmentObservation, assessment_id)
        if row is None:
            raise HTTPException(status_code=404, detail="assessment_not_found")
        return _detail(db.session, row)


@router.post("/{assessment_id}/decision")
def decide_permission_review(
    assessment_id: int,
    body: PermissionDecisionRequest,
    http_request: Request,
    login: ModeratorDep,
) -> PermissionReviewDetail:
    observation = models.PermissionAssessmentObservation
    with get_db("writer") as db:
        row = db.session.execute(
            select(observation).where(observation.id == assessment_id).with_for_update()
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="assessment_not_found")
        if assessment.superseded_by(db.session, row) is not None:
            raise HTTPException(status_code=409, detail="assessment_superseded")
        if (
            row.outcome == "error"
            or row.fingerprint is None
            or row.pull_request_number is None
            or row.candidate_kind not in PR_CANDIDATE_KINDS
        ):
            raise HTTPException(status_code=409, detail="assessment_not_reviewable")
        if body.fingerprint != row.fingerprint:
            raise HTTPException(status_code=409, detail="snapshot_mismatch")
        if row.acceptance_basis == "baseline":
            raise HTTPException(status_code=409, detail="no_review_needed")
        decision = models.PermissionDecision(
            assessment_id=row.id,
            reviewer_id=login.user.id,
            decision=body.decision,
            rationale=body.rationale,
        )
        db.session.add(decision)
        db.session.flush()
        db.session.execute(
            update(observation)
            .where(
                *assessment.same_scope(observation, row),
                observation.outcome != "error",
                observation.acceptance_basis.is_distinct_from("baseline"),
            )
            .values(**assessment.decision_outcome(body.decision, decision.id))
        )
        db.session.refresh(row)
        detail = _detail(db.session, row)
        details = {
            "app_id": row.app_id,
            "assessment_id": row.id,
            "decision_id": decision.id,
            "fingerprint": row.fingerprint,
        }

    event = (
        models.AuditEventType.PERMISSION_DECISION_APPROVED
        if body.decision == "approved"
        else models.AuditEventType.PERMISSION_DECISION_REJECTED
    )
    audit_log.enqueue_audit_log(http_request, login.user.id, event, details=details)
    return detail


def register_to_app(app: FastAPI) -> None:
    app.include_router(router)
