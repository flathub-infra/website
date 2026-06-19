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


class FakeSession:
    """Minimal SQLAlchemy session stand-in."""

    def __init__(self):
        self._objects = []
        self._deleted = []

    def add(self, obj):
        self._objects.append(obj)

    def flush(self):
        pass

    def commit(self):
        pass

    def merge(self, obj):
        return obj

    def delete(self, obj):
        self._deleted.append(obj)

    def execute(self, stmt):
        pass


class FakeDb:
    def __init__(self):
        self.session = FakeSession()


@contextmanager
def fake_get_db(db_type="replica"):
    yield FakeDb()


@contextmanager
def fake_get_db_session(session: FakeSession):

    fake_db = SimpleNamespace()
    fake_db.session = session
    yield fake_db


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
                endoflife_rebase="org.gnome.Platform",
            ),
            login=FakeLogin(),
            app_id="org.gnome.Platform",
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == verification.ErrorDetail.RUNTIME_CANNOT_BE_ARCHIVED
    assert enqueued == []


def test_switch_to_direct_upload_raises_if_uploader_role_missing(monkeypatch):
    """If Role.by_name returns None the endpoint must raise 500."""
    fake_maintainer = SimpleNamespace(
        id=42, display_name="Maintainer", permissions=lambda: set()
    )

    def fake_get_db_writer(db_type="replica"):
        @contextmanager
        def _ctx():
            db = FakeDb()
            monkeypatch.setattr(
                models.FlathubUser, "by_id", lambda db, uid: fake_maintainer
            )
            monkeypatch.setattr(
                models.DirectUploadApp,
                "by_app_id",
                lambda db, app_id: None,
            )
            monkeypatch.setattr(
                models.RuntimeScope,
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

    request = runtimes.SwitchToDirectUploadRequest(
        app_id="org.gnome.Platform",
        primary_maintainer_user_id=42,
        scope=runtimes.RuntimeScopeInput(
            prefixes=["org.gnome.Platform", "org.gnome.Sdk"],
        ),
    )

    with pytest.raises(HTTPException) as exc_info:
        runtimes.switch_to_direct_upload(request, _admin=None)

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "uploader_role_missing"


def test_revoke_tokens_revokes_without_archiving(monkeypatch):
    """revoke_tokens revokes each active token and never sets archived."""
    monkeypatch.setattr(
        runtimes.config.settings, "flat_manager_api", "https://flat-manager.example"
    )

    revoked_jtis = []
    token_a = SimpleNamespace(revoked=False, id=1, issued_at=None)
    token_b = SimpleNamespace(revoked=True, id=2, issued_at=None)  # already revoked
    token_c = SimpleNamespace(revoked=False, id=3, issued_at=None)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
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

    runtimes.revoke_tokens("org.gnome.Platform", _admin=None)

    # token_b was already revoked — only token_a and token_c should have been sent
    assert set(revoked_jtis) == {
        runtimes.jti(token_a),
        runtimes.jti(token_c),
    }
    assert token_a.revoked is True
    assert token_b.revoked is True  # unchanged
    assert token_c.revoked is True


def test_archive_marks_runtime_archived_and_republishes(monkeypatch):
    monkeypatch.setattr(
        runtimes.config.settings, "flat_manager_api", "https://flat-manager.example"
    )
    fake_app = SimpleNamespace(app_id="org.gnome.Platform", archived=False)
    revoked = []
    sent = []

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: fake_app,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)
    monkeypatch.setattr(
        runtimes, "_revoke_all_tokens", lambda app_id: revoked.append(app_id)
    )
    monkeypatch.setattr(
        runtimes.worker.republish_app, "send", lambda *a, **k: sent.append(a)
    )

    runtimes.archive_direct_upload_app(
        "org.gnome.Platform",
        runtimes.ArchiveRequest(endoflife="no longer maintained"),
        _admin=None,
    )

    assert fake_app.archived is True
    assert revoked == ["org.gnome.Platform"]
    assert sent == [("org.gnome.Platform", "no longer maintained", None)]


