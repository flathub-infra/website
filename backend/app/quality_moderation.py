import datetime
from dataclasses import dataclass
from math import ceil
from typing import Any, Literal

from fastapi import APIRouter, Depends, FastAPI, Path
from fastapi.responses import ORJSONResponse
from fastapi_sqlalchemy import db
from pydantic import BaseModel

from .db import get_all_appids_for_frontend, get_json_key
from .login_info import quality_moderator_only, quality_moderator_or_app_author_only
from .models import QualityModeration, QualityModerationRequest

router = APIRouter(prefix="/quality-moderation", default_response_class=ORJSONResponse)


@dataclass
class Guideline:
    id: str
    url: str
    needed_to_pass_since: datetime.datetime
    read_only: bool = False


@dataclass
class GuidelineCategory:
    id: str
    guidelines: list[Guideline]


GUIDELINES = [
    GuidelineCategory(
        "general",
        [
            Guideline(
                "general-no-trademark-violations",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-trademark-violations",
                datetime.datetime(2023, 9, 1),
            ),
        ],
    ),
    GuidelineCategory(
        "app-icon",
        [
            # This guideline can't be checked, as currently icons are a maximal size of 128x128
            # Guideline(
            #     "app-icon-size",
            #     "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#icon-size",
            #     datetime.datetime(2023, 9, 1),
            # ),
            Guideline(
                "app-icon-footprint",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#reasonable-footprint",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-icon-contrast",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#good-contrast",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-icon-detail",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-too-much-or-too-little-detail",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-icon-no-baked-in-shadows",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-baked-in-shadows",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-icon-in-line-with-contemporary-styles",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#in-line-with-contemporary-styles",
                datetime.datetime(2023, 9, 1),
            ),
        ],
    ),
    GuidelineCategory(
        "app-name",
        [
            Guideline(
                "app-name-not-too-long",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-too-long",
                datetime.datetime(2023, 9, 1),
                read_only=True,
            ),
            Guideline(
                "app-name-just-the-name",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#just-the-name",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-no-weird-formatting",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-weird-formatting",
                datetime.datetime(2023, 9, 1),
            ),
        ],
    ),
    GuidelineCategory(
        "app-summary",
        [
            Guideline(
                "app-summary-not-too-long",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-too-long-1",
                datetime.datetime(2023, 9, 1),
                read_only=True,
            ),
            Guideline(
                "app-summary-not-technical",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-technical",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-summary-no-weird-formatting",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#no-weird-formatting-1",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-summary-dont-repeat-app-name",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#dont-repeat-the-name",
                datetime.datetime(2023, 9, 1),
            ),
            Guideline(
                "app-summary-dont-start-with-an-article",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#dont-start-with-an-article",
                datetime.datetime(2023, 9, 1),
            ),
        ],
    ),
    GuidelineCategory(
        "screenshots",
        [
            Guideline(
                "screenshots-at-least-one-screenshot",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#at-least-one-screenshot",
                datetime.datetime(2023, 9, 30),
                read_only=True,
            ),
            Guideline(
                "screenshots-tag-screenshots-with-correct-language",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#tag-screenshots-with-correct-language",
                datetime.datetime(2023, 9, 30),
            ),
            Guideline(
                "screenshots-just-the-app-window",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#just-the-app-window",
                datetime.datetime(2023, 9, 30),
            ),
            Guideline(
                "screenshots-take-screenshots-on-linux",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#take-screenshots-on-linux",
                datetime.datetime(2023, 9, 30),
            ),
            Guideline(
                "screenshots-default-settings",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#default-settings",
                datetime.datetime(2023, 9, 30),
            ),
            Guideline(
                "screenshots-include-window-shadow-and-rounded-corners",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#include-window-shadow-and-rounded-corners",
                datetime.datetime(2023, 9, 30),
            ),
            Guideline(
                "screenshots-reasonable-window-size",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#reasonable-window-size",
                datetime.datetime(2023, 9, 30),
            ),
            Guideline(
                "screenshots-good-content",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#good-content",
                datetime.datetime(2023, 9, 30),
            ),
            Guideline(
                "screenshots-up-to-date",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#up-to-date",
                datetime.datetime(2023, 9, 30),
            ),
        ],
    ),
]


class UpsertQualityModeration(BaseModel):
    guideline_id: str
    passed: bool


def register_to_app(app: FastAPI):
    app.include_router(router)


class QualityModerationStatus(BaseModel):
    passes: bool
    unrated: int
    passed: int
    not_passed: int
    last_updated: datetime.datetime
    review_requested_at: datetime.datetime | None = None


class QualityModerationDashboardRow(BaseModel):
    id: str
    quality_moderation_status: QualityModerationStatus
    appstream: Any | None = None
    installs_last_7_days: int | None = None


class Pagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class QualityModerationDashboardResponse(BaseModel):
    apps: list[QualityModerationDashboardRow]
    pagination: Pagination


class QualityModerationType(BaseModel):
    guideline_id: str
    app_id: str
    updated_at: datetime.datetime
    updated_by: int | None
    passed: bool
    comment: str | None


class QualityModerationResponse(BaseModel):
    categories: list[GuidelineCategory]
    marks: dict[str, QualityModerationType]
    review_requested_at: datetime.datetime | None = None


