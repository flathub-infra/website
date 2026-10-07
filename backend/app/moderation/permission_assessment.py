import hashlib
import json
import logging
import re
from dataclasses import asdict
from typing import Annotated, Any, Literal, NoReturn, Self, TypedDict

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from .. import config, http_client, models, utils
from ..database import get_db
from ..types import JSONValue, is_json_object
from .ostree_permissions import (
    CollectedPermissions,
    _valid_segment,
    collect_permissions,
)
from .permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionSnapshot,
    PermissionSnapshotError,
    compare_snapshots,
    fingerprint_snapshot,
)
from .permission_snapshot import JSONValue as PermissionJSONValue

logger = logging.getLogger(__name__)

type NonemptyString = Annotated[str, Field(min_length=1, pattern=r"^\S(?:.*\S)?$")]
type RefSegment = Annotated[str, Field(min_length=1, pattern=r"^[^/\s\x00-\x1f\x7f]+$")]
type Revision = Annotated[str, Field(pattern=r"^[0-9a-fA-F]{40}$")]


class CandidateAssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    pipeline_id: NonemptyString
    build_id: Annotated[int, Field(gt=0)]
    forge_instance: NonemptyString
    source_repository: NonemptyString
    pull_request_number: Annotated[int, Field(gt=0)] | None = None
    pull_request_url: NonemptyString | None = None
    pull_request_head_revision: Revision | None = None
    built_revision: Revision
    target_git_branch: NonemptyString
    base_revision: Revision | None = None
    candidate_kind: Literal["head", "merge", "push"]
    app_id: RefSegment
    destination_repo: RefSegment
    destination_channel: RefSegment
    flatpak_branch: RefSegment
    expected_arches: Annotated[list[RefSegment], Field(min_length=1)]
    matrix_succeeded: bool

    @model_validator(mode="after")
    def check_pull_request(self) -> Self:
        if (self.pull_request_number is None) != (self.pull_request_url is None):
            raise ValueError("Pull request number and URL must be supplied together")
        if self.candidate_kind == "push":
            if (self.pull_request_number is None) != (
                self.pull_request_head_revision is None
            ):
                raise ValueError("Linked pull request requires its head revision")
        elif self.pull_request_head_revision is None:
            raise ValueError("Pull request candidates require a head revision")
        return self


class CandidateIdentity(BaseModel):
    pipeline_id: str
    build_id: int


class _PermissionDifference(TypedDict):
    path: tuple[str, ...]
    before: PermissionJSONValue
    after: PermissionJSONValue


class _BuildCheck(TypedDict):
    check_name: str
    status: int
    status_reason: str | None
    errors: list[str]


class CandidateAssessmentResponse(BaseModel):
    assessment_id: int
    candidate_identity: CandidateIdentity
    snapshot_fingerprint: str | None
    outcome: Literal["accepted", "pending", "error"]
    acceptance_basis: Literal["baseline"] | None = None
    baseline_id: int | None = None
    review_url: None = None
    mode: Literal["observational"] = "observational"
    canonicalization_version: Literal[2, 3] = 3
    assessment_identity: str
    expected_arches: list[str]
    published_comparison_available: bool
    differences: list[_PermissionDifference] | None
    build_checks: list[_BuildCheck]
    linked_assessment_id: int | None = None
    linked_fingerprint_match: bool | None = None
    error_code: str | None = None
    error_message: str | None = None


def _response(
    row: models.PermissionAssessmentObservation,
) -> CandidateAssessmentResponse:
    return CandidateAssessmentResponse(
        assessment_id=row.id,
        candidate_identity=CandidateIdentity(
            pipeline_id=row.pipeline_id, build_id=row.build_id
        ),
        snapshot_fingerprint=row.fingerprint,
        outcome=row.outcome,
        acceptance_basis=row.acceptance_basis,
        baseline_id=row.baseline_id,
        canonicalization_version=row.canonicalization_version,
        assessment_identity=row.assessment_identity,
        expected_arches=row.expected_arches,
        published_comparison_available=row.published_snapshot is not None,
        differences=row.differences,
        build_checks=row.build_checks,
        linked_assessment_id=row.linked_assessment_id,
        linked_fingerprint_match=row.linked_fingerprint_match,
        error_code=row.error_code,
        error_message=row.error_message,
    )


