from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest

from app.maintenance import (
    Evidence,
    apply_triage,
    assess,
    evidence_fingerprint,
    fingerprint_matches_evidence,
)
from app.upstream import AnityaClient, compare_releases, release_evidence

NOW = datetime(2026, 10, 19, tzinfo=UTC)
SOURCE = "https://github.com/example/app"


def observation(**changes):
    return SimpleNamespace(
        **(
            {
                "project_id": 12,
                "upstream_version": "2.0",
                "stable_versions": ["2.0", "1.0"],
                "source_url": SOURCE,
                "checked_at": NOW,
                "last_attempt_at": NOW,
                "status": "ok",
            }
            | changes
        )
    )


@pytest.mark.parametrize(
    "packaged,versions,expected",
    [
        ("1.0", ["2.0", "1.0"], ("2.0", True)),
        ("v1.0.0", ["1.0", "0.9"], ("1.0", False)),
        ("1.10", ["1.10", "1.9"], ("1.10", False)),
        ("1.9", ["1.10", "1.9"], ("1.10", True)),
        ("1.0", ["2.0rc1", "1.0"], None),
        ("1.0-beta", ["2.0", "1.0-beta"], None),
        ("1:1.0", ["2.0", "1:1.0"], None),
        ("1.0-2", ["2.0", "1.0-2"], None),
        ("build-abc", ["2.0", "build-abc"], None),
        ("1.0", ["2026.1", "1.0"], None),
        ("3.0", ["2.0", "1.0"], None),
        (None, ["2.0"], None),
        ("1.0", [], None),
        ("1.0", None, None),
    ],
)
def test_conservative_stable_comparison(packaged, versions, expected):
    assert compare_releases(packaged, versions) == expected


def test_newer_release_is_review_evidence_with_source_and_checked_time():
    upstream = release_evidence(
        observation(), [{"version": "1.0"}], SOURCE, "stable", NOW
    )
    case = assess(Evidence("org.example.App", "App", NOW, upstream=upstream), NOW)
    assert case.signals[0].kind == "upstream"
    assert case.signals[0].confidence == "investigate"
    assert case.signals[0].source_url == "https://release-monitoring.org/project/12/"
    assert case.signals[0].checked_at == NOW


def test_upstream_queue_does_not_include_age_only_cases():
    from app.maintenance import dashboard

    upstream = release_evidence(
        observation(), [{"version": "1.0"}], SOURCE, "stable", NOW
    )
    cases = [
        assess(Evidence("new", "New", NOW, upstream=upstream), NOW),
        assess(Evidence("old", "Old", NOW - timedelta(days=500)), NOW),
    ]
    result = dashboard(cases, NOW, queue="upstream", user_id=1)
    assert [case.app_id for case in result.cases] == ["new"]


def test_newly_comparable_upstream_evidence_reopens_a_snoozed_case():
    row = observation(stable_versions=["2.0"])
    upstream = release_evidence(row, [{"version": "1.0"}], SOURCE, "stable", NOW)
    assert upstream.status == "unknown"
    evidence = Evidence("app", "App", NOW - timedelta(days=500), upstream=upstream)
    state = SimpleNamespace(
        owner_id=None,
        notes="",
        version=1,
        snoozed_until=NOW + timedelta(days=30),
        snooze_reason="Waiting",
        fingerprint=evidence_fingerprint(evidence),
    )
    row.stable_versions = ["2.0", "1.0"]
    evidence.upstream = release_evidence(
        row, [{"version": "1.0"}], SOURCE, "stable", NOW
    )
    case = assess(evidence, NOW)
    apply_triage(case, state, NOW, evidence)
    assert any(signal.kind == "upstream" for signal in case.signals)
    assert case.reopened and not case.snoozed


def test_uncomparable_release_changes_do_not_invalidate_a_snooze():
    evidence = Evidence(
        "app",
        "App",
        NOW,
        upstream=release_evidence(
            observation(stable_versions=["2.0"]),
            [{"version": "1.0"}],
            SOURCE,
            "stable",
            NOW,
        ),
    )
    saved = evidence_fingerprint(evidence)
    evidence.upstream = release_evidence(
        observation(upstream_version="3.0", stable_versions=["3.0", "2.0"]),
        [{"version": "1.0"}],
        SOURCE,
        "stable",
        NOW,
    )
    assert evidence.upstream.status == "unknown"
    assert fingerprint_matches_evidence(evidence, saved)


def test_internal_comparison_eligibility_is_not_exposed_in_api_schema_or_response():
    from app.upstream import UpstreamEvidence

    upstream = release_evidence(
        observation(), [{"version": "1.0"}], SOURCE, "stable", NOW
    )
    assert "_comparison_eligible" not in upstream.model_dump()
    assert (
        "_comparison_eligible" not in UpstreamEvidence.model_json_schema()["properties"]
    )


