import base64
import hashlib
import hmac
import itertools
import json
import logging
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Annotated, Any

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from github import Github, GithubException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, not_, or_

from . import (
    audit_log,
    cache,
    config,
    http_client,
    manifest_complexity,
    models,
    ostree_manifest,
    summary,
    url_origin,
    utils,
    worker,
)
from .database import get_db, get_json_key
from .emails import EmailCategory
from .login_info import LoginStatusDep, ModeratorDep
from .moderation_constants import should_skip_review
from .types import ModerationRequestType

router = APIRouter(prefix="/moderation")
logger = logging.getLogger(__name__)


_RANDOM_REVIEW_MARKER = "Randomly selected for human review"


def _extra_data_origins(extra_data: dict[str, Any]) -> list[str] | None:
    uri_values = [
        value
        for key, value in extra_data.items()
        if key == "uri" or (key.startswith("uri") and key != "uri")
    ]
    if not uri_values:
        return None

    origins: set[str] = set()
    for value in uri_values:
        try:
            origin = url_origin.normalize_url_origin(value)
        except url_origin.InvalidUrlOrigin:
            return None
        if origin is not None:
            origins.add(origin)

    return sorted(origins)


def _extra_data_moderation_values(
    current_extra_data: dict[str, Any] | None,
    build_extra_data: dict[str, Any] | None,
) -> tuple[bool | list[str], bool | list[str]] | None:
    current_has_extra_data = bool(current_extra_data)
    build_has_extra_data = bool(build_extra_data)
    if current_has_extra_data != build_has_extra_data:
        return current_has_extra_data, build_has_extra_data
    if not current_has_extra_data:
        return None

    current_origins = (
        _extra_data_origins(current_extra_data)
        if isinstance(current_extra_data, dict)
        else None
    )
    build_origins = (
        _extra_data_origins(build_extra_data)
        if isinstance(build_extra_data, dict)
        else None
    )
    if (
        current_origins is not None
        and build_origins is not None
        and current_origins == build_origins
    ):
        return None

    return (
        current_origins or ["<invalid or missing current extra-data URL>"],
        build_origins or ["<invalid or missing new extra-data URL>"],
    )


def _canonical_random_review_identity(
    build_metadata: dict[str, Any], build_refs: list[dict[str, Any]]
) -> bytes:
    if not isinstance(build_metadata, dict) or not isinstance(build_refs, list):
        raise TypeError("build metadata or references are missing")

    repository = build_metadata.get("repo")
    if not isinstance(repository, str) or not repository:
        raise ValueError("build repository is missing")

    ref_commits: list[tuple[str, str]] = []
    for build_ref in build_refs:
        if not isinstance(build_ref, dict):
            raise TypeError("build reference is invalid")

        ref_name = build_ref.get("ref_name")
        commit = build_ref.get("commit")
        if not isinstance(ref_name, str) or not ref_name:
            raise ValueError("build reference name is missing")
        if not isinstance(commit, str) or not commit:
            raise ValueError("build reference commit is missing")

        ref_commits.append((ref_name, commit))

    if not ref_commits:
        raise ValueError("build references are missing")

    return json.dumps(
        {"repo": repository, "refs": sorted(ref_commits)},
        ensure_ascii=True,
        separators=(",", ":"),
    ).encode("utf-8")


def _random_review_sample_value(identity: bytes, secret: str) -> float:
    digest = hmac.new(
        secret.encode("utf-8"),
        identity,
        hashlib.sha256,
    ).digest()
    sample_bits = int.from_bytes(digest, byteorder="big") >> (len(digest) * 8 - 53)
    return sample_bits / (1 << 53)


def _random_review_request_data() -> dict[str, dict[str, str]]:
    return {
        "keys": {"human_review": _RANDOM_REVIEW_MARKER},
        "current_values": {},
    }


def _is_random_review_request(request: models.ModerationRequest) -> bool:
    try:
        request_data = json.loads(request.request_data)
    except (TypeError, json.JSONDecodeError):
        return False

    return request_data == _random_review_request_data()


class ModerationAppItem(BaseModel):
    appid: str
    is_new_submission: bool
    updated_at: datetime | None = None
    request_types: list[ModerationRequestType]


class ModerationAppsResponse(BaseModel):
    apps: list[ModerationAppItem]
    apps_count: int


class RequestData(BaseModel):
    keys: dict[str, str | None | list | dict | bool]
    current_values: dict[str, str | None | list | dict | bool]


class ManifestSourceOriginFindingData(BaseModel):
    origins_added: list[str]
    origins_removed: list[str]
    locations_by_origin: dict[str, list[str]]
    arches: list[str]


class ManifestComplexityBreakdownData(BaseModel):
    structural_units: int = Field(ge=0)
    recipe_units: int = Field(ge=0)
    breadth_units: int = Field(ge=0, le=8)
    ambiguity_units: int = Field(ge=0)


class ManifestComplexityEventData(BaseModel):
    kind: manifest_complexity.ManifestChangeKind
    location: str
    arches: list[str]
    old_summary: manifest_complexity.JSONValue | None = None
    new_summary: manifest_complexity.JSONValue | None = None
    magnitude: int | None = Field(default=None, ge=0)


def _manifest_event_data_key(
    event: ManifestComplexityEventData,
) -> tuple[object, ...]:
    return (
        event.kind.value,
        event.location,
        json.dumps(
            event.old_summary,
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        ),
        json.dumps(
            event.new_summary,
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        ),
        -1 if event.magnitude is None else event.magnitude,
        tuple(event.arches),
    )


class ManifestComplexityRequestData(BaseModel):
    algorithm_version: int = Field(ge=1)
    analysis_fingerprint: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    score_units: int = Field(ge=0, le=40)
    raw_score_units: int = Field(ge=0)
    display_score: float = Field(ge=0, le=20)
    threshold_units: int = Field(ge=1, le=40)
    score_band: manifest_complexity.ManifestComplexityScoreBand
    score_breakdown: ManifestComplexityBreakdownData
    affected_arches: list[str]
    touched_modules: list[str] = Field(max_length=50)
    touched_modules_truncated: bool
    total_touched_module_count: int = Field(ge=0)
    events: list[ManifestComplexityEventData] = Field(max_length=25)
    events_truncated: bool
    total_event_count: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_derived_fields(self):
        if self.display_score != self.score_units / 2:
            raise ValueError("display_score does not match score_units")
        if self.score_units != min(
            self.raw_score_units,
            manifest_complexity.MANIFEST_COMPLEXITY_MAX_SCORE_UNITS,
        ):
            raise ValueError("score_units does not match raw_score_units")
        if self.score_band is not manifest_complexity.manifest_complexity_score_band(
            self.score_units
        ):
            raise ValueError("score_band does not match score_units")
        breakdown_total = (
            self.score_breakdown.structural_units
            + self.score_breakdown.recipe_units
            + self.score_breakdown.breadth_units
            + self.score_breakdown.ambiguity_units
        )
        if breakdown_total != self.raw_score_units:
            raise ValueError("score breakdown does not match raw_score_units")
        if self.affected_arches != sorted(set(self.affected_arches)):
            raise ValueError("affected_arches must be sorted and unique")
        if self.touched_modules != sorted(set(self.touched_modules)):
            raise ValueError("touched_modules must be sorted and unique")
        if any(event.arches != sorted(set(event.arches)) for event in self.events):
            raise ValueError("event arches must be sorted and unique")
        if self.events != sorted(self.events, key=_manifest_event_data_key):
            raise ValueError("events must use canonical order")
        if self.total_touched_module_count < len(self.touched_modules):
            raise ValueError("invalid touched module total")
        if self.total_event_count < len(self.events):
            raise ValueError("invalid event total")
        if self.touched_modules_truncated != (
            self.total_touched_module_count > len(self.touched_modules)
        ):
            raise ValueError("invalid touched module truncation flag")
        if self.events_truncated != self.total_event_count > len(self.events):
            raise ValueError("invalid event truncation flag")
        return self


