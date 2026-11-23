from typing import Annotated, Literal

from fastapi import APIRouter, FastAPI, HTTPException, Path, Query
from github import Github, GithubException
from pydantic import BaseModel, Field, StringConstraints

from .. import cache, config
from ..database import get_db
from ..login_info import ManageAppsDep
from ..metadata_translation_artifacts import PublishedListingUnavailable
from ..metadata_translation_batches import (
    TextConflict,
    dismiss_previous_translation,
    queue_translation,
    read_saved_translation,
    rebase_translation,
    unavailable_source_snapshot,
)
from ..metadata_translation_github import (
    read_source,
)
from ..metadata_translation_queue import TranslationQueue, language_queue
from ..metadata_translation_target import RecipeTarget, excluded_addon_ids, target_of
from ..metadata_translations import (
    LOCALE_PATTERN,
    QUEUE_FIELDS,
    MetadataError,
    SharedTranslationUnit,
    TranslationUnit,
)
from ..models import App

router = APIRouter(prefix="/metadata-translations", tags=["metadata-translations"])
AppId = Annotated[
    str, Path(min_length=6, max_length=255, pattern=r"^[A-Za-z_][\w\-\.]+$")
]
Locale = Annotated[str, Query(min_length=2, max_length=40, pattern=LOCALE_PATTERN)]


class TranslationSource(BaseModel):
    queue_fields: list[str] = Field(default_factory=lambda: sorted(QUEUE_FIELDS))
    revision: str
    path: str
    source_url: str
    metadata_license: str
    locale: str
    units: list[SharedTranslationUnit]
    previous_translations: list[TranslationUnit] = Field(default_factory=list)
    can_submit: bool
    batch_state: str | None = None
    batch_error: str | None = None
    pull_request_url: str | None = None


class TranslationRevision(BaseModel):
    revision: str = Field(pattern=r"^[0-9a-f]{40}$")


class TranslationChanges(TranslationRevision):
    versions: dict[
        str, Annotated[str, StringConstraints(min_length=1, max_length=64)]
    ] = Field(min_length=1, max_length=2000)
    changes: dict[str, Annotated[str, StringConstraints(max_length=20000)]] = Field(
        min_length=1, max_length=2000
    )


class TranslationSave(BaseModel):
    url: str | None = None
    state: str
    units: list[SharedTranslationUnit]


def _repo(app_id: str, *, write: bool = False):
    with get_db("replica") as db:
        app = App.by_appid(db, app_id)
        if app is None:
            raise HTTPException(404, detail="app_not_found")
        if (
            app.type == "addon"
            and db.query(
                excluded_addon_ids().where(App.app_id == app_id).exists()
            ).scalar()
        ):
            raise MetadataError("unsupported_metadata")
        target = RecipeTarget.for_app(db, app_id, app.type, app.appstream)
    if write and not config.settings.github_bot_token:
        raise HTTPException(503, detail="submission_unavailable")
    return target.open(Github(config.settings.github_bot_token), discover=True)


def _error(error: MetadataError | GithubException) -> HTTPException:
    if isinstance(error, MetadataError):
        if isinstance(error, PublishedListingUnavailable):
            return HTTPException(503, detail=str(error))
        return HTTPException(
            409 if str(error) == "source_changed" else 422, detail=str(error)
        )
    if error.status == 404:
        return HTTPException(404, detail="metadata_not_found")
    return HTTPException(502, detail="github_unavailable")


@router.get("/queue")
@cache.no_store
def get_translation_queue(locale: Locale, login: ManageAppsDep) -> TranslationQueue:
    return language_queue(locale)


@router.get("/{app_id}")
@cache.no_store
def get_translation_source(
    app_id: AppId, locale: Locale, login: ManageAppsDep
) -> TranslationSource:
    try:
        repo = _repo(app_id)
        source = read_source(repo, app_id)
        source, document, state, error, url, previous = read_saved_translation(
            repo, source, app_id, locale
        )
        return TranslationSource(
            revision=source.revision,
            path=source.path,
            source_url=f"https://github.com/flathub/{target_of(repo, app_id).repository}/blob/{source.revision}/{source.path}",
            metadata_license=document.license,
            locale=document.locale,
            units=document.units(),
            previous_translations=previous,
            can_submit=bool(config.settings.github_bot_token)
            and bool(document.license)
            and error != "source_changed",
            batch_state=state,
            batch_error=error,
            pull_request_url=url,
        )
    except HTTPException as error:
        if error.detail == "app_not_found":
            snapshot = unavailable_source_snapshot(app_id, locale)
            if snapshot is not None:
                return TranslationSource(**snapshot)
        raise
    except (MetadataError, GithubException) as error:
        if isinstance(error, MetadataError) or error.status == 404:
            snapshot = unavailable_source_snapshot(app_id, locale)
            if snapshot is not None:
                return TranslationSource(**snapshot)
        raise _error(error) from error


class TextConflictDetail(BaseModel):
    code: Literal["text_conflict"]
    unit: SharedTranslationUnit


class TranslationConflict(BaseModel):
    detail: Literal["source_changed"] | TextConflictDetail


@router.post("/{app_id}", responses={409: {"model": TranslationConflict}})
@cache.private
def save_listing_translations(
    app_id: AppId,
    locale: Locale,
    body: TranslationChanges,
    login: ManageAppsDep,
) -> TranslationSave:
    try:
        result = queue_translation(
            _repo(app_id, write=True),
            app_id,
            locale,
            body.revision,
            body.changes,
            login.user.id,
            versions=body.versions,
        )
        return TranslationSave.model_validate(result)
    except TextConflict as error:
        raise HTTPException(
            409, detail={"code": "text_conflict", "unit": error.unit.model_dump()}
        ) from error
    except (MetadataError, GithubException) as error:
        raise _error(error) from error


@router.post("/{app_id}/rebase")
@cache.private
def rebase_translation_source(
    app_id: AppId,
    locale: Locale,
    body: TranslationRevision,
    login: ManageAppsDep,
) -> None:
    try:
        rebase_translation(_repo(app_id, write=True), app_id, locale, body.revision)
    except (MetadataError, GithubException) as error:
        raise _error(error) from error


@router.post("/{app_id}/dismiss")
@cache.private
def dismiss_recovered_translation(
    app_id: AppId, locale: Locale, body: TranslationUnit, login: ManageAppsDep
) -> list[TranslationUnit]:
    return dismiss_previous_translation(app_id, locale, body.model_dump())


def register_to_app(app: FastAPI):
    app.include_router(router)
