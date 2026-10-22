import json
import os
import sys
import threading
import time
from contextlib import contextmanager
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from github import GithubException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

sys.modules["app.search"] = SimpleNamespace()

from app import cache, config, login_info, models
from app.db_session import DBSession
from app.login_info import LoginInformation, LoginState, login_state
from app.moderation import review as moderation

APP_ID = "org.example.App"
MANIFEST_DATA = {
    "findings": [
        {
            "origins_added": ["https://source.example"],
            "origins_removed": [],
            "locations_by_origin": {},
            "arches": ["x86_64"],
        }
    ]
}
APPDATA_DATA = {"keys": {}, "current_values": {}}
TABLES = (
    "flathubuser",
    "permission",
    "role",
    "role_permission",
    "flathubuser_role",
    "directuploadapp",
    "moderationrequest",
    "moderationoriginallowlist",
    "auditlog",
)


class FakeGithub:
    def __init__(self):
        self.issues = []
        self.failures = []
        self.before_create = None

    def __call__(self, token):
        return self

    def get_repo(self, name):
        return self

    def get_pulls(self, **kwargs):
        return []

    def create_issue(self, title, body):
        if self.before_create is not None:
            self.before_create()
        if self.failures:
            raise self.failures.pop(0)
        self.issues.append((title, body))
        return SimpleNamespace(
            html_url=f"https://github.com/flathub/{APP_ID}/issues/{len(self.issues)}",
            add_to_assignees=lambda login: None,
        )


@pytest.fixture
def discussion_api(monkeypatch):
    url = os.getenv("OIDC_TEST_DATABASE_URL")
    if not url:
        pytest.skip("OIDC_TEST_DATABASE_URL is not configured")

    schema = f"moderation_discussion_{uuid4().hex}"
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f"CREATE SCHEMA {schema}"))
        for table in TABLES:
            connection.execute(
                text(
                    f"CREATE TABLE {schema}.{table} (LIKE public.{table} INCLUDING ALL)"
                )
            )
    engine = create_engine(
        url, connect_args={"options": f"-c search_path={schema},public"}
    )
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO flathubuser (id, display_name) "
                "VALUES (1, 'Moderator'), (2, 'Regular user')"
            )
        )
        connection.execute(text("INSERT INTO permission (name) VALUES ('moderation')"))
        connection.execute(text("INSERT INTO role (id, name) VALUES (1, 'moderator')"))
        connection.execute(
            text(
                "INSERT INTO role_permission (role_id, permission_name) "
                "VALUES (1, 'moderation')"
            )
        )
        connection.execute(
            text("INSERT INTO flathubuser_role (flathubuser_id, role_id) VALUES (1, 1)")
        )
        for id, appid, build_id, job_id, request_type, data, observation in (
            (1, APP_ID, 42, 7, "appdata", APPDATA_DATA, False),
            (2, APP_ID, 42, 7, "manifest", MANIFEST_DATA, False),
            (3, APP_ID, 42, 7, "manifest", MANIFEST_DATA, True),
            (4, APP_ID, 41, 6, "appdata", APPDATA_DATA, False),
            (5, "org.example.Direct", 50, 8, "appdata", APPDATA_DATA, False),
        ):
            connection.execute(
                text(
                    "INSERT INTO moderationrequest (id, appid, build_id, job_id, "
                    "request_type, request_data, is_observation) VALUES "
                    "(:id, :appid, :build_id, :job_id, :request_type, :data, "
                    ":observation)"
                ),
                {
                    "id": id,
                    "appid": appid,
                    "build_id": build_id,
                    "job_id": job_id,
                    "request_type": request_type,
                    "data": json.dumps(data),
                    "observation": observation,
                },
            )

    with Session(engine) as session:
        users = {user.id: user for user in session.query(models.FlathubUser).all()}
        session.expunge_all()
    current = {"user": None}

    def current_login_state():
        user = current["user"]
        return LoginInformation(
            LoginState.LOGGED_IN if user else LoginState.LOGGED_OUT, user, None
        )

    @contextmanager
    def real_db(db_type="writer"):
        with Session(engine, expire_on_commit=False) as session:
            yield DBSession(session)
            if db_type == "writer":
                session.commit()

    github = FakeGithub()
    calls = SimpleNamespace(emails=[], reviews=[], audits=[], email_failures=[])

    def send_email(payload):
        if calls.email_failures:
            raise calls.email_failures.pop(0)
        calls.emails.append(payload)

    monkeypatch.setattr(moderation, "get_db", real_db)
    monkeypatch.setattr(login_info, "get_db", real_db)
    monkeypatch.setattr(moderation, "Github", github)
    monkeypatch.setattr(config.settings, "github_bot_token", "token")
    monkeypatch.setattr(moderation, "get_json_key", lambda key: None)
    monkeypatch.setattr(moderation.worker.send_email_new, "send", send_email)
    monkeypatch.setattr(
        moderation.worker.review_check, "send", lambda *args: calls.reviews.append(args)
    )
    monkeypatch.setattr(
        moderation.audit_log,
        "enqueue_audit_log",
        lambda *args, **kwargs: calls.audits.append((args[2], kwargs["details"])),
    )

    app = FastAPI()
    app.dependency_overrides[login_state] = current_login_state
    moderation.register_to_app(app)
    app.add_middleware(cache.CacheControlMiddleware)

    def login_as(user_id):
        current["user"] = users.get(user_id)

    def rows():
        with Session(engine) as session:
            return {
                row.id: row
                for row in session.query(models.ModerationRequest)
                .order_by(models.ModerationRequest.id)
                .all()
            }

    with TestClient(app, raise_server_exceptions=False) as client:
        yield SimpleNamespace(
            client=client,
            engine=engine,
            github=github,
            calls=calls,
            login_as=login_as,
            rows=rows,
        )

    engine.dispose()
    with admin.begin() as connection:
        connection.execute(text(f"DROP SCHEMA {schema} CASCADE"))
    admin.dispose()