def test_archive_already_archived_is_noop(monkeypatch):
    monkeypatch.setattr(
        runtimes.config.settings, "flat_manager_api", "https://flat-manager.example"
    )
    fake_app = SimpleNamespace(app_id="org.example.App", archived=True)
    revoked = []
    sent = []

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: fake_app,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)
    monkeypatch.setattr(
        runtimes, "_revoke_all_tokens", lambda app_id: revoked.append(app_id)
    )
    monkeypatch.setattr(
        runtimes.worker.republish_app, "send", lambda *a, **k: sent.append(a)
    )

    runtimes.archive_direct_upload_app(
        "org.example.App",
        runtimes.ArchiveRequest(endoflife="no longer maintained"),
        _admin=None,
    )

    assert revoked == []
    assert sent == []


def test_archive_404_if_app_missing(monkeypatch):
    monkeypatch.setattr(
        runtimes.config.settings, "flat_manager_api", "https://flat-manager.example"
    )
    revoked = []
    sent = []
    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: None,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)
    monkeypatch.setattr(
        runtimes, "_revoke_all_tokens", lambda app_id: revoked.append(app_id)
    )
    monkeypatch.setattr(
        runtimes.worker.republish_app, "send", lambda *a, **k: sent.append(a)
    )

    with pytest.raises(HTTPException) as exc_info:
        runtimes.archive_direct_upload_app(
            "org.example.App",
            runtimes.ArchiveRequest(endoflife="no longer maintained"),
            _admin=None,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "app_not_found"
    assert revoked == []
    assert sent == []


def test_archive_500_if_flat_manager_unset(monkeypatch):
    monkeypatch.setattr(runtimes.config.settings, "flat_manager_api", None)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.archive_direct_upload_app(
            "org.example.App",
            runtimes.ArchiveRequest(endoflife="no longer maintained"),
            _admin=None,
        )

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "flat_manager_not_configured"


def test_unarchive_marks_unarchived_and_republishes(monkeypatch):
    fake_app = SimpleNamespace(app_id="org.example.App", archived=True)
    sent = []

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: fake_app,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)
    monkeypatch.setattr(
        runtimes.worker.republish_app, "send", lambda *a, **k: sent.append(a)
    )

    runtimes.unarchive_direct_upload_app("org.example.App", _admin=None)

    assert fake_app.archived is False
    assert sent == [("org.example.App",)]


def test_unarchive_not_archived_is_noop(monkeypatch):
    fake_app = SimpleNamespace(app_id="org.example.App", archived=False)
    sent = []

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: fake_app,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)
    monkeypatch.setattr(
        runtimes.worker.republish_app, "send", lambda *a, **k: sent.append(a)
    )

    runtimes.unarchive_direct_upload_app("org.example.App", _admin=None)

    assert sent == []


def test_unarchive_404_if_app_missing(monkeypatch):
    sent = []
    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: None,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)
    monkeypatch.setattr(
        runtimes.worker.republish_app, "send", lambda *a, **k: sent.append(a)
    )

    with pytest.raises(HTTPException) as exc_info:
        runtimes.unarchive_direct_upload_app("org.example.App", _admin=None)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "app_not_found"
    assert sent == []


def _make_switch_request(
    primary_maintainer_user_id=42,
    scope=runtimes.RuntimeScopeInput(
        prefixes=["org.gnome.Platform", "org.gnome.Sdk"],
    ),
):
    return runtimes.SwitchToDirectUploadRequest(
        app_id="org.gnome.Platform",
        primary_maintainer_user_id=primary_maintainer_user_id,
        scope=scope,
    )


