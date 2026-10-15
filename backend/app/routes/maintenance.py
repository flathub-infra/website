from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, FastAPI, HTTPException, Query

from .. import cache, models, utils
from ..database import get_db
from ..login_info import ModeratorDep
from ..maintenance import (
    Evidence,
    MaintenanceAction,
    MaintenanceCase,
    MaintenanceDashboard,
    apply_triage,
    assess,
    dashboard,
    same_fingerprint,
)

router = APIRouter(prefix="/admin/maintenance", tags=["maintenance"])
APP_TYPES = ("desktop", "desktop-application", "console-application")


def register_to_app(app: FastAPI):
    app.include_router(router)


def load_cases(
    db, now, stale_days: int, app_id: str | None = None, user_id: int | None = None
) -> list[MaintenanceCase]:
    # Fetch only the required JSON fields, not the full AppStream catalog.
    query = db.session.query(
        models.App.app_id,
        models.App.appstream["name"].as_string().label("name"),
        models.App.last_updated_at,
        models.App.installs_last_7_days,
        models.App.summary["metadata"]["runtime"].as_string().label("runtime"),
        models.App.summary["branch"].as_string().label("branch"),
        models.App.is_eol,
        models.App.eol_branches,
    ).filter(models.App.type.in_(APP_TYPES))
    if app_id:
        query = query.filter(models.App.app_id == app_id)
    apps = query.all()
    ids = [app.app_id for app in apps]
    runtime_ids = {app.runtime.split("/")[0] for app in apps if app.runtime}
    runtimes = {
        row.app_id: row
        for row in db.session.query(
            models.App.app_id,
            models.App.is_eol,
            models.App.eol_branches,
        )
        .filter(models.App.app_id.in_(runtime_ids))
        .all()
    }
    triage = {
        row.app_id: row
        for row in db.session.query(models.MaintenanceTriage)
        .filter(models.MaintenanceTriage.app_id.in_(ids))
        .all()
    }
    owner_ids = {row.owner_id for row in triage.values() if row.owner_id is not None}
    owners = dict(
        db.session.query(models.FlathubUser.id, models.FlathubUser.display_name)
        .filter(models.FlathubUser.id.in_(owner_ids))
        .all()
    )
    result = []
    for app in apps:
        runtime_eol = None
        if app.runtime:
            parts = app.runtime.split("/")
            runtime = runtimes.get(parts[0])
            if runtime is not None and len(parts) == 3:
                runtime_eol = bool(
                    runtime.is_eol
                    and (not runtime.eol_branches or parts[2] in runtime.eol_branches)
                )
        is_eol = bool(
            app.is_eol
            and (not app.eol_branches or (app.branch or "stable") in app.eol_branches)
        )
        evidence = Evidence(
            app_id=app.app_id,
            name=app.name or app.app_id,
            last_updated_at=app.last_updated_at,
            installs_last_7_days=app.installs_last_7_days,
            runtime=app.runtime,
            runtime_eol=runtime_eol,
            is_eol=is_eol,
        )
        case = assess(evidence, now, stale_days)
        state = triage.get(app.app_id)
        apply_triage(
            case, state, now, evidence, owners.get(state.owner_id) if state else None
        )
        case.owned_by_me = case.owner_id is not None and case.owner_id == user_id
        result.append(case)
    return result


@router.get("")
@cache.private
def get_maintenance_dashboard(
    admin: ModeratorDep,
    queue: Literal[
        "all", "stale", "runtime", "eol", "unknown", "mine", "snoozed"
    ] = "all",
    search: str = Query(default="", max_length=200),
    runtime: str | None = Query(default=None, max_length=300),
    stale_days: int = Query(default=365, ge=30, le=3650),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> MaintenanceDashboard:
    now = utils.utcnow()
    # Writer reads ensure claimed/snoozed cases are consistent immediately after edits.
    with get_db("writer") as db:
        return dashboard(
            load_cases(db, now, stale_days, user_id=admin.user.id),
            now,
            queue=queue,
            search=search,
            runtime=runtime,
            user_id=admin.user.id,
            page=page,
            page_size=page_size,
        )


@router.get("/{app_id}")
@cache.private
def get_maintenance_case(
    app_id: str,
    admin: ModeratorDep,
    stale_days: int = Query(default=365, ge=30, le=3650),
) -> MaintenanceCase:
    with get_db("writer") as db:
        cases = load_cases(db, utils.utcnow(), stale_days, app_id, admin.user.id)
        if not cases:
            raise HTTPException(404, "App not found")
        return cases[0]


@router.post("/{app_id}")
@cache.private
def update_maintenance_case(
    app_id: str, body: MaintenanceAction, admin: ModeratorDep
) -> MaintenanceCase:
    now = utils.utcnow()
    with get_db("writer") as db:
        # Lock the parent too: two first-time edits cannot both create triage state.
        app = (
            db.session.query(models.App)
            .filter(models.App.app_id == app_id)
            .with_for_update()
            .first()
        )
        if app is None or app.type not in APP_TYPES:
            raise HTTPException(404, "App not found")
        state = db.session.get(models.MaintenanceTriage, app_id)
        if (state.version if state else 0) != body.version:
            raise HTTPException(409, "This case changed. Refresh it before editing.")
        if body.action == "snooze":
            viewed_case = load_cases(db, now, 365, app_id)[0]
            # New snoozes must review the current schema. Existing stored
            # snoozes remain comparable using their original schema version.
            if not same_fingerprint(body.expected_fingerprint, viewed_case.fingerprint):
                raise HTTPException(
                    409, "Maintenance evidence changed. Refresh it before snoozing."
                )
        if state is None:
            state = models.MaintenanceTriage(
                app_id=app_id, notes="", snooze_reason="", fingerprint="", version=0
            )
            db.session.add(state)
        if body.action in ("claim", "release"):
            if state.owner_id not in (None, admin.user.id):
                raise HTTPException(409, "This case is claimed by another moderator.")
            state.owner_id = admin.user.id if body.action == "claim" else None
        elif body.action == "snooze":
            if not body.reason.strip():
                raise HTTPException(422, "A snooze reason is required.")
            state.snoozed_until = now + timedelta(days=body.days)
            state.snooze_reason = body.reason.strip()
            # Preserve the reviewed snapshot. Later package/runtime changes
            # must invalidate this snooze, not become part of its baseline.
            state.fingerprint = body.expected_fingerprint
        elif body.action == "wake":
            state.snoozed_until = None
            state.snooze_reason = ""
        elif body.action == "notes":
            state.notes = body.notes
        state.version += 1
        state.updated_by = admin.user.id
        state.updated_at = now
        db.session.flush()
        return load_cases(db, now, 365, app_id, admin.user.id)[0]
