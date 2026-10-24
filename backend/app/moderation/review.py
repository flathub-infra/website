import base64
import hashlib
import hmac
import itertools
import json
import logging
from collections.abc import Mapping, Sequence
from collections.abc import Set as AbstractSet
from datetime import UTC, datetime
from typing import Annotated, Any, cast

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from github import Github, GithubException
from pydantic import AfterValidator, BaseModel, model_validator
from sqlalchemy import Table, func, not_, or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, aliased

from .. import (
    audit_log,
    cache,
    config,
    http_client,
    models,
    summary,
    utils,
    worker,
)
from ..database import get_db, get_json_key
from ..emails import EmailCategory
from ..login_info import LoginStatusDep, ModeratorDep
from ..types import (
    JSONValue,
    ModerationOriginKind,
    ModerationRequestType,
    is_json_object,
    is_json_value,
)
from ..verification import is_appid_runtime
from . import (
    ostree_manifest,
    permission_publication,
    summary_decisions,
    url_origin,
)
from .constants import should_skip_review
from .ostree_permissions import runtime_permissions
from .permission_snapshot import PermissionMap

router = APIRouter(prefix="/moderation")
logger = logging.getLogger(__name__)


_RANDOM_REVIEW_MARKER = "Randomly selected for human review"


def _within_one_edit(current: str, candidate: str) -> bool:
    if abs(len(current) - len(candidate)) > 1:
        return False

    current_index = candidate_index = edits = 0
    while current_index < len(current) and candidate_index < len(candidate):
        if current[current_index] == candidate[candidate_index]:
            current_index += 1
            candidate_index += 1
            continue

        edits += 1
        if edits > 1:
            return False
        if len(current) >= len(candidate):
            current_index += 1
        if len(candidate) >= len(current):
            candidate_index += 1

    return (
        edits + (current_index < len(current) or candidate_index < len(candidate)) <= 1
    )


def _summaries_equivalent(current: str | None, candidate: str | None) -> bool:
    if current == candidate:
        return True
    if (
        not isinstance(current, str)
        or not isinstance(candidate, str)
        or not current.strip()
        or not candidate.strip()
    ):
        return False

    normalized = []
    for value in (current, candidate):
        value = value.strip().casefold()
        if value.endswith(".") and not value.endswith(".."):
            value = value[:-1]
        tokens = [token for token in value.split() if token not in {"a", "an", "the"}]
        if not tokens:
            return False
        normalized.append(" ".join(tokens))

    return _within_one_edit(normalized[0], normalized[1])


def _extra_data_origins(extra_data: Mapping[str, JSONValue]) -> list[str] | None:
    uri_values = [
        value
        for key, value in extra_data.items()
        if key == "uri" or (key.startswith("uri") and key != "uri")
    ]
    if not uri_values:
        return None

    origins: set[str] = set()
    for value in uri_values:
        if not isinstance(value, str):
            return None
        try:
            origin = url_origin.normalize_url_origin(value)
        except url_origin.InvalidUrlOrigin:
            return None
        if origin is not None:
            origins.add(origin)

    return sorted(origins)


