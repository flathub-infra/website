import os
import sys
from contextlib import contextmanager
from uuid import uuid4

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def isolated_email_db(monkeypatch):
    url = os.getenv("OIDC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("OIDC_TEST_DATABASE_URL is not configured")

    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session

    from app import config, login_info, logins
    from app.db_session import DBSession

    schema = f"email_login_{uuid4().hex}"
    admin = create_engine(url)
    tables = (
        "flathubuser",
        "emailaccount",
        "emailloginchallenge",
        "githubaccount",
        "gitlabaccount",
        "gnomeaccount",
        "googleaccount",
        "kdeaccount",
        "flathubuser_role",
        "directuploadappdeveloper",
        "appverification",
        "passkeycredential",
    )
    with admin.begin() as connection:
        connection.execute(text(f"CREATE SCHEMA {schema}"))
        for table in tables:
            connection.execute(
                text(
                    f"CREATE TABLE {schema}.{table} (LIKE public.{table} INCLUDING ALL)"
                )
            )
        for table in (
            "flathubuser",
            "emailaccount",
            "emailloginchallenge",
            "passkeycredential",
        ):
            connection.execute(text(f"CREATE SEQUENCE {schema}.{table}_id_seq"))
            connection.execute(
                text(
                    f"ALTER TABLE {schema}.{table} ALTER COLUMN id SET DEFAULT "
                    f"nextval('{schema}.{table}_id_seq')"
                )
            )
    engine = create_engine(
        url, connect_args={"options": f"-c search_path={schema},public"}
    )

    @contextmanager
    def writer(_db_type="writer"):
        with Session(engine, expire_on_commit=False) as session:
            yield DBSession(session)
            session.commit()

    monkeypatch.setattr(logins, "get_db", writer)
    monkeypatch.setattr(login_info, "get_db", writer)
    monkeypatch.setattr(config.settings, "email_login_enabled", True)
    yield writer, engine
    engine.dispose()
    with admin.begin() as connection:
        connection.execute(text(f"DROP SCHEMA {schema} CASCADE"))
    admin.dispose()
