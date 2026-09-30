import json
from types import SimpleNamespace

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import config
from app.moderation import permission_assessment as assessment
from app.moderation import permission_assessment_api as api
from app.moderation.ostree_permissions import collect_permissions
from tests.shared_fixtures import APP, ARM, REF, SourceRepo

SECRET = "permission-assessment-test-secret-32-bytes"


def request_body(**changes):
    return {
        "pipeline_id": "pipeline-1",
        "build_id": 1,
        "forge_instance": "https://github.com",
        "source_repository": "flathub/org.example.App",
        "pull_request_number": 1,
        "pull_request_url": "https://github.com/flathub/org.example.App/pull/1",
        "pull_request_head_revision": "a" * 40,
        "built_revision": "b" * 40,
        "target_git_branch": "master",
        "base_revision": "c" * 40,
        "candidate_kind": "merge",
        "app_id": APP,
        "destination_repo": "test",
        "destination_channel": "test",
        "flatpak_branch": "stable",
        "expected_arches": ["x86_64", "aarch64"],
        "matrix_succeeded": True,
        **changes,
    }


def headers(**claims):
    token = jwt.encode(
        {"sub": "permission-assessment", "scope": ["assess"], **claims},
        SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(config.settings, "permission_assessment_shared_secret", SECRET)
    app = FastAPI()
    api.register_to_app(app)
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize(
    "changes",
    [
        {"pull_request_url": None},
        {"pull_request_number": None},
        {"pull_request_head_revision": "bad"},
        {"built_revision": "bad"},
        {"base_revision": "bad"},
        {"candidate_kind": "tag"},
        {"expected_arches": []},
        {"expected_arches": ["x86_64/other"]},
        {"build_id": True},
        {"matrix_succeeded": "true"},
    ],
)
def test_malformed_attestations_return_422(client, changes):
    response = client.post(
        "/moderation/permissions/assess",
        headers=headers(),
        json=request_body(**changes),
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    "method,path",
    [("GET", "/moderation/permissions/1"), ("POST", "/moderation/permissions/assess")],
)
@pytest.mark.parametrize(
    "authorization,status",
    [
        ({}, 401),
        ({"Authorization": "Bearer invalid"}, 401),
        (headers(sub="reviewcheck"), 401),
        (headers(scope=["reviewcheck"]), 403),
        (headers(scope="not-assess"), 403),
        (headers(scope=None), 403),
    ],
)
def test_authentication_rejects_other_authorities(
    client, authorization, status, method, path
):
    response = client.request(method, path, headers=authorization, json=request_body())
    assert response.status_code == status


def test_missing_signing_configuration_returns_500(client, monkeypatch):
    monkeypatch.setattr(config.settings, "permission_assessment_shared_secret", None)
    assert client.get("/moderation/permissions/1", headers=headers()).status_code == 500


@pytest.fixture
def observed(monkeypatch):
    rows = []

    def persist(values):
        rows.append(values)
        return assessment._response(SimpleNamespace(id=len(rows), **values))

    monkeypatch.setattr(assessment, "_persist_observation", persist)
    return rows


def test_failed_matrix_does_not_resolve_artifacts(client, observed, monkeypatch):
    def fetch(*args, **kwargs):
        pytest.fail("Failed matrix must stop before artifact resolution")

    monkeypatch.setattr(assessment, "_fetch", fetch)
    response = client.post(
        "/moderation/permissions/assess",
        headers=headers(),
        json=request_body(matrix_succeeded=False),
    )
    assert response.status_code == 200
    assert response.json()["outcome"] == "error"
    assert response.json()["error_code"] == "matrix_failed"
    assert response.json()["snapshot_fingerprint"] is None
    assert observed[0]["candidate_snapshot"] is None


@pytest.fixture
def candidate_source(tmp_path, monkeypatch):
    source = SourceRepo(tmp_path / "candidate")
    final = {
        REF: source.commit(REF, "[Context]\nsockets=x11;!x11;\n"),
        ARM: source.commit(ARM, "[Context]\nfilesystems=home:ro;\n"),
    }
    extended = {
        "build": {
            "id": 1,
            "app_id": APP,
            "repo": "test",
            "repo_state": 2,
            "commit_job_id": 7,
        },
        "build_refs": [{"ref_name": ref, "commit": "d" * 64} for ref in final],
    }
    job = {"id": 7, "kind": 0, "status": 2, "results": json.dumps({"refs": final})}
    monkeypatch.setattr(config.settings, "flat_manager_api", "http://localhost:1234")
    monkeypatch.setattr(
        assessment,
        "_fetch",
        lambda url, *args, **kwargs: job if url.endswith("/commit") else extended,
    )
    published = SourceRepo(tmp_path / "published")
    monkeypatch.setattr(config.settings, "repo_url", published.url)

    def collect(**kwargs):
        if kwargs["repository_url"].startswith("https://dl.flathub.org/build-repo/"):
            kwargs["repository_url"] = source.url
        return collect_permissions(**kwargs)

    monkeypatch.setattr(assessment, "collect_permissions", collect)
    return source, final, job


def test_missing_baseline_preserves_candidate_without_authorization(
    candidate_source, observed
):
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "pending"
    assert response.acceptance_basis is None
    assert response.review_url is None
    assert response.published_comparison_available is False
    assert response.differences is None
    row = observed[0]
    assert row["fingerprint"] == response.snapshot_fingerprint
    assert {
        item["ref_name"]: item["commit"] for item in row["candidate_artifacts"]
    } == candidate_source[1]
    assert {item["commit"] for item in row["uploaded_refs"]} == {"d" * 64}
    assert row["published_snapshot"] is None
    assert row["published_fingerprint"] is None
    assert set(row["candidate_snapshot"]["architectures"]) == {"x86_64", "aarch64"}


@pytest.mark.parametrize(
    "change,code",
    [
        ({"status": 1}, "commit_not_complete"),
        ({"kind": 1}, "invalid_commit_job"),
        ({"id": 8}, "identity_mismatch"),
        ({"results": "bad"}, "invalid_commit_results"),
        ({"results": {"refs": {REF: "d" * 64}}}, "missing_architecture"),
        ({"results": {"refs": {REF: "bad", ARM: "d" * 64}}}, "invalid_commit_results"),
        ({"results": {"refs": {REF: "d" * 64, ARM: "d" * 64}}}, "checksum_mismatch"),
    ],
)
def test_final_commit_conflicts_never_fall_back_to_uploads(
    candidate_source, observed, change, code
):
    candidate_source[2].update(change)
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "error"
    assert response.error_code == code
    assert response.snapshot_fingerprint is None
    assert response.acceptance_basis is None
    assert observed[0]["fingerprint"] is None


def test_identity_includes_head_and_architecture_set(candidate_source, observed):
    first = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    reordered = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(
            **request_body(expected_arches=["aarch64", "x86_64", "x86_64"])
        )
    )
    changed = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(
            **request_body(pull_request_head_revision="e" * 40)
        )
    )
    assert first.assessment_identity == reordered.assessment_identity
    assert first.assessment_identity != changed.assessment_identity


