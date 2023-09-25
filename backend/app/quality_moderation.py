import datetime
from dataclasses import dataclass

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.responses import ORJSONResponse
from fastapi_sqlalchemy import db
from pydantic import BaseModel

from . import models
from .db import get_all_appids_for_frontend
from .logins import LoginStatusDep

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
            Guideline(
                "app-icon-size",
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#icon-size",
                datetime.datetime(2023, 9, 1),
            ),
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
                "https://docs.flathub.org/docs/for-app-authors/appdata-guidelines/quality-guidelines/#not-too-much-detail",
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
]


class UpsertQualityModeration(BaseModel):
    guideline_id: str
    passed: bool


def register_to_app(app: FastAPI):
    app.include_router(router)


def quality_moderator_only(login: LoginStatusDep):
    if not login.state.logged_in():
        raise HTTPException(status_code=401, detail="not_logged_in")
    if not login.user.is_quality_moderator:
        raise HTTPException(status_code=403, detail="not_quality_moderator")

    return login


@router.get("/status")
def get_quality_moderation_status(_moderator=Depends(quality_moderator_only)):
    return {
        "apps": [
            {
                "id": appId,
                "quality-moderation-status": get_quality_moderation_status_for_appid(
                    appId
                ),
            }
            for appId in get_all_appids_for_frontend()
        ]
    }


@router.get("/{app_id}")
def get_quality_moderation_for_app(
    app_id: str, _moderator=Depends(quality_moderator_only)
):
    items = models.QualityModeration.by_appid(db, app_id)
    return {
        "categories": GUIDELINES,
        "marks": {item.guideline_id: item for item in items},
    }


@router.post("/{app_id}")
def set_quality_moderation_for_app(
    app_id: str,
    body: UpsertQualityModeration,
    moderator=Depends(quality_moderator_only),
):
    models.QualityModeration.upsert(
        db, app_id, body.guideline_id, body.passed, moderator.user.id
    )


@router.get("/{app_id}/status")
def get_quality_moderation_status_for_app(app_id: str):
    return get_quality_moderation_status_for_appid(app_id)


def get_quality_moderation_status_for_appid(app_id: str):
    marks = models.QualityModeration.by_appid(db, app_id)
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

    return {
        "passes": unrated + not_passed == 0,
        "unrated": unrated,
        "passed": passed,
        "not-passed": not_passed,
    }
