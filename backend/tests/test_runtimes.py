import os
import sys
from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

# app.search imports meilisearch at module load and connects at import time.
# Stub it before importing any app module that transitively pulls it in.
sys.modules["app.search"] = SimpleNamespace()

from app import (
    models,  # noqa: E402
    verification,  # noqa: E402
)
from app.routes import runtimes  # noqa: E402

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


class FakeSession:
    """Minimal SQLAlchemy session stand-in."""

    def __init__(self):
        self._objects = []

    def add(self, obj):
        self._objects.append(obj)

    def flush(self):
        pass

    def commit(self):
        pass

    def merge(self, obj):
        return obj


class FakeDb:
    def __init__(self):
        self.session = FakeSession()


@contextmanager
def fake_get_db(db_type="replica"):
    yield FakeDb()


# ---------------------------------------------------------------------------
# B1: verification.archive must reject runtimes
# ---------------------------------------------------------------------------


def _make_archive_request(endoflife="no longer maintained", endoflife_rebase=None):
    return verification.ArchiveRequest(
        endoflife=endoflife, endoflife_rebase=endoflife_rebase
    )


class FakeLogin:
    pass


def test_archive_rejects_canonical_runtime_app_id(monkeypatch):
    """is_appid_runtime() truthy → 403 RUNTIME_CANNOT_BE_ARCHIVED."""
    enqueued = []
    monkeypatch.setattr(
        verification.worker.republish_app, "send", lambda *a, **k: enqueued.append(a)
    )

    with pytest.raises(HTTPException) as exc_info:
        verification.archive(
            request=_make_archive_request(),
            login=FakeLogin(),
            app_id="org.gnome.Platform",
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == verification.ErrorDetail.RUNTIME_CANNOT_BE_ARCHIVED
    assert enqueued == [], "republish_app must NOT be enqueued for a runtime"


def test_archive_rejects_provisioned_runtime(monkeypatch):
    """RuntimeScope.by_app_id returns non-None → 403 RUNTIME_CANNOT_BE_ARCHIVED."""
    enqueued = []
    monkeypatch.setattr(
        verification.worker.republish_app, "send", lambda *a, **k: enqueued.append(a)
    )
    monkeypatch.setattr(
        verification.models.RuntimeScope,
        "by_app_id",
        lambda db, app_id: SimpleNamespace(),  # non-None → provisioned runtime
    )
    monkeypatch.setattr(verification, "get_db", fake_get_db)

    with pytest.raises(HTTPException) as exc_info:
        verification.archive(
            request=_make_archive_request(),
            login=FakeLogin(),
            app_id="io.example.MyRuntime",
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == verification.ErrorDetail.RUNTIME_CANNOT_BE_ARCHIVED
    assert enqueued == [], (
        "republish_app must NOT be enqueued for a provisioned runtime"
    )


def test_archive_rejects_eol_rebase_for_runtime(monkeypatch):
    """EOL-rebase path also blocked: archive is the only entry point."""
    enqueued = []
    monkeypatch.setattr(
        verification.worker.republish_app, "send", lambda *a, **k: enqueued.append(a)
    )

    with pytest.raises(HTTPException) as exc_info:
        verification.archive(
            request=_make_archive_request(
                endoflife="no longer supported",
                endoflife_rebase="org.kde.Platform",
            ),
            login=FakeLogin(),
            app_id="org.kde.Platform",
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == verification.ErrorDetail.RUNTIME_CANNOT_BE_ARCHIVED
    assert enqueued == []


# ---------------------------------------------------------------------------
# A3: create_runtime raises 500 when uploader role is missing
# ---------------------------------------------------------------------------


def test_create_runtime_raises_if_uploader_role_missing(monkeypatch):
    """If Role.by_name returns None the endpoint must raise 500."""
    fake_maintainer = SimpleNamespace(
        id=42, display_name="Maintainer", permissions=lambda: set()
    )

    def fake_get_db_writer(db_type="replica"):
        @contextmanager
        def _ctx():
            db = FakeDb()
            # Stub all model lookups
            monkeypatch.setattr(
                models.FlathubUser, "by_id", lambda db, uid: fake_maintainer
            )
            monkeypatch.setattr(
                models.RuntimeScope,
                "by_app_id",
                lambda db, app_id: None,
            )
            monkeypatch.setattr(
                models.DirectUploadApp,
                "by_app_id",
                lambda db, app_id: None,
            )
            monkeypatch.setattr(
                models.DirectUploadAppDeveloper,
                "by_developer_and_app",
                lambda db, dev, app: None,
            )
            monkeypatch.setattr(
                models.DirectUploadAppDeveloper,
                "primary_for_app",
                lambda db, app: None,
            )
            monkeypatch.setattr(
                models.Role,
                "by_name",
                lambda db, name: None,  # role missing
            )
            yield db

        return _ctx()

    monkeypatch.setattr(runtimes, "get_db", fake_get_db_writer)

    request = runtimes.CreateRuntimeRequest(
        app_id="org.gnome.Platform",
        prefixes=["org.gnome.Platform", "org.gnome.Sdk"],
        primary_maintainer_user_id=42,
    )

    with pytest.raises(HTTPException) as exc_info:
        runtimes.create_runtime(request, _admin=None)

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "uploader_role_missing"


# ---------------------------------------------------------------------------
# B2: revoke_runtime_tokens does NOT set archived
# ---------------------------------------------------------------------------


def test_revoke_runtime_tokens_revokes_without_archiving(monkeypatch):
    """revoke_runtime_tokens revokes each active token and never sets archived."""
    monkeypatch.setattr(
        runtimes.config.settings, "flat_manager_api", "https://flat-manager.example"
    )

    revoked_jtis = []
    token_a = SimpleNamespace(revoked=False, id=1, issued_at=None)
    token_b = SimpleNamespace(revoked=True, id=2, issued_at=None)  # already revoked
    token_c = SimpleNamespace(revoked=False, id=3, issued_at=None)

    monkeypatch.setattr(
        runtimes.models.RuntimeScope,
        "by_app_id",
        lambda db, app_id: SimpleNamespace(app_id=app_id),
    )
    monkeypatch.setattr(
        runtimes.models.UploadToken,
        "by_app_id",
        lambda db, app_id: [token_a, token_b, token_c],
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    def fake_create_flat_manager_token(comment, scopes, sub):
        return "fake-jwt"

    monkeypatch.setattr(
        runtimes.utils, "create_flat_manager_token", fake_create_flat_manager_token
    )

    def fake_post(url, headers, json):
        revoked_jtis.extend(json["token_ids"])
        return SimpleNamespace(is_success=True)

    monkeypatch.setattr(runtimes.http_client, "post", fake_post)

    direct_upload_app_accessed = []

    def sentinel_direct_upload_app(db, app_id):
        direct_upload_app_accessed.append(app_id)
        return None

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", sentinel_direct_upload_app
    )

    runtimes.revoke_runtime_tokens("org.gnome.Platform", _admin=None)

    # token_b was already revoked — only token_a and token_c should have been sent
    assert set(revoked_jtis) == {
        runtimes.jti(token_a),
        runtimes.jti(token_c),
    }
    assert token_a.revoked is True
    assert token_b.revoked is True  # unchanged
    assert token_c.revoked is True

    # Confirm the route never touched DirectUploadApp (which would imply archival).
    # The sentinel was not called, so archived was never set.
    assert direct_upload_app_accessed == [], (
        "revoke_runtime_tokens must not access DirectUploadApp"
    )


# ---------------------------------------------------------------------------
# Issue 1: primary_maintainer_user_id always becomes primary
# ---------------------------------------------------------------------------


def _make_create_request(primary_maintainer_user_id=42):
    return runtimes.CreateRuntimeRequest(
        app_id="org.gnome.Platform",
        prefixes=["org.gnome.Platform", "org.gnome.Sdk"],
        primary_maintainer_user_id=primary_maintainer_user_id,
    )


def _setup_create_runtime_db(
    monkeypatch, existing_dev=None, current_primary=None, role=object()
):
    """Patch all model lookups used by create_runtime."""
    fake_maintainer = SimpleNamespace(id=42, display_name="Maintainer")
    fake_app = SimpleNamespace(id=1, app_id="org.gnome.Platform", archived=False)
    fake_role = role if role is not object() else SimpleNamespace(id=10)

    added = []

    class _FakeSession:
        def add(self, obj):
            added.append(obj)

        def flush(self):
            pass

        def commit(self):
            pass

        def merge(self, obj):
            return obj

    class _FakeDb:
        session = _FakeSession()

    @contextmanager
    def _ctx(db_type="replica"):
        monkeypatch.setattr(
            models.FlathubUser, "by_id", lambda db, uid: fake_maintainer
        )
        monkeypatch.setattr(models.RuntimeScope, "by_app_id", lambda db, app_id: None)
        monkeypatch.setattr(
            models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
        )
        monkeypatch.setattr(
            models.DirectUploadAppDeveloper,
            "by_developer_and_app",
            lambda db, dev, app: existing_dev,
        )
        monkeypatch.setattr(
            models.DirectUploadAppDeveloper,
            "primary_for_app",
            lambda db, app: current_primary,
        )
        monkeypatch.setattr(models.Role, "by_name", lambda db, name: fake_role)
        monkeypatch.setattr(
            models.flathubuser_role,
            "add_user_role",
            lambda db, user, role: None,
        )
        monkeypatch.setattr(
            models.DirectUploadAppDeveloper,
            "by_app",
            lambda db, app: [],
        )
        monkeypatch.setattr(
            runtimes,
            "_runtime_response",
            lambda db, scope, app: SimpleNamespace(),
        )
        yield _FakeDb()

    monkeypatch.setattr(runtimes, "get_db", _ctx)
    return added


def test_create_runtime_new_dev_becomes_primary(monkeypatch):
    added = _setup_create_runtime_db(
        monkeypatch, existing_dev=None, current_primary=None
    )
    runtimes.create_runtime(_make_create_request(), _admin=None)
    dev_rows = [o for o in added if isinstance(o, models.DirectUploadAppDeveloper)]
    assert len(dev_rows) == 1
    assert dev_rows[0].is_primary is True


def test_create_runtime_already_primary_is_noop(monkeypatch):
    existing = SimpleNamespace(is_primary=True, id=42)
    added = _setup_create_runtime_db(
        monkeypatch, existing_dev=existing, current_primary=existing
    )
    # No exception should be raised
    runtimes.create_runtime(_make_create_request(), _admin=None)
    dev_rows = [o for o in added if isinstance(o, models.DirectUploadAppDeveloper)]
    assert dev_rows == []  # nothing new was added


def test_create_runtime_promotes_existing_non_primary(monkeypatch):
    existing = SimpleNamespace(is_primary=False, id=42)
    added = _setup_create_runtime_db(
        monkeypatch, existing_dev=existing, current_primary=None
    )
    runtimes.create_runtime(_make_create_request(), _admin=None)
    # existing_dev.is_primary must have been set to True and re-added
    assert existing.is_primary is True
    assert existing in added


def test_create_runtime_rejects_conflicting_primary(monkeypatch):
    existing = SimpleNamespace(is_primary=False, id=42)
    other_primary = SimpleNamespace(is_primary=True, id=99)
    _setup_create_runtime_db(
        monkeypatch, existing_dev=existing, current_primary=other_primary
    )
    with pytest.raises(HTTPException) as exc_info:
        runtimes.create_runtime(_make_create_request(), _admin=None)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "primary_already_assigned"


def test_create_runtime_rejects_new_dev_when_primary_already_assigned(monkeypatch):
    other_primary = SimpleNamespace(is_primary=True, id=99)
    _setup_create_runtime_db(
        monkeypatch, existing_dev=None, current_primary=other_primary
    )
    with pytest.raises(HTTPException) as exc_info:
        runtimes.create_runtime(_make_create_request(), _admin=None)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "primary_already_assigned"


# ---------------------------------------------------------------------------
# Issue 2: prefix / extra_id entries must be non-empty and whitespace-free
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "prefixes,extra_ids,detail",
    [
        # empty string in prefixes
        (["org.gnome.Platform", ""], [], "invalid_prefixes_entry"),
        # whitespace-only entry in prefixes
        (["org.gnome.Platform", "  "], [], "invalid_prefixes_entry"),
        # entry with embedded space in prefixes
        (["org.foo.Platform org.bar.Platform"], [], "invalid_prefixes_entry"),
        # empty string in extra_ids
        (["org.gnome.Platform"], [""], "invalid_extra_ids_entry"),
        # entry with tab in extra_ids
        (["org.gnome.Platform"], ["org.foo.Sdk\t1"], "invalid_extra_ids_entry"),
    ],
)
def test_create_runtime_rejects_malformed_id_lists(
    monkeypatch, prefixes, extra_ids, detail
):
    with pytest.raises(HTTPException) as exc_info:
        runtimes.create_runtime(
            runtimes.CreateRuntimeRequest(
                app_id="org.gnome.Platform",
                prefixes=prefixes,
                extra_ids=extra_ids,
                primary_maintainer_user_id=42,
            ),
            _admin=None,
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == detail


@pytest.mark.parametrize(
    "prefixes,extra_ids,detail",
    [
        (["org.gnome.Platform", ""], None, "invalid_prefixes_entry"),
        (["org.gnome.Platform org.kde.Platform"], None, "invalid_prefixes_entry"),
        (None, [""], "invalid_extra_ids_entry"),
        (None, ["org.foo.Sdk org.bar.Sdk"], "invalid_extra_ids_entry"),
    ],
)
def test_update_runtime_rejects_malformed_id_lists(
    monkeypatch, prefixes, extra_ids, detail
):
    # validation runs before the DB lookup, so no DB mocking needed
    with pytest.raises(HTTPException) as exc_info:
        runtimes.update_runtime(
            app_id="org.gnome.Platform",
            request=runtimes.UpdateRuntimeRequest(
                prefixes=prefixes,
                extra_ids=extra_ids,
            ),
            _admin=None,
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == detail
