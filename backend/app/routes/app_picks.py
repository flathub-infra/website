import datetime

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Response
from pydantic import BaseModel, Field

from .. import cache, models
from ..database import get_db
from ..login_info import quality_moderator_only

router = APIRouter(prefix="/app-picks")


def register_to_app(app: FastAPI):
    app.include_router(router)


class AppOfTheDay(BaseModel):
    app_id: str
    day: datetime.date


@router.get(
    "/app-of-the-day/{date}",
    tags=["app-picks"],
    responses={
        200: {"description": "App of the day"},
        404: {"description": "No app of the day for this date"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
@cache.cached(ttl=21600)
async def get_app_of_the_day(
    date: datetime.date = Path(
        examples=[
            "2021-01-01",
            "2023-10-21",
        ],
    ),
) -> AppOfTheDay:
    with get_db("replica") as db:
        app_of_the_day = models.AppOfTheDay.by_date(db, date)

        if app_of_the_day is None:
            return AppOfTheDay(app_id="tv.kodi.Kodi", day=date)

        app = models.App.by_appid(db, app_of_the_day.app_id)
        if app and app.excluded_from_app_picks:
            return AppOfTheDay(app_id="tv.kodi.Kodi", day=date)

        return AppOfTheDay(app_id=app_of_the_day.app_id, day=date)


class AppOfTheWeek(BaseModel):
    app_id: str
    position: int
    isFullscreen: bool


class AppsOfTheWeek(BaseModel):
    apps: list[AppOfTheWeek]


class CuratedAppSelectionApp(BaseModel):
    app_id: str
    position: int


class CuratedAppSelection(BaseModel):
    id: int
    theme_key: str
    slot: str
    starts_at: datetime.date
    ends_at: datetime.date
    apps: list[CuratedAppSelectionApp]


class CuratedAppSelections(BaseModel):
    selections: list[CuratedAppSelection]


class SelectionTheme(BaseModel):
    id: int
    key: str
    name: str
    enabled: bool


class ScheduledSelectionAppInput(BaseModel):
    app_id: str
    position: int = Field(ge=0)


class ScheduledSelectionInput(BaseModel):
    theme_id: int
    slot: str
    starts_at: datetime.date
    ends_at: datetime.date
    enabled: bool = False
    apps: list[ScheduledSelectionAppInput]


class ScheduledSelectionAdmin(CuratedAppSelection):
    theme_id: int
    enabled: bool


def _theme_to_response(theme: models.SelectionTheme) -> SelectionTheme:
    return SelectionTheme(
        id=theme.id,
        key=theme.key,
        name=theme.name,
        enabled=theme.enabled,
    )


def _selection_to_response(
    selection: models.ScheduledSelection,
    allowed_app_ids: set[str] | None = None,
) -> CuratedAppSelection | None:
    apps = [
        CuratedAppSelectionApp(app_id=app.app_id, position=app.position)
        for app in selection.apps
        if allowed_app_ids is None or app.app_id in allowed_app_ids
    ]
    if not apps:
        return None

    return CuratedAppSelection(
        id=selection.id,
        theme_key=selection.theme.key,
        slot=selection.slot,
        starts_at=selection.starts_at,
        ends_at=selection.ends_at,
        apps=apps,
    )


def _selection_to_admin_response(
    selection: models.ScheduledSelection,
) -> ScheduledSelectionAdmin:
    public_selection = _selection_to_response(selection)
    if public_selection is None:
        raise HTTPException(500, "Scheduled selection has no apps")

    return ScheduledSelectionAdmin(
        **public_selection.model_dump(),
        theme_id=selection.theme_id,
        enabled=selection.enabled,
    )


def _app_pick_recommendation_ids(db, recommendation_date: datetime.date) -> set[str]:
    return {
        app.app_id
        for app in models.App.app_pick_recommendations(
            db, recommendation_date
        ).recommendations
    }


def _validate_scheduled_selection(
    db,
    body: ScheduledSelectionInput,
    selection_id: int | None = None,
) -> models.SelectionTheme:
    theme = models.SelectionTheme.by_id(db, body.theme_id)
    if theme is None or not theme.enabled:
        raise HTTPException(400, "Unknown or inactive selection theme")

    if body.slot not in models.CURATED_APP_SELECTION_SLOTS:
        raise HTTPException(400, "Unknown curated app selection slot")

    if body.starts_at > body.ends_at:
        raise HTTPException(400, "Selection start date must not be after end date")

    if not body.apps:
        raise HTTPException(400, "Scheduled selections must contain at least one app")

    app_ids = [app.app_id for app in body.apps]
    if len(app_ids) != len(set(app_ids)):
        raise HTTPException(400, "Scheduled selection apps must be unique")

    positions = [app.position for app in body.apps]
    if len(positions) != len(set(positions)):
        raise HTTPException(400, "Scheduled selection app positions must be unique")

    allowed_app_ids = _app_pick_recommendation_ids(db, datetime.date.today())
    invalid_app_ids = sorted(set(app_ids) - allowed_app_ids)
    if invalid_app_ids:
        raise HTTPException(
            400,
            f"Apps outside the app-pick recommendation pool: {', '.join(invalid_app_ids)}",
        )

    if body.enabled and models.ScheduledSelection.has_enabled_overlap(
        db, body.slot, body.starts_at, body.ends_at, selection_id
    ):
        raise HTTPException(
            400, "Enabled scheduled selections must not overlap in the same slot"
        )

    return theme


@router.get(
    "/apps-of-the-week/{date}",
    tags=["app-picks"],
    responses={
        200: {"description": "Apps of the week"},
        404: {"description": "No apps of the week for this date"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
@cache.cached(ttl=21600)
async def get_app_of_the_week(
    date: datetime.date = Path(
        examples=[
            "2021-01-01",
            "2023-10-21",
        ],
    ),
) -> AppsOfTheWeek:
    """Returns apps of the week"""
    with get_db("replica") as db:
        apps_of_the_week = models.AppsOfTheWeek.by_week(
            db, date.isocalendar().week, date.year
        )

        return AppsOfTheWeek(
            apps=[
                AppOfTheWeek(
                    app_id=app.app_id,
                    position=app.position,
                    isFullscreen=models.App.get_fullscreen_app(db, app.app_id),
                )
                for app in apps_of_the_week
                if (
                    (db_app := models.App.by_appid(db, app.app_id)) is not None
                    and not db_app.excluded_from_app_picks
                )
            ]
        )


@router.get(
    "/curated-app-selections/{date}",
    tags=["app-picks"],
    responses={
        200: {"description": "Active curated app selections"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
@cache.cached(ttl=21600)
async def get_curated_app_selections(
    date: datetime.date = Path(
        examples=[
            "2026-07-05",
        ],
    ),
) -> CuratedAppSelections:
    with get_db("replica") as db:
        allowed_app_ids = _app_pick_recommendation_ids(db, date)
        selections = []
        used_slots = set()
        for selection in models.ScheduledSelection.active_by_date(db, date):
            if selection.slot in used_slots:
                continue

            response = _selection_to_response(selection, allowed_app_ids)
            if response is None:
                continue

            selections.append(response)
            used_slots.add(selection.slot)

        return CuratedAppSelections(selections=selections)


@router.get(
    "/admin/apps-of-the-week/{date}",
    tags=["app-picks"],
    responses={
        200: {"description": "Apps of the week"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
async def get_app_of_the_week_admin(
    response: Response,
    date: datetime.date = Path(
        examples=[
            "2021-01-01",
            "2023-10-21",
        ],
    ),
    _moderator=Depends(quality_moderator_only),
) -> AppsOfTheWeek:
    """Returns apps of the week for the admin page, bypassing CDN cache"""
    response.headers["Cache-Control"] = "private"
    with get_db("writer") as db:
        apps_of_the_week = models.AppsOfTheWeek.by_week(
            db, date.isocalendar().week, date.year
        )

        return AppsOfTheWeek(
            apps=[
                AppOfTheWeek(
                    app_id=app.app_id,
                    position=app.position,
                    isFullscreen=models.App.get_fullscreen_app(db, app.app_id),
                )
                for app in apps_of_the_week
                if (
                    (db_app := models.App.by_appid(db, app.app_id)) is not None
                    and not db_app.excluded_from_app_picks
                )
            ]
        )


@router.get(
    "/admin/curated-app-selection-themes",
    tags=["app-picks"],
    responses={
        200: {"description": "Curated app selection themes"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        500: {"description": "Internal server error"},
    },
)
async def get_curated_app_selection_themes_admin(
    response: Response,
    _moderator=Depends(quality_moderator_only),
) -> list[SelectionTheme]:
    response.headers["Cache-Control"] = "private"
    with get_db("writer") as db:
        return [
            _theme_to_response(theme)
            for theme in models.SelectionTheme.all(db, include_disabled=True)
        ]


@router.get(
    "/admin/curated-app-selections",
    tags=["app-picks"],
    responses={
        200: {"description": "Curated app selection schedules"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        500: {"description": "Internal server error"},
    },
)
async def get_curated_app_selections_admin(
    response: Response,
    _moderator=Depends(quality_moderator_only),
) -> list[ScheduledSelectionAdmin]:
    response.headers["Cache-Control"] = "private"
    with get_db("writer") as db:
        return [
            _selection_to_admin_response(selection)
            for selection in models.ScheduledSelection.all(db)
        ]


@router.post(
    "/admin/curated-app-selections",
    tags=["app-picks"],
    responses={
        200: {"description": "Created curated app selection schedule"},
        400: {"description": "Invalid curated app selection schedule"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
async def create_curated_app_selection_admin(
    body: ScheduledSelectionInput,
    _moderator=Depends(quality_moderator_only),
) -> ScheduledSelectionAdmin:
    with get_db("writer") as db:
        theme = _validate_scheduled_selection(db, body)
        selection = models.ScheduledSelection(
            theme_id=body.theme_id,
            slot=body.slot,
            starts_at=body.starts_at,
            ends_at=body.ends_at,
            enabled=body.enabled,
        )
        selection.theme = theme
        db.session.add(selection)
        db.session.flush()
        selection.apps = [
            models.ScheduledSelectionApp(
                scheduled_selection_id=selection.id,
                app_id=app.app_id,
                position=app.position,
            )
            for app in sorted(body.apps, key=lambda app: app.position)
        ]
        db.session.flush()
        result = _selection_to_admin_response(selection)

    await cache.invalidate_cache_by_pattern(
        "cache:endpoint:get_curated_app_selections:*"
    )
    return result


@router.put(
    "/admin/curated-app-selections/{selection_id}",
    tags=["app-picks"],
    responses={
        200: {"description": "Updated curated app selection schedule"},
        400: {"description": "Invalid curated app selection schedule"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        404: {"description": "Curated app selection schedule not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
async def update_curated_app_selection_admin(
    body: ScheduledSelectionInput,
    selection_id: int = Path(),
    _moderator=Depends(quality_moderator_only),
) -> ScheduledSelectionAdmin:
    with get_db("writer") as db:
        selection = models.ScheduledSelection.by_id(db, selection_id)
        if selection is None:
            raise HTTPException(404, "Curated app selection schedule not found")

        theme = _validate_scheduled_selection(db, body, selection_id)
        selection.theme_id = body.theme_id
        selection.theme = theme
        selection.slot = body.slot
        selection.starts_at = body.starts_at
        selection.ends_at = body.ends_at
        selection.enabled = body.enabled
        db.session.query(models.ScheduledSelectionApp).filter_by(
            scheduled_selection_id=selection.id
        ).delete()
        db.session.flush()
        selection.apps = [
            models.ScheduledSelectionApp(
                scheduled_selection_id=selection.id,
                app_id=app.app_id,
                position=app.position,
            )
            for app in sorted(body.apps, key=lambda app: app.position)
        ]
        db.session.flush()
        result = _selection_to_admin_response(selection)

    await cache.invalidate_cache_by_pattern(
        "cache:endpoint:get_curated_app_selections:*"
    )
    return result


@router.delete(
    "/admin/curated-app-selections/{selection_id}",
    tags=["app-picks"],
    responses={
        204: {"description": "Deleted curated app selection schedule"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        404: {"description": "Curated app selection schedule not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
    status_code=204,
)
async def delete_curated_app_selection_admin(
    selection_id: int = Path(),
    _moderator=Depends(quality_moderator_only),
) -> None:
    with get_db("writer") as db:
        selection = models.ScheduledSelection.by_id(db, selection_id)
        if selection is None:
            raise HTTPException(404, "Curated app selection schedule not found")
        db.session.delete(selection)

    await cache.invalidate_cache_by_pattern(
        "cache:endpoint:get_curated_app_selections:*"
    )


class UpsertAppOfTheWeek(BaseModel):
    app_id: str
    weekNumber: int
    year: int
    position: int


@router.post(
    "/app-of-the-week",
    tags=["app-picks"],
    responses={
        200: {"description": "Successfully set app of the week"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
async def set_app_of_the_week(
    body: UpsertAppOfTheWeek,
    moderator=Depends(quality_moderator_only),
):
    """Sets an app of the week"""
    with get_db("writer") as db:
        models.AppsOfTheWeek.upsert(
            db,
            body.app_id,
            body.weekNumber,
            body.year,
            body.position,
            moderator.user.id,
        )
        await cache.invalidate_cache_by_pattern("cache:endpoint:get_app_of_the_week:*")


@router.post(
    "/app-of-the-day",
    tags=["app-picks"],
    responses={
        200: {"description": "Successfully set app of the day"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - quality moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
async def set_app_of_the_day(
    body: AppOfTheDay,
    _moderator=Depends(quality_moderator_only),
) -> AppOfTheDay | None:
    """Sets an app of the day"""
    with get_db("writer") as db:
        app = models.AppOfTheDay.set_app_of_the_day(db, body.app_id, body.day)
        await cache.invalidate_cache_by_pattern("cache:endpoint:get_app_of_the_day:*")

        if app:
            return AppOfTheDay(app_id=app.app_id, day=app.date)
        return None
