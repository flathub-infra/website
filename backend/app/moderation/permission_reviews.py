from datetime import datetime, timedelta
from typing import Annotated, Any, Literal

from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, model_validator
from sqlalchemy import and_, case, exists, func, select
from sqlalchemy.orm import aliased

from .. import audit_log, cache, models, worker
from ..database import get_db
from ..login_info import ModeratorDep
from . import permission_assessment as assessment

router = APIRouter(prefix="/moderation/permission-reviews", tags=["moderation"])

SNOOZE = timedelta(hours=12)
current_outcome = case(
    (
        and_(
            models.PermissionAssessmentObservation.outcome == "snoozed",
            ~exists().where(
                models.PermissionDecision.id
                == models.PermissionAssessmentObservation.decision_id,
                models.PermissionDecision.created_at > func.now() - SNOOZE,
            ),
        ),
        "pending",
    ),
    else_=models.PermissionAssessmentObservation.outcome,
)


class PermissionReviewSummary(BaseModel):
    assessment_id: int
    app_id: str
    created_at: datetime
    outcome: Literal["accepted", "pending", "rejected", "snoozed", "ignored", "error"]
    acceptance_basis: assessment.AcceptanceBasis | None
    candidate_kind: str
    forge_instance: str
    source_repository: str
    pull_request_number: int | None
    pull_request_url: str | None
    target_git_branch: str
    destination_channel: str
    flatpak_branch: str
    difference_count: int | None
    superseded_by: int | None


class PermissionDecisionRule(BaseModel):
    id: int
    decision: Literal["approved", "rejected"]
    permission_group: str
    key: str
    value: str


class PermissionDecisionEntry(BaseModel):
    id: int
    created_at: datetime
    decision: Literal["approved", "rejected", "snoozed", "ignored"]
    rationale: str | None
    reviewer_id: int | None
    reviewer_name: str | None
    rules: list[PermissionDecisionRule] | None
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
    build_checks: list[dict[str, Any]]
    error_code: str | None
    error_message: str | None
    linked_assessment_id: int | None
    decision_id: int | None
    decisions: list[PermissionDecisionEntry]


class PermissionDecisionRequest(BaseModel):
    decision: Literal["approved", "rejected", "snoozed", "ignored"]
    fingerprint: str
    rationale: str | None = None

    @model_validator(mode="after")
    def check_rationale(self):
        if (
            self.decision in ("rejected", "ignored")
            and not (self.rationale or "").strip()
        ):
            raise ValueError(f"A {self.decision} decision requires a rationale")
        return self


def _fields(
    session, row: models.PermissionAssessmentObservation, outcome: str
) -> dict[str, Any]:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns} | {
        "assessment_id": row.id,
        "outcome": outcome,
        "destination_channel": row.intended_channel,
        "difference_count": None if row.differences is None else len(row.differences),
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
        .outerjoin(models.FlathubUser, models.FlathubUser.id == decision.reviewer_id)
        .where(
            source.app_id == row.app_id,
            source.forge_instance == row.forge_instance,
            source.source_repository == row.source_repository,
            source.pull_request_number == row.pull_request_number,
        )
        .order_by(decision.id.desc())
    ).all()
    kind = "baseline" if row.baseline_id is not None else "published"
    outcome = session.execute(
        select(current_outcome).where(
            models.PermissionAssessmentObservation.id == row.id
        )
    ).scalar_one()
    return PermissionReviewDetail(
        **_fields(session, row, outcome),
        review_url=assessment.review_url(row.id),
        snapshot_fingerprint=row.fingerprint,
        comparison_fingerprint=row.published_fingerprint,
        comparison_source=None if row.published_snapshot is None else kind,
        comparison_artifacts=row.published_artifacts,
        comparison_snapshot=row.published_snapshot,
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
@cache.private
def list_permission_reviews(
    _moderator: ModeratorDep,
    outcome: Annotated[
        Literal[
            "accepted", "pending", "rejected", "snoozed", "ignored", "error", "all"
        ],
        Query(),
    ] = "pending",
    include_superseded: bool = False,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict[str, Any]:
    observation = models.PermissionAssessmentObservation
    newer = aliased(observation)
    query = select(observation, current_outcome).where(
        observation.candidate_kind.in_(assessment.PR_CANDIDATE_KINDS),
        observation.acceptance_basis.is_distinct_from("baseline"),
    )
    if outcome != "all":
        query = query.where(current_outcome == outcome)
    if not include_superseded:
        query = query.where(
            ~exists().where(
                newer.forge_instance == observation.forge_instance,
                newer.source_repository == observation.source_repository,
                newer.pull_request_number == observation.pull_request_number,
                newer.candidate_kind.in_(assessment.PR_CANDIDATE_KINDS),
                newer.id > observation.id,
            )
        )
    with get_db("replica") as db:
        total = db.session.execute(
            select(func.count()).select_from(query.subquery())
        ).scalar_one()
        rows = db.session.execute(
            query.order_by(observation.id.desc()).limit(limit).offset(offset)
        )
        items = [
            PermissionReviewSummary(**_fields(db.session, row, state))
            for row, state in rows
        ]
    return {"items": items, "total": total}


@router.get("/{assessment_id}")
@cache.private
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
        row = db.session.get(observation, assessment_id)
        if row is None:
            raise HTTPException(status_code=404, detail="assessment_not_found")
        assessment.lock_pull_request(db.session, row)
        if assessment.superseded_by(db.session, row) is not None:
            raise HTTPException(status_code=409, detail="assessment_superseded")
        if (
            row.outcome == "error"
            or row.fingerprint is None
            or row.pull_request_number is None
            or row.candidate_kind not in assessment.PR_CANDIDATE_KINDS
        ):
            raise HTTPException(status_code=409, detail="assessment_not_reviewable")
        if body.fingerprint != row.fingerprint:
            raise HTTPException(status_code=409, detail="snapshot_mismatch")
        if row.acceptance_basis == "baseline":
            raise HTTPException(status_code=409, detail="no_review_needed")
        unchanged = assessment.decision_outcome(body.decision, row.decision_id)
        if body.decision != "snoozed" and all(
            getattr(row, key) == value for key, value in unchanged.items()
        ):
            return _detail(db.session, row)
        decision = assessment.record_decision(
            db.session,
            row,
            body.decision,
            reviewer_id=login.user.id,
            rationale=body.rationale,
        )
        detail = _detail(db.session, row)
        details = {
            "app_id": row.app_id,
            "assessment_id": row.id,
            "decision_id": decision.id,
            "fingerprint": row.fingerprint,
        }
        pull_request = (
            (row.source_repository, row.pull_request_number)
            if row.forge_instance == "github.com"
            and body.decision in ("approved", "rejected")
            else None
        )

    event = models.AuditEventType(f"permission-decision-{body.decision}")
    audit_log.enqueue_audit_log(http_request, login.user.id, event, details=details)
    if pull_request is not None:
        worker.notify_permission_decision.send(*pull_request)
    return detail


def register_to_app(app: FastAPI) -> None:
    app.include_router(router)