def _discuss(api, request_id, comment):
    return api.client.post(
        f"/moderation/requests/{request_id}/discussion", json={"comment": comment}
    )


def _wait_for_lock_waiter(engine):
    deadline = time.monotonic() + 10
    with engine.connect() as connection:
        while time.monotonic() < deadline:
            waiting = connection.execute(
                text("SELECT count(*) FROM pg_locks WHERE NOT granted")
            ).scalar_one()
            connection.rollback()
            if waiting:
                return
            time.sleep(0.01)
    raise AssertionError("no transaction waited for the moderation row lock")


def _run(target):
    result = {}
    thread = threading.Thread(target=lambda: result.setdefault("response", target()))
    thread.start()
    return thread, result


def test_rejected_discussions_change_nothing(discussion_api):
    api = discussion_api
    before = {id: (row.handled_at, row.is_approved) for id, row in api.rows().items()}

    assert _discuss(api, 1, "Why?").json()["detail"] == "not_logged_in"

    api.login_as(2)
    response = _discuss(api, 1, "Why?")
    assert (response.status_code, response.json()["detail"]) == (403, "not_moderator")

    api.login_as(1)
    for body in ({}, {"comment": None}, {"comment": ""}, {"comment": " \n\t"}):
        response = api.client.post("/moderation/requests/1/discussion", json=body)
        assert response.status_code == 422

    with api.engine.begin() as connection:
        connection.execute(
            text("INSERT INTO directuploadapp (app_id) VALUES ('org.example.Direct')")
        )
        connection.execute(
            text("UPDATE moderationrequest SET handled_at = now() WHERE id = 4")
        )
    before[4] = (api.rows()[4].handled_at, None)
    for request_id, status, detail in (
        (999, 404, "not_found"),
        (3, 404, "not_found"),
        (4, 400, "already_handled"),
        (5, 409, "discussion_not_supported"),
    ):
        response = _discuss(api, request_id, "Why?")
        assert (response.status_code, response.json()["detail"]) == (status, detail)

    config.settings.github_bot_token = None
    response = _discuss(api, 1, "Why?")
    assert (response.status_code, response.json()["detail"]) == (
        503,
        "discussion_unavailable",
    )

    rows = api.rows()
    assert {id: (row.handled_at, row.is_approved) for id, row in rows.items()} == before
    assert all(row.discussion_url is None for row in rows.values())
    assert api.github.issues == []
    assert api.calls.emails == []