@pytest.mark.parametrize(
    "status,checked_at",
    [
        ("error", NOW),
        ("ok", NOW - timedelta(days=4)),
    ],
)
def test_transient_errors_and_staleness_do_not_change_compared_identity(
    status, checked_at
):
    evidence = Evidence(
        "app",
        "App",
        NOW,
        upstream=release_evidence(
            observation(), [{"version": "1.0"}], SOURCE, "stable", NOW
        ),
    )
    saved = evidence_fingerprint(evidence)
    evidence.upstream = release_evidence(
        observation(status=status, checked_at=checked_at),
        [{"version": "1.0"}],
        SOURCE,
        "stable",
        NOW,
    )
    assert fingerprint_matches_evidence(evidence, saved)


def test_high_severity_guidance_precedes_upstream_release_investigation():
    evidence = Evidence(
        "app",
        "App",
        NOW - timedelta(days=500),
        installs_last_7_days=10,
        runtime="org.example.Runtime/x86_64/old",
        runtime_eol=True,
        is_eol=True,
        upstream=release_evidence(
            observation(), [{"version": "1.0"}], SOURCE, "stable", NOW
        ),
    )
    case = assess(evidence, NOW)
    assert [signal.kind for signal in case.signals] == [
        "runtime",
        "eol",
        "upstream",
        "stale",
    ]
    assert "supported-runtime migration" in case.signals[0].next_step


@pytest.mark.parametrize(
    "changes,branch,releases,status",
    [
        (
            {"checked_at": NOW - timedelta(days=4)},
            "stable",
            [{"version": "1.0"}],
            "stale",
        ),
        ({"status": "error"}, "stable", [{"version": "1.0"}], "error"),
        (
            {"source_url": "https://github.com/wrong/app"},
            "stable",
            [{"version": "1.0"}],
            "unknown",
        ),
        ({}, "beta", [{"version": "1.0"}], "unknown"),
        (
            {},
            "stable",
            [{"version": "2.1beta", "type": "development"}, {"version": "1.0"}],
            "unknown",
        ),
        ({}, "stable", [], "unknown"),
        ({}, "stable", [{"version": "2.0"}], "current"),
    ],
)
def test_no_signal_for_unknown_failed_stale_beta_or_current(
    changes, branch, releases, status
):
    upstream = release_evidence(observation(**changes), releases, SOURCE, branch, NOW)
    assert upstream.status == status
    assert not assess(Evidence("app", "App", NOW, upstream=upstream), NOW).signals


def test_snooze_ignores_poll_timestamps_and_errors_but_changes_with_release():
    upstream = release_evidence(
        observation(), [{"version": "1.0"}], SOURCE, "stable", NOW
    )
    evidence = Evidence("app", "App", NOW, upstream=upstream)
    saved = evidence_fingerprint(evidence)
    upstream.checked_at += timedelta(days=1)
    upstream.last_attempt_at += timedelta(days=1)
    upstream.status = "error"
    assert fingerprint_matches_evidence(evidence, saved)
    upstream.upstream_version = "3.0"
    assert not fingerprint_matches_evidence(evidence, saved)
    # v1 reviewed only the old fields; rollout must not wake the entire backlog.
    assert fingerprint_matches_evidence(evidence, evidence_fingerprint(evidence, 1))


def test_client_retries_transient_gets_only(monkeypatch):
    monkeypatch.setattr("app.upstream.time.sleep", lambda _: None)
    calls = []

    def handle(request):
        calls.append(request)
        return httpx.Response(502 if len(calls) < 3 else 200, json={"items": []})

    client = AnityaClient()
    client.client.close()
    client.client = httpx.Client(transport=httpx.MockTransport(handle))
    try:
        assert client.get("/api/v2/projects/") == {"items": []}
        assert len(calls) == 3
        assert all(
            r.method == "GET" and "authorization" not in r.headers for r in calls
        )
    finally:
        client.close()


@pytest.mark.parametrize("status", [401, 404, 429, 502])
def test_http_errors_stop_with_bounded_requests(monkeypatch, status):
    monkeypatch.setattr("app.upstream.time.sleep", lambda _: None)
    client = AnityaClient()
    client.client.close()
    transport = Mock(side_effect=lambda r: httpx.Response(status))
    client.client = httpx.Client(transport=httpx.MockTransport(transport))
    try:
        with pytest.raises(httpx.HTTPStatusError):
            client.get("/api/v2/projects/")
        assert transport.call_count == (3 if status == 502 else 1)
    finally:
        client.close()


def project_client(**changes):
    client = AnityaClient()
    project = {
        "id": 12,
        "name": "app",
        "ecosystem": SOURCE,
        "archived": False,
        "homepage": SOURCE,
        "packages": [{"distro": "Flathub", "package_name": "org.example.App"}],
        "stable_versions": ["2.0", "1.0"],
    } | changes
    client.get = Mock(side_effect=[{"total_items": 1, "items": [{"id": 12}]}, project])
    return client


def test_project_requires_exact_unique_repository_and_unshared_identity():
    mapping = {"project": "app", "ecosystem": SOURCE}
    client = project_client()
    try:
        assert client.project(mapping, "org.example.App", SOURCE) == (
            12,
            ["2.0", "1.0"],
        )
    finally:
        client.close()
    for changes in [
        {"archived": True},
        {"packages": [{"distro": "Flathub", "package_name": "org.example.Other"}]},
        {"stable_versions": None},
        {"name": "wrong"},
        {"ecosystem": "https://wrong.example"},
    ]:
        client = project_client(**changes)
        try:
            with pytest.raises(ValueError):
                client.project(mapping, "org.example.App", SOURCE)
        finally:
            client.close()