class FailedByGuideline(BaseModel):
    guideline_id: str
    not_passed: int


@router.get("/status", tags=["quality-moderation"])
def get_quality_moderation_status(
    page: int = 1,
    page_size: int = 25,
    filter: Literal["all", "passing", "todo"] = "all",
    _moderator=Depends(quality_moderator_only),
) -> QualityModerationDashboardResponse:
    apps = [
        QualityModerationDashboardRow(
            id=appId,
            quality_moderation_status=get_quality_moderation_status_for_appid(
                db, appId
            ),
        )
        for appId in get_all_appids_for_frontend()
    ]

    for app in apps:
        app_stats = get_json_key(f"app_stats:{app.id}")
        app.installs_last_7_days = (
            app_stats["installs_last_7_days"]
            if app_stats and "installs_last_7_days" in app_stats
            else None
        )

    # sort by review_requested, passed, then by weekly downloads
    apps.sort(
        key=lambda app: (
            app.quality_moderation_status.review_requested_at is not None,
            app.quality_moderation_status.passes,
            app.installs_last_7_days or 0,
        ),
        reverse=True,
    )

    if filter == "passing":
        apps = [app for app in apps if app.quality_moderation_status.passes]
    elif filter == "todo":
        apps = [
            app
            for app in apps
            if app.quality_moderation_status.not_passed == 0
            and app.quality_moderation_status.unrated > 0
        ]

    all_quality_apps = QualityModerationDashboardResponse(
        apps=apps,
        pagination=Pagination(
            page=page,
            page_size=page_size,
            total=len(apps),
            total_pages=ceil(len(apps) / page_size),
        ),
    )

    all_quality_apps.apps = apps[(page - 1) * page_size : page * page_size]

    for app in all_quality_apps.apps:
        app.appstream = get_json_key(f"apps:{app.id}")

    return all_quality_apps


@router.get("/{app_id}", tags=["quality-moderation"])
def get_quality_moderation_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    _moderator=Depends(quality_moderator_or_app_author_only),
) -> QualityModerationResponse:
    items = [
        QualityModerationType(
            guideline_id=item.guideline_id,
            app_id=item.app_id,
            updated_at=item.updated_at,
            updated_by=item.updated_by,
            passed=item.passed,
            comment=item.comment,
        )
        for item in QualityModeration.by_appid(db, app_id)
    ]

    review_request = QualityModerationRequest.by_appid(db, app_id)

    return QualityModerationResponse(
        categories=GUIDELINES,
        marks={item.guideline_id: item for item in items},
        review_requested_at=review_request.created_at if review_request else None,
    )


@router.post("/{app_id}", tags=["quality-moderation"])
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
    QualityModeration.upsert(
        db, app_id, body.guideline_id, body.passed, moderator.user.id
    )


@router.get("/failed-by-guideline", tags=["quality-moderation"])
def get_quality_moderation_stats(
    _moderator=Depends(quality_moderator_only)
) -> list[FailedByGuideline]:
    return QualityModeration.group_by_guideline(db)


@router.get("/{app_id}/status", tags=["quality-moderation"])
def get_quality_moderation_status_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    _moderator=Depends(quality_moderator_or_app_author_only),
) -> QualityModerationStatus:
    app_quality_status = get_quality_moderation_status_for_appid(db, app_id)

    return app_quality_status


@router.post("/{app_id}/request-review", tags=["quality-moderation"])
def request_review_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    moderator=Depends(quality_moderator_or_app_author_only),
):
    QualityModerationRequest.create(db, app_id, moderator.user.id)


@router.delete("/{app_id}/request-review", tags=["quality-moderation"])
def delete_review_request_for_app(
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    _moderator=Depends(quality_moderator_only),
):
    QualityModerationRequest.delete(db, app_id)


def get_quality_moderation_status_for_appid(db, app_id: str) -> QualityModerationStatus:
    marks = QualityModeration.by_appid(db, app_id)
    unrated = 0

    checks = []

    for category in GUIDELINES:
        for guideline in category.guidelines:
            if guideline.needed_to_pass_since > datetime.datetime.now():
                continue

            firstMatch = next(
                (mark for mark in marks if mark.guideline_id == guideline.id), None
            )

            checks.append(
                {
                    "category": category.id,
                    "guideline": guideline.id,
                    "needed_to_pass_since": guideline.needed_to_pass_since,
                    "passed": firstMatch.passed if firstMatch else None,
                    "updated_at": firstMatch.updated_at if firstMatch else None,
                }
            )

            if firstMatch is None:
                unrated += 1

    passed = len(
        [
            item
            for item in checks
            if item["passed"] and item["needed_to_pass_since"] < datetime.datetime.now()
        ]
    )
    not_passed = len(
        [
            item
            for item in checks
            if item["passed"] is False
            and item["needed_to_pass_since"] < datetime.datetime.now()
        ]
    )

    def last_updated(checks):
        return max([check.updated_at for check in checks] + [datetime.datetime.min])

    app_quality_request = QualityModerationRequest.by_appid(db, app_id)

    return QualityModerationStatus(
        passes=unrated + not_passed == 0,
        unrated=unrated,
        passed=passed,
        not_passed=not_passed,
        last_updated=last_updated(marks),
        review_requested_at=app_quality_request.created_at
        if app_quality_request
        else None,
    )
