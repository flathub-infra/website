import datetime
from dataclasses import dataclass
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, Path
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel

from ..database import get_db, get_json_key
from ..login_info import quality_moderator_only, quality_moderator_or_app_author_only
from ..models import (
    App,
    AppPickRecommendationsResponse,
    QualityModeration,
    QualityModerationDashboardResponse,
    QualityModerationRequest,
    QualityModerationStatus,
    SimpleQualityModerationResponse,
)

router = APIRouter(prefix="/quality-moderation", default_response_class=ORJSONResponse)


@dataclass
class Guideline:
    id: str
    url: str
    needed_to_pass_since: datetime.datetime
    category: str
    read_only: bool = False


class UpsertQualityModeration(BaseModel):
    guideline_id: str
    passed: bool


def register_to_app(app: FastAPI):
    app.include_router(router)


class QualityModerationType(BaseModel):
    guideline_id: str
    guideline: Guideline
    app_id: str
    updated_at: datetime.datetime
    updated_by: int | None
    passed: bool | None
    comment: str | None
    needed_to_pass_since: datetime.datetime


class QualityModerationResponse(BaseModel):
    guidelines: list[QualityModerationType]
    is_fullscreen_app: bool
    review_requested_at: datetime.datetime | None = None


class FailedByGuideline(BaseModel):
    guideline_id: str
    not_passed: int


@router.get(
    "/status",
    tags=["quality-moderation"],
    responses={
        200: {"model": QualityModerationDashboardResponse},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_quality_moderation_status(
    page: int = 1,
    page_size: int = 25,
    filter: Literal["all", "passing", "todo"] = "all",
    _moderator=Depends(quality_moderator_only),
) -> QualityModerationDashboardResponse:
    with get_db("replica") as db:
        all_quality_apps = App.status_summarized(db, page, page_size, filter)

    for app in all_quality_apps.apps:
        app.appstream = get_json_key(f"apps:{app.id}")

    return all_quality_apps


@router.get(
    "/passing-apps",
    tags=["quality-moderation"],
    responses={
        200: {"model": SimpleQualityModerationResponse},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_passing_quality_apps(
    page: int = 1,
    page_size: int = 25,
) -> SimpleQualityModerationResponse:
    with get_db("replica") as db:
        passing_quality_apps = App.status_summarized(db, page, page_size, "passing")

    return SimpleQualityModerationResponse(
        apps=[app.id for app in passing_quality_apps.apps],
        pagination=passing_quality_apps.pagination,
    )


@router.get(
    "/app-pick-recommendations",
    tags=["quality-moderation"],
    responses={
        200: {"description": "App pick recommendations"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_app_pick_recommendations(
    recommendation_date: datetime.date = datetime.date.today(),
    _moderator=Depends(quality_moderator_only),
) -> AppPickRecommendationsResponse:
    with get_db("replica") as db:
        return App.app_pick_recommendations(db, recommendation_date)


@router.get(
    "/failed-by-guideline",
    tags=["quality-moderation"],
    responses={
        200: {"description": "Apps grouped by failed guidelines"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        500: {"description": "Internal server error"},
    },
)
def get_quality_moderation_stats(
    _moderator=Depends(quality_moderator_only),
) -> list[FailedByGuideline]:
    with get_db("replica") as db:
        return QualityModeration.group_by_guideline(db)


@router.get(
    "/{app_id}",
    tags=["quality-moderation"],
    responses={
        200: {"description": "Quality moderation details for app"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_quality_moderation_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    _moderator=Depends(quality_moderator_or_app_author_only),
) -> QualityModerationResponse:
    with get_db("replica") as db:
        items = [
            QualityModerationType(
                guideline_id=item.Guideline.id,
                app_id=app_id,
                updated_at=(
                    item.QualityModeration.updated_at
                    if item.QualityModeration
                    else datetime.datetime.min
                ),
                updated_by=(
                    item.QualityModeration.updated_by
                    if item.QualityModeration
                    else None
                ),
                passed=(
                    item.QualityModeration.passed if item.QualityModeration else None
                ),
                comment=(
                    item.QualityModeration.comment if item.QualityModeration else None
                ),
                guideline=Guideline(
                    id=item.Guideline.id,
                    url=item.Guideline.url,
                    needed_to_pass_since=item.Guideline.needed_to_pass_since,
                    read_only=item.Guideline.read_only,
                    category=item.Guideline.guideline_category_id,
                ),
                needed_to_pass_since=item.Guideline.needed_to_pass_since,
            )
            for item in QualityModeration.by_appid(db, app_id)
        ]

        review_request = QualityModerationRequest.by_appid(db, app_id)
        is_fullscreen_app = App.get_fullscreen_app(db, app_id)

    return QualityModerationResponse(
        guidelines=items,
        is_fullscreen_app=is_fullscreen_app,
        review_requested_at=review_request.created_at if review_request else None,
    )


@router.post(
    "/{app_id}",
    tags=["quality-moderation"],
    responses={
        200: {"description": "Quality moderation updated successfully"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def set_quality_moderation_for_app(
    body: UpsertQualityModeration,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    moderator=Depends(quality_moderator_only),
):
    with get_db("writer") as db:
        QualityModeration.upsert(
            db, app_id, body.guideline_id, body.passed, moderator.user.id
        )


@router.get(
    "/{app_id}/status",
    tags=["quality-moderation"],
    responses={
        200: {"description": "App quality moderation status"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def get_quality_moderation_status_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    _moderator=Depends(quality_moderator_or_app_author_only),
) -> QualityModerationStatus:
    with get_db("replica") as db:
        app_quality_status = QualityModeration.by_appid_summarized(db, app_id)

    return app_quality_status


@router.post(
    "/{app_id}/request-review",
    tags=["quality-moderation"],
    responses={
        200: {"description": "Review requested successfully"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not app developer"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def request_review_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    moderator=Depends(quality_moderator_or_app_author_only),
):
    with get_db("writer") as db:
        QualityModerationRequest.create(db, app_id, moderator.user.id)


@router.delete(
    "/{app_id}/request-review",
    tags=["quality-moderation"],
    responses={
        204: {"description": "Review request cancelled successfully"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not app developer"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def delete_review_request_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    _moderator=Depends(quality_moderator_only),
):
    with get_db("writer") as db:
        QualityModerationRequest.delete(db, app_id)


@router.post(
    "/{app_id}/fullscreen",
    tags=["quality-moderation"],
    responses={
        200: {"description": "Fullscreen setting updated successfully"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def set_fullscreen_app(
    is_fullscreen_app: bool,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    moderator=Depends(quality_moderator_only),
):
    with get_db("writer") as db:
        App.set_fullscreen_app(db, app_id, is_fullscreen_app)
