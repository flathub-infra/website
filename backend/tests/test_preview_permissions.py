import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from tests.shared_fixtures import APP, ARM, REF, SourceRepo

BACKEND = Path(__file__).resolve().parent.parent


def preview(published, *extra):
    command = [
        sys.executable,
        "-m",
        "utils.preview_permissions",
        "--published-repo",
        published.url,
        "--app-id",
        APP,
        "--branch",
        "stable",
        *extra,
    ]
    return subprocess.run(
        command,
        cwd=BACKEND,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
    )


def test_baseline_and_architecture_removal(tmp_path):
    published = SourceRepo(tmp_path / "published")
    candidate = SourceRepo(tmp_path / "candidate")
    x86 = published.commit(REF, "[Context]\nfilesystems=home;\n")
    arm = published.commit(ARM, "[Context]\nfilesystems=host;\n")
    candidate_commit = candidate.commit(REF, "[Context]\nfilesystems=home:ro;\n")
    baseline = preview(published)
    assert baseline.returncode == 0, baseline.stderr
    base = json.loads(baseline.stdout)
    assert base["mode"] == "baseline_preview"
    assert base["status"] == "complete"
    assert [(a["arch"], a["commit"]) for a in base["published"]["artifacts"]] == [
        ("aarch64", arm),
        ("x86_64", x86),
    ]
    assert base["published"]["snapshot"]["architectures"]["aarch64"]["Context"][
        "filesystems"
    ] == ["host"]
    assert base["published"]["fingerprint"]
    repeat = preview(published)
    assert repeat.returncode == 0
    assert (
        json.loads(repeat.stdout)["published"]["fingerprint"]
        == base["published"]["fingerprint"]
    )

    comparison = preview(
        published,
        "--candidate-repo",
        candidate.url,
        "--candidate-ref",
        f"{REF}={candidate_commit}",
        "--expected-arch",
        "x86_64",
    )
    assert comparison.returncode == 0, comparison.stderr
    data = json.loads(comparison.stdout)
    assert data["differences"][0] == {
        "path": ["aarch64"],
        "before": {"Context": {"filesystems": ["host"]}},
        "after": None,
    }


def test_reduction_and_expected_missing_architecture(tmp_path):
    published = SourceRepo(tmp_path / "published")
    candidate = SourceRepo(tmp_path / "candidate")
    published.commit(REF, "[Context]\nfilesystems=home;\n")
    checksum = candidate.commit(REF, "[Context]\nfilesystems=home:ro;\n")
    flags = (
        "--candidate-repo",
        candidate.url,
        "--candidate-ref",
        f"{REF}={checksum}",
        "--expected-arch",
        "x86_64",
    )
    result = preview(published, *flags)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert data["equal"] is False
    assert data["differences"] == [
        {
            "path": ["x86_64", "Context", "filesystems"],
            "before": ["home"],
            "after": ["home:ro"],
        }
    ]
    missing = preview(published, *flags, "--expected-arch", "aarch64")
    assert missing.returncode == 1
    error = json.loads(missing.stdout)
    assert error["error"]["code"] == "missing_architecture"
    assert "equal" not in error and "fingerprint" not in error


@pytest.mark.parametrize(
    "flags",
    [
        ("--candidate-repo", "file:///tmp/foo"),
        ("--candidate-ref", "invalid"),
        (
            "--candidate-repo",
            "file:///tmp/foo",
            "--candidate-ref",
            "bad",
            "--expected-arch",
            "x86_64",
        ),
        (
            "--candidate-repo",
            "file:///tmp/foo",
            "--candidate-ref",
            "ref=1",
            "--candidate-ref",
            "ref=2",
            "--expected-arch",
            "x86_64",
        ),
        (
            "--candidate-repo",
            "file:///tmp/foo",
            "--candidate-ref",
            "ref=1",
            "--expected-arch",
            "x86_64",
            "--expected-arch",
            "x86_64",
        ),
    ],
)
def test_usage_errors(tmp_path, flags):
    published = SourceRepo(tmp_path / "published")
    result = preview(published, *flags)
    assert result.returncode == 2
    assert result.stderr.startswith("usage:")
