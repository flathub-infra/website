from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .. import audit_log, cache, models, worker
from ..database import get_db
from ..login_info import ModeratorDep
from . import permission_assessment as assessment
from .permission_rules import BUS_GROUPS, evaluate

router = APIRouter(prefix="/moderation/permission-rules", tags=["moderation"])

Text = Annotated[str, Field(min_length=1)]


class PermissionRuleInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    decision: Literal["approved", "rejected"]
    permission_group: Literal[
        "Context", "Session Bus Policy", "System Bus Policy", "USB Devices"
    ]
    key: Text
    match_type: Literal["destination", "transition"] = "destination"
    before: Text | None = None
    value: Text | None
    rationale: Text
    enabled: bool = True

    @model_validator(mode="after")
    def check_match(self):
        if self.match_type == "destination":
            if self.before is not None or self.value is None:
                raise ValueError("Destination rules need only a non-null value")
        elif self.before == self.value:
            raise ValueError("Transition rules need distinct endpoints")
        if self.permission_group in BUS_GROUPS and any(
            endpoint is not None and endpoint not in ("none", "see", "talk", "own")
            for endpoint in (self.before, self.value)
        ):
            raise ValueError("Bus policy endpoints need a none, see, talk or own value")
        return self


class PermissionRuleDraft(PermissionRuleInput):
    id: int | None = None


class PermissionRuleEntry(PermissionRuleInput):
    id: int
    updated_at: datetime
    updated_by_name: str | None


class PermissionRuleMatch(BaseModel):
    assessment_id: int
    app_id: str
    decision: Literal["approved", "rejected"]


class PermissionRuleConflict(PermissionRuleMatch):
    decision_id: int
    moderator_decision: Literal["approved", "rejected"]


class PermissionRulePreview(BaseModel):
    pending: list[PermissionRuleMatch]
    conflicts: list[PermissionRuleConflict]


def _entry(session, rule: models.PermissionRule) -> PermissionRuleEntry:
    updater = session.get(models.FlathubUser, rule.updated_by)
    return PermissionRuleEntry(
        **_values(rule),
        id=rule.id,
        updated_at=rule.updated_at,
        updated_by_name=updater.display_name if updater else None,
    )


def _values(rule: models.PermissionRule) -> dict[str, Any]:
    return {name: getattr(rule, name) for name in PermissionRuleInput.model_fields}


def _flush(session) -> None:
    try:
        session.flush()
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="rule_exists") from exc


def _pending(session) -> list[models.PermissionAssessmentObservation]:
    observation = models.PermissionAssessmentObservation
    return list(
        session.scalars(
            select(observation)
            .where(
                observation.candidate_kind.in_(assessment.PR_CANDIDATE_KINDS),
                observation.outcome == "pending",
                assessment.newest_in_pull_request(observation),
            )
            .order_by(observation.id)
        )
    )


@router.get("")
@cache.private
def list_permission_rules(_moderator: ModeratorDep) -> list[PermissionRuleEntry]:
    rule = models.PermissionRule
    with get_db("replica") as db:
        rules = db.session.scalars(
            select(rule).order_by(
                rule.permission_group,
                rule.key,
                rule.match_type,
                rule.before.nullsfirst(),
                rule.value.nullsfirst(),
            )
        )
        return [_entry(db.session, item) for item in rules]


@router.post("", status_code=201)
def create_permission_rule(
    body: PermissionRuleInput, http_request: Request, login: ModeratorDep
) -> PermissionRuleEntry:
    with get_db("writer") as db:
        rule = models.PermissionRule(
            **body.model_dump(), created_by=login.user.id, updated_by=login.user.id
        )
        db.session.add(rule)
        _flush(db.session)
        db.session.refresh(rule)
        entry = _entry(db.session, rule)
    audit_log.enqueue_audit_log(
        http_request,
        login.user.id,
        models.AuditEventType.PERMISSION_RULE_CREATED,
        details={"rule_id": entry.id, **body.model_dump()},
    )
    return entry


