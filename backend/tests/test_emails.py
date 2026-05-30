import sys
from pathlib import Path
from types import SimpleNamespace

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT_DIR))

import app
from app import emails


class FakeUser:
    def __init__(self, user_id, email):
        self.id = user_id
        self.email = email

    def get_default_account(self, db):
        return SimpleNamespace(email=self.email)


class FakeQuery:
    def __init__(self, users):
        self.users = users

    def filter(self, *_args):
        return self

    def all(self):
        return self.users


class FakeSession:
    def __init__(self, github_users=()):
        self.github_users = github_users

    def query(self, *_args):
        return FakeQuery(self.github_users)


class FakeDb:
    def __init__(self, github_users=()):
        self.session = FakeSession(github_users)


def set_fake_worker(monkeypatch, sent):
    fake_worker = SimpleNamespace(
        send_one_email_new=SimpleNamespace(
            send=lambda message, dest: sent.append((dest, message))
        )
    )
    monkeypatch.setitem(sys.modules, "app.worker", fake_worker)
    monkeypatch.setattr(app, "worker", fake_worker, raising=False)


def upload_token_payload():
    return {
        "messageId": "org.example.App/1/issued",
        "creation_timestamp": 1,
        "subject": "New upload token issued",
        "previewText": "New upload token issued",
        "inform_admins": True,
        "messageInfo": {
            "category": emails.EmailCategory.UPLOAD_TOKEN_CREATED,
            "appId": "org.example.App",
            "appName": None,
            "issuedTo": "Test User",
            "comment": "test token",
            "expiresAt": "1 January 2027",
            "scopes": ["build"],
            "repos": ["beta"],
        },
    }


def test_send_email_new_informs_admins(monkeypatch):
    sent = []
    admin_user = FakeUser(1, "admin@example.com")
    set_fake_worker(monkeypatch, sent)
    monkeypatch.setattr(
        emails.models.DirectUploadApp, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        emails.models.Role, "by_name_users", lambda db, role: [admin_user]
    )

    payload = upload_token_payload()
    emails.send_email_new(payload, FakeDb())

    assert sent == [("admin@example.com", payload)]


def test_send_email_new_deduplicates_admin_developer(monkeypatch):
    sent = []
    admin_user = FakeUser(1, "admin@example.com")
    set_fake_worker(monkeypatch, sent)
    monkeypatch.setattr(
        emails.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: SimpleNamespace(id=1),
    )
    monkeypatch.setattr(
        emails.models.DirectUploadAppDeveloper,
        "by_app",
        lambda db, app: [(SimpleNamespace(), admin_user)],
    )
    monkeypatch.setattr(
        emails.models.Role, "by_name_users", lambda db, role: [admin_user]
    )

    payload = upload_token_payload()
    emails.send_email_new(payload, FakeDb())

    assert sent == [("admin@example.com", payload)]