def _setup_switch_db(
    monkeypatch,
    existing_dev=None,
    current_primary=None,
    role=None,
    existing_app="archived",  # "archived" | "none" (no app exists)
):
    """Patch all model lookups used by switch_to_direct_upload.

    existing_app="archived": by_app_id returns an archived app (default, exercises un-archive path).
    existing_app="none":    by_app_id returns None (exercises creation path).
    """
    fake_maintainer = SimpleNamespace(id=42, display_name="Maintainer")
    fake_app = SimpleNamespace(id=1, app_id="org.gnome.Platform", archived=False)
    fake_role = role if role is not None else SimpleNamespace(id=10)

    if existing_app == "none":
        _app_stub = None
    else:
        _app_stub = SimpleNamespace(
            id=fake_app.id, app_id=fake_app.app_id, archived=True
        )

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

        def execute(self, stmt):
            pass

    class _FakeDb:
        session = _FakeSession()

    @contextmanager
    def _ctx(db_type="replica"):
        monkeypatch.setattr(
            models.FlathubUser, "by_id", lambda db, uid: fake_maintainer
        )
        monkeypatch.setattr(
            models.DirectUploadApp,
            "by_app_id",
            lambda db, app_id: _app_stub,
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
            "by_user_role",
            lambda db, user, role: None,
        )
        monkeypatch.setattr(
            models.DirectUploadAppDeveloper,
            "by_app",
            lambda db, app: [],
        )
        monkeypatch.setattr(
            models.RuntimeScope,
            "by_app_id",
            lambda db, app_id: None,
        )
        monkeypatch.setattr(
            runtimes,
            "_managed_app_response",
            lambda db, app, scope: SimpleNamespace(),
        )
        yield _FakeDb()

    monkeypatch.setattr(runtimes, "get_db", _ctx)
    return added


def test_switch_to_direct_upload_new_dev_becomes_primary(monkeypatch):
    added = _setup_switch_db(monkeypatch, existing_dev=None, current_primary=None)
    runtimes.switch_to_direct_upload(_make_switch_request(), _admin=None)
    dev_rows = [o for o in added if isinstance(o, models.DirectUploadAppDeveloper)]
    assert len(dev_rows) == 1
    assert dev_rows[0].is_primary is True


def test_switch_to_direct_upload_already_primary_is_noop(monkeypatch):
    existing = SimpleNamespace(is_primary=True, id=42)
    added = _setup_switch_db(
        monkeypatch, existing_dev=existing, current_primary=existing
    )
    # No exception should be raised
    runtimes.switch_to_direct_upload(_make_switch_request(), _admin=None)
    dev_rows = [o for o in added if isinstance(o, models.DirectUploadAppDeveloper)]
    assert dev_rows == []  # nothing new was added


def test_switch_to_direct_upload_promotes_existing_non_primary(monkeypatch):
    existing = SimpleNamespace(is_primary=False, id=42)
    added = _setup_switch_db(monkeypatch, existing_dev=existing, current_primary=None)
    runtimes.switch_to_direct_upload(_make_switch_request(), _admin=None)
    # existing_dev.is_primary must have been set to True and re-added
    assert existing.is_primary is True
    assert existing in added


def test_switch_to_direct_upload_rejects_conflicting_primary(monkeypatch):
    existing = SimpleNamespace(is_primary=False, id=42)
    other_primary = SimpleNamespace(is_primary=True, id=99)
    _setup_switch_db(monkeypatch, existing_dev=existing, current_primary=other_primary)
    with pytest.raises(HTTPException) as exc_info:
        runtimes.switch_to_direct_upload(_make_switch_request(), _admin=None)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "primary_already_assigned"


def test_switch_to_direct_upload_rejects_new_dev_when_primary_already_assigned(
    monkeypatch,
):
    other_primary = SimpleNamespace(is_primary=True, id=99)
    _setup_switch_db(monkeypatch, existing_dev=None, current_primary=other_primary)
    with pytest.raises(HTTPException) as exc_info:
        runtimes.switch_to_direct_upload(_make_switch_request(), _admin=None)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "primary_already_assigned"


def test_switch_to_direct_upload_without_scope_creates_no_scope(monkeypatch):
    """switch_to_direct_upload without a scope creates DirectUploadApp but no RuntimeScope."""
    added = _setup_switch_db(monkeypatch, existing_dev=None, current_primary=None)
    runtimes.switch_to_direct_upload(_make_switch_request(scope=None), _admin=None)
    scope_rows = [o for o in added if isinstance(o, models.RuntimeScope)]
    assert scope_rows == []


def test_switch_to_direct_upload_with_scope_creates_scope(monkeypatch):
    """switch_to_direct_upload with a scope creates a RuntimeScope."""
    added = _setup_switch_db(monkeypatch, existing_dev=None, current_primary=None)
    runtimes.switch_to_direct_upload(
        _make_switch_request(
            scope=runtimes.RuntimeScopeInput(
                prefixes=["org.gnome.Platform", "org.gnome.Sdk"],
                extra_ids=[],
                repos=["stable", "beta"],
            )
        ),
        _admin=None,
    )
    scope_rows = [o for o in added if isinstance(o, models.RuntimeScope)]
    assert len(scope_rows) == 1
    assert scope_rows[0].prefixes == "org.gnome.Platform org.gnome.Sdk"


