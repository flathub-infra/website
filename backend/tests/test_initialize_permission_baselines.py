import json
import os
from contextlib import contextmanager
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.orm import sessionmaker

from app import models
from app.db_session import DBSession
from app.moderation.ostree_permissions import collect_published_permissions
from tests.shared_fixtures import APP, ARM, REF, SourceRepo
from utils import initialize_permission_baselines as baselines

OTHER = "org.example.Other"
BROKEN = "org.example.Broken"


@pytest.fixture
def source(tmp_path):
    repo = SourceRepo(tmp_path / "source")
    repo.commit(REF, "[Context]\nshared=network;\n")
    repo.commit(ARM, "[Context]\nshared=network;\n")
    repo.commit(f"app/{OTHER}/x86_64/stable", "[Context]\ndevices=dri;\n", name=OTHER)
    repo.commit(f"app/{BROKEN}/x86_64/stable", None, name=BROKEN)
    return repo


def collection(source):
    return collect_published_permissions(source.url, timeout_seconds=10)


def test_plan_classifies_new_and_existing_baselines(source):
    result = collection(source)
    fingerprints = {
        item.app_id: baselines.baseline_values(item)["fingerprint"]
        for item in result.collected
    }
    plan = baselines.plan_baselines(
        result,
        {(APP, "stable"): fingerprints[APP], (OTHER, "stable"): "0" * 64},
    )
    assert plan["counts"] == {
        "collected": 2,
        "new": 0,
        "existing_same": 1,
        "existing_different": 1,
        "failures": 1,
    }
    assert plan["failure_codes"] == {"missing_metadata": 1}
    assert {entry["app_id"]: entry["status"] for entry in plan["entries"]} == {
        APP: "existing_same",
        OTHER: "existing_different",
    }

    values = next(entry for entry in plan["entries"] if entry["app_id"] == APP)[
        "values"
    ]
    assert values["channel"] == "stable"
    assert values["source"] == "initialized"
    assert values["captured_at"].tzinfo is None
    assert [item["arch"] for item in values["artifacts"]] == ["aarch64", "x86_64"]
    assert values["snapshot"]["architectures"]["x86_64"] == {
        "Context": {"shared": ["network"]}
    }


def run_main(monkeypatch, capsys, source, *args, existing=None, written=None):
    monkeypatch.setattr(baselines, "existing_baselines", lambda: existing or {})

    def write(values):
        if written is None:
            pytest.fail("Preview must not write baselines")
        written.extend(values)
        return len(written)

    monkeypatch.setattr(baselines, "write_baselines", write)
    baselines.main(["--repo", source.url, "--timeout-seconds", "10", *args])
    return json.loads(capsys.readouterr().out)


def test_preview_reports_without_writing(source, monkeypatch, capsys, tmp_path):
    report_path = tmp_path / "report.json"
    summary = run_main(monkeypatch, capsys, source, "--report", str(report_path))
    assert summary["mode"] == "preview"
    assert summary["counts"]["new"] == 2
    assert "inserted" not in summary

    report = json.loads(report_path.read_text())
    assert report["counts"] == summary["counts"]
    assert [entry["app_id"] for entry in report["entries"]] == [APP, OTHER]
    assert all("values" not in entry for entry in report["entries"])
    assert [failure["app_id"] for failure in report["failures"]] == [BROKEN]


def test_write_inserts_only_new_baselines(source, monkeypatch, capsys):
    written = []
    summary = run_main(
        monkeypatch,
        capsys,
        source,
        "--write",
        existing={(APP, "stable"): "0" * 64},
        written=written,
    )
    assert summary["mode"] == "write"
    assert summary["inserted"] == 1
    assert [(item["app_id"], item["flatpak_branch"]) for item in written] == [
        (OTHER, "stable")
    ]


def test_app_id_filter(source, monkeypatch, capsys):
    summary = run_main(monkeypatch, capsys, source, "--app-id", OTHER)
    assert summary["counts"]["collected"] == 1
    assert summary["counts"]["failures"] == 0


def test_listing_failure_exits_without_planning(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr(
        baselines,
        "existing_baselines",
        lambda: pytest.fail("Failed collection must not read baselines"),
    )
    with pytest.raises(SystemExit) as exit_info:
        baselines.main(
            ["--repo", (tmp_path / "missing").as_uri(), "--timeout-seconds", "1"]
        )
    assert exit_info.value.code == 1
    assert json.loads(capsys.readouterr().out)["error"]["code"] == "transport_error"


def test_write_and_read_baselines_in_postgres(source, monkeypatch):
    database_url = os.getenv("PERMISSION_ASSESSMENT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("PERMISSION_ASSESSMENT_TEST_DATABASE_URL is not configured")

    schema_name = f"permission_baseline_test_{uuid4().hex}"
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
        Session = sessionmaker(bind=isolated_engine, expire_on_commit=False)

        @contextmanager
        def real_db(db_type="writer"):
            session = Session()
            try:
                yield DBSession(session)
                session.commit()
            finally:
                session.close()

        monkeypatch.setattr(baselines, "get_db", real_db)
        plan = baselines.plan_baselines(collection(source), {})
        values = [entry["values"] for entry in plan["entries"]]

        assert baselines.write_baselines(values, batch_size=1) == 2
        assert baselines.write_baselines(values) == 0
        assert baselines.existing_baselines() == {
            (entry["app_id"], entry["flatpak_branch"]): entry["fingerprint"]
            for entry in plan["entries"]
        }
        with Session() as session:
            row = session.scalars(
                select(models.PermissionBaseline).where(
                    models.PermissionBaseline.app_id == APP
                )
            ).one()
        assert row.source == "initialized"
        assert row.snapshot == values[0]["snapshot"]
        assert row.artifacts == values[0]["artifacts"]
    finally:
        if isolated_engine is not None:
            isolated_engine.dispose()
        if schema_created:
            with admin_engine.begin() as connection:
                connection.execute(text(f'DROP SCHEMA "{schema_name}" CASCADE'))
        admin_engine.dispose()