def _persist_observation(values: dict[str, object]) -> CandidateAssessmentResponse:
    with get_db("writer") as db:
        db.session.execute(
            insert(models.PermissionAssessmentObservation)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["assessment_identity"])
        )
        row = db.session.execute(
            select(models.PermissionAssessmentObservation).where(
                models.PermissionAssessmentObservation.assessment_identity
                == values["assessment_identity"]
            )
        ).scalar_one()
        response = _response(row)
    logger.info(
        "Recorded permission assessment observation",
        extra={
            "app_id": values["app_id"],
            "pipeline_id": response.candidate_identity.pipeline_id,
            "build_id": response.candidate_identity.build_id,
            "outcome": response.outcome,
            "assessment_identity": response.assessment_identity,
            "expected_arches": response.expected_arches,
            "error_code": response.error_code,
        },
    )
    return response


def _stored_baseline(request: CandidateAssessmentRequest) -> dict[str, Any] | None:
    baseline = models.PermissionBaseline
    with get_db("writer") as db:
        row = db.session.execute(
            select(baseline).where(
                baseline.app_id == request.app_id,
                baseline.channel == request.destination_channel,
                baseline.flatpak_branch == request.flatpak_branch,
                baseline.canonicalization_version == CANONICALIZATION_VERSION,
            )
        ).scalar_one_or_none()
        if row is None:
            return None
        return {
            "id": row.id,
            "snapshot": row.snapshot,
            "artifacts": row.artifacts,
            "fingerprint": row.fingerprint,
        }


def _linked_assessment(
    request: CandidateAssessmentRequest, fingerprint: str | None
) -> tuple[int | None, bool | None]:
    if request.candidate_kind != "push" or request.pull_request_number is None:
        return None, None
    observation = models.PermissionAssessmentObservation
    with get_db("writer") as db:
        row = db.session.execute(
            select(observation)
            .where(
                observation.candidate_kind.in_(("head", "merge")),
                observation.app_id == request.app_id,
                observation.forge_instance == request.forge_instance,
                observation.source_repository == request.source_repository,
                observation.pull_request_number == request.pull_request_number,
                observation.pull_request_head_revision
                == request.pull_request_head_revision,
                observation.target_git_branch == request.target_git_branch,
                observation.intended_channel == request.destination_channel,
                observation.flatpak_branch == request.flatpak_branch,
                observation.canonicalization_version == CANONICALIZATION_VERSION,
                observation.fingerprint.isnot(None),
            )
            .order_by(observation.id.desc())
            .limit(1)
        ).scalar_one_or_none()
        if row is None:
            return None, None
        return row.id, None if fingerprint is None else row.fingerprint == fingerprint


def get_assessment(assessment_id: int) -> CandidateAssessmentResponse:
    with get_db("writer") as db:
        row = db.session.get(models.PermissionAssessmentObservation, assessment_id)
        if row is None:
            raise HTTPException(status_code=404, detail="assessment_not_found")
        return _response(row)


