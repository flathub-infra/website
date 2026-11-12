from fastapi import APIRouter, FastAPI

from .. import cache, models
from ..checker_health import CheckerHealth, summarize
from ..checker_selection import load_selection
from ..database import get_db
from ..login_info import ModifyUsersDep

router = APIRouter(prefix="/apps", tags=["checker-health"])


def register_to_app(app: FastAPI) -> None:
    app.include_router(router)


@router.get("/{app_id}/checker-health")
@cache.private
def get_checker_health(app_id: str, login: ModifyUsersDep) -> CheckerHealth:
    with get_db("replica") as db:
        rows = (
            db.session.query(models.CheckerHealthObservation)
            .filter_by(app_id=app_id)
            .order_by(
                models.CheckerHealthObservation.observed_at,
                models.CheckerHealthObservation.artifact_id,
            )
            .yield_per(20)
        )
        result = summarize(rows, ordered=True)
        result.selection = load_selection(db, app_id)
        return result
