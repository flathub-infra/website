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
from app.moderation.permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionSnapshot,
    fingerprint_snapshot,
)
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
        "destination_channel": "stable",
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
        {"pull_request_head_revision": None},
        {"candidate_kind": "push", "pull_request_head_revision": None},
        {
            "candidate_kind": "push",
            "pull_request_number": None,
            "pull_request_url": None,
        },
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
    monkeypatch.setattr(assessment, "_stored_baseline", lambda request: None)
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
        "checks": [],
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
        "checks": [],
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


def lint_check(status, errors):
    return {
        "check_name": "flathub-hooks",
        "build_id": 1,
        "job_id": 8,
        "status": status,
        "status_reason": "One or more validations failed." if status == 3 else None,
        "results": json.dumps(
            {
                "diagnostics": [
                    {
                        "refstring": f"app/{APP}/x86_64/test",
                        "is_warning": False,
                        "category": "flatpak_builder_lint",
                        "data": {"stdout": {"errors": errors, "info": ["x"]}},
                    }
                ]
            }
        ),
    }


def test_build_failed_by_checks_is_assessed(test_branch_source, observed):
    _, extended = test_branch_source
    extended["build"]["repo_state"] = 3
    extended["checks"] = [
        lint_check(
            3,
            [
                "finish-args-home-filesystem-access",
                "finish-args-has-socket-ssh-auth",
                "finish-args-home-filesystem-access",
            ],
        )
    ]
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "pending"
    assert response.build_checks == [
        {
            "check_name": "flathub-hooks",
            "status": 3,
            "status_reason": "One or more validations failed.",
            "errors": [
                "finish-args-has-socket-ssh-auth",
                "finish-args-home-filesystem-access",
            ],
        }
    ]
    assert observed[0]["build_checks"] == response.build_checks


@pytest.mark.parametrize(
    "repo_state,checks",
    [
        (3, []),
        (3, [lint_check(1, [])]),
        (5, [lint_check(3, ["finish-args-host-filesystem-access"])]),
        (1, []),
    ],
)
def test_build_without_inspectable_artifacts_is_not_ready(
    test_branch_source, observed, repo_state, checks
):
    _, extended = test_branch_source
    extended["build"]["repo_state"] = repo_state
    extended["checks"] = checks
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "error"
    assert response.error_code == "build_not_ready"
    assert [check["status"] for check in response.build_checks] == [
        check["status"] for check in checks
    ]


@pytest.mark.parametrize(
    "checks",
    [None, [{"check_name": "flathub-hooks"}], [{"status": 3}], ["bad"]],
)
def test_malformed_build_checks_are_errors(test_branch_source, observed, checks):
    _, extended = test_branch_source
    extended["checks"] = checks
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "error"
    assert response.error_code == "invalid_build"
    assert observed[0]["build_checks"] == []


def test_unparseable_check_results_record_no_errors(test_branch_source, observed):
    _, extended = test_branch_source
    extended["checks"] = [{**lint_check(1, []), "results": "not json"}]
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "pending"
    assert response.build_checks[0]["errors"] == []


def test_beta_destination_compares_with_beta_repo(
    test_branch_source, observed, monkeypatch, tmp_path
):
    monkeypatch.setattr(config.settings, "beta_repo_url", config.settings.repo_url)
    monkeypatch.setattr(
        config.settings, "repo_url", (tmp_path / "unavailable").as_uri()
    )
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(
            **request_body(destination_channel="beta")
        )
    )
    assert response.outcome == "pending"
    assert response.published_comparison_available is True
    assert observed[0]["intended_channel"] == "beta"


def test_unsupported_destination_channel_is_an_error(test_branch_source, observed):
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(
            **request_body(destination_channel="test")
        )
    )
    assert response.outcome == "error"
    assert response.error_code == "unsupported_destination"
    assert observed[0]["uploaded_refs"] == []


def push_body(**changes):
    return request_body(
        **{
            "candidate_kind": "push",
            "built_revision": "f" * 40,
            "pull_request_head_revision": "a" * 40,
            **changes,
        }
    )