class ManifestSourceOriginRequestData(BaseModel):
    findings: list[ManifestSourceOriginFindingData]
    complexity: ManifestComplexityRequestData | None = None


class ModerationRequestResponse(BaseModel):
    id: int
    app_id: str
    created_at: datetime

    build_id: int
    job_id: int
    is_outdated: bool

    request_type: ModerationRequestType
    request_data: RequestData | ManifestSourceOriginRequestData | None = None
    build_log_url: str | None = None
    is_new_submission: bool

    handled_by: str | None = None
    handled_at: datetime | None = None
    is_approved: bool | None = None
    comment: str | None = None


class ModerationApp(BaseModel):
    requests: list[ModerationRequestResponse]
    requests_count: int


def create_github_build_rejection_issue(request: models.ModerationRequest):
    gh_token = config.settings.github_bot_token
    if not gh_token:
        return

    gh = Github(gh_token)

    app_id = request.appid
    build_id = request.build_id
    build_log_url = request.build_log_url
    comment = request.comment
    quoted_comment = "\n".join(f"> {line}" for line in comment.rstrip().splitlines())

    repo = gh.get_repo(f"flathub/{app_id}")
    if not repo:
        return

    recent_merged_by = None
    try:
        prs = repo.get_pulls(state="closed", sort="updated", direction="desc")
        latest_pr = next((pr for pr in prs if pr.merged_at), None)
        if latest_pr and latest_pr.merged_by:
            login = latest_pr.merged_by.login
            if login not in ("web-flow", "flathubbot", "github-actions[bot]"):
                recent_merged_by = login
    except GithubException:
        pass

    request_data = json.loads(request.request_data)
    is_random_review = _is_random_review_request(request)
    title = (
        f"Random human review for build {build_id} rejected"
        if is_random_review
        else f"Change in build {build_id} rejected"
    )
    body = (
        (
            f"Build [{build_id}]({build_log_url}) was randomly selected for human review and rejected by the Flathub team (@flathub/build-moderation) for the following reason:\n"
        )
        if is_random_review
        else (
            f"A change in [build {build_id}]({build_log_url}) has been reviewed by the Flathub team (@flathub/build-moderation), and rejected for the following reason:\n"
        )
    )
    body += f"\n{quoted_comment}\n"

    if is_random_review:
        body += f"\n## Review reason\n\n{_RANDOM_REVIEW_MARKER}\n"
    elif request.request_type == ModerationRequestType.MANIFEST:
        complexity = request_data.get("complexity")
        if complexity:
            body += "\n## Manifest packaging complexity\n"
            score = complexity["score_units"] / 2
            score_text = (
                "20+"
                if complexity["score_units"] == 40
                and complexity["raw_score_units"] > 40
                else f"{score:g}"
            )
            threshold = complexity["threshold_units"] / 2
            body += (
                "\nThis build was selected because its packaging recipe changed broadly or structurally. "
                "This score is not a security-risk or malicious-change assessment.\n"
            )
            body += f"\n- Score: **{score_text}** / threshold **{threshold:g}**\n"
            body += f"- Band: **{complexity['score_band']}**\n"
            breakdown = complexity["score_breakdown"]
            body += (
                f"- Breakdown units: structural {breakdown['structural_units']}, "
                f"recipe {breakdown['recipe_units']}, breadth {breakdown['breadth_units']}, "
                f"ambiguity {breakdown['ambiguity_units']}\n"
            )
            body += f"- Architectures: {', '.join(complexity['affected_arches']) or 'none'}\n"
            for module in complexity["touched_modules"]:
                body += f"- Module: `{module}`\n"
            for event in complexity["events"]:
                body += f"- `{event['kind']}` at `{event['location']}`"
                if event.get("magnitude") is not None:
                    body += f" (magnitude {event['magnitude']})"
                body += "\n"
            if complexity["events_truncated"]:
                body += (
                    f"- Showing {len(complexity['events'])} of "
                    f"{complexity['total_event_count']} events\n"
                )
            if complexity["touched_modules_truncated"]:
                body += (
                    f"- Showing {len(complexity['touched_modules'])} of "
                    f"{complexity['total_touched_module_count']} modules\n"
                )
        if request_data["findings"]:
            body += "\n## Manifest source changes\n"
            for finding in request_data["findings"]:
                body += f"\n### Architectures: {', '.join(finding['arches'])}\n"
                for source in finding["origins_added"]:
                    body += f"\n- New source: `{source}`\n"
                    for location in finding["locations_by_origin"].get(source, []):
                        body += f"  - Source location: `{location}`\n"
                for source in finding["origins_removed"]:
                    body += f"\n- Previous source no longer used: `{source}`\n"
    else:
        body += "\n## Changes\n| Field | Old value | New value |\n| --- | --- | --- |\n"
        for field in request_data["keys"]:
            old_val = request_data["current_values"].get(field)
            new_val = request_data["keys"][field]
            body += f"| {field} | {old_val} | {new_val} |\n"

    ret = repo.create_issue(title=title, body=body)

    if recent_merged_by:
        try:
            ret.add_to_assignees(recent_merged_by)
        except GithubException:
            pass

    return ret


def sort_lists_in_dict(data: dict) -> dict:
    if isinstance(data, dict):
        for key, value in data.items():
            data[key] = sort_lists_in_dict(value)
    elif isinstance(data, list):
        data.sort()
    return data