def _fetch(
    url: str, headers: dict[str, str], *, commit: bool = False
) -> dict[str, JSONValue]:
    try:
        if commit:
            with http_client.stream(
                "GET", url, headers=headers, json={"log-offset": None}
            ) as response:
                response.read()
                response.raise_for_status()
                payload = response.json()
        else:
            response = http_client.get(url, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Permission assessment upstream request failed", exc_info=True)
        raise HTTPException(status_code=502, detail="flat_manager_unavailable") from exc
    if not is_json_object(payload):
        raise HTTPException(status_code=502, detail="invalid_flat_manager_response")
    return payload


def _conflict(code: str, message: str) -> NoReturn:
    raise PermissionSnapshotError(code, message)


def _build_checks(extended: dict[str, JSONValue], checks: list[_BuildCheck]) -> None:
    items = extended.get("checks")
    if not isinstance(items, list):
        _conflict("invalid_build", "Flat-manager response lacks build checks")
    for item in items:
        if not is_json_object(item):
            _conflict("invalid_build", "Invalid build check metadata")
        check_name = item.get("check_name")
        status = item.get("status")
        if not isinstance(check_name, str) or type(status) is not int:
            _conflict("invalid_build", "Invalid build check metadata")
        errors: set[str] = set()
        raw_results = item.get("results")
        try:
            results = json.loads(raw_results) if isinstance(raw_results, str) else {}
        except (TypeError, ValueError):
            results = None
        diagnostics = results.get("diagnostics") if isinstance(results, dict) else None
        for diagnostic in diagnostics if isinstance(diagnostics, list) else []:
            data = diagnostic.get("data") if isinstance(diagnostic, dict) else None
            stdout = data.get("stdout") if isinstance(data, dict) else None
            codes = stdout.get("errors") if isinstance(stdout, dict) else None
            if isinstance(codes, list):
                errors.update(code for code in codes if isinstance(code, str))
        reason = item.get("status_reason")
        checks.append(
            {
                "check_name": check_name,
                "status": status,
                "status_reason": reason if isinstance(reason, str) else None,
                "errors": sorted(errors),
            }
        )
    checks.sort(key=lambda check: check["check_name"])


def _uploaded_refs(
    request: CandidateAssessmentRequest,
    extended: dict[str, JSONValue],
    checks: list[_BuildCheck],
    uploaded: list[dict[str, str]],
) -> str:
    build = extended.get("build")
    if not is_json_object(build):
        _conflict("invalid_build", "Flat-manager response lacks build metadata")
    build_id = build.get("id")
    if type(build_id) is not int or build_id != request.build_id:
        _conflict("identity_mismatch", "Flat-manager build ID differs from candidate")
    if build.get("app_id") is not None and build["app_id"] != request.app_id:
        _conflict("identity_mismatch", "Flat-manager app ID differs from candidate")
    if build.get("repo") != request.destination_repo:
        _conflict(
            "identity_mismatch",
            "Flat-manager repository differs from candidate destination",
        )
    repo_state = build.get("repo_state")
    check_failed = any(check["status"] == 3 for check in checks)
    if type(repo_state) is not int or not (
        repo_state in (2, 6) or (repo_state == 3 and check_failed)
    ):
        _conflict("build_not_ready", "Flat-manager build is not committed or ready")
    build_refs = extended.get("build_refs")
    if not isinstance(build_refs, list):
        _conflict("invalid_build", "Flat-manager response lacks uploaded refs")
    selected: dict[str, dict[str, str]] = {}
    branches: set[str] = set()
    for item in build_refs:
        if not is_json_object(item):
            _conflict("invalid_build", "Invalid uploaded ref metadata")
        ref_name = item.get("ref_name")
        if not isinstance(ref_name, str):
            _conflict("invalid_build", "Invalid uploaded ref metadata")
        parts = ref_name.split("/")
        if len(parts) != 4 or parts[0] != "app" or parts[1] != request.app_id:
            continue
        if not _valid_segment(parts[2]) or not _valid_segment(parts[3]):
            _conflict("invalid_build", f"Invalid uploaded app ref: {ref_name}")
        branches.add(parts[3])
        if ref_name in selected:
            _conflict("invalid_build", f"Duplicate uploaded ref: {ref_name}")
        commit = item.get("commit")
        if not isinstance(commit, str) or re.fullmatch(r"[0-9a-f]{64}", commit) is None:
            _conflict("invalid_build", f"Invalid uploaded checksum for {ref_name}")
        selected[ref_name] = {"ref_name": ref_name, "commit": commit}
    if len(branches) > 1:
        _conflict(
            "identity_mismatch",
            f"Uploaded refs span multiple Flatpak branches: {sorted(branches)}",
        )
    uploaded.extend(selected[name] for name in sorted(selected))
    arches = {name.split("/")[2] for name in selected}
    expected = set(request.expected_arches)
    if arches - expected:
        _conflict(
            "identity_mismatch",
            f"Unexpected uploaded architectures: {sorted(arches - expected)}",
        )
    if expected - arches:
        _conflict(
            "missing_architecture",
            f"Uploaded refs lack expected architectures: {sorted(expected - arches)}",
        )
    return branches.pop()


def _final_commits(
    job: dict[str, JSONValue], job_id: int, uploaded: list[dict[str, str]]
) -> dict[str, str]:
    if type(job.get("id")) is not int or job["id"] != job_id:
        _conflict("identity_mismatch", "Commit job ID differs from build commit job")
    if type(job.get("kind")) is not int or job["kind"] != 0:
        _conflict("invalid_commit_job", "Build job is not a commit job")
    if type(job.get("status")) is not int or job["status"] != 2:
        _conflict("commit_not_complete", "Commit job did not complete successfully")
    results = job.get("results")
    if isinstance(results, str):
        try:
            results = json.loads(results)
        except ValueError:
            _conflict("invalid_commit_results", "Commit job results are not valid JSON")
    if not is_json_object(results):
        _conflict("invalid_commit_results", "Commit job results lack final refs")
    refs_value = results.get("refs")
    if not is_json_object(refs_value):
        _conflict("invalid_commit_results", "Commit job results lack final refs")
    names = {item["ref_name"] for item in uploaded}
    refs = refs_value
    selected: dict[str, str] = {}
    for name in names:
        checksum = refs.get(name)
        if isinstance(checksum, str):
            selected[name] = checksum
    if selected.keys() != names:
        _conflict(
            "missing_architecture", "Commit job results lack selected uploaded refs"
        )
    for name, checksum in selected.items():
        if (
            not isinstance(checksum, str)
            or re.fullmatch(r"[0-9a-f]{64}", checksum) is None
        ):
            _conflict(
                "invalid_commit_results",
                f"Commit job lacks a trustworthy final checksum for {name}",
            )
    return selected


def assess_candidate(
    request: CandidateAssessmentRequest,
) -> CandidateAssessmentResponse:
    uploaded: list[dict[str, str]] = []
    checks: list[_BuildCheck] = []
    candidate: CollectedPermissions | None = None
    published: CollectedPermissions | None = None
    baseline: dict[str, Any] | None = None
    comparison: PermissionSnapshot | None = None
    comparison_artifacts: list[dict[str, Any]] = []
    fingerprint: str | None = None
    published_fingerprint: str | None = None
    differences: list[_PermissionDifference] | None = None
    error: PermissionSnapshotError | None = None
    try:
        if not request.matrix_succeeded:
            _conflict("matrix_failed", "Expected architecture matrix did not succeed")
        published_repo_url = {
            "stable": config.settings.repo_url,
            "beta": config.settings.beta_repo_url,
        }.get(request.destination_channel)
        if published_repo_url is None:
            _conflict(
                "unsupported_destination",
                f"Unsupported destination channel: {request.destination_channel}",
            )
        if (
            not config.settings.flat_manager_api
            or not config.settings.flat_manager_build_secret
        ):
            raise HTTPException(status_code=500, detail="flat_manager_not_configured")
        try:
            token = utils.create_flat_manager_token(
                "assess_permission_candidate",
                ["build", "jobs"],
                repos=["stable", "beta", "test"],
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=500, detail="flat_manager_not_configured"
            ) from exc
        headers = {"Authorization": token, "Content-Type": "application/json"}
        build_url = f"{config.settings.flat_manager_api.rstrip('/')}/api/v1/build/{request.build_id}"
        extended = _fetch(f"{build_url}/extended", headers)
        _build_checks(extended, checks)
        candidate_branch = _uploaded_refs(request, extended, checks, uploaded)
        build_metadata = extended.get("build")
        if not is_json_object(build_metadata):
            _conflict("invalid_build", "Flat-manager response lacks build metadata")
        job_id = build_metadata.get("commit_job_id")
        if type(job_id) is not int or job_id <= 0:
            _conflict("missing_commit_job", "Build lacks a commit job")
        final = _final_commits(
            _fetch(f"{build_url}/commit", headers, commit=True), job_id, uploaded
        )
        candidate = collect_permissions(
            repository_url=f"https://dl.flathub.org/build-repo/{request.build_id}",
            app_id=request.app_id,
            flatpak_branch=candidate_branch,
            expected_arches=set(request.expected_arches),
            expected_commits=final,
        )
        baseline = _stored_baseline(request)
        if baseline is not None:
            comparison = PermissionSnapshot(**baseline["snapshot"])
            comparison_artifacts = baseline["artifacts"]
            published_fingerprint = fingerprint_snapshot(comparison)
            if published_fingerprint != baseline["fingerprint"]:
                _conflict("invalid_baseline", "Stored baseline fingerprint differs")
        else:
            try:
                published = collect_permissions(
                    repository_url=published_repo_url,
                    app_id=request.app_id,
                    flatpak_branch=request.flatpak_branch,
                )
            except PermissionSnapshotError as exc:
                if exc.code != "missing_baseline":
                    raise
            if published is not None:
                comparison = published.snapshot
                comparison_artifacts = [asdict(item) for item in published.artifacts]
                published_fingerprint = fingerprint_snapshot(comparison)
        if comparison is not None:
            differences = [
                {"path": item.path, "before": item.before, "after": item.after}
                for item in compare_snapshots(comparison, candidate.snapshot)
            ]
        fingerprint = fingerprint_snapshot(candidate.snapshot)
    except PermissionSnapshotError as exc:
        if exc.code == "invalid_input":
            raise HTTPException(
                status_code=500, detail="permission_repository_not_configured"
            ) from exc
        if exc.code in ("transport_error", "timeout"):
            raise HTTPException(
                status_code=504 if exc.code == "timeout" else 502,
                detail="permission_repository_unavailable",
            ) from exc
        error = exc
        baseline = None
        comparison = None
        comparison_artifacts = []
        published_fingerprint = None
        differences = None

    artifacts = [asdict(item) for item in candidate.artifacts] if candidate else []
    identity = request.model_dump(exclude={"matrix_succeeded"})
    identity.update(
        schema="permission-assessment/1",
        expected_arches=sorted(set(request.expected_arches)),
        canonicalization_version=CANONICALIZATION_VERSION,
        uploaded_refs=uploaded,
        candidate_artifacts=artifacts,
    )
    assessment_identity = hashlib.sha256(
        json.dumps(
            identity, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        ).encode("utf-8")
    ).hexdigest()
    accepted = error is None and baseline is not None and differences == []
    values = request.model_dump(
        exclude={"matrix_succeeded", "destination_repo", "destination_channel"}
    )
    values.update(
        assessment_identity=assessment_identity,
        outcome="error" if error else "accepted" if accepted else "pending",
        acceptance_basis="baseline" if accepted else None,
        baseline_id=baseline["id"] if baseline is not None else None,
        base_revision=request.base_revision or "",
        intended_repo=request.destination_repo,
        intended_channel=request.destination_channel,
        expected_arches=sorted(set(request.expected_arches)),
        canonicalization_version=CANONICALIZATION_VERSION,
        uploaded_refs=uploaded,
        candidate_artifacts=artifacts,
        published_artifacts=comparison_artifacts,
        candidate_snapshot=asdict(candidate.snapshot) if candidate else None,
        published_snapshot=asdict(comparison) if comparison else None,
        fingerprint=fingerprint,
        published_fingerprint=published_fingerprint,
        differences=differences,
        build_checks=checks,
        error_code=error.code if error else None,
        error_message=error.message if error else None,
    )
    linked_assessment_id, linked_fingerprint_match = _linked_assessment(
        request, fingerprint
    )
    values.update(
        linked_assessment_id=linked_assessment_id,
        linked_fingerprint_match=linked_fingerprint_match,
    )
    return _persist_observation(values)