def _extra_data_moderation_values(
    current_extra_data: Mapping[str, JSONValue] | None,
    build_extra_data: Mapping[str, JSONValue] | None,
    allowlisted: AbstractSet[str] = frozenset(),
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
    if current_origins is not None and build_origins is not None:
        added = set(build_origins) - set(current_origins)
        removed = set(current_origins) - set(build_origins)
        if added and not removed and added <= allowlisted:
            return None

    return (
        current_origins or ["<invalid or missing current extra-data URL>"],
        build_origins or ["<invalid or missing new extra-data URL>"],
    )


def _eol_moderation_values(
    metadata: dict[str, object],
    valid_app_branches: dict[str, set[str]],
) -> dict[str, dict[str, list[str]]]:
    values = {app_id: {"eol": [], "eol-rebase": []} for app_id in valid_app_branches}
    if not isinstance(metadata.get("xa.sparse-cache"), dict):
        return values

    eol_rebases, eol_messages = summary.parse_eol_data(metadata)
    for app_id_and_branch, message in eol_messages.items():
        app_id, _, branch = app_id_and_branch.partition(":")
        if branch in valid_app_branches.get(app_id, set()):
            values[app_id]["eol"].append(f"{branch}: {message}")

    for target_app_id, old_app_ids in eol_rebases.items():
        for app_id_and_branch in old_app_ids:
            app_id, _, branch = app_id_and_branch.partition(":")
            if branch in valid_app_branches.get(app_id, set()):
                values[app_id]["eol-rebase"].append(f"{branch}: {target_app_id}")

    for app_values in values.values():
        app_values["eol"] = sorted(set(app_values["eol"]))
        app_values["eol-rebase"] = sorted(set(app_values["eol-rebase"]))
    return values


def _canonical_random_review_identity(
    build_metadata: dict[str, JSONValue],
    build_refs: list[dict[str, JSONValue]],
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


def _has_appdata_request(app_id: str, build_id: int, job_id: int) -> bool:
    with get_db("writer") as db:
        requests = (
            db.session.query(models.ModerationRequest)
            .filter(
                models.ModerationRequest.appid == app_id,
                models.ModerationRequest.build_id == build_id,
                models.ModerationRequest.job_id == job_id,
                models.ModerationRequest.request_type == ModerationRequestType.APPDATA,
            )
            .all()
        )
        return any(not _is_random_review_request(request) for request in requests)


class ModerationAppItem(BaseModel):
    appid: str
    is_new_submission: bool
    updated_at: datetime | None = None
    request_types: list[ModerationRequestType]


class ModerationAppsResponse(BaseModel):
    apps: list[ModerationAppItem]
    apps_count: int


class RequestData(BaseModel):
    keys: dict[str, JSONValue]
    current_values: dict[str, JSONValue]


class ManifestSourceOriginFindingData(BaseModel):
    origins_added: list[str]
    origins_removed: list[str]
    locations_by_origin: dict[str, list[str]]
    arches: list[str]


class ManifestSourceOriginRequestData(BaseModel):
    findings: list[ManifestSourceOriginFindingData]


class PermissionsRequestData(BaseModel):
    channel: str
    flatpak_branch: str | None = None
    comparison_source: str | None = None
    candidate_fingerprint: str | None = None
    comparison_fingerprint: str | None = None
    differences: list[dict[str, Any]]
    error_code: str | None = None
    error_message: str | None = None
    linked_assessment_id: int | None = None
    linked_review_url: str | None = None
    pull_request_url: str | None = None
    approved_baseline: dict[str, Any] | None = None


class ModerationRequestResponse(BaseModel):
    id: int
    app_id: str
    created_at: datetime

    build_id: int
    job_id: int
    is_outdated: bool

    request_type: ModerationRequestType
    request_data: (
        RequestData | ManifestSourceOriginRequestData | PermissionsRequestData | None
    ) = None
    build_log_url: str | None = None
    is_new_submission: bool

    handled_by: str | None = None
    handled_at: datetime | None = None
    is_approved: bool | None = None
    comment: str | None = None
    internal_comment: str | None = None
    discussion_url: str | None = None
    discussion_comment: str | None = None
    discussion_opened_by: str | None = None
    can_open_discussion: bool


class ModerationApp(BaseModel):
    requests: list[ModerationRequestResponse]
    requests_count: int


def create_github_build_issue(
    request: models.ModerationRequest, comment: str, *, discussion: bool
):
    gh_token = config.settings.github_bot_token
    if not gh_token:
        return

    gh = Github(gh_token)

    app_id = request.appid
    build_id = request.build_id
    build_log_url = request.build_log_url
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

    if discussion:
        title = f"Moderation discussion for build {build_id}"
        build_ref = (
            f"[build {build_id}]({build_log_url})"
            if build_log_url
            else f"build {build_id}"
        )
        body = (
            "The Flathub team (@flathub/build-moderation) opened a discussion "
            f"about {build_ref}.\n\n"
            "The build remains withheld pending review. This discussion does not "
            "approve or reject it.\n"
        )
    else:
        title = f"Change in build {build_id} rejected"
        body = (
            f"A change in [build {build_id}]({build_log_url}) has been reviewed by "
            "the Flathub team (@flathub/build-moderation), and rejected for the "
            "following reason:\n"
        )
    body += f"\n{quoted_comment}\n"

    ret = repo.create_issue(title=title, body=body)

    if recent_merged_by:
        try:
            ret.add_to_assignees(recent_merged_by)
        except GithubException:
            pass

    return ret


def _sort_json_lists(value: JSONValue) -> JSONValue:
    if isinstance(value, dict):
        return {
            key: _sort_json_lists(item)
            for key, item in value.items()
            if isinstance(key, str) and is_json_value(item)
        }
    if isinstance(value, list):
        strings = [item for item in value if isinstance(item, str)]
        if len(strings) == len(value):
            return [item for item in sorted(strings)]
        numbers = [item for item in value if isinstance(item, (int, float, bool))]
        if len(numbers) == len(value):
            return [item for item in sorted(numbers)]
        return [_sort_json_lists(item) for item in value if is_json_value(item)]
    return value


def sort_lists_in_dict(data: dict[str, JSONValue]) -> dict[str, JSONValue]:
    sorted_data = _sort_json_lists(data)
    if not is_json_object(sorted_data):
        raise TypeError("Moderation payload is not a JSON object")
    return sorted_data


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def _without_inherited_permissions(
    permissions: dict[str, JSONValue], inherited: tuple[PermissionMap, ...]
) -> dict[str, JSONValue]:
    result = dict(permissions)
    for runtime in inherited:
        buses = {
            "session-bus": runtime.get("Session Bus Policy", {}),
            "system-bus": runtime.get("System Bus Policy", {}),
        }
        for key, value in result.items():
            granted = runtime.get("Context", {}).get(key)
            if isinstance(value, list) and isinstance(granted, list):
                result[key] = [item for item in value if item not in granted]
            elif key in buses and is_json_object(value):
                levels: dict[str, JSONValue] = {}
                for level, names in value.items():
                    if isinstance(names, list):
                        names = [
                            name
                            for name in names
                            if not isinstance(name, str)
                            or buses[key].get(name) != level
                        ]
                        if not names:
                            continue
                    levels[level] = names
                result[key] = levels
    return result


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
                models.ModerationRequest.is_observation.is_(False),
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
        is_moderator = "moderation" in user.permissions()
        if not is_moderator and app_id not in user.dev_flatpaks(db):
            raise HTTPException(status_code=403, detail="forbidden")

        discussion_opener = aliased(models.FlathubUser)
        query = (
            db.session.query(
                models.ModerationRequest,
                models.FlathubUser.display_name,
                discussion_opener.display_name,
            )
            .filter_by(appid=app_id)
            .filter(models.ModerationRequest.is_observation.is_(False))
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

        query = query.join(
            models.FlathubUser,
            models.FlathubUser.id == models.ModerationRequest.handled_by,
            isouter=True,
        ).join(
            discussion_opener,
            discussion_opener.id == models.ModerationRequest.discussion_opened_by,
            isouter=True,
        )
        can_open_discussion = (
            bool(config.settings.github_bot_token)
            and models.DirectUploadApp.by_app_id(db, app_id) is None
        )

        total = query.count()
        query = query.offset(offset).limit(limit)

        # Execute the query and process results within the session
        results = []
        for row, handled_by_name, discussion_opened_by_name in query:
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
                    internal_comment=row.internal_comment if is_moderator else None,
                    is_outdated=row.is_outdated,
                    is_new_submission=row.is_new_submission,
                    created_at=row.created_at,
                    discussion_url=row.discussion_url,
                    discussion_comment=row.discussion_comment if is_moderator else None,
                    discussion_opened_by=discussion_opened_by_name
                    if is_moderator
                    else None,
                    can_open_discussion=can_open_discussion
                    and row.request_type != ModerationRequestType.PERMISSIONS,
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


def _manifest_source_findings_data(
    findings: Sequence[ostree_manifest.ManifestSourceFinding],
) -> list[ManifestSourceOriginFindingData]:
    return [
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
    ]


def _manifest_source_findings_would_gate(
    findings: Sequence[ostree_manifest.ManifestSourceFinding],
) -> bool:
    return any(finding.sources_added for finding in findings)


def _manifest_request_data(
    findings: Sequence[ostree_manifest.ManifestSourceFinding],
) -> str:
    body = ManifestSourceOriginRequestData(
        findings=_manifest_source_findings_data(findings),
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
    return stored.findings == candidate.findings


def _approved_request_origins(
    request_type: str,
    request_data: str | None,
) -> set[tuple[ModerationOriginKind, str]]:
    try:
        data = json.loads(request_data or "")
    except (TypeError, json.JSONDecodeError):
        return set()
    if not isinstance(data, dict):
        return set()

    origins: set[tuple[ModerationOriginKind, str]] = set()
    if request_type == ModerationRequestType.MANIFEST:
        findings = data.get("findings")
        for finding in findings if isinstance(findings, list) else []:
            added = finding.get("origins_added") if isinstance(finding, dict) else None
            for origin in added if isinstance(added, list) else []:
                if isinstance(origin, str) and origin:
                    origins.add((ModerationOriginKind.MANIFEST_SOURCE, origin))
    elif request_type == ModerationRequestType.SUMMARY:
        keys = data.get("keys")
        current_values = data.get("current_values")
        build_origins = keys.get("extra-data") if isinstance(keys, dict) else None
        current_origins = (
            current_values.get("extra-data")
            if isinstance(current_values, dict)
            else None
        )
        if isinstance(build_origins, list):
            known = set(current_origins) if isinstance(current_origins, list) else set()
            for origin in build_origins:
                if (
                    isinstance(origin, str)
                    and origin
                    and not origin.startswith("<")
                    and origin not in known
                ):
                    origins.add((ModerationOriginKind.EXTRA_DATA, origin))
    return origins


def _allowlisted_origins(
    kind: ModerationOriginKind,
    candidates: AbstractSet[str],
) -> frozenset[str]:
    if not candidates:
        return frozenset()
    with get_db("replica") as db:
        rows = (
            db.session.query(models.ModerationOriginAllowlist.origin)
            .filter(
                models.ModerationOriginAllowlist.kind == kind,
                models.ModerationOriginAllowlist.origin.in_(sorted(candidates)),
            )
            .all()
        )
    return frozenset(row.origin for row in rows)


def _filter_allowlisted_manifest_findings(
    findings: Sequence[ostree_manifest.ManifestSourceFinding],
    allowlisted: AbstractSet[str],
) -> tuple[ostree_manifest.ManifestSourceFinding, ...]:
    filtered: list[ostree_manifest.ManifestSourceFinding] = []
    for finding in findings:
        sources_added = tuple(
            source for source in finding.sources_added if source not in allowlisted
        )
        if not sources_added and not finding.sources_removed:
            continue
        kept_sources = set(sources_added) | set(finding.sources_removed)
        filtered.append(
            ostree_manifest.ManifestSourceFinding(
                app_id=finding.app_id,
                sources_added=sources_added,
                sources_removed=finding.sources_removed,
                locations_by_source={
                    source: locations
                    for source, locations in finding.locations_by_source.items()
                    if source in kept_sources
                },
                arches=finding.arches,
            )
        )
    return tuple(filtered)


def _manifest_analysis_observation_values(
    review_request: ReviewRequest,
    app_id: str,
    *,
    appstream_present: bool,
    is_new_submission: bool,
    policy_context: str,
    expected_refs: set[tuple[str, str, str]],
    collected_refs: set[tuple[str, str, str]],
    comparable_refs: set[tuple[str, str, str]],
    findings: Sequence[ostree_manifest.ManifestSourceFinding],
    moderation_observe_only: bool,
) -> dict[str, JSONValue]:
    candidate_ref_count = len(expected_refs)
    collected_ref_count = len(collected_refs)
    comparable_ref_count = len(comparable_refs)
    if candidate_ref_count == 0:
        collection_status = "unavailable"
    elif collected_refs == expected_refs:
        collection_status = "complete"
    else:
        collection_status = "partial"

    serialized_findings = [
        finding.model_dump(mode="json", exclude_none=True)
        for finding in _manifest_source_findings_data(findings)
    ]
    if serialized_findings:
        source_status = "findings"
    elif (
        collection_status == "complete"
        and comparable_refs == expected_refs
        and candidate_ref_count > 0
    ):
        source_status = "clean"
    else:
        source_status = "unavailable"

    return {
        "app_id": app_id,
        "build_id": review_request.build_id,
        "job_id": review_request.job_id,
        "appstream_present": appstream_present,
        "is_new_submission": is_new_submission,
        "policy_context": policy_context,
        "candidate_ref_count": candidate_ref_count,
        "collected_ref_count": collected_ref_count,
        "comparable_ref_count": comparable_ref_count,
        "collection_status": collection_status,
        "source_status": source_status,
        "source_findings": serialized_findings,
        "source_would_gate": (
            _manifest_source_findings_would_gate(findings)
            and policy_context == "normal"
        ),
        "source_gating_enabled": True,
        "source_observe_only": False,
        "moderation_observe_only": moderation_observe_only,
    }


def _upsert_manifest_analysis_observations(
    session: Session,
    observations: Sequence[dict[str, JSONValue]],
) -> None:
    if not observations:
        return
    table = cast("Table", models.ManifestAnalysisObservation.__table__)
    statement = insert(table).values(observations)
    immutable_columns = {"id", "app_id", "build_id", "created_at"}
    updated_values: dict[str, object] = {
        column.name: statement.excluded[column.name]
        for column in table.columns
        if column.name not in immutable_columns | {"updated_at"}
    }
    updated_values["updated_at"] = func.now()
    session.execute(
        statement.on_conflict_do_update(
            index_elements=[table.c.build_id, table.c.app_id],
            set_=updated_values,
        )
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
    extra: dict[str, object] = {
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
    if not is_json_object(build_extended):
        raise HTTPException(status_code=500, detail="invalid_build")
    build_metadata_value = build_extended.get("build")
    if not is_json_object(build_metadata_value):
        raise HTTPException(status_code=500, detail="invalid_build")
    build_metadata = build_metadata_value
    build_target_repo = build_metadata.get("repo")
    build_log_url = build_metadata.get("build_log_url")
    if not isinstance(build_target_repo, str) or not isinstance(
        build_log_url, str | None
    ):
        raise HTTPException(status_code=500, detail="invalid_build")
    if build_target_repo in ("beta", "test"):
        beta_requests, beta_handled, beta_held = permission_publication.check_build(
            build_id=review_request.build_id,
            job_id=review_request.job_id,
            repo=build_target_repo,
            build_extended=build_extended,
            build_log_url=build_log_url,
        )
        beta_emails = _email_requests(beta_requests)
        if beta_requests:
            with get_db("writer") as db:
                db.session.add_all(beta_requests)
                db.session.commit()
        if config.settings.moderation_observe_only:
            return ReviewRequestResponse(requires_review=False)
        if not (beta_requests or beta_held):
            permission_publication.advance_published(
                review_request.build_id, build_target_repo, beta_handled
            )
            return ReviewRequestResponse(requires_review=False)
        _send_held_emails(review_request.build_id, beta_emails)
        return ReviewRequestResponse(requires_review=True)

    build_refs_value = build_extended.get("build_refs")
    if not isinstance(build_refs_value, list):
        raise HTTPException(status_code=500, detail="invalid_build")
    build_refs = [
        build_ref for build_ref in build_refs_value if is_json_object(build_ref)
    ]
    if len(build_refs) != len(build_refs_value):
        raise HTTPException(status_code=500, detail="invalid_build")
    candidate_refs: tuple[ostree_manifest.CandidateManifestRef, ...] = ()
    manifest_pairs: tuple[ostree_manifest.ManifestPair, ...] = ()
    manifest_groups: tuple[tuple[ostree_manifest.ManifestPair, ...], ...] = ()
    manifest_findings_by_app: dict[
        str, tuple[ostree_manifest.ManifestSourceFinding, ...]
    ] = {}
    allowlist_filtered_app_ids: set[str] = set()
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
        skip_missing_candidate_app_ids = direct_upload_app_ids | {
            app_id for app_id in candidate_app_ids if is_appid_runtime(app_id)
        }

        manifest_pairs = ostree_manifest.collect_manifest_pairs(
            candidate_repo_url=(
                f"https://dl.flathub.org/build-repo/{review_request.build_id}"
            ),
            published_repo_url=config.settings.repo_url,
            refs=candidate_refs,
            timeout_seconds=config.settings.ostree_manifest_timeout_seconds,
            skip_missing_candidate_app_ids=skip_missing_candidate_app_ids,
        )
        manifest_groups = ostree_manifest.group_identical_manifest_pairs(manifest_pairs)
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
    manifest_findings = ostree_manifest.find_manifest_source_changes(manifest_groups)
    allowlisted_sources = _allowlisted_origins(
        ModerationOriginKind.MANIFEST_SOURCE,
        {source for finding in manifest_findings for source in finding.sources_added},
    )
    for finding in manifest_findings:
        if allowlisted_finding_sources := sorted(
            set(finding.sources_added) & allowlisted_sources
        ):
            allowlist_filtered_app_ids.add(finding.app_id)
            logger.info(
                "Ignored allowlisted manifest source origins",
                extra={
                    "build_id": review_request.build_id,
                    "job_id": review_request.job_id,
                    "app_id": finding.app_id,
                    "allowlisted_sources": allowlisted_finding_sources,
                },
            )
    manifest_findings = _filter_allowlisted_manifest_findings(
        manifest_findings, allowlisted_sources
    )
    for finding in manifest_findings:
        manifest_findings_by_app.setdefault(finding.app_id, ())
        manifest_findings_by_app[finding.app_id] += (finding,)
    expected_refs_by_app: dict[str, set[tuple[str, str, str]]] = {}
    for candidate_ref in candidate_refs:
        expected_refs_by_app.setdefault(candidate_ref.app_id, set()).add(
            (
                candidate_ref.ref_name,
                candidate_ref.arch,
                candidate_ref.branch,
            )
        )
    collected_refs_by_app: dict[str, set[tuple[str, str, str]]] = {}
    for pair in manifest_pairs:
        collected_refs_by_app.setdefault(pair.app_id, set()).add(
            (pair.ref_name, pair.arch, pair.branch)
        )
    comparable_refs_by_app: dict[str, set[tuple[str, str, str]]] = {}
    for pair in manifest_pairs:
        if pair.published_status is ostree_manifest.PublishedManifestStatus.PRESENT:
            comparable_refs_by_app.setdefault(pair.app_id, set()).add(
                (pair.ref_name, pair.arch, pair.branch)
            )
    if random_review_enabled and not isinstance(build_refs, list):
        raise HTTPException(status_code=500, detail="invalid_build")
    build_ref_arches = {
        ref_parts[2]
        for build_ref in (build_refs if isinstance(build_refs, list) else [])
        if is_json_object(build_ref)
        and isinstance((ref_name := build_ref.get("ref_name")), str)
        and len(ref_parts := ref_name.split("/")) == 4
    }

    new_requests: list[models.ModerationRequest] = []
    persisted_requests: list[models.ModerationRequest] = []
    summary_decision_records: list[models.SummaryDecision] = []
    analysis_observations: dict[str, dict[str, JSONValue]] = {}
    manifest_newly_actionable_requests: list[models.ModerationRequest] = []
    manifest_newly_actionable_app_ids: set[str] = set()
    eligible_app_ids: list[str] = []
    has_initial_submission = False
    manifest_reused_app_ids: set[str] = set()
    manifest_reuse_requires_review = False
    permission_requests, permission_handled, permission_held = (
        permission_publication.check_build(
            build_id=review_request.build_id,
            job_id=review_request.job_id,
            repo=build_target_repo,
            build_extended=build_extended,
            build_log_url=build_log_url,
        )
    )
    new_requests += permission_requests
    persisted_requests += permission_requests

    def stage_analysis_observation(
        app_id: str,
        *,
        appstream_present: bool,
        is_new_submission: bool,
        policy_context: str,
        findings: Sequence[ostree_manifest.ManifestSourceFinding],
    ) -> None:
        analysis_observations[app_id] = _manifest_analysis_observation_values(
            review_request,
            app_id,
            appstream_present=appstream_present,
            is_new_submission=is_new_submission,
            policy_context=policy_context,
            expected_refs=expected_refs_by_app.get(app_id, set()),
            collected_refs=collected_refs_by_app.get(app_id, set()),
            comparable_refs=comparable_refs_by_app.get(app_id, set()),
            findings=findings,
            moderation_observe_only=config.settings.moderation_observe_only,
        )

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
        build_summary, _, build_summary_top_metadata = summary.parse_summary(
            r.content, db
        )

    sentry_context = {"build_summary": build_summary}

    app_runtime_dref: str | None = None

    app_ids = list(build_appstream.keys())
    direct_upload_apps_by_id = {}
    valid_build_branches: dict[str, set[str]] = {}
    build_refs_by_app: dict[str, set[str]] = {}
    for build_ref in build_refs if isinstance(build_refs, list) else []:
        if not is_json_object(build_ref):
            continue
        ref_name = build_ref.get("ref_name")
        if not isinstance(ref_name, str):
            continue
        ref_parts = ref_name.split("/")
        if (
            len(ref_parts) == 4
            and ref_parts[0] in ("app", "runtime")
            and all(ref_parts)
        ):
            build_refs_by_app.setdefault(ref_parts[1], set()).add(ref_name)
        if len(ref_parts) == 4 and ref_parts[0] == "app" and ref_parts[1] in app_ids:
            valid_build_branches.setdefault(ref_parts[1], set()).add(ref_parts[3])
    build_eol_values_by_app: dict[str, dict[str, list[str]]] | None = None
    current_eol_values_by_app: dict[str, dict[str, list[str]]] | None = None

    def _build_eol_values_by_app() -> dict[str, dict[str, list[str]]]:
        nonlocal build_eol_values_by_app
        if build_eol_values_by_app is None:
            build_eol_values_by_app = _eol_moderation_values(
                build_summary_top_metadata, valid_build_branches
            )
        return build_eol_values_by_app

    def _current_eol_values_by_app() -> dict[str, dict[str, list[str]]]:
        nonlocal current_eol_values_by_app
        if current_eol_values_by_app is None:
            _build_eol_values_by_app()
            published_summary = summary.fetch_summary_bytes(
                f"{config.settings.repo_url}/summary"
            )
            if not isinstance(published_summary, bytes):
                raise HTTPException(
                    status_code=500, detail="invalid_published_summary_file"
                )
            current_eol_values_by_app = _eol_moderation_values(
                summary.parse_summary_metadata(published_summary), valid_build_branches
            )
        return current_eol_values_by_app

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

        keys: dict[str, JSONValue] = {
            "name": app_data.get("name"),
            "summary": app_data.get("summary"),
            "developer_name": app_data.get("developer_name"),
            "project_license": app_data.get("project_license"),
        }
        current_values: dict[str, JSONValue] = {}
        summary_keys: dict[str, JSONValue] = {}
        summary_current_values: dict[str, JSONValue] = {}
        # Check if the app data matches the current appstream
        app_manifest_findings = manifest_findings_by_app.get(app_id, ())
        source_would_gate = _manifest_source_findings_would_gate(app_manifest_findings)
        if app := get_json_key(f"apps:{app_id}"):
            is_new_submission = False

            current_values["name"] = app.get("name")
            current_values["summary"] = app.get("summary")
            current_values["developer_name"] = app.get("developer_name")
            current_values["project_license"] = app.get("project_license")

            for key, value in current_values.items():
                candidate_value = keys[key]
                if value == candidate_value or (
                    key == "summary"
                    and (value is None or isinstance(value, str))
                    and (candidate_value is None or isinstance(candidate_value, str))
                    and _summaries_equivalent(value, candidate_value)
                ):
                    keys.pop(key, None)

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
            stage_analysis_observation(
                app_id,
                appstream_present=True,
                is_new_submission=True,
                policy_context="initial_vorarbeiter",
                findings=app_manifest_findings,
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
            stage_analysis_observation(
                app_id,
                appstream_present=True,
                is_new_submission=is_new_submission,
                policy_context="skip_list",
                findings=app_manifest_findings,
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

        stage_analysis_observation(
            app_id,
            appstream_present=True,
            is_new_submission=is_new_submission,
            policy_context=("initial_submission" if is_new_submission else "normal"),
            findings=app_manifest_findings,
        )

        if app_manifest_findings:
            _log_manifest_source_gate(
                review_request,
                app_id,
                app_manifest_findings,
                would_require_review=(
                    not is_new_submission
                    and source_would_gate
                    and not config.settings.moderation_observe_only
                ),
                reason="initial-submission" if is_new_submission else None,
            )

        origin_should_gate = not is_new_submission and source_would_gate
        appdata_request: models.ModerationRequest | None = None
        summary_request: models.ModerationRequest | None = None

        if random_review_enabled:
            eligible_app_ids.append(app_id)
            has_initial_submission = has_initial_submission or is_new_submission

        current_summary: dict[str, JSONValue] | None = None
        current_permissions: dict[str, JSONValue] | None = None
        current_extradata: dict[str, JSONValue] | None = None
        current_runtime: JSONValue = None

        if (current_summary := apps_summary_by_id.get(app_id)) or (
            current_summary := get_json_key(f"summary:{app_id}:stable")
        ):
            sentry_context[f"summary:{app_id}:stable"] = current_summary

            current_metadata = current_summary.get("metadata")
            if is_json_object(current_metadata):
                permissions = current_metadata.get("permissions")
                current_permissions = (
                    permissions if is_json_object(permissions) else None
                )
                extra_data = current_metadata.get("extra-data")
                current_extradata = extra_data if is_json_object(extra_data) else None
                current_runtime = current_metadata.get("runtime")

        if current_summary:
            # Parsed summaries contain architecture sets until persisted as JSON.
            build_summary_app = build_summary.get(app_id) or {}
            build_summary_metadata_value = build_summary_app.get("metadata")
            build_summary_metadata = (
                build_summary_metadata_value
                if is_json_object(build_summary_metadata_value)
                else {}
            )
            build_permissions_value = build_summary_metadata.get("permissions")
            build_permissions = (
                build_permissions_value
                if is_json_object(build_permissions_value)
                else {}
            )
            build_extra_data = build_summary_metadata.get("extra-data")
            build_extradata = (
                build_extra_data if is_json_object(build_extra_data) else None
            )

            app_runtime = build_summary_metadata.get(
                "runtime"
            ) or build_summary_metadata.get("sdk")
            if isinstance(app_runtime, str) and app_runtime:
                app_runtime_dref = (
                    f"{app_runtime.split('/')[0]}//{app_runtime.split('/')[2]}"
                    if app_runtime.count("/") == 2
                    else None
                )

            extra_data_values = _extra_data_moderation_values(
                current_extradata, build_extradata
            )
            if extra_data_values is not None and isinstance(extra_data_values[1], list):
                allowlisted_extra_data = _allowlisted_origins(
                    ModerationOriginKind.EXTRA_DATA, set(extra_data_values[1])
                )
                if allowlisted_extra_data:
                    extra_data_values = _extra_data_moderation_values(
                        current_extradata, build_extradata, allowlisted_extra_data
                    )
                    if extra_data_values is None:
                        logger.info(
                            "Ignored allowlisted extra-data origins",
                            extra={
                                "build_id": review_request.build_id,
                                "job_id": review_request.job_id,
                                "app_id": app_id,
                                "allowlisted_origins": sorted(allowlisted_extra_data),
                            },
                        )
            if extra_data_values is not None:
                current_extra, build_extra = extra_data_values
                summary_current_values["extra-data"] = (
                    current_extra
                    if isinstance(current_extra, bool)
                    else [item for item in current_extra]
                )
                summary_keys["extra-data"] = (
                    build_extra
                    if isinstance(build_extra, bool)
                    else [item for item in build_extra]
                )

            if (
                current_permissions is not None
                and build_permissions
                and current_permissions != build_permissions
                and app_id not in permission_handled
            ):
                inherited = runtime_permissions(
                    current_runtime, build_summary_metadata.get("runtime")
                )
                current_permissions = _without_inherited_permissions(
                    current_permissions, inherited
                )
                build_permissions = _without_inherited_permissions(
                    build_permissions, inherited
                )
                for perm in current_permissions.keys() | build_permissions.keys():
                    current_perm = current_permissions.get(perm)
                    build_perm = build_permissions.get(perm)

                    if isinstance(current_perm, list) or isinstance(build_perm, list):
                        current_strings = _string_list(current_perm)
                        build_strings = _string_list(build_perm)
                        if (
                            len(current_strings)
                            != (
                                len(current_perm)
                                if isinstance(current_perm, list)
                                else 0
                            )
                            or len(build_strings)
                            != (len(build_perm) if isinstance(build_perm, list) else 0)
                            or sorted(current_strings) != sorted(build_strings)
                        ):
                            summary_current_values[perm] = current_perm
                            if is_json_value(build_perm):
                                summary_keys[perm] = build_perm

                    elif isinstance(current_perm, dict) or isinstance(build_perm, dict):
                        if not is_json_object(current_perm):
                            current_perm = {}
                        if not is_json_object(build_perm):
                            build_perm = {}

                        dict_keys = current_perm.keys() | build_perm.keys()
                        for key in dict_keys:
                            current_val = current_perm.get(key)
                            build_val = build_perm.get(key)

                            if isinstance(current_val, list) and isinstance(
                                build_val, list
                            ):
                                current_items = _string_list(current_val)
                                build_items = _string_list(build_val)
                                is_different = (
                                    sorted(current_items) != sorted(build_items)
                                    or len(current_items) != len(current_val)
                                    or len(build_items) != len(build_val)
                                )
                            else:
                                is_different = current_val != build_val
                            if is_different:
                                summary_current_values[f"{key}-{perm}"] = current_val
                                summary_keys[f"{key}-{perm}"] = build_val

            if app_id not in direct_upload_apps_by_id:
                current_arches_value = current_summary.get("arches", [])
                current_arches = (
                    {value for value in current_arches_value if isinstance(value, str)}
                    if isinstance(current_arches_value, list)
                    else set()
                )
                build_arches_value = build_summary_app.get("arches", [])
                build_arches = (
                    {value for value in build_arches_value if isinstance(value, str)}
                    if isinstance(build_arches_value, (list, set))
                    else set()
                )

                if current_arches != build_arches:
                    summary_current_values["arches"] = list(current_arches)
                    summary_keys["arches"] = list(build_arches)

        if not is_new_submission:
            build_eol_values_app = _build_eol_values_by_app().get(
                app_id, {"eol": [], "eol-rebase": []}
            )
            current_eol_values_app = _current_eol_values_by_app().get(
                app_id, {"eol": [], "eol-rebase": []}
            )
            for field in ("eol", "eol-rebase"):
                if current_eol_values_app[field] != build_eol_values_app[field]:
                    summary_current_values[field] = [
                        item for item in current_eol_values_app[field]
                    ]
                    summary_keys[field] = [item for item in build_eol_values_app[field]]

        if len(summary_keys) > 0:
            summary_keys = sort_lists_in_dict(summary_keys)
            summary_current_values = sort_lists_in_dict(summary_current_values)

            request_ignored = False

            if "sockets" in summary_keys and "sockets" in summary_current_values:
                cur_sockets = set(_string_list(summary_current_values["sockets"]))
                new_sockets = set(_string_list(summary_keys["sockets"]))

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
                        cur_session_talks = _string_list(
                            summary_current_values["talk-session-bus"]
                        )
                        new_session_talks = _string_list(
                            summary_keys["talk-session-bus"]
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
        if not is_new_submission and set(keys) == {"summary"}:
            old_summary = current_values.get("summary")
            new_summary = keys["summary"]
            app_name = current_values.get("name")
            description = app_data.get("description")
            if (
                isinstance(old_summary, str)
                and old_summary
                and isinstance(new_summary, str)
                and new_summary
                and not _has_appdata_request(
                    app_id, review_request.build_id, review_request.job_id
                )
            ):
                summary_decision = summary_decisions.auto_approve_summary_change(
                    app_id=app_id,
                    app_name=app_name if isinstance(app_name, str) else None,
                    description=description if isinstance(description, str) else None,
                    old_summary=old_summary,
                    new_summary=new_summary,
                    build_id=review_request.build_id,
                    job_id=review_request.job_id,
                )
                if summary_decision is not None:
                    summary_decision_records.append(summary_decision)
                    if summary_decision.approved:
                        keys.pop("summary")
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
        selected_manifest_data: str | None = None
        if origin_should_gate:
            selected_manifest_data = _manifest_request_data(app_manifest_findings)

        if selected_manifest_data is not None or app_id in allowlist_filtered_app_ids:
            reused_manifest_was_observation: bool | None = None
            with get_db("writer") as db:
                db.session.expire_on_commit = False
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
                existing_matches = (
                    selected_manifest_data is not None
                    and len(existing_manifest_requests) == 1
                    and existing_manifest_requests[0].job_id == review_request.job_id
                    and _manifest_request_matches(
                        existing_manifest_requests[0].request_data,
                        selected_manifest_data,
                    )
                )
                if existing_matches:
                    reused_manifest_was_observation = bool(
                        existing_manifest_requests[0].is_observation
                    )
                    if reused_manifest_was_observation:
                        existing_manifest_requests[0].is_observation = False
                        db.session.commit()
            existing_preserved = (
                not existing_matches
                and app_id in allowlist_filtered_app_ids
                and len(existing_manifest_requests) == 1
                and existing_manifest_requests[0].job_id == review_request.job_id
            )
            if not existing_manifest_requests and selected_manifest_data is not None:
                manifest_request = models.ModerationRequest(
                    appid=app_id,
                    request_type=ModerationRequestType.MANIFEST,
                    request_data=selected_manifest_data,
                    is_new_submission=False,
                    is_observation=False,
                    is_outdated=False,
                    build_id=review_request.build_id,
                    job_id=review_request.job_id,
                    build_log_url=build_log_url,
                )
                persisted_requests.append(manifest_request)
                new_requests.append(manifest_request)
            elif existing_matches:
                reused_request = existing_manifest_requests[0]
                manifest_reused_app_ids.add(app_id)
                reuse_requires_review = (
                    reused_request.handled_at is None
                    or reused_request.is_approved is None
                )
                manifest_reuse_requires_review = (
                    manifest_reuse_requires_review or reuse_requires_review
                )
                if reused_manifest_was_observation and reuse_requires_review:
                    manifest_newly_actionable_requests.append(reused_request)
                    manifest_newly_actionable_app_ids.add(app_id)
            elif existing_preserved:
                preserved_request = existing_manifest_requests[0]
                logger.info(
                    "Preserved manifest moderation request despite allowlist change",
                    extra={
                        "build_id": review_request.build_id,
                        "job_id": review_request.job_id,
                        "app_id": app_id,
                        "request_id": preserved_request.id,
                    },
                )
                if not preserved_request.is_observation:
                    manifest_reused_app_ids.add(app_id)
                    manifest_reuse_requires_review = manifest_reuse_requires_review or (
                        preserved_request.handled_at is None
                        or preserved_request.is_approved is None
                    )
            elif selected_manifest_data is not None:
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
            persisted_requests.append(appdata_request)
            new_requests.append(appdata_request)
        if summary_request is not None:
            persisted_requests.append(summary_request)
            new_requests.append(summary_request)

    leftover_manifest_app_ids = (
        set(expected_refs_by_app)
        | set(collected_refs_by_app)
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
        stage_analysis_observation(
            app_id,
            appstream_present=False,
            is_new_submission=False,
            policy_context="missing_appstream",
            findings=findings,
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
                        random_request = models.ModerationRequest(
                            appid=app_id,
                            request_type=ModerationRequestType.APPDATA,
                            request_data=json.dumps(_random_review_request_data()),
                            is_new_submission=False,
                            is_observation=False,
                            is_outdated=False,
                            build_id=review_request.build_id,
                            job_id=review_request.job_id,
                            build_log_url=build_log_url,
                        )
                        persisted_requests.append(random_request)
                        new_requests.append(random_request)

    email_requests = _email_requests(new_requests + manifest_newly_actionable_requests)

    # A newer build only supersedes requests whose app refs it fully replaces.
    # Separate architecture/branch uploads must remain visible for review. Outdated
    # requests are hidden by default.
    with get_db("writer") as db:
        actionable_app_ids = {
            request.appid for request in new_requests
        } | manifest_newly_actionable_app_ids
        outdated_count = 0
        for app_id in set(app_ids) | actionable_app_ids:
            app_refs = sorted(build_refs_by_app.get(app_id, ()))
            if not app_refs:
                continue
            outdated_count += (
                db.session.query(models.ModerationRequest)
                .filter_by(appid=app_id, is_outdated=False)
                .filter(
                    models.ModerationRequest.build_id < review_request.build_id,
                    or_(
                        models.ModerationRequest.app_refs.is_(None),
                        models.ModerationRequest.app_refs.contained_by(app_refs),
                    ),
                )
                .update({"is_outdated": True})
            )
        promoted_request_ids = [
            request.id for request in manifest_newly_actionable_requests
        ]
        if promoted_request_ids:
            db.session.query(models.ModerationRequest).filter(
                models.ModerationRequest.id.in_(promoted_request_ids)
            ).update({"is_outdated": False})

        for request in persisted_requests:
            request.app_refs = sorted(build_refs_by_app.get(request.appid, ())) or None
            db.session.add(request)
        for decision in summary_decision_records:
            db.session.add(decision)
        _upsert_manifest_analysis_observations(
            db.session,
            list(analysis_observations.values()),
        )
        if (
            persisted_requests
            or summary_decision_records
            or analysis_observations
            or outdated_count
        ):
            db.session.commit()

    if config.settings.moderation_observe_only:
        return ReviewRequestResponse(requires_review=False)

    requires_review = (
        bool(new_requests)
        or permission_held
        or manifest_reuse_requires_review
        or random_review_reuse_requires_review
    )
    if not requires_review:
        permission_publication.advance_published(
            review_request.build_id, "stable", set(app_ids)
        )
        return ReviewRequestResponse(requires_review=False)

    _send_held_emails(review_request.build_id, email_requests)
    return ReviewRequestResponse(requires_review=True)


def _email_requests(
    requests: list[models.ModerationRequest],
) -> list[dict[str, Any]]:
    return [
        {
            "appid": request.appid,
            "build_log_url": request.build_log_url,
            "request_type": request.request_type,
            "request_data": request.request_data,
            "is_new_submission": request.is_new_submission,
        }
        for request in requests
    ]


def _send_held_emails(build_id: int, email_requests: list[dict[str, Any]]) -> None:
    apps = itertools.groupby(
        sorted(email_requests, key=lambda request: request["appid"]),
        lambda request: request["appid"],
    )
    for app_id, requests in apps:
        requests = list(requests)

        if app_metadata := get_json_key(f"apps:{app_id}"):
            app_name = app_metadata["name"]
        else:
            app_name = None

        subject = f"Build #{build_id} held for review"
        payload = {
            "messageId": f"{app_id}/{build_id}/held",
            "creation_timestamp": utils.utcnow().timestamp(),
            "subject": subject,
            "previewText": subject,
            "inform_moderators": True,
            "messageInfo": {
                "category": EmailCategory.MODERATION_HELD,
                "appId": requests[0]["appid"],
                "appName": app_name,
                "buildId": build_id,
                "buildLogUrl": requests[0]["build_log_url"],
                "requests": [
                    {
                        "requestType": request["request_type"],
                        "requestData": json.loads(request["request_data"]),
                        "isNewSubmission": request["is_new_submission"],
                    }
                    for request in requests
                ],
            },
        }

        worker.send_email_new.send(payload)


class Review(BaseModel):
    approve: bool
    comment: str | None = None
    internal_comment: str | None = None

    @model_validator(mode="after")
    def reject_requires_comment(self):
        if not self.approve and (self.comment is None or not self.comment.strip()):
            raise ValueError("rejecting a request requires a comment")
        return self


class ReviewResponse(BaseModel):
    github_issue_url: str


def _require_text(value: str) -> str:
    if not value.strip():
        raise ValueError("a discussion requires a comment")
    return value


class Discussion(BaseModel):
    comment: Annotated[str, AfterValidator(_require_text)]


def _lock_review_requests(
    session: Session, request_id: int
) -> tuple[models.ModerationRequest, list[models.ModerationRequest]]:
    target = (
        session.query(models.ModerationRequest)
        .filter_by(id=request_id)
        .filter(models.ModerationRequest.is_observation.is_(False))
        .first()
    )
    if target is None:
        raise HTTPException(status_code=404, detail="not_found")

    requests = (
        session.query(models.ModerationRequest)
        .filter_by(appid=target.appid, build_id=target.build_id)
        .filter(models.ModerationRequest.is_observation.is_(False))
        .order_by(models.ModerationRequest.id)
        .with_for_update()
        .populate_existing()
        .all()
    )
    request = next((row for row in requests if row.id == request_id), None)
    if request is None:
        raise HTTPException(status_code=404, detail="not_found")
    if request.handled_at is not None:
        raise HTTPException(status_code=400, detail="already_handled")
    return request, requests


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

    logger.info(
        f"Processing moderation review for request {id}, approval: {review.approve}"
    )

    with get_db("writer") as db:
        request = (
            db.session.query(models.ModerationRequest)
            .filter_by(id=id)
            .filter(models.ModerationRequest.is_observation.is_(False))
            .first()
        )
        if request is None:
            raise HTTPException(status_code=404, detail="not_found")
        job_requests = (
            db.session.query(models.ModerationRequest)
            .filter_by(job_id=request.job_id)
            .order_by(models.ModerationRequest.id)
            .populate_existing()
            .with_for_update()
            .all()
        )

        if request.handled_at is not None:
            raise HTTPException(status_code=400, detail="already_handled")

        if login.user is None:
            raise HTTPException(status_code=401, detail="not_logged_in")

        permissions = ModerationRequestType.PERMISSIONS
        actionable = [row for row in job_requests if not row.is_observation]
        job_app_ids = {row.appid for row in job_requests}
        channel = next(
            (
                json.loads(row.request_data)["channel"]
                for row in actionable
                if row.request_type == permissions
            ),
            "stable",
        )
        requests = [
            row
            for row in actionable
            if (row.appid, row.build_id) == (request.appid, request.build_id)
            and row.handled_at is None
            and (
                not review.approve
                or (
                    row.id == request.id
                    if request.request_type == permissions
                    else row.request_type != permissions
                )
            )
        ]

        for grouped_request in requests:
            grouped_request.is_approved = review.approve
            grouped_request.handled_by = login.user.id
            grouped_request.handled_at = func.now()
            grouped_request.comment = review.comment
            grouped_request.internal_comment = review.internal_comment

        job_id = request.job_id
        build_id = request.build_id
        is_approved = review.approve
        appid = request.appid
        build_log_url = request.build_log_url
        request_type = request.request_type
        request_data = request.request_data
        is_new_submission = request.is_new_submission
        comment = review.comment
        request_ids = [grouped_request.id for grouped_request in requests]
        request_types = [grouped_request.request_type for grouped_request in requests]
        worker_should_be_triggered = False
        approved_origins: dict[tuple[ModerationOriginKind, str], int] = {}
        if is_approved:
            for grouped_request in requests:
                for origin in _approved_request_origins(
                    grouped_request.request_type, grouped_request.request_data
                ):
                    approved_origins.setdefault(origin, grouped_request.id)
            if approved_origins:
                db.session.execute(
                    insert(models.ModerationOriginAllowlist)
                    .values(
                        [
                            {
                                "kind": kind,
                                "origin": origin,
                                "approved_by": login.user.id,
                                "request_id": request_id,
                            }
                            for (kind, origin), request_id in sorted(
                                approved_origins.items()
                            )
                        ]
                    )
                    .on_conflict_do_nothing(index_elements=["kind", "origin"])
                )
            remaining = sum(row.is_approved is None for row in actionable)
            worker_should_be_triggered = all(row.is_approved for row in actionable)
            logger.info(
                f"Approval for job {job_id}: remaining unapproved requests: {remaining}, will trigger worker: {worker_should_be_triggered}"
            )

        db.session.commit()
        logger.info(f"Moderation requests {request_ids} updated successfully")

        audit_log.enqueue_audit_log(
            http_request,
            login.user.id,
            models.AuditEventType.MODERATION_APPROVED
            if is_approved
            else models.AuditEventType.MODERATION_REJECTED,
            details={
                "app_id": appid,
                "build_id": build_id,
                "request_ids": request_ids,
                "request_types": request_types,
                "allowlisted_origins": [
                    {"kind": kind, "origin": origin}
                    for kind, origin in sorted(approved_origins)
                ],
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
                permission_publication.advance_published(build_id, channel, job_app_ids)
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

    logger.info(f"Moderation review completed for requests {request_ids}, job {job_id}")

    issue = None
    if is_approved:
        category = EmailCategory.MODERATION_APPROVED
        subject = f"Build #{build_id} approved"
    else:
        category = EmailCategory.MODERATION_REJECTED
        subject = f"Build #{build_id} rejected"

        with get_db("replica") as db:
            if not models.DirectUploadApp.by_app_id(db, appid):
                with get_db("writer") as db:
                    request = (
                        db.session.query(models.ModerationRequest)
                        .filter_by(id=id)
                        .first()
                    )
                    issue = create_github_build_issue(
                        request, request.comment, discussion=False
                    )

    if app_metadata := get_json_key(f"apps:{appid}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    payload: dict[str, JSONValue] = {
        "messageId": f"{appid}/{build_id}/{'approved' if is_approved else 'rejected'}",
        "creation_timestamp": utils.utcnow().timestamp(),
        "subject": subject,
        "previewText": subject,
        "inform_moderators": True,
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


@router.post(
    "/requests/{id}/discussion",
    status_code=200,
    tags=["moderation"],
    response_model=ReviewResponse,
    responses={
        400: {"description": "Moderation request already handled"},
        401: {"description": "Unauthorized"},
        403: {"description": "Forbidden - moderator required"},
        404: {"description": "Moderation request not found"},
        409: {"description": "Discussion not supported for this app"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
        502: {"description": "GitHub issue creation failed"},
        503: {"description": "Discussion unavailable or notification failed"},
    },
)
def submit_discussion(
    id: int,
    discussion: Discussion,
    http_request: Request,
    _moderator: ModeratorDep,
) -> ReviewResponse:
    with get_db("writer") as db:
        request, locked_requests = _lock_review_requests(db.session, id)

        if (
            request.request_type == ModerationRequestType.PERMISSIONS
            or models.DirectUploadApp.by_app_id(db, request.appid) is not None
        ):
            raise HTTPException(status_code=409, detail="discussion_not_supported")

        build_requests = [
            row
            for row in locked_requests
            if row.request_type != ModerationRequestType.PERMISSIONS
        ]
        pending = [row for row in build_requests if row.handled_at is None]
        existing = next((row for row in build_requests if row.discussion_url), None)
        if existing is not None:
            discussion_url = existing.discussion_url
            discussion_comment = existing.discussion_comment
            discussion_opened_by = existing.discussion_opened_by
        else:
            if not config.settings.github_bot_token:
                raise HTTPException(status_code=503, detail="discussion_unavailable")
            try:
                issue = create_github_build_issue(
                    request, discussion.comment, discussion=True
                )
            except Exception:
                logger.exception(
                    "Failed to create discussion issue for app %s build %s",
                    request.appid,
                    request.build_id,
                )
                issue = None
            if issue is None:
                raise HTTPException(
                    status_code=502, detail="discussion_creation_failed"
                )
            discussion_url = issue.html_url
            discussion_comment = discussion.comment
            discussion_opened_by = _moderator.user.id

        for row in pending:
            if row.discussion_url is None:
                row.discussion_url = discussion_url
                row.discussion_comment = discussion_comment
                row.discussion_opened_by = discussion_opened_by

        appid = request.appid
        build_id = request.build_id
        build_log_url = request.build_log_url
        request_ids = [row.id for row in pending]
        request_types = [row.request_type for row in pending]

        if existing is None:
            models.AuditLog.create(
                db,
                user_id=_moderator.user.id,
                event_type=models.AuditEventType.MODERATION_DISCUSSION_OPENED,
                ip_address=http_request.client.host if http_request.client else None,
                user_agent=http_request.headers.get("user-agent"),
                details={
                    "app_id": appid,
                    "build_id": build_id,
                    "request_ids": request_ids,
                    "request_types": request_types,
                    "discussion_url": discussion_url,
                },
            )

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            logger.exception(
                "Failed to persist discussion %s for app %s build %s",
                discussion_url,
                appid,
                build_id,
            )
            raise HTTPException(status_code=500, detail="discussion_persistence_failed")

    if app_metadata := get_json_key(f"apps:{appid}"):
        app_name = app_metadata["name"]
    else:
        app_name = None

    subject = f"Discussion opened for build #{build_id}"
    payload: dict[str, JSONValue] = {
        "messageId": f"{appid}/{build_id}/discussion",
        "creation_timestamp": utils.utcnow().timestamp(),
        "subject": subject,
        "previewText": subject,
        "inform_moderators": True,
        "inform_only_moderators": True,
        "messageInfo": {
            "category": EmailCategory.MODERATION_DISCUSSION,
            "appId": appid,
            "appName": app_name,
            "buildId": build_id,
            "buildLogUrl": build_log_url,
            "comment": discussion_comment,
            "discussionUrl": discussion_url,
            "references": f"{appid}/{build_id}/held",
        },
    }

    try:
        worker.send_email_new.send(payload)
    except Exception:
        logger.exception(
            "Failed to queue discussion notification for app %s build %s",
            appid,
            build_id,
        )
        raise HTTPException(status_code=503, detail="discussion_notification_failed")

    return ReviewResponse(github_issue_url=discussion_url)


def register_to_app(app: FastAPI):
    """
    Register the login and authentication flows with the FastAPI application
    """
    app.include_router(router)