@router.get(
    "/apps",
    status_code=200,
    response_model_exclude_none=True,
    tags=["moderation"],
    responses={
        200: {"description": "List of apps with moderation requests"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - moderator required"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
@cache.private
def get_moderation_apps(
    new_submissions: bool | None = None,
    show_handled: bool = False,
    limit: int = 100,
    offset: int = 0,
    *,
    _moderator: ModeratorDep,
) -> ModerationAppsResponse:
    """Get a list of apps with unhandled moderation requests."""

    with get_db("replica") as db_session:
        is_new_submission = func.bool_or(
            models.ModerationRequest.is_new_submission
        ).label("is_new_submission")
        query = (
            db_session.session.query(
                models.ModerationRequest.appid,
                is_new_submission,
                func.max(models.ModerationRequest.created_at).label("updated_at"),
                func.array_agg(models.ModerationRequest.request_type.distinct()).label(
                    "request_types"
                ),
            )
            .filter(
                (
                    models.ModerationRequest.handled_at.is_(None)
                    if show_handled is False
                    else models.ModerationRequest.handled_at.isnot(None)
                ),
                models.ModerationRequest.is_outdated.is_(False),
            )
            .group_by(models.ModerationRequest.appid)
            .order_by(func.max(models.ModerationRequest.created_at).desc())
        )

        if new_submissions is not None:
            query = query.having(is_new_submission == new_submissions)

        total = query.count()
        query = query.offset(offset).limit(limit)

        results = [ModerationAppItem(**row._asdict()) for row in query]

    return ModerationAppsResponse(
        apps=results,
        apps_count=total,
    )


@router.get(
    "/apps/{app_id}",
    status_code=200,
    response_model_exclude_none=True,
    tags=["moderation"],
    responses={
        200: {"description": "Moderation details for the app"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - not authorized for this app"},
        404: {"description": "App not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
@cache.private
def get_moderation_app(
    login: LoginStatusDep,
    app_id: str = Path(
        min_length=6,
        max_length=255,
        pattern=r"^[A-Za-z_][\w\-\.]+$",
        examples=["org.gnome.Glade"],
    ),
    include_outdated: bool = False,
    include_handled: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> ModerationApp:
    """Get a list of moderation requests for an app."""

    if login.user is None:
        raise HTTPException(status_code=401, detail="not_logged_in")

    with get_db("replica") as db:
        user = db.session.merge(login.user)
        if "moderation" not in user.permissions() and app_id not in user.dev_flatpaks(
            db
        ):
            raise HTTPException(status_code=403, detail="forbidden")

        query = (
            db.session.query(models.ModerationRequest, models.FlathubUser.display_name)
            .filter_by(appid=app_id)
            .order_by(models.ModerationRequest.created_at.desc())
        )

        # include_handled should include outdated+handled requests
        if include_handled:
            if not include_outdated:
                query = query.filter(
                    or_(
                        models.ModerationRequest.handled_at.isnot(None),
                        not_(models.ModerationRequest.is_outdated),
                    )
                )
        else:
            query = query.filter_by(handled_at=None)
            if not include_outdated:
                query = query.filter_by(is_outdated=False)

        query = query.join(models.FlathubUser, isouter=True)

        total = query.count()
        query = query.offset(offset).limit(limit)

        # Execute the query and process results within the session
        results = []
        for row, handled_by_name in query:
            results.append(
                ModerationRequestResponse(
                    id=row.id,
                    app_id=row.appid,
                    request_type=row.request_type,
                    request_data=json.loads(row.request_data),
                    build_id=row.build_id,
                    build_log_url=row.build_log_url,
                    job_id=row.job_id,
                    is_approved=row.is_approved,
                    handled_by=handled_by_name,
                    handled_at=row.handled_at if row.handled_at else None,
                    comment=row.comment,
                    is_outdated=row.is_outdated,
                    is_new_submission=row.is_new_submission,
                    created_at=row.created_at,
                )
            )

    return ModerationApp(
        requests=results,
        requests_count=total,
    )


class ReviewItem(BaseModel):
    name: str | None = None
    summary: str | None = None
    developer_name: str | None = None
    project_license: str | None = None


class ReviewRequest(BaseModel):
    build_id: int
    job_id: int


class ReviewRequestResponse(BaseModel):
    requires_review: bool


def _bounded_manifest_text(value: str) -> str:
    return value if len(value) <= 512 else value[:511] + "…"


def _manifest_complexity_fingerprint(
    review_request: ReviewRequest,
    app_id: str,
    analysis: manifest_complexity.ManifestComplexityResult,
) -> str:
    payload = {
        "build_id": review_request.build_id,
        "job_id": review_request.job_id,
        "app_id": app_id,
        "algorithm_version": analysis.algorithm_version,
        "score_units": analysis.score_units,
        "raw_score_units": analysis.raw_score_units,
        "structural_units": analysis.structural_units,
        "recipe_units": analysis.recipe_units,
        "breadth_units": analysis.breadth_units,
        "ambiguity_units": analysis.ambiguity_units,
        "affected_arches": list(analysis.affected_arches),
        "touched_modules": list(analysis.touched_modules),
        "changed_categories": list(analysis.changed_categories),
        "events": [
            {
                "kind": event.kind.value,
                "location": event.location,
                "arches": list(event.arches),
                "old_summary": event.old_summary,
                "new_summary": event.new_summary,
                "magnitude": event.magnitude,
            }
            for event in analysis.events
        ],
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )
    return "sha256:" + hashlib.sha256(canonical.encode()).hexdigest()


def _manifest_complexity_request_data(
    review_request: ReviewRequest,
    app_id: str,
    analysis: manifest_complexity.ManifestComplexityResult,
) -> ManifestComplexityRequestData:
    stored_modules = sorted(
        {_bounded_manifest_text(module) for module in analysis.touched_modules[:50]}
    )
    stored_events = sorted(
        [
            ManifestComplexityEventData(
                kind=event.kind,
                location=_bounded_manifest_text(event.location),
                arches=list(event.arches),
                old_summary=event.old_summary,
                new_summary=event.new_summary,
                magnitude=event.magnitude,
            )
            for event in analysis.events[:25]
        ],
        key=_manifest_event_data_key,
    )
    return ManifestComplexityRequestData(
        algorithm_version=analysis.algorithm_version,
        analysis_fingerprint=_manifest_complexity_fingerprint(
            review_request, app_id, analysis
        ),
        score_units=analysis.score_units,
        raw_score_units=analysis.raw_score_units,
        display_score=analysis.score_units / 2,
        threshold_units=config.settings.ostree_manifest_complexity_threshold_units,
        score_band=manifest_complexity.manifest_complexity_score_band(
            analysis.score_units
        ),
        score_breakdown=ManifestComplexityBreakdownData(
            structural_units=analysis.structural_units,
            recipe_units=analysis.recipe_units,
            breadth_units=analysis.breadth_units,
            ambiguity_units=analysis.ambiguity_units,
        ),
        affected_arches=list(analysis.affected_arches),
        touched_modules=stored_modules,
        touched_modules_truncated=len(analysis.touched_modules) > len(stored_modules),
        total_touched_module_count=len(analysis.touched_modules),
        events=stored_events,
        events_truncated=len(analysis.events) > len(stored_events),
        total_event_count=len(analysis.events),
    )


def _manifest_request_data(
    findings: Sequence[ostree_manifest.ManifestSourceFinding],
    complexity: ManifestComplexityRequestData | None,
) -> str:
    body = ManifestSourceOriginRequestData(
        findings=[
            ManifestSourceOriginFindingData(
                origins_added=list(finding.sources_added),
                origins_removed=list(finding.sources_removed),
                locations_by_origin={
                    source: list(locations)
                    for source, locations in finding.locations_by_source.items()
                },
                arches=list(finding.arches),
            )
            for finding in findings
        ],
        complexity=complexity,
    )
    return json.dumps(
        body.model_dump(mode="json", exclude_none=True),
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    )


def _manifest_request_matches(
    stored_data: str,
    candidate_data: str,
) -> bool:
    try:
        stored = ManifestSourceOriginRequestData.model_validate_json(stored_data)
        candidate = ManifestSourceOriginRequestData.model_validate_json(candidate_data)
    except ValueError:
        return False
    if stored.findings != candidate.findings:
        return False
    stored_complexity = stored.complexity
    candidate_complexity = candidate.complexity
    if (stored_complexity is None) != (candidate_complexity is None):
        return False
    if stored_complexity is None or candidate_complexity is None:
        return True
    return (
        stored_complexity.analysis_fingerprint
        == candidate_complexity.analysis_fingerprint
    )


def _log_manifest_complexity(
    review_request: ReviewRequest,
    app_id: str,
    analysis: manifest_complexity.ManifestComplexityAnalysis,
    gate_suppressed_reason: str | None,
) -> None:
    threshold = config.settings.ostree_manifest_complexity_threshold_units
    if isinstance(analysis, manifest_complexity.ManifestComplexityResult):
        would_gate = analysis.score_units >= threshold
        score_units: int | None = analysis.score_units
        display_score: float | None = analysis.score_units / 2
        score_band: str | None = manifest_complexity.manifest_complexity_score_band(
            analysis.score_units
        ).value
        event_counts = dict(
            sorted(
                {
                    kind.value: sum(event.kind is kind for event in analysis.events)
                    for kind in manifest_complexity.ManifestChangeKind
                    if any(event.kind is kind for event in analysis.events)
                }.items()
            )
        )
        touched_count = len(analysis.touched_modules)
        fingerprint = _manifest_complexity_fingerprint(review_request, app_id, analysis)
        not_scored_reason = None
    else:
        would_gate = False
        score_units = None
        display_score = None
        score_band = None
        event_counts = {}
        touched_count = 0
        fingerprint = None
        not_scored_reason = analysis.reason.value
    logger.info(
        "Evaluated manifest packaging complexity for app",
        extra={
            "algorithm_version": analysis.algorithm_version,
            "build_id": review_request.build_id,
            "job_id": review_request.job_id,
            "app_id": app_id,
            "score_units": score_units,
            "display_score": display_score,
            "score_band": score_band,
            "event_counts_by_kind": event_counts,
            "touched_module_count": touched_count,
            "affected_arches": list(analysis.affected_arches),
            "would_gate": would_gate,
            "gating_enabled": config.settings.ostree_manifest_complexity_gating_enabled,
            "threshold_units": threshold,
            "not_scored_reason": not_scored_reason,
            "gate_suppressed_reason": gate_suppressed_reason,
            "analysis_fingerprint": fingerprint,
        },
    )


def _complexity_analysis_for_app(
    app_id: str,
    *,
    is_new_submission: bool,
    expected_refs_by_app: dict[str, set[tuple[str, str, str, str]]],
    collected_refs_by_app: dict[str, set[tuple[str, str, str, str]]],
    manifest_groups_by_app: dict[
        str, tuple[tuple[ostree_manifest.ManifestPair, ...], ...]
    ],
) -> manifest_complexity.ManifestComplexityAnalysis:
    expected = expected_refs_by_app.get(app_id, set())
    if is_new_submission:
        return manifest_complexity.ManifestComplexityNotScored(
            manifest_complexity.MANIFEST_COMPLEXITY_ALGORITHM_VERSION,
            manifest_complexity.ManifestComplexityNotScoredReason.INITIAL_SUBMISSION,
            tuple(sorted({identity[1] for identity in expected})),
        )
    missing = expected - collected_refs_by_app.get(app_id, set())
    if missing or not expected:
        return manifest_complexity.ManifestComplexityNotScored(
            manifest_complexity.MANIFEST_COMPLEXITY_ALGORITHM_VERSION,
            manifest_complexity.ManifestComplexityNotScoredReason.CANDIDATE_MANIFEST_UNAVAILABLE,
            tuple(sorted({identity[1] for identity in missing or expected})),
        )
    return manifest_complexity.analyze_manifest_complexity(
        manifest_groups_by_app.get(app_id, ())
    )


def _log_manifest_source_gate(
    review_request: ReviewRequest,
    app_id: str,
    findings: Sequence[ostree_manifest.ManifestSourceFinding],
    *,
    would_require_review: bool,
    reason: str | None = None,
) -> None:
    introduced_sources = sorted(
        {source for finding in findings for source in finding.sources_added}
    )
    removed_sources = sorted(
        {source for finding in findings for source in finding.sources_removed}
    )
    affected_arches = sorted({arch for finding in findings for arch in finding.arches})
    extra: dict[str, Any] = {
        "build_id": review_request.build_id,
        "job_id": review_request.job_id,
        "app_id": app_id,
        "introduced_sources": introduced_sources,
        "removed_sources": removed_sources,
        "affected_arches": affected_arches,
        "would_require_review": would_require_review,
    }
    if reason is not None:
        extra["reason"] = reason
    logger.info("Evaluated manifest source gate for app", extra=extra)


@router.post(
    "/submit_review_request",
    status_code=200,
    response_model_exclude_none=True,
    tags=["moderation"],
    responses={
        200: {"model": ReviewRequestResponse},
        401: {"description": "Unauthorized - invalid token"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def submit_review_request(
    review_request: ReviewRequest,
    authorization: Annotated[HTTPAuthorizationCredentials, Depends(HTTPBearer())],
) -> ReviewRequestResponse:
    random_review_enabled = getattr(config.settings, "random_review_enabled", False)
    random_review_rate = getattr(config.settings, "random_review_rate", 0.01)
    random_review_secret = getattr(config.settings, "random_review_secret", None)
    logger.info(
        "Random review configuration",
        extra={
            "random_review_enabled": random_review_enabled,
            "random_review_rate": random_review_rate if random_review_enabled else None,
        },
    )

    secret = config.settings.flat_manager_build_secret
    if secret is None:
        raise HTTPException(
            status_code=500,
            detail="flat_manager_not_configured",
        )

    try:
        claims = jwt.decode(
            authorization.credentials,
            base64.b64decode(secret),
            algorithms=["HS256"],
        )
        if "reviewcheck" not in claims["scope"]:
            raise HTTPException(status_code=403, detail="invalid_scope")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid_token")

    flat_manager_token = utils.create_flat_manager_token(
        "process_review_request",
        ["build"],
        repos=["stable", "beta", "test"],
    )
    build_extended_url = f"{config.settings.flat_manager_api}/api/v1/build/{review_request.build_id}/extended"
    build_extended_headers = {
        "Authorization": f"{flat_manager_token}",
        "Content-Type": "application/json",
    }
    r = http_client.get(build_extended_url, headers=build_extended_headers)
    r.raise_for_status()

    # Skip beta and test builds
    build_extended = r.json()
    build_metadata = build_extended.get("build")
    build_target_repo = build_metadata.get("repo")
    if build_target_repo in ("beta", "test"):
        return ReviewRequestResponse(requires_review=False)
    build_log_url = build_metadata.get("build_log_url")

    build_refs = build_extended.get("build_refs")
    candidate_refs: tuple[ostree_manifest.CandidateManifestRef, ...] = ()
    manifest_pairs: tuple[ostree_manifest.ManifestPair, ...] = ()
    manifest_groups: tuple[tuple[ostree_manifest.ManifestPair, ...], ...] = ()
    manifest_findings_by_app: dict[
        str, tuple[ostree_manifest.ManifestSourceFinding, ...]
    ] = {}
    if config.settings.ostree_manifest_comparison_enabled:
        try:
            candidate_refs = ostree_manifest.normalize_candidate_refs(build_refs)
            direct_upload_app_ids: set[str] = set()
            candidate_app_ids = {item.app_id for item in candidate_refs}
            if candidate_app_ids:
                with get_db("writer") as db:
                    direct_upload_apps = (
                        db.session.query(models.DirectUploadApp)
                        .filter(models.DirectUploadApp.app_id.in_(candidate_app_ids))
                        .all()
                    )
                    direct_upload_app_ids = {app.app_id for app in direct_upload_apps}
            manifest_pairs = ostree_manifest.collect_manifest_pairs(
                candidate_repo_url=(
                    f"https://dl.flathub.org/build-repo/{review_request.build_id}"
                ),
                published_repo_url=config.settings.repo_url,
                refs=candidate_refs,
                timeout_seconds=config.settings.ostree_manifest_timeout_seconds,
                skip_missing_candidate_app_ids=direct_upload_app_ids,
            )
            manifest_groups = ostree_manifest.group_identical_manifest_pairs(
                manifest_pairs
            )
        except ostree_manifest.InvalidBuildRefError as exc:
            raise HTTPException(status_code=500, detail="invalid_build") from exc
        except ostree_manifest.ManifestRetrievalError as exc:
            logger.exception(
                "OSTree manifest retrieval failed",
                extra={
                    "build_id": review_request.build_id,
                    "job_id": review_request.job_id,
                    "category": exc.category,
                },
            )
            raise HTTPException(
                status_code=500, detail="manifest_retrieval_failed"
            ) from exc

        logger.info(
            "Compared embedded manifests",
            extra={
                "build_id": review_request.build_id,
                "job_id": review_request.job_id,
                "ref_count": len(manifest_pairs),
                "comparison_group_count": len(manifest_groups),
                "changed_group_count": sum(
                    group[0].changed is True for group in manifest_groups
                ),
                "missing_baseline_count": sum(
                    pair.published_status
                    is not ostree_manifest.PublishedManifestStatus.PRESENT
                    for pair in manifest_pairs
                ),
            },
        )
        manifest_findings = ostree_manifest.find_manifest_source_changes(
            manifest_groups
        )
        for finding in manifest_findings:
            manifest_findings_by_app.setdefault(finding.app_id, ())
            manifest_findings_by_app[finding.app_id] += (finding,)
    manifest_groups_by_app: dict[
        str, tuple[tuple[ostree_manifest.ManifestPair, ...], ...]
    ] = {}
    for group in manifest_groups:
        manifest_groups_by_app.setdefault(group[0].app_id, ())
        manifest_groups_by_app[group[0].app_id] += (group,)
    expected_refs_by_app: dict[str, set[tuple[str, str, str, str]]] = {}
    for candidate_ref in candidate_refs:
        expected_refs_by_app.setdefault(candidate_ref.app_id, set()).add(
            (
                candidate_ref.ref_name,
                candidate_ref.arch,
                candidate_ref.branch,
                candidate_ref.candidate_commit,
            )
        )
    collected_refs_by_app: dict[str, set[tuple[str, str, str, str]]] = {}
    for pair in manifest_pairs:
        collected_refs_by_app.setdefault(pair.app_id, set()).add(
            (pair.ref_name, pair.arch, pair.branch, pair.candidate_commit)
        )
    if random_review_enabled and not isinstance(build_refs, list):
        raise HTTPException(status_code=500, detail="invalid_build")
    build_ref_arches = {
        build_ref.get("ref_name").split("/")[2]
        for build_ref in build_refs
        if len(build_ref.get("ref_name").split("/")) == 4
    }

    new_requests: list[models.ModerationRequest] = []
    eligible_app_ids: list[str] = []
    has_initial_submission = False
    manifest_reused_app_ids: set[str] = set()
    manifest_reuse_requires_review = False

    try:
        build_ref_arch = build_ref_arches.pop()
        build_appstream = utils.appstream2dict(
            f"https://dl.flathub.org/build-repo/{review_request.build_id}/appstream/{build_ref_arch}/appstream.xml.gz"
        )
    except KeyError:
        # if build_ref_arches has no elements, something went terribly wrong with the build in general
        raise HTTPException(status_code=500, detail="invalid_build")

    r = http_client.get(
        f"https://dl.flathub.org/build-repo/{review_request.build_id}/summary"
    )
    r.raise_for_status()
    if not isinstance(r.content, bytes):
        # If the summary file is not a binary file, something also went wrong
        raise HTTPException(status_code=500, detail="invalid_summary_file")
    with get_db("writer") as db:
        build_summary, _, _ = summary.parse_summary(r.content, db)

    sentry_context = {"build_summary": build_summary}

    app_runtime_dref: str | None = None

    app_ids = list(build_appstream.keys())
    direct_upload_apps_by_id = {}
    apps_by_id = {}

    if app_ids:
        with get_db("writer") as db:
            direct_upload_apps = (
                db.session.query(models.DirectUploadApp)
                .filter(models.DirectUploadApp.app_id.in_(app_ids))
                .all()
            )
            direct_upload_apps_by_id = {app.app_id: app for app in direct_upload_apps}

        with get_db("replica") as db:
            apps = (
                db.session.query(models.App)
                .filter(models.App.app_id.in_(app_ids))
                .all()
            )
            apps_summary_by_id = {
                app.app_id: app.summary for app in apps if app.summary is not None
            }

    for app_id, app_data in build_appstream.items():
        is_new_submission = True

        keys: dict[str, Any] = {
            "name": app_data.get("name"),
            "summary": app_data.get("summary"),
            "developer_name": app_data.get("developer_name"),
            "project_license": app_data.get("project_license"),
        }
        current_values: dict[str, Any] = {}
        summary_keys: dict[str, Any] = {}
        summary_current_values: dict[str, Any] = {}
        # Check if the app data matches the current appstream
        app_manifest_findings = manifest_findings_by_app.get(app_id, ())
        if app := get_json_key(f"apps:{app_id}"):
            is_new_submission = False

            current_values["name"] = app.get("name")
            current_values["summary"] = app.get("summary")
            current_values["developer_name"] = app.get("developer_name")
            current_values["project_license"] = app.get("project_license")

            for key, value in current_values.items():
                if value == keys[key]:
                    keys.pop(key, None)

        app_complexity: manifest_complexity.ManifestComplexityAnalysis | None = None
        # Don't consider the first "official" vorarbeiter build as a new submission
        # as it has been already reviewed manually on GitHub
        if is_new_submission and build_metadata.get("token_name") == "vorarbeiter":
            if app_manifest_findings:
                _log_manifest_source_gate(
                    review_request,
                    app_id,
                    app_manifest_findings,
                    would_require_review=False,
                    reason="initial-vorarbeiter",
                )
            if config.settings.ostree_manifest_comparison_enabled:
                app_complexity = _complexity_analysis_for_app(
                    app_id,
                    is_new_submission=True,
                    expected_refs_by_app=expected_refs_by_app,
                    collected_refs_by_app=collected_refs_by_app,
                    manifest_groups_by_app=manifest_groups_by_app,
                )
                _log_manifest_complexity(
                    review_request,
                    app_id,
                    app_complexity,
                    "initial-vorarbeiter",
                )
            continue

        if should_skip_review(app_id):
            if app_manifest_findings:
                _log_manifest_source_gate(
                    review_request,
                    app_id,
                    app_manifest_findings,
                    would_require_review=False,
                    reason="skip-list",
                )
            if config.settings.ostree_manifest_comparison_enabled:
                app_complexity = _complexity_analysis_for_app(
                    app_id,
                    is_new_submission=is_new_submission,
                    expected_refs_by_app=expected_refs_by_app,
                    collected_refs_by_app=collected_refs_by_app,
                    manifest_groups_by_app=manifest_groups_by_app,
                )
                _log_manifest_complexity(
                    review_request,
                    app_id,
                    app_complexity,
                    "skip-list",
                )
            continue

        if "keys" not in locals():
            keys = {}
        if "current_values" not in locals():
            current_values = {}

        with get_db("writer") as db:
            if direct_upload_app := direct_upload_apps_by_id.get(app_id):
                direct_upload_app = db.session.merge(direct_upload_app)
                if not direct_upload_app.first_seen_at:
                    direct_upload_app.first_seen_at = datetime.now(UTC)
                    is_new_submission = True
                    current_values = {"direct upload": False}
                    keys = {"direct upload": True}

        if config.settings.ostree_manifest_comparison_enabled:
            app_complexity = _complexity_analysis_for_app(
                app_id,
                is_new_submission=is_new_submission,
                expected_refs_by_app=expected_refs_by_app,
                collected_refs_by_app=collected_refs_by_app,
                manifest_groups_by_app=manifest_groups_by_app,
            )

        if app_manifest_findings:
            _log_manifest_source_gate(
                review_request,
                app_id,
                app_manifest_findings,
                would_require_review=(
                    not is_new_submission
                    and not config.settings.moderation_observe_only
                ),
                reason="initial-submission" if is_new_submission else None,
            )

        origin_should_gate = (
            not is_new_submission
            and bool(app_manifest_findings)
            and config.settings.ostree_manifest_source_origin_gating_enabled
        )
        complexity_would_gate = (
            isinstance(
                app_complexity,
                manifest_complexity.ManifestComplexityResult,
            )
            and app_complexity.score_units
            >= config.settings.ostree_manifest_complexity_threshold_units
        )
        complexity_should_gate = (
            complexity_would_gate
            and config.settings.ostree_manifest_complexity_gating_enabled
        )
        appdata_request: models.ModerationRequest | None = None
        summary_request: models.ModerationRequest | None = None

        if random_review_enabled:
            eligible_app_ids.append(app_id)
            has_initial_submission = has_initial_submission or is_new_submission

        current_summary = None
        current_permissions = None
        current_extradata = None

        if (current_summary := apps_summary_by_id.get(app_id)) or (
            current_summary := get_json_key(f"summary:{app_id}:stable")
        ):
            sentry_context[f"summary:{app_id}:stable"] = current_summary

            if current_metadata := current_summary.get("metadata", {}):
                current_permissions = current_metadata.get("permissions")
                current_extradata = current_metadata.get("extra-data")

        if current_summary:
            build_summary_app = build_summary.get(app_id) or {}
            build_summary_metadata = build_summary_app.get("metadata") or {}
            build_permissions = build_summary_metadata.get("permissions") or {}
            build_extradata = build_summary_metadata.get("extra-data")

            app_runtime = build_summary_metadata.get(
                "runtime"
            ) or build_summary_metadata.get("sdk")
            if app_runtime:
                app_runtime_dref = (
                    f"{app_runtime.split('/')[0]}//{app_runtime.split('/')[2]}"
                    if app_runtime.count("/") == 2
                    else None
                )

            extra_data_values = _extra_data_moderation_values(
                current_extradata, build_extradata
            )
            if extra_data_values is not None:
                summary_current_values["extra-data"], summary_keys["extra-data"] = (
                    extra_data_values
                )

            if (
                current_permissions
                and build_permissions
                and current_permissions != build_permissions
            ):
                for perm in current_permissions:
                    current_perm = current_permissions[perm]
                    build_perm = build_permissions.get(perm)

                    if isinstance(current_perm, list) and sorted(
                        current_perm or []
                    ) != sorted(build_perm or []):
                        summary_current_values[perm] = current_perm
                        summary_keys[perm] = build_perm

                    if isinstance(current_perm, dict):
                        if build_perm is None:
                            build_perm = {}

                        dict_keys = current_perm.keys() | build_perm.keys()
                        for key in dict_keys:
                            current_val = current_perm.get(key)
                            build_val = build_perm.get(key)

                            is_different = (
                                sorted(current_val or []) != sorted(build_val or [])
                                if isinstance(current_val, list)
                                and isinstance(build_val, list)
                                else current_val != build_val
                            )
                            if is_different:
                                summary_current_values[f"{key}-{perm}"] = current_val
                                summary_keys[f"{key}-{perm}"] = build_val

            if app_id not in direct_upload_apps_by_id:
                current_arches = set(current_summary.get("arches", []))
                build_arches = set(build_summary_app.get("arches", []))

                if current_arches != build_arches:
                    summary_current_values["arches"] = list(current_arches)
                    summary_keys["arches"] = list(build_arches)

        if len(summary_keys) > 0:
            summary_keys = sort_lists_in_dict(summary_keys)
            summary_current_values = sort_lists_in_dict(summary_current_values)

            request_ignored = False

            if "sockets" in summary_keys and "sockets" in summary_current_values:
                cur_sockets = set(summary_current_values["sockets"])
                new_sockets = set(summary_keys["sockets"])

                x11_compat_transition = (
                    cur_sockets
                    and new_sockets
                    and {"fallback-x11", "wayland", "x11"} <= cur_sockets
                    and {"fallback-x11", "wayland"} <= new_sockets
                    and "x11" not in new_sockets
                )

                if x11_compat_transition:
                    summary_keys.pop("sockets", None)
                    summary_current_values.pop("sockets", None)
                    request_ignored = True

            if app_runtime_dref:
                runtime_id, runtime_br = app_runtime_dref.split("//")

                if runtime_id in ("org.kde.Platform", "org.kde.Sdk"):
                    is_ge_6_10 = False

                    if not runtime_br.startswith("5.15-"):
                        try:
                            if "." in runtime_br:
                                major, minor = runtime_br.split(".", 1)
                                is_ge_6_10 = (
                                    int(major) == 6 and int(minor) >= 10
                                ) or int(major) > 6
                        except (IndexError, ValueError):
                            pass

                    if (
                        "talk-session-bus" in summary_keys
                        and "talk-session-bus" in summary_current_values
                    ):
                        cur_session_talks = (
                            summary_current_values["talk-session-bus"]
                            if isinstance(
                                summary_current_values["talk-session-bus"], list
                            )
                            else []
                        )
                        new_session_talks = (
                            summary_keys["talk-session-bus"]
                            if isinstance(summary_keys["talk-session-bus"], list)
                            else []
                        )

                        if (is_ge_6_10 or runtime_br.startswith("5.15-")) and (
                            "org.kde.kdeconnect" in cur_session_talks
                            and "org.kde.kdeconnect" not in new_session_talks
                        ):
                            cur_session_talks_filtered = list(
                                filter(
                                    lambda x: x != "org.kde.kdeconnect",
                                    cur_session_talks,
                                )
                            )

                            if sorted(cur_session_talks_filtered) == sorted(
                                new_session_talks
                            ):
                                summary_keys.pop("talk-session-bus", None)
                                summary_current_values.pop("talk-session-bus", None)
                                request_ignored = True

                        if runtime_br in ("6.9", "6.8") and (
                            "org.kde.kdeconnect" not in cur_session_talks
                            and "org.kde.kdeconnect" in new_session_talks
                        ):
                            new_session_talks_filtered = list(
                                filter(
                                    lambda x: x != "org.kde.kdeconnect",
                                    new_session_talks,
                                )
                            )

                            if sorted(cur_session_talks) == sorted(
                                new_session_talks_filtered
                            ):
                                summary_keys.pop("talk-session-bus", None)
                                summary_current_values.pop("talk-session-bus", None)
                                request_ignored = True

            if request_ignored:
                logger.info(
                    "Ignored moderation request for %s with current data %s and build data %s",
                    app_id,
                    summary_current_values,
                    summary_keys,
                )

            if len(summary_keys) > 0:
                summary_request = models.ModerationRequest(
                    appid=app_id,
                    request_type=ModerationRequestType.SUMMARY,
                    request_data=json.dumps(
                        {
                            "keys": summary_keys,
                            "current_values": summary_current_values,
                        }
                    ),
                    is_new_submission=is_new_submission,
                    is_outdated=False,
                    build_id=review_request.build_id,
                    job_id=review_request.job_id,
                    build_log_url=build_log_url,
                )
            # keys may become empty after pop above but empty keys
            # still triggers a moderation request, so re-check
        if len(keys) > 0:
            keys = sort_lists_in_dict(keys)
            current_values = sort_lists_in_dict(current_values)
            appdata_request = models.ModerationRequest(
                appid=app_id,
                request_type=ModerationRequestType.APPDATA,
                request_data=json.dumps(
                    {"keys": keys, "current_values": current_values}
                ),
                is_new_submission=is_new_submission,
                is_outdated=False,
                build_id=review_request.build_id,
                job_id=review_request.job_id,
                build_log_url=build_log_url,
            )
        complexity_data = (
            _manifest_complexity_request_data(
                review_request,
                app_id,
                app_complexity,
            )
            if isinstance(
                app_complexity,
                manifest_complexity.ManifestComplexityResult,
            )
            else None
        )
        selected_manifest_data: str | None = None
        if origin_should_gate:
            selected_manifest_data = _manifest_request_data(
                app_manifest_findings,
                complexity_data,
            )
        elif (
            complexity_should_gate
            and appdata_request is None
            and summary_request is None
        ):
            selected_manifest_data = _manifest_request_data((), complexity_data)

        if app_complexity is not None:
            suppressed_reason = None
            if is_new_submission:
                suppressed_reason = "initial-submission"
            elif isinstance(
                app_complexity,
                manifest_complexity.ManifestComplexityNotScored,
            ):
                suppressed_reason = "invalid-or-missing-baseline"
            elif (
                complexity_would_gate
                and not config.settings.ostree_manifest_complexity_gating_enabled
            ):
                suppressed_reason = "gating-disabled"
            elif (
                complexity_would_gate
                and (appdata_request is not None or summary_request is not None)
                and not origin_should_gate
            ):
                suppressed_reason = "existing-deterministic-request"
            _log_manifest_complexity(
                review_request,
                app_id,
                app_complexity,
                suppressed_reason,
            )

        if selected_manifest_data is not None:
            with get_db("writer") as db:
                existing_manifest_requests = (
                    db.session.query(models.ModerationRequest)
                    .filter(
                        models.ModerationRequest.appid == app_id,
                        models.ModerationRequest.build_id == review_request.build_id,
                        models.ModerationRequest.request_type
                        == ModerationRequestType.MANIFEST,
                    )
                    .all()
                )
            if not existing_manifest_requests:
                new_requests.append(
                    models.ModerationRequest(
                        appid=app_id,
                        request_type=ModerationRequestType.MANIFEST,
                        request_data=selected_manifest_data,
                        is_new_submission=False,
                        is_outdated=False,
                        build_id=review_request.build_id,
                        job_id=review_request.job_id,
                        build_log_url=build_log_url,
                    )
                )
            elif (
                len(existing_manifest_requests) == 1
                and existing_manifest_requests[0].job_id == review_request.job_id
                and _manifest_request_matches(
                    existing_manifest_requests[0].request_data,
                    selected_manifest_data,
                )
            ):
                reused_request = existing_manifest_requests[0]
                manifest_reused_app_ids.add(app_id)
                manifest_reuse_requires_review = (
                    manifest_reuse_requires_review
                    or reused_request.handled_at is None
                    or reused_request.is_approved is None
                )
            else:
                logger.error(
                    "Conflicting manifest moderation request",
                    extra={
                        "build_id": review_request.build_id,
                        "job_id": review_request.job_id,
                        "app_id": app_id,
                        "existing_request_count": len(existing_manifest_requests),
                    },
                )
                raise HTTPException(
                    status_code=500,
                    detail="conflicting_manifest_review_request",
                )

        if appdata_request is not None:
            new_requests.append(appdata_request)
        if summary_request is not None:
            new_requests.append(summary_request)

    leftover_manifest_app_ids = (
        set(expected_refs_by_app)
        | set(manifest_groups_by_app)
        | set(manifest_findings_by_app)
    ) - set(build_appstream)
    for app_id in sorted(leftover_manifest_app_ids):
        findings = manifest_findings_by_app.get(app_id, ())
        if findings:
            _log_manifest_source_gate(
                review_request,
                app_id,
                findings,
                would_require_review=False,
                reason="missing-appstream",
            )
        analysis = _complexity_analysis_for_app(
            app_id,
            is_new_submission=False,
            expected_refs_by_app=expected_refs_by_app,
            collected_refs_by_app=collected_refs_by_app,
            manifest_groups_by_app=manifest_groups_by_app,
        )
        _log_manifest_complexity(
            review_request,
            app_id,
            analysis,
            "missing-appstream",
        )

    random_review_reused_app_ids: set[str] = set()
    random_review_reuse_requires_review = False
    if random_review_enabled:
        logger.info(
            "Evaluating random review eligibility",
            extra={
                "build_id": review_request.build_id,
                "job_id": review_request.job_id,
                "random_review_rate": random_review_rate,
                "eligible_app_count": len(eligible_app_ids),
                "deterministic_request_count": len(new_requests)
                + len(manifest_reused_app_ids),
                "has_initial_submission": has_initial_submission,
            },
        )

        if new_requests or manifest_reused_app_ids:
            logger.info(
                "Random review suppressed by deterministic moderation",
                extra={
                    "build_id": review_request.build_id,
                    "job_id": review_request.job_id,
                    "eligible_app_count": len(eligible_app_ids),
                    "random_review_rate": random_review_rate,
                },
            )
        elif has_initial_submission:
            logger.info(
                "Random review suppressed by initial submission",
                extra={
                    "build_id": review_request.build_id,
                    "job_id": review_request.job_id,
                    "eligible_app_count": len(eligible_app_ids),
                    "random_review_rate": random_review_rate,
                },
            )
        elif not eligible_app_ids:
            logger.info(
                "Random review suppressed because build has no eligible apps",
                extra={
                    "build_id": review_request.build_id,
                    "job_id": review_request.job_id,
                    "eligible_app_count": 0,
                    "random_review_rate": random_review_rate,
                },
            )
        else:
            with get_db("writer") as db:
                existing_requests = (
                    db.session.query(models.ModerationRequest)
                    .filter(
                        models.ModerationRequest.build_id == review_request.build_id,
                        models.ModerationRequest.job_id == review_request.job_id,
                        models.ModerationRequest.request_type
                        == ModerationRequestType.APPDATA,
                        models.ModerationRequest.appid.in_(eligible_app_ids),
                    )
                    .all()
                )
                random_review_reused_requests = [
                    request
                    for request in existing_requests
                    if _is_random_review_request(request)
                ]
                random_review_reused_app_ids = {
                    request.appid for request in random_review_reused_requests
                }
                random_review_reuse_requires_review = not any(
                    request.handled_at is not None and request.is_approved is False
                    for request in random_review_reused_requests
                ) and any(
                    request.handled_at is None or request.is_approved is None
                    for request in random_review_reused_requests
                )

            if random_review_reused_app_ids:
                logger.info(
                    "Reusing random review requests",
                    extra={
                        "build_id": review_request.build_id,
                        "job_id": review_request.job_id,
                        "callback_reuse": True,
                        "reused_request_count": len(random_review_reused_app_ids),
                        "reused_request_requires_review": random_review_reuse_requires_review,
                    },
                )
            else:
                try:
                    identity = _canonical_random_review_identity(
                        build_metadata, build_refs
                    )
                except (TypeError, ValueError) as exc:
                    raise HTTPException(
                        status_code=500, detail="invalid_build"
                    ) from exc

                if random_review_secret is None:
                    raise HTTPException(
                        status_code=500, detail="random_review_not_configured"
                    )
                if not 0 <= random_review_rate <= 1:
                    raise HTTPException(
                        status_code=500, detail="invalid_random_review_rate"
                    )

                selected = (
                    _random_review_sample_value(identity, random_review_secret)
                    < random_review_rate
                )
                logger.info(
                    "Random review outcome",
                    extra={
                        "build_id": review_request.build_id,
                        "job_id": review_request.job_id,
                        "random_review_selected": selected,
                        "random_review_rate": random_review_rate,
                        "eligible_app_count": len(eligible_app_ids),
                    },
                )

                if selected:
                    for app_id in eligible_app_ids:
                        new_requests.append(
                            models.ModerationRequest(
                                appid=app_id,
                                request_type=ModerationRequestType.APPDATA,
                                request_data=json.dumps(_random_review_request_data()),
                                is_new_submission=False,
                                is_outdated=False,
                                build_id=review_request.build_id,
                                job_id=review_request.job_id,
                                build_log_url=build_log_url,
                            )
                        )

    # Mark previous requests as outdated, to avoid flooding the moderation queue with requests that probably aren't
    # relevant anymore. Outdated requests can still be viewed and approved, but they're hidden by default.
    with get_db("writer") as db:
        app_ids = {request.appid for request in new_requests}
        for app_id in app_ids:
            db.session.query(models.ModerationRequest).filter_by(
                appid=app_id, is_outdated=False
            ).update({"is_outdated": True})

        if len(new_requests) == 0:
            if manifest_reused_app_ids or random_review_reused_app_ids:
                return ReviewRequestResponse(
                    requires_review=(
                        (
                            manifest_reuse_requires_review
                            or random_review_reuse_requires_review
                        )
                        and not config.settings.moderation_observe_only
                    )
                )
            return ReviewRequestResponse(requires_review=False)
        else:
            for request in new_requests:
                db.session.add(request)
            db.session.commit()

        if config.settings.moderation_observe_only:
            return ReviewRequestResponse(requires_review=False)
        else:
            apps = itertools.groupby(new_requests, lambda r: r.appid)
            for app_id, requests in apps:
                requests = list(requests)

                if app_metadata := get_json_key(f"apps:{app_id}"):
                    app_name = app_metadata["name"]
                else:
                    app_name = None

                subject = f"Build #{review_request.build_id} held for review"
                payload = {
                    "messageId": f"{app_id}/{review_request.build_id}/held",
                    "creation_timestamp": utils.utcnow().timestamp(),
                    "subject": subject,
                    "previewText": subject,
                    "inform_moderators": True,
                    "messageInfo": {
                        "category": EmailCategory.MODERATION_HELD,
                        "appId": request.appid,
                        "appName": app_name,
                        "buildId": review_request.build_id,
                        "buildLogUrl": request.build_log_url,
                        "requests": [
                            {
                                "requestType": request.request_type,
                                "requestData": json.loads(request.request_data),
                                "isNewSubmission": request.is_new_submission,
                            }
                            for request in requests
                        ],
                    },
                }

                worker.send_email_new.send(payload)

            return ReviewRequestResponse(requires_review=True)


class Review(BaseModel):
    approve: bool
    comment: str | None = None

    @field_validator("comment")
    def reject_requires_comment(cls, v, values):
        if v is None and not values["approve"]:
            raise ValueError("rejecting a request requires a comment")
        return v


class ReviewResponse(BaseModel):
    github_issue_url: str


@router.post(
    "/requests/{id}/review",
    status_code=200,
    tags=["moderation"],
    responses={
        200: {"model": ReviewResponse},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - moderator required"},
        404: {"description": "Moderation request not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)
def submit_review(
    id: int,
    review: Review,
    login: LoginStatusDep,
    http_request: Request,
    _moderator: ModeratorDep,
) -> ReviewResponse | None:
    """Approve or reject the moderation request with a comment. If all requests for a job are approved, the job is
    marked as successful in flat-manager."""

    logger.info(
        f"Processing moderation review for request {id}, approval: {review.approve}"
    )

    with get_db("writer") as db:
        request = (
            db.session.query(models.ModerationRequest)
            .filter_by(id=id)
            .with_for_update()
            .first()
        )

        if request is None:
            raise HTTPException(status_code=404, detail="not_found")
        elif request.handled_at is not None:
            raise HTTPException(status_code=400, detail="already_handled")

        if login.user is None:
            raise HTTPException(status_code=401, detail="not_logged_in")

        request.is_approved = review.approve
        request.handled_by = login.user.id
        request.handled_at = func.now()
        request.comment = review.comment

        job_id = request.job_id
        build_id = request.build_id
        is_approved = review.approve
        appid = request.appid
        build_log_url = request.build_log_url
        request_type = request.request_type
        request_data = request.request_data
        is_new_submission = request.is_new_submission
        comment = review.comment
        worker_should_be_triggered = False
        if is_approved:
            remaining = (
                db.session.query(models.ModerationRequest)
                .filter_by(job_id=job_id)
                .filter(models.ModerationRequest.is_approved.is_(None))
                .filter(models.ModerationRequest.id != id)
                .count()
            )
            worker_should_be_triggered = remaining == 0
            logger.info(
                f"Approval for job {job_id}: remaining unapproved requests: {remaining}, will trigger worker: {worker_should_be_triggered}"
            )

        db.session.commit()
        logger.info(f"Moderation request {id} updated successfully")

        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType.MODERATION_APPROVED
            if is_approved
            else models.AuditEventType.MODERATION_REJECTED,
            details={
                "app_id": appid,
                "build_id": build_id,
                "request_id": id,
                "request_type": request_type,
            },
        )

    try:
        if is_approved:
            if worker_should_be_triggered:
                logger.info(
                    f"Triggering worker for job {job_id}, build {build_id} - all requests approved"
                )
                worker.review_check.send(job_id, "Passed", None, build_id)
                logger.info(f"Worker successfully queued for job {job_id}")
            else:
                logger.info(
                    f"Worker not triggered for job {job_id} - still has pending requests"
                )
        else:
            logger.info(f"Triggering worker for job {job_id} - request rejected")
            worker.review_check.send(
                job_id, "Failed", "The review was rejected by a moderator."
            )
            logger.info(f"Worker successfully queued for rejected job {job_id}")
    except Exception:
        logger.exception("Failed to dispatch worker for job %s", job_id)
        raise HTTPException(
            status_code=500, detail="Failed to trigger publication workflow"
        )

    logger.info(f"Moderation review completed for request {id}, job {job_id}")
    inform_only_moderators = False

    issue = None
    if is_approved:
        category = EmailCategory.MODERATION_APPROVED
        subject = f"Build #{build_id} approved"
    else:
        category = EmailCategory.MODERATION_REJECTED
        subject = f"Build #{build_id} rejected"

        with get_db("replica") as db:
            if not models.DirectUploadApp.by_app_id(db, appid):
                inform_only_moderators = True
                with get_db("writer") as db:
                    request = (
                        db.session.query(models.ModerationRequest)
                        .filter_by(id=id)
                        .first()
                    )
                    issue = create_github_build_rejection_issue(request)

    if app_metadata := get_json_key(f"apps:{appid}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    payload: dict[str, Any] = {
        "messageId": f"{appid}/{build_id}/{'approved' if is_approved else 'rejected'}",
        "creation_timestamp": utils.utcnow().timestamp(),
        "subject": subject,
        "previewText": subject,
        "inform_moderators": True,
        "inform_only_moderators": inform_only_moderators,
        "messageInfo": {
            "category": category,
            "appId": appid,
            "appName": app_name,
            "buildId": build_id,
            "buildLogUrl": build_log_url,
            "request": {
                "requestType": request_type,
                "requestData": json.loads(request_data),
                "isNewSubmission": is_new_submission,
            },
            "references": f"{appid}/{build_id}/held",
        },
    }

    if comment is not None:
        payload["messageInfo"]["comment"] = comment

    worker.send_email_new.send(payload)

    return ReviewResponse(github_issue_url=issue.html_url) if issue else None


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application
    """
    app.include_router(router)