@router.put("/{rule_id}")
def update_permission_rule(
    rule_id: int, body: PermissionRuleInput, http_request: Request, login: ModeratorDep
) -> PermissionRuleEntry:
    with get_db("writer") as db:
        rule = db.session.get(models.PermissionRule, rule_id, with_for_update=True)
        if rule is None:
            raise HTTPException(status_code=404, detail="rule_not_found")
        before, after = _values(rule), body.model_dump()
        if before != after:
            for name, value in after.items():
                setattr(rule, name, value)
            rule.updated_by = login.user.id
            rule.updated_at = func.now()
            _flush(db.session)
            db.session.refresh(rule)
        entry = _entry(db.session, rule)
    if before != after:
        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType.PERMISSION_RULE_UPDATED,
            details={"rule_id": rule_id, "before": before, "after": after},
        )
    return entry


@router.post("/preview")
def preview_permission_rules(
    _moderator: ModeratorDep, body: PermissionRuleDraft | None = None
) -> PermissionRulePreview:
    decision = models.PermissionDecision
    observation = models.PermissionAssessmentObservation
    with get_db("replica") as db:
        rules = list(db.session.scalars(select(models.PermissionRule)))
        if body is not None:
            draft = models.PermissionRule(**body.model_dump())
            rules = [rule for rule in rules if rule.id != body.id] + [draft]
        pending = [
            PermissionRuleMatch(
                assessment_id=row.id, app_id=row.app_id, decision=verdict.decision
            )
            for row in _pending(db.session)
            if (verdict := evaluate(row.differences or [], rules)) is not None
        ]
        decided = db.session.execute(
            select(decision, observation)
            .join(observation, observation.id == decision.assessment_id)
            .where(
                decision.reviewer_id.isnot(None),
                decision.decision.in_(("approved", "rejected")),
                observation.decision_id == decision.id,
            )
            .order_by(decision.id)
        ).all()
        conflicts = [
            PermissionRuleConflict(
                assessment_id=row.id,
                app_id=row.app_id,
                decision=verdict.decision,
                decision_id=item.id,
                moderator_decision=item.decision,
            )
            for item, row in decided
            if (verdict := evaluate(row.differences or [], rules)) is not None
            and verdict.decision != item.decision
        ]
    return PermissionRulePreview(pending=pending, conflicts=conflicts)


@router.post("/apply")
def apply_permission_rules(
    http_request: Request, login: ModeratorDep
) -> list[PermissionRuleMatch]:
    applied = []
    with get_db("writer") as db:
        rules = list(db.session.scalars(select(models.PermissionRule)))
        for row in _pending(db.session):
            assessment.lock_pull_request(db.session, row)
            db.session.refresh(row)
            if (
                row.outcome != "pending"
                or assessment.superseded_by(db.session, row) is not None
                or (verdict := evaluate(row.differences or [], rules)) is None
            ):
                continue
            item = assessment.record_decision(
                db.session,
                row,
                verdict.decision,
                rationale=verdict.rationale,
                rules=verdict.rules,
            )
            applied.append(
                (
                    PermissionRuleMatch(
                        assessment_id=row.id,
                        app_id=row.app_id,
                        decision=verdict.decision,
                    ),
                    {
                        "app_id": row.app_id,
                        "assessment_id": row.id,
                        "decision_id": item.id,
                        "fingerprint": row.fingerprint,
                        "rules": [rule["id"] for rule in verdict.rules],
                    },
                    (row.source_repository, row.pull_request_number)
                    if row.forge_instance == "github.com"
                    else None,
                )
            )
    for match, details, pull_request in applied:
        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType(f"permission-decision-{match.decision}"),
            details=details,
        )
        if pull_request is not None:
            worker.notify_permission_decision.send(*pull_request)
    return [match for match, _, _ in applied]


def register_to_app(app: FastAPI) -> None:
    app.include_router(router)