def test_switch_to_direct_upload_rejects_existing_active_app(monkeypatch):
    """If a non-archived DirectUploadApp already exists, raise 400 app_already_exists."""
    fake_maintainer = SimpleNamespace(id=42, display_name="Maintainer")
    fake_active_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)

    @contextmanager
    def _ctx(db_type="replica"):
        monkeypatch.setattr(
            models.FlathubUser, "by_id", lambda db, uid: fake_maintainer
        )
        monkeypatch.setattr(
            models.DirectUploadApp,
            "by_app_id",
            lambda db, app_id: fake_active_app,
        )
        yield FakeDb()

    monkeypatch.setattr(runtimes, "get_db", _ctx)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.switch_to_direct_upload(
            runtimes.SwitchToDirectUploadRequest(
                app_id="org.example.App",
                primary_maintainer_user_id=42,
            ),
            _admin=None,
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "app_already_exists"


def test_switch_to_direct_upload_creates_new_app_when_none_exists(monkeypatch):
    """When DirectUploadApp.by_app_id returns None, a new app row is created."""
    added = _setup_switch_db(
        monkeypatch, existing_dev=None, current_primary=None, existing_app="none"
    )
    runtimes.switch_to_direct_upload(_make_switch_request(scope=None), _admin=None)
    app_rows = [o for o in added if isinstance(o, models.DirectUploadApp)]
    assert len(app_rows) == 1
    assert app_rows[0].app_id == "org.gnome.Platform"


def test_switch_to_direct_upload_rejects_scope_already_exists(monkeypatch):
    """If a RuntimeScope already exists for the app, raise 400 scope_already_exists.

    This covers the regression where re-enabling an archived app that still has a
    RuntimeScope would previously hit a unique-constraint IntegrityError (500).
    """
    fake_maintainer = SimpleNamespace(id=42, display_name="Maintainer")
    fake_archived_app = SimpleNamespace(id=1, app_id="org.example.App", archived=True)
    fake_scope = SimpleNamespace(app_id="org.example.App")

    @contextmanager
    def _ctx(db_type="replica"):
        monkeypatch.setattr(
            models.FlathubUser, "by_id", lambda db, uid: fake_maintainer
        )
        monkeypatch.setattr(
            models.DirectUploadApp,
            "by_app_id",
            lambda db, app_id: fake_archived_app,
        )
        monkeypatch.setattr(
            models.RuntimeScope,
            "by_app_id",
            lambda db, app_id: fake_scope,  # scope still present on archived app
        )
        yield FakeDb()

    monkeypatch.setattr(runtimes, "get_db", _ctx)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.switch_to_direct_upload(
            runtimes.SwitchToDirectUploadRequest(
                app_id="org.example.App",
                primary_maintainer_user_id=42,
                scope=runtimes.RuntimeScopeInput(
                    prefixes=["org.example.App"],
                ),
            ),
            _admin=None,
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "scope_already_exists"


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
def test_switch_to_direct_upload_rejects_malformed_id_lists(
    monkeypatch, prefixes, extra_ids, detail
):
    with pytest.raises(HTTPException) as exc_info:
        runtimes.switch_to_direct_upload(
            runtimes.SwitchToDirectUploadRequest(
                app_id="org.gnome.Platform",
                primary_maintainer_user_id=42,
                scope=runtimes.RuntimeScopeInput(
                    prefixes=prefixes,
                    extra_ids=extra_ids,
                ),
            ),
            _admin=None,
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == detail


def test_switch_off_direct_upload_revokes_and_deletes(monkeypatch):
    """switch_off_direct_upload revokes tokens and hard-deletes scope/devs/invites/app."""
    monkeypatch.setattr(
        runtimes.config.settings, "flat_manager_api", "https://flat-manager.example"
    )

    revoked_jtis = []
    token_a = SimpleNamespace(revoked=False, id=1, issued_at=None)
    token_b = SimpleNamespace(revoked=True, id=2, issued_at=None)  # already revoked
    token_c = SimpleNamespace(revoked=False, id=3, issued_at=None)

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_scope = SimpleNamespace(app_id="org.example.App")

    monkeypatch.setattr(
        runtimes.utils, "create_flat_manager_token", lambda *a, **k: "fake-jwt"
    )

    def fake_post(url, headers, json):
        revoked_jtis.extend(json["token_ids"])
        return SimpleNamespace(is_success=True)

    monkeypatch.setattr(runtimes.http_client, "post", fake_post)
    monkeypatch.setattr(
        runtimes.models.UploadToken,
        "by_app_id",
        lambda db, app_id: [token_a, token_b, token_c],
    )

    deleted_objects = []
    execute_calls = []

    class _WriteSession:
        def delete(self, obj):
            deleted_objects.append(obj)

        def commit(self):
            pass

        def merge(self, obj):
            return obj

        def execute(self, stmt):
            execute_calls.append(stmt)

    class _WriteDb:
        session = _WriteSession()

    call_count = [0]

    @contextmanager
    def _ctx(db_type="replica"):
        call_count[0] += 1
        if db_type == "replica" or call_count[0] <= 2:
            # First two replica calls: initial check + token fetch
            monkeypatch.setattr(
                models.DirectUploadApp,
                "by_app_id",
                lambda db, app_id: fake_app,
            )
            monkeypatch.setattr(
                models.RuntimeScope,
                "by_app_id",
                lambda db, app_id: fake_scope,
            )
            yield FakeDb()
        else:
            monkeypatch.setattr(
                models.DirectUploadApp,
                "by_app_id",
                lambda db, app_id: fake_app,
            )
            monkeypatch.setattr(
                models.RuntimeScope,
                "by_app_id",
                lambda db, app_id: fake_scope,
            )
            yield _WriteDb()

    monkeypatch.setattr(runtimes, "get_db", _ctx)

    runtimes.switch_off_direct_upload("org.example.App", _admin=None)

    assert set(revoked_jtis) == {runtimes.jti(token_a), runtimes.jti(token_c)}
    assert token_a.revoked is True
    assert token_c.revoked is True

    assert fake_scope in deleted_objects
    assert fake_app in deleted_objects

    assert len(execute_calls) == 2


def test_switch_off_direct_upload_404_if_app_missing(monkeypatch):
    """switch_off_direct_upload raises 404 if the app is not a direct-upload app."""
    monkeypatch.setattr(
        runtimes.config.settings, "flat_manager_api", "https://flat-manager.example"
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadApp,
        "by_app_id",
        lambda db, app_id: None,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.switch_off_direct_upload("org.example.App", _admin=None)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "app_not_found"


def test_update_runtime_scope_success(monkeypatch):
    fake_app = SimpleNamespace(id=1, app_id="org.gnome.Platform", archived=False)
    fake_scope = SimpleNamespace(
        app_id="org.gnome.Platform",
        prefixes="org.gnome.Platform org.gnome.Sdk",
        extra_ids="",
        repos="stable beta",
    )
    fake_response = object()  # sentinel; we mock _managed_app_response

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.RuntimeScope, "by_app_id", lambda db, app_id: fake_scope
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)
    monkeypatch.setattr(
        runtimes, "_managed_app_response", lambda db, app, scope: fake_response
    )

    request = runtimes.UpdateScopeRequest(
        prefixes=["org.gnome.Platform"],
        extra_ids=["org.gnome.Sdk.Docs"],
    )

    result = runtimes.update_runtime_scope("org.gnome.Platform", request, _admin=None)

    assert fake_scope.prefixes == "org.gnome.Platform"
    assert fake_scope.extra_ids == "org.gnome.Sdk.Docs"
    assert result is fake_response


def test_update_runtime_scope_app_not_found(monkeypatch):
    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    request = runtimes.UpdateScopeRequest(prefixes=["org.gnome.Platform"])

    with pytest.raises(HTTPException) as exc_info:
        runtimes.update_runtime_scope("org.gnome.Platform", request, _admin=None)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "app_not_found"


def test_update_runtime_scope_scope_not_found(monkeypatch):
    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    request = runtimes.UpdateScopeRequest(prefixes=["org.gnome.Platform"])

    with pytest.raises(HTTPException) as exc_info:
        runtimes.update_runtime_scope("org.example.App", request, _admin=None)

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "scope_not_found"


def test_update_runtime_scope_prefixes_required(monkeypatch):
    request = runtimes.UpdateScopeRequest(prefixes=[])

    with pytest.raises(HTTPException) as exc_info:
        runtimes.update_runtime_scope("org.gnome.Platform", request, _admin=None)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "prefixes_required"


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
def test_update_runtime_scope_rejects_malformed_id_lists(
    monkeypatch, prefixes, extra_ids, detail
):
    with pytest.raises(HTTPException) as exc_info:
        runtimes.update_runtime_scope(
            "org.gnome.Platform",
            runtimes.UpdateScopeRequest(
                prefixes=prefixes,
                extra_ids=extra_ids,
            ),
            _admin=None,
        )
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == detail


def test_add_maintainer_success(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Alice")
    fake_response = object()
    added_objects = []

    class TrackingSession(FakeSession):
        def add(self, obj):
            added_objects.append(obj)
            super().add(obj)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: None,
    )
    monkeypatch.setattr(
        runtimes.models.Role, "by_name", lambda db, name: SimpleNamespace(id=1)
    )
    monkeypatch.setattr(
        runtimes.models.flathubuser_role,
        "by_user_role",
        lambda db, user, role: False,
    )
    monkeypatch.setattr(
        runtimes.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        runtimes, "_managed_app_response", lambda db, app, scope: fake_response
    )
    monkeypatch.setattr(
        runtimes, "get_db", lambda db_type: fake_get_db_session(TrackingSession())
    )

    request = runtimes.AddMaintainerRequest(user_id=42)
    result = runtimes.add_maintainer("org.example.App", request, _admin=None)

    assert result is fake_response
    # Should have added the developer and flathubuser_role
    dev_added = any(
        isinstance(obj, runtimes.models.DirectUploadAppDeveloper)
        and obj.developer_id == 42
        and obj.is_primary is False
        for obj in added_objects
    )
    assert dev_added, "DirectUploadAppDeveloper not added with correct params"


def test_add_maintainer_already_a_maintainer(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Alice")
    fake_existing_dev = SimpleNamespace(app_id=1, developer_id=42, is_primary=False)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: fake_existing_dev,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    request = runtimes.AddMaintainerRequest(user_id=42)
    with pytest.raises(HTTPException) as exc_info:
        runtimes.add_maintainer("org.example.App", request, _admin=None)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "already_a_maintainer"


def test_add_maintainer_app_not_found(monkeypatch):

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    request = runtimes.AddMaintainerRequest(user_id=42)
    with pytest.raises(HTTPException) as exc_info:
        runtimes.add_maintainer("org.example.App", request, _admin=None)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "app_not_found"


def test_add_maintainer_user_not_found(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(runtimes.models.FlathubUser, "by_id", lambda db, user_id: None)
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    request = runtimes.AddMaintainerRequest(user_id=999)
    with pytest.raises(HTTPException) as exc_info:
        runtimes.add_maintainer("org.example.App", request, _admin=None)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "user_not_found"


def test_add_maintainer_uploader_role_missing(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Alice")

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: None,
    )
    monkeypatch.setattr(
        runtimes.models.Role,
        "by_name",
        lambda db, name: None,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    request = runtimes.AddMaintainerRequest(user_id=42)
    with pytest.raises(HTTPException) as exc_info:
        runtimes.add_maintainer("org.example.App", request, _admin=None)
    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "uploader_role_missing"


def test_remove_maintainer_success(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Alice")
    fake_dev = SimpleNamespace(app_id=1, developer_id=42, is_primary=False)
    deleted_objects = []

    class TrackingSession(FakeSession):
        def delete(self, obj):
            deleted_objects.append(obj)
            super().delete(obj)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: fake_dev,
    )
    monkeypatch.setattr(
        runtimes, "get_db", lambda db_type: fake_get_db_session(TrackingSession())
    )

    runtimes.remove_maintainer("org.example.App", 42, _admin=None)
    assert fake_dev in deleted_objects


def test_remove_maintainer_cannot_remove_primary(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=1, display_name="Alice")
    fake_primary_dev = SimpleNamespace(app_id=1, developer_id=1, is_primary=True)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: fake_primary_dev,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.remove_maintainer("org.example.App", 1, _admin=None)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "cannot_remove_primary"


def test_remove_maintainer_maintainer_not_found(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Bob")

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: None,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.remove_maintainer("org.example.App", 42, _admin=None)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "maintainer_not_found"


def test_remove_maintainer_app_not_found(monkeypatch):
    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.remove_maintainer("org.example.App", 42, _admin=None)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "app_not_found"


def test_set_primary_maintainer_promotes_secondary(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Bob")
    current_primary = SimpleNamespace(app_id=1, developer_id=1, is_primary=True)
    target_dev = SimpleNamespace(app_id=1, developer_id=42, is_primary=False)
    fake_response = object()
    flush_count = 0

    class FlushTrackingSession(FakeSession):
        def flush(self):
            nonlocal flush_count
            flush_count += 1

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: target_dev,
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "primary_for_app",
        lambda db, app: current_primary,
    )
    monkeypatch.setattr(
        runtimes.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        runtimes, "_managed_app_response", lambda db, app, scope: fake_response
    )
    monkeypatch.setattr(
        runtimes, "get_db", lambda db_type: fake_get_db_session(FlushTrackingSession())
    )

    result = runtimes.set_primary_maintainer("org.example.App", 42, _admin=None)

    assert result is fake_response
    assert current_primary.is_primary is False, "old primary was demoted"
    assert target_dev.is_primary is True, "target was promoted"
    assert flush_count >= 1, "flush was called between demote and promote"


def test_set_primary_maintainer_no_prior_primary(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Bob")
    target_dev = SimpleNamespace(app_id=1, developer_id=42, is_primary=False)
    fake_response = object()

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: target_dev,
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "primary_for_app",
        lambda db, app: None,
    )
    monkeypatch.setattr(
        runtimes.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        runtimes, "_managed_app_response", lambda db, app, scope: fake_response
    )
    monkeypatch.setattr(
        runtimes, "get_db", lambda db_type: fake_get_db_session(FakeSession())
    )

    result = runtimes.set_primary_maintainer("org.example.App", 42, _admin=None)

    assert result is fake_response
    assert target_dev.is_primary is True


def test_set_primary_maintainer_already_primary(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=1, display_name="Alice")
    primary_dev = SimpleNamespace(app_id=1, developer_id=1, is_primary=True)
    fake_response = object()
    add_called = [False]

    class AddTrackingSession(FakeSession):
        def add(self, obj):
            add_called[0] = True
            super().add(obj)

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: primary_dev,
    )
    monkeypatch.setattr(
        runtimes.models.RuntimeScope, "by_app_id", lambda db, app_id: None
    )
    monkeypatch.setattr(
        runtimes, "_managed_app_response", lambda db, app, scope: fake_response
    )
    monkeypatch.setattr(
        runtimes, "get_db", lambda db_type: fake_get_db_session(AddTrackingSession())
    )

    result = runtimes.set_primary_maintainer("org.example.App", 1, _admin=None)

    assert result is fake_response
    assert not add_called[0], "no DB writes for idempotent case"


def test_set_primary_maintainer_maintainer_not_found(monkeypatch):

    fake_app = SimpleNamespace(id=1, app_id="org.example.App", archived=False)
    fake_user = SimpleNamespace(id=42, display_name="Bob")

    monkeypatch.setattr(
        runtimes.models.DirectUploadApp, "by_app_id", lambda db, app_id: fake_app
    )
    monkeypatch.setattr(
        runtimes.models.FlathubUser, "by_id", lambda db, user_id: fake_user
    )
    monkeypatch.setattr(
        runtimes.models.DirectUploadAppDeveloper,
        "by_developer_and_app",
        lambda db, user, app: None,
    )
    monkeypatch.setattr(runtimes, "get_db", fake_get_db)

    with pytest.raises(HTTPException) as exc_info:
        runtimes.set_primary_maintainer("org.example.App", 42, _admin=None)
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "maintainer_not_found"