def test_discussion_keeps_build_pending_until_approval(discussion_api):
    api = discussion_api
    api.login_as(1)

    response = _discuss(api, 1, "Please explain why this source changed.")
    assert response.status_code == 200
    url = response.json()["github_issue_url"]

    listing = api.client.get(f"/moderation/apps/{APP_ID}").json()["requests"]
    assert {item["id"]: item.get("discussion_url") for item in listing} == {
        1: url,
        2: url,
        4: None,
    }
    assert all(item["can_open_discussion"] for item in listing)
    rows = api.rows()
    assert [(rows[i].handled_at, rows[i].is_approved) for i in (1, 2)] == [
        (None, None),
        (None, None),
    ]
    assert rows[3].discussion_url is None
    assert rows[4].discussion_url is None
    with api.engine.connect() as connection:
        assert (
            connection.execute(
                text("SELECT count(*) FROM moderationoriginallowlist")
            ).scalar_one()
            == 0
        )
    assert api.calls.reviews == []
    (email,) = api.calls.emails
    assert email["inform_only_moderators"] is True
    assert email["messageId"] == f"{APP_ID}/42/discussion"
    assert email["messageInfo"]["discussionUrl"] == url
    assert email["messageInfo"]["comment"] == "Please explain why this source changed."
    with api.engine.connect() as connection:
        assert connection.execute(text("SELECT event_type FROM auditlog")).all() == [
            (models.AuditEventType.MODERATION_DISCUSSION_OPENED,)
        ]

    response = api.client.post("/moderation/requests/2/review", json={"approve": True})
    assert response.status_code == 200
    assert api.calls.reviews == [(7, "Passed", None, 42)]
    rows = api.rows()
    assert [(rows[i].is_approved, rows[i].discussion_url) for i in (1, 2)] == [
        (True, url),
        (True, url),
    ]
    response = _discuss(api, 1, "Again")
    assert (response.status_code, response.json()["detail"]) == (
        400,
        "already_handled",
    )
    assert len(api.github.issues) == 1


def test_discussion_excludes_permission_requests(discussion_api):
    api = discussion_api
    api.login_as(1)
    with api.engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO moderationrequest (id, appid, build_id, job_id, "
                "request_type, request_data, is_observation) VALUES "
                "(6, :appid, 42, 7, 'permissions', :data, false)"
            ),
            {
                "appid": APP_ID,
                "data": json.dumps({"channel": "stable", "differences": []}),
            },
        )

    response = _discuss(api, 6, "Why?")
    assert (response.status_code, response.json()["detail"]) == (
        409,
        "discussion_not_supported",
    )
    assert api.github.issues == []

    url = _discuss(api, 1, "Why?").json()["github_issue_url"]
    listing = api.client.get(f"/moderation/apps/{APP_ID}").json()["requests"]
    assert {
        item["id"]: (item.get("discussion_url"), item["can_open_discussion"])
        for item in listing
    } == {1: (url, True), 2: (url, True), 4: (None, True), 6: (None, False)}


def test_discussion_opener_is_visible_only_to_moderators(discussion_api, monkeypatch):
    api = discussion_api
    api.login_as(1)
    url = _discuss(api, 1, "Why?").json()["github_issue_url"]

    def listing():
        return {
            item["id"]: (
                item.get("discussion_url"),
                item.get("discussion_opened_by"),
                item.get("discussion_comment"),
            )
            for item in api.client.get(f"/moderation/apps/{APP_ID}").json()["requests"]
        }

    assert listing() == {
        1: (url, "Moderator", "Why?"),
        2: (url, "Moderator", "Why?"),
        4: (None, None, None),
    }

    monkeypatch.setattr(models.FlathubUser, "dev_flatpaks", lambda self, db: {APP_ID})
    api.login_as(2)
    assert listing() == {
        1: (url, None, None),
        2: (url, None, None),
        4: (None, None, None),
    }


