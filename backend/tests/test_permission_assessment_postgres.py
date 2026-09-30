import os
import sys
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import asdict
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.orm import sessionmaker

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import models
from app.db_session import DBSession
from app.moderation import permission_assessment
from app.moderation.permission_snapshot import (
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
            canonicalization_version=2,
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
            "canonicalization_version": 2,
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