def test_push_without_linked_pull_request_is_valid():
    request = assessment.CandidateAssessmentRequest(
        **push_body(
            pull_request_number=None,
            pull_request_url=None,
            pull_request_head_revision=None,
        )
    )
    assert assessment._linked_assessment(request, "f" * 64) == (None, None)


def test_pull_request_candidates_are_never_linked():
    request = assessment.CandidateAssessmentRequest(**request_body())
    assert assessment._linked_assessment(request, "f" * 64) == (None, None)


def test_push_records_linked_assessment(test_branch_source, observed, monkeypatch):
    calls = []

    def linked(request, fingerprint):
        calls.append((request.pull_request_head_revision, fingerprint))
        return 41, True

    monkeypatch.setattr(assessment, "_linked_assessment", linked)
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**push_body())
    )
    assert response.outcome == "pending"
    assert calls == [("a" * 40, response.snapshot_fingerprint)]
    assert response.linked_assessment_id == 41
    assert response.linked_fingerprint_match is True
    assert observed[0]["candidate_kind"] == "push"
    assert observed[0]["linked_assessment_id"] == 41


def stored_baseline(monkeypatch, architectures, fingerprint=None):
    snapshot = PermissionSnapshot(CANONICALIZATION_VERSION, architectures)
    baseline = {
        "id": 12,
        "snapshot": {
            "canonicalization_version": CANONICALIZATION_VERSION,
            "architectures": architectures,
        },
        "artifacts": [
            {"ref_name": REF, "arch": "x86_64", "commit": "e" * 64},
            {"ref_name": ARM, "arch": "aarch64", "commit": "f" * 64},
        ],
        "fingerprint": fingerprint or fingerprint_snapshot(snapshot),
    }
    requests = []

    def lookup(request):
        requests.append(request)
        return baseline

    monkeypatch.setattr(assessment, "_stored_baseline", lookup)
    return baseline, requests


NETWORK = {"Context": {"shared": ["network"]}}


def test_matching_baseline_accepts_candidate(
    test_branch_source, observed, monkeypatch, tmp_path
):
    baseline, requests = stored_baseline(
        monkeypatch, {"x86_64": NETWORK, "aarch64": NETWORK}
    )
    monkeypatch.setattr(
        config.settings, "repo_url", (tmp_path / "unavailable").as_uri()
    )
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert [request.destination_channel for request in requests] == ["stable"]
    assert response.outcome == "accepted"
    assert response.acceptance_basis == "baseline"
    assert response.baseline_id == 12
    assert response.differences == []
    row = observed[0]
    assert row["published_artifacts"] == baseline["artifacts"]
    assert row["published_fingerprint"] == baseline["fingerprint"]
    assert row["published_snapshot"] == baseline["snapshot"]


def test_baseline_difference_needs_review_even_for_removals(
    test_branch_source, observed, monkeypatch
):
    stored_baseline(
        monkeypatch,
        {
            "x86_64": {"Context": {"shared": ["ipc", "network"]}},
            "aarch64": NETWORK,
        },
    )
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "pending"
    assert response.acceptance_basis is None
    assert response.baseline_id == 12
    assert response.differences == [
        {
            "path": ("x86_64", "Context", "shared"),
            "before": ["ipc", "network"],
            "after": ["network"],
        }
    ]


def test_inconsistent_baseline_is_an_error(test_branch_source, observed, monkeypatch):
    stored_baseline(monkeypatch, {"x86_64": NETWORK, "aarch64": NETWORK}, "0" * 64)
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "error"
    assert response.error_code == "invalid_baseline"
    assert response.baseline_id is None
    assert observed[0]["published_snapshot"] is None


def test_matching_live_repo_without_baseline_stays_pending(
    test_branch_source, observed, monkeypatch, tmp_path
):
    published = SourceRepo(tmp_path / "identical")
    published.commit(REF, "[Context]\nshared=network;\n")
    published.commit(ARM, "[Context]\nshared=network;\n")
    monkeypatch.setattr(config.settings, "repo_url", published.url)
    response = assessment.assess_candidate(
        assessment.CandidateAssessmentRequest(**request_body())
    )
    assert response.outcome == "pending"
    assert response.differences == []
    assert response.acceptance_basis is None
    assert response.baseline_id is None