def test_failed_discussion_steps_can_be_retried(discussion_api):
    api = discussion_api
    api.login_as(1)

    api.github.failures.append(GithubException(500, "boom", None))
    response = _discuss(api, 1, "Original")
    assert (response.status_code, response.json()["detail"]) == (
        502,
        "discussion_creation_failed",
    )
    assert all(row.discussion_url is None for row in api.rows().values())
    assert api.calls.emails == []

    api.calls.email_failures.append(RuntimeError("broker down"))
    response = _discuss(api, 1, "Original")
    assert (response.status_code, response.json()["detail"]) == (
        503,
        "discussion_notification_failed",
    )
    rows = api.rows()
    url = rows[1].discussion_url
    assert url is not None
    assert [(rows[i].discussion_url, rows[i].discussion_comment) for i in (1, 2)] == [
        (url, "Original"),
        (url, "Original"),
    ]
    assert rows[1].handled_at is None

    response = _discuss(api, 2, "Replacement")
    assert response.status_code == 200
    assert response.json()["github_issue_url"] == url
    assert len(api.github.issues) == 1
    (email,) = api.calls.emails
    assert email["messageInfo"]["comment"] == "Original"
    with api.engine.connect() as connection:
        assert (
            connection.execute(text("SELECT count(*) FROM auditlog")).scalar_one() == 1
        )


def test_concurrent_discussions_share_one_issue(discussion_api):
    api = discussion_api
    api.login_as(1)
    entered = threading.Event()
    release = threading.Event()

    def block_first_issue():
        if not entered.is_set():
            entered.set()
            assert release.wait(10)

    api.github.before_create = block_first_issue
    first, first_result = _run(lambda: _discuss(api, 1, "First"))
    assert entered.wait(10)
    second, second_result = _run(lambda: _discuss(api, 2, "Second"))
    _wait_for_lock_waiter(api.engine)
    release.set()
    first.join(10)
    second.join(10)

    responses = [first_result["response"], second_result["response"]]
    assert [response.status_code for response in responses] == [200, 200]
    assert len({response.json()["github_issue_url"] for response in responses}) == 1
    assert len(api.github.issues) == 1
    assert {row.discussion_comment for row in api.rows().values()} == {None, "First"}


def test_final_review_prevents_waiting_discussion(discussion_api, monkeypatch):
    api = discussion_api
    api.login_as(1)
    entered = threading.Event()
    release = threading.Event()
    approved_origins = moderation._approved_request_origins

    def block_review(*args):
        entered.set()
        assert release.wait(10)
        return approved_origins(*args)

    monkeypatch.setattr(moderation, "_approved_request_origins", block_review)
    review, review_result = _run(
        lambda: api.client.post("/moderation/requests/1/review", json={"approve": True})
    )
    assert entered.wait(10)
    discussion, discussion_result = _run(lambda: _discuss(api, 2, "Too late"))
    _wait_for_lock_waiter(api.engine)
    release.set()
    review.join(10)
    discussion.join(10)

    assert review_result["response"].status_code == 200
    response = discussion_result["response"]
    assert (response.status_code, response.json()["detail"]) == (
        400,
        "already_handled",
    )
    assert api.github.issues == []
    assert all(row.discussion_url is None for row in api.rows().values())


def test_rejection_after_discussion_opens_separate_issue(discussion_api):
    api = discussion_api
    api.login_as(1)
    url = _discuss(api, 1, "Please explain").json()["github_issue_url"]

    response = api.client.post(
        "/moderation/requests/2/review", json={"approve": False, "comment": "No"}
    )

    assert response.status_code == 200
    assert response.json()["github_issue_url"] != url
    assert [title for title, _body in api.github.issues] == [
        "Moderation discussion for build 42",
        "Change in build 42 rejected",
    ]
    assert api.calls.reviews == [
        (7, "Failed", "The review was rejected by a moderator.")
    ]
    rows = api.rows()
    assert [(rows[i].is_approved, rows[i].discussion_url) for i in (1, 2)] == [
        (False, url),
        (False, url),
    ]
    assert (rows[3].handled_at, rows[3].discussion_url) == (None, None)
    assert (rows[4].handled_at, rows[4].discussion_url) == (None, None)
