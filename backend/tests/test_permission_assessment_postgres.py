import os
import sys
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import asdict
from datetime import UTC, datetime
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import models
from app.db_session import DBSession
from app.moderation import permission_assessment
from app.moderation.permission_snapshot import (
    CANONICALIZATION_VERSION,
    PermissionSnapshot,
    fingerprint_snapshot,
)


def test_concurrent_identical_observations_persist_once(monkeypatch):
    database_url = os.getenv("PERMISSION_ASSESSMENT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("PERMISSION_ASSESSMENT_TEST_DATABASE_URL is not configured")

    schema_name = f"permission_assessment_test_{uuid4().hex}"
    admin_engine = create_engine(database_url)
    isolated_engine = None
    schema_created = False
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))
        schema_created = True

        isolated_engine = create_engine(database_url)

        def set_search_path(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute(f'SET search_path TO "{schema_name}"')
            cursor.close()

        event.listen(isolated_engine, "connect", set_search_path)
        with isolated_engine.begin() as connection:
            models.PermissionBaseline.__table__.create(connection)
            models.PermissionAssessmentObservation.__table__.create(connection)

        Session = sessionmaker(bind=isolated_engine, expire_on_commit=False)
        barrier = Barrier(2, timeout=30)

        @contextmanager
        def real_db(db_type="writer"):
            assert db_type == "writer"
            session = Session()
            try:
                session.begin()
                session.execute(text("SELECT 1"))
                barrier.wait()
                yield DBSession(session)
                if db_type == "writer":
                    session.commit()
            except BaseException:
                session.rollback()
                raise
            finally:
                session.close()

        snapshot = PermissionSnapshot(
            canonicalization_version=CANONICALIZATION_VERSION,
            architectures={
                "x86_64": {
                    "Context": {"shared": ["network"]},
                    "Session Bus Policy": {"org.example.Service": "talk"},
                }
            },
        )
        candidate_snapshot = asdict(snapshot)
        fingerprint = fingerprint_snapshot(snapshot)
        assessment_identity = str(uuid4())
        ref_name = "app/org.example.App/x86_64/stable"
        commit = "a" * 64
        uploaded_ref = {"ref_name": ref_name, "commit": commit}
        values = {
            "assessment_identity": assessment_identity,
            "outcome": "pending",
            "app_id": "org.example.App",
            "pipeline_id": "permission-assessment-integration",
            "forge_instance": "github",
            "source_repository": "flathub/org.example.App",
            "pull_request_head_revision": "1" * 40,
            "built_revision": "2" * 40,
            "target_git_branch": "main",
            "base_revision": "3" * 40,
            "candidate_kind": "head",
            "intended_repo": "test",
            "intended_channel": "stable",
            "flatpak_branch": "stable",
            "build_id": 43127,
            "pull_request_number": 17,
            "pull_request_url": ("https://github.com/flathub/org.example.App/pull/17"),
            "expected_arches": ["x86_64"],
            "canonicalization_version": CANONICALIZATION_VERSION,
            "candidate_artifacts": [
                {"ref_name": ref_name, "arch": "x86_64", "commit": commit}
            ],
            "published_artifacts": [],
            "uploaded_refs": [uploaded_ref],
            "candidate_snapshot": candidate_snapshot,
            "published_snapshot": None,
            "differences": None,
            "fingerprint": fingerprint,
            "published_fingerprint": None,
            "error_code": None,
            "error_message": None,
        }
        monkeypatch.setattr(permission_assessment, "get_db", real_db)

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(permission_assessment._persist_observation, values)
                for _ in range(2)
            ]
            responses = [future.result() for future in futures]

        assert responses[0].assessment_id == responses[1].assessment_id
        assert responses[0].assessment_identity == assessment_identity
        assert responses[1].assessment_identity == assessment_identity
        assert responses[0].outcome == responses[1].outcome == "pending"
        assert (
            responses[0].snapshot_fingerprint
            == responses[1].snapshot_fingerprint
            == fingerprint
        )

        with Session() as session:
            persisted = session.scalars(
                select(models.PermissionAssessmentObservation).where(
                    models.PermissionAssessmentObservation.assessment_identity
                    == assessment_identity
                )
            ).all()

        assert len(persisted) == 1
        row = persisted[0]
        assert row.id == responses[0].assessment_id
        assert row.assessment_identity == assessment_identity
        assert row.candidate_snapshot == candidate_snapshot
        assert row.fingerprint == fingerprint
    finally:
        if isolated_engine is not None:
            isolated_engine.dispose()
        if schema_created:
            with admin_engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_push_links_latest_matching_pull_request_assessment(monkeypatch):
    database_url = os.getenv("PERMISSION_ASSESSMENT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("PERMISSION_ASSESSMENT_TEST_DATABASE_URL is not configured")

    schema_name = f"permission_assessment_test_{uuid4().hex}"
    admin_engine = create_engine(database_url)
    isolated_engine = None
    schema_created = False
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))
        schema_created = True
        isolated_engine = create_engine(database_url)

        def set_search_path(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute(f'SET search_path TO "{schema_name}"')
            cursor.close()

        event.listen(isolated_engine, "connect", set_search_path)
        with isolated_engine.begin() as connection:
            models.PermissionBaseline.__table__.create(connection)
            models.PermissionAssessmentObservation.__table__.create(connection)
        Session = sessionmaker(bind=isolated_engine, expire_on_commit=False)

        @contextmanager
        def real_db(db_type="writer"):
            session = Session()
            try:
                session.begin()
                yield DBSession(session)
                session.commit()
            finally:
                session.close()

        monkeypatch.setattr(permission_assessment, "get_db", real_db)

        def observation(identity, fingerprint, **changes):
            return {
                "assessment_identity": identity,
                "outcome": "pending" if fingerprint else "error",
                "app_id": "org.example.App",
                "pipeline_id": identity,
                "forge_instance": "github.com",
                "source_repository": "flathub/org.example.App",
                "pull_request_head_revision": "1" * 40,
                "built_revision": "1" * 40,
                "target_git_branch": "master",
                "base_revision": "3" * 40,
                "candidate_kind": "head",
                "intended_repo": "test",
                "intended_channel": "stable",
                "flatpak_branch": "stable",
                "build_id": 1,
                "pull_request_number": 17,
                "pull_request_url": "https://github.com/flathub/org.example.App/pull/17",
                "expected_arches": ["x86_64"],
                "canonicalization_version": CANONICALIZATION_VERSION,
                "candidate_artifacts": [],
                "published_artifacts": [],
                "uploaded_refs": [],
                "candidate_snapshot": {} if fingerprint else None,
                "published_snapshot": None,
                "differences": None,
                "fingerprint": fingerprint,
                "published_fingerprint": None,
                "error_code": None if fingerprint else "build_not_ready",
                "error_message": None if fingerprint else "not ready",
                **changes,
            }

        persist = permission_assessment._persist_observation
        older = persist(observation("older", "a" * 64))
        latest = persist(observation("latest", "b" * 64))
        persist(observation("errored", None))
        persist(observation("beta", "c" * 64, intended_channel="beta"))
        persist(
            observation("other-head", "d" * 64, pull_request_head_revision="9" * 40)
        )
        persist(observation("old-version", "e" * 64, canonicalization_version=2))
        assert older.assessment_id < latest.assessment_id

        def request(**changes):
            return permission_assessment.CandidateAssessmentRequest(
                **{
                    "pipeline_id": "push",
                    "build_id": 2,
                    "forge_instance": "github.com",
                    "source_repository": "flathub/org.example.App",
                    "pull_request_number": 17,
                    "pull_request_url": "https://github.com/flathub/org.example.App/pull/17",
                    "pull_request_head_revision": "1" * 40,
                    "built_revision": "5" * 40,
                    "target_git_branch": "master",
                    "candidate_kind": "push",
                    "app_id": "org.example.App",
                    "destination_repo": "stable",
                    "destination_channel": "stable",
                    "flatpak_branch": "stable",
                    "expected_arches": ["x86_64"],
                    "matrix_succeeded": True,
                    **changes,
                }
            )

        link = permission_assessment._linked_assessment
        assert link(request(), "b" * 64) == (latest.assessment_id, True)
        assert link(request(), "a" * 64) == (latest.assessment_id, False)
        assert link(request(), None) == (latest.assessment_id, None)
        assert link(request(pull_request_head_revision="8" * 40), "b" * 64) == (
            None,
            None,
        )
        assert link(request(target_git_branch="beta"), "b" * 64) == (None, None)

        pushed = persist(
            observation(
                "push",
                "b" * 64,
                candidate_kind="push",
                intended_repo="stable",
                linked_assessment_id=latest.assessment_id,
                linked_fingerprint_match=True,
            )
        )
        assert pushed.linked_assessment_id == latest.assessment_id
        assert link(request(), "b" * 64) == (latest.assessment_id, True)
    finally:
        if isolated_engine is not None:
            isolated_engine.dispose()
        if schema_created:
            with admin_engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema_name}" CASCADE'))
        admin_engine.dispose()