@pytest.mark.parametrize("stage", ["candidate", "published"])
@pytest.mark.parametrize(
    "code,status,detail",
    [
        ("invalid_input", 500, "permission_repository_not_configured"),
        ("transport_error", 502, "permission_repository_unavailable"),
        ("timeout", 504, "permission_repository_unavailable"),
    ],
)
def test_repository_failures_do_not_persist_observations(
    client, candidate_source, observed, monkeypatch, stage, code, status, detail
):
    collect = assessment.collect_permissions

    def fail(**kwargs):
        is_candidate = kwargs["repository_url"].startswith(
            "https://dl.flathub.org/build-repo/"
        )
        if is_candidate == (stage == "candidate"):
            raise assessment.PermissionSnapshotError(code, "Repository failed")
        return collect(**kwargs)

    monkeypatch.setattr(assessment, "collect_permissions", fail)
    response = client.post(
        "/moderation/permissions/assess", headers=headers(), json=request_body()
    )
    assert response.status_code == status
    assert response.json() == {"detail": detail}
    assert observed == []


@pytest.fixture
def test_branch_source(tmp_path, monkeypatch):
    source = SourceRepo(tmp_path / "candidate")
    published = SourceRepo(tmp_path / "published")
    test_ref = f"app/{APP}/x86_64/test"
    test_arm = f"app/{APP}/aarch64/test"
    final = {
        test_ref: source.commit(test_ref, "[Context]\nshared=network;\n"),
        test_arm: source.commit(test_arm, "[Context]\nshared=network;\n"),
    }
    published.commit(REF, "[Context]\nshared=ipc;\n")
    published.commit(ARM, "[Context]\nshared=network;\n")
    extended = {
        "build": {
            "id": 1,
            "app_id": APP,
            "repo": "test",
            "repo_state": 2,
            "commit_job_id": 7,
        },
        "build_refs": [{"ref_name": ref, "commit": "d" * 64} for ref in final],
    }
    job = {"id": 7, "kind": 0, "status": 2, "results": json.dumps({"refs": final})}
    monkeypatch.setattr(config.settings, "flat_manager_api", "http://localhost:1234")
    monkeypatch.setattr(
        assessment,
        "_fetch",
        lambda url, *args, **kwargs: job if url.endswith("/commit") else extended,
    )
    monkeypatch.setattr(config.settings, "repo_url", published.url)

    def collect(**kwargs):
        if kwargs["repository_url"].startswith("https://dl.flathub.org/build-repo/"):
            kwargs["repository_url"] = source.url
        return collect_permissions(**kwargs)

    monkeypatch.setattr(assessment, "collect_permissions", collect)
    return final, extended


def test_candidate_branch_comes_from_uploaded_refs(test_branch_source, observed):
    final, _ = test_branch_source
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "pending"
    assert response.published_comparison_available is True
    assert response.differences == [
        {
            "path": ("x86_64", "Context", "shared"),
            "before": ["ipc"],
            "after": ["network"],
        }
    ]
    row = observed[0]
    assert {
        item["ref_name"]: item["commit"] for item in row["candidate_artifacts"]
    } == final
    assert {item["ref_name"] for item in row["published_artifacts"]} == {REF, ARM}
    assert row["flatpak_branch"] == "stable"


@pytest.mark.parametrize(
    "extra_ref,code",
    [
        (REF, "identity_mismatch"),
        (f"app/{APP}/x86_64/", "invalid_build"),
    ],
)
def test_uploaded_ref_branch_conflicts(test_branch_source, observed, extra_ref, code):
    _, extended = test_branch_source
    extended["build_refs"].append({"ref_name": extra_ref, "commit": "d" * 64})
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "error"
    assert response.error_code == code
    assert observed[0]["uploaded_refs"] == []