def test_no_homepage_fallback_when_repository_differs():
    client = project_client()
    try:
        with pytest.raises(ValueError, match="source-repository"):
            client.project(
                {"project": "app", "ecosystem": SOURCE},
                "org.example.App",
                "https://github.com/fork/app",
            )
    finally:
        client.close()


def test_public_anitya_api_can_omit_the_archived_field():
    client = project_client()
    project = {
        "id": 12,
        "name": "app",
        "ecosystem": SOURCE,
        "homepage": SOURCE,
        "packages": [{"distro": "Flathub", "package_name": "org.example.App"}],
        "stable_versions": ["2.0", "1.0"],
    }
    client.get = Mock(side_effect=[{"total_items": 1, "items": [{"id": 12}]}, project])
    try:
        assert client.project(
            {"project": "app", "ecosystem": SOURCE}, "org.example.App", SOURCE
        ) == (12, ["2.0", "1.0"])
    finally:
        client.close()


def test_observe_only_uses_existing_unique_flathub_mappings():
    from app.maintenance_upstream import observe

    mapping = {"name": "org.example.App", "project": "app", "ecosystem": SOURCE}
    client = Mock()
    assert observe(client, "org.example.App", SOURCE, []) == {
        "status": "unmapped",
        "project_id": None,
        "stable_versions": [],
        "upstream_version": None,
    }
    client.project.assert_not_called()
    with pytest.raises(ValueError):
        observe(
            client,
            "org.example.App",
            SOURCE,
            [mapping, {**mapping, "name": "org.example.Variant"}],
        )
    with pytest.raises(ValueError):
        observe(client, "org.example.App", SOURCE, [mapping, mapping])
    client.project.return_value = (12, ["2.0", "1.0"])
    assert (
        observe(client, "org.example.App", SOURCE, [mapping])["upstream_version"]
        == "2.0"
    )


def test_failed_observation_preserves_successful_data_and_timestamp():
    from app.maintenance_upstream import store_observation

    cached = observation()
    db = SimpleNamespace(session=Mock())
    db.session.get.return_value = cached
    store_observation(
        db, "org.example.App", SOURCE, {"status": "error"}, NOW + timedelta(days=1)
    )
    assert cached.checked_at == NOW
    assert cached.upstream_version == "2.0"
    assert cached.status == "error"
    assert cached.last_attempt_at == NOW + timedelta(days=1)


@pytest.mark.parametrize(
    "catalog_fails,project_fails", [(False, False), (False, True), (True, False)]
)
def test_refresh_runs_by_default_excludes_variants_and_isolates_failures(
    monkeypatch, catalog_fails, project_fails
):
    from app import maintenance_upstream as worker
    from app import models

    session = Mock()
    session.query.return_value.filter.return_value.all.return_value = [
        SimpleNamespace(app_id="org.example.App", source=SOURCE),
        SimpleNamespace(app_id="org.example.Other", source=SOURCE),
        SimpleNamespace(app_id="org.kde.okular.kirigami", source=SOURCE),
        SimpleNamespace(app_id="io.github.martinrotter.rssguardlite", source=SOURCE),
        SimpleNamespace(app_id="org.gnome.Crosswords.Editor", source=SOURCE),
    ]
    session.get.return_value = None

    @contextmanager
    def db(_):
        yield SimpleNamespace(session=session)

    monkeypatch.setattr(worker, "get_db", db)
    client = Mock()
    if catalog_fails:
        client.mappings.side_effect = ValueError("unavailable")
    else:
        client.mappings.return_value = [
            {"name": "org.example.App", "project": "app", "ecosystem": SOURCE}
        ]
        if project_fails:
            client.project.side_effect = ValueError("transient failure")
        else:
            client.project.return_value = (12, ["2.0", "1.0"])
    monkeypatch.setattr(worker, "AnityaClient", lambda: client)
    worker.refresh_maintenance_upstream()
    stored = [call.args[0] for call in session.add.call_args_list]
    assert len(stored) == 2 and all(
        isinstance(row, models.MaintenanceUpstream) for row in stored
    )
    assert stored[0].status == ("error" if catalog_fails or project_fails else "ok")
    if stored[0].status == "ok":
        assert stored[0].upstream_version == "2.0"
    assert stored[1].status == ("error" if catalog_fails else "unmapped")
    client.close.assert_called_once()


def test_mapping_pagination_rejects_incomplete_or_changing_catalog():
    client = AnityaClient()
    try:
        for pages in [
            [
                {"total_items": 2, "items": [{"name": "first"}]},
                {"total_items": 2, "items": []},
            ],
            [
                {"total_items": 2, "items": [{"name": "first"}]},
                {"total_items": 3, "items": [{"name": "next"}]},
            ],
        ]:
            client.get = Mock(side_effect=pages)
            with pytest.raises(ValueError):
                client.mappings()
    finally:
        client.close()