def test_stored_baseline_lookup_and_acceptance_constraint(monkeypatch):
    database_url = os.getenv("PERMISSION_ASSESSMENT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("PERMISSION_ASSESSMENT_TEST_DATABASE_URL is not configured")

    schema_name = f"permission_assessment_test_{uuid4().hex}"
    admin_engine = create_engine(database_url)
    isolated_engine = None
    schema_created = False
    try:
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema_name}"'))
        schema_created = True
        isolated_engine = create_engine(database_url)

        def set_search_path(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute(f'SET search_path TO "{schema_name}"')
            cursor.close()

        event.listen(isolated_engine, "connect", set_search_path)
        with isolated_engine.begin() as connection:
            models.PermissionBaseline.__table__.create(connection)
            models.PermissionAssessmentObservation.__table__.create(connection)
        Session = sessionmaker(bind=isolated_engine, expire_on_commit=False)

        @contextmanager
        def real_db(db_type="writer"):
            session = Session()
            try:
                yield DBSession(session)
                session.commit()
            finally:
                session.close()

        monkeypatch.setattr(permission_assessment, "get_db", real_db)
        snapshot = {
            "canonicalization_version": CANONICALIZATION_VERSION,
            "architectures": {"x86_64": {}},
        }
        with Session() as session:
            for channel, version in (("stable", CANONICALIZATION_VERSION), ("beta", 2)):
                session.add(
                    models.PermissionBaseline(
                        app_id="org.example.App",
                        channel=channel,
                        flatpak_branch=channel,
                        source="initialized",
                        repository_url="https://dl.flathub.org/repo",
                        captured_at=datetime(2026, 10, 2, tzinfo=UTC).replace(
                            tzinfo=None
                        ),
                        canonicalization_version=version,
                        artifacts=[{"ref_name": "r", "arch": "x86_64", "commit": "c"}],
                        snapshot=snapshot,
                        fingerprint="f" * 64,
                    )
                )
            session.commit()

        def request(**changes):
            return permission_assessment.CandidateAssessmentRequest(
                **{
                    "pipeline_id": "pipeline",
                    "build_id": 1,
                    "forge_instance": "github.com",
                    "source_repository": "flathub/org.example.App",
                    "pull_request_head_revision": "1" * 40,
                    "built_revision": "1" * 40,
                    "target_git_branch": "master",
                    "candidate_kind": "head",
                    "app_id": "org.example.App",
                    "destination_repo": "test",
                    "destination_channel": "stable",
                    "flatpak_branch": "stable",
                    "expected_arches": ["x86_64"],
                    "matrix_succeeded": True,
                    **changes,
                }
            )

        stored = permission_assessment._stored_baseline(request())
        assert stored is not None
        assert stored["snapshot"] == snapshot
        assert stored["fingerprint"] == "f" * 64
        assert (
            permission_assessment._stored_baseline(
                request(destination_channel="beta", flatpak_branch="beta")
            )
            is None
        )
        assert (
            permission_assessment._stored_baseline(request(flatpak_branch="24.08"))
            is None
        )

        def observation(identity, **changes):
            return {
                "assessment_identity": identity,
                "outcome": "accepted",
                "acceptance_basis": "baseline",
                "baseline_id": stored["id"],
                "app_id": "org.example.App",
                "pipeline_id": identity,
                "forge_instance": "github.com",
                "source_repository": "flathub/org.example.App",
                "pull_request_head_revision": "1" * 40,
                "built_revision": "1" * 40,
                "target_git_branch": "master",
                "base_revision": "",
                "candidate_kind": "head",
                "intended_repo": "test",
                "intended_channel": "stable",
                "flatpak_branch": "stable",
                "build_id": 1,
                "expected_arches": ["x86_64"],
                "canonicalization_version": CANONICALIZATION_VERSION,
                "candidate_artifacts": [],
                "published_artifacts": [],
                "uploaded_refs": [],
                "candidate_snapshot": snapshot,
                "published_snapshot": snapshot,
                "differences": [],
                "fingerprint": "f" * 64,
                "published_fingerprint": "f" * 64,
                "error_code": None,
                "error_message": None,
                **changes,
            }

        accepted = permission_assessment._persist_observation(observation("ok"))
        assert accepted.outcome == "accepted"
        assert accepted.acceptance_basis == "baseline"
        assert accepted.baseline_id == stored["id"]

        for identity, changes in (
            ("changed", {"differences": [{"path": ["x86_64"]}]}),
            ("no-basis", {"acceptance_basis": None}),
            ("no-baseline", {"baseline_id": None}),
            ("pending-basis", {"outcome": "pending"}),
            (
                "no-comparison",
                {
                    "differences": None,
                    "published_snapshot": None,
                    "published_fingerprint": None,
                },
            ),
        ):
            with pytest.raises(IntegrityError):
                permission_assessment._persist_observation(
                    observation(identity, **changes)
                )
    finally:
        if isolated_engine is not None:
            isolated_engine.dispose()
        if schema_created:
            with admin_engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema_name}" CASCADE'))
        admin_engine.dispose()
