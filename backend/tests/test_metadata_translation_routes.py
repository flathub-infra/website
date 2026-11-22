from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from github import GithubException

from app import login_info
from app import metadata_translation_batches as batches
from app.login_info import LoginInformation, LoginState, login_state
from app.metadata_translation_github import MetadataSource
from app.metadata_translations import MetadataDocument, MetadataError
from app.routes import metadata_translations as routes


def client(monkeypatch, *, authenticated=True, permissions=("manage-apps",)):
    app = FastAPI()
    routes.register_to_app(app)
    user = SimpleNamespace(
        id=42, login_disabled=False, permissions=lambda: set(permissions)
    )
    database = MagicMock()
    database.__enter__.return_value.session.get.return_value = user
    monkeypatch.setattr(login_info, "get_db", lambda *args: database)
    app.dependency_overrides[login_state] = lambda: LoginInformation(
        state=LoginState.LOGGED_IN if authenticated else LoginState.LOGGED_OUT,
        user=user if authenticated else None,
        method=None,
    )
    repo = MagicMock()
    monkeypatch.setattr(routes, "_repo", lambda *args, **kwargs: repo)
    monkeypatch.setattr(
        routes,
        "read_saved_translation",
        lambda repo, source, app_id, locale: (
            source,
            batches._annotate(MetadataDocument(source.content, app_id, locale), {}),
            None,
            None,
            None,
            [],
        ),
    )
    return TestClient(app), repo


def test_both_endpoints_require_login(monkeypatch):
    http, repo = client(monkeypatch, authenticated=False)
    url = "/metadata-translations/org.example.App?locale=de"
    assert http.get(url).status_code == 401
    assert http.get("/metadata-translations/queue?locale=de").status_code == 401
    assert (
        http.post(
            "/metadata-translations/org.example.App/rebase?locale=de",
            json={"revision": "a" * 40},
        ).status_code
        == 401
    )
    assert (
        http.post(
            url, json={"revision": "a" * 40, "changes": {"/component/summary": "Text"}}
        ).status_code
        == 401
    )
    repo.create_pull.assert_not_called()


@pytest.mark.parametrize(
    "permissions", [(), ("moderation",), ("view-users",), ("modify-users",)]
)
def test_both_endpoints_require_admin(monkeypatch, permissions):
    http, repo = client(monkeypatch, permissions=permissions)
    queue = MagicMock()
    source = MagicMock()
    monkeypatch.setattr(routes, "queue_translation", queue)
    monkeypatch.setattr(routes, "read_source", source)
    url = "/metadata-translations/org.example.App?locale=de"
    assert http.get(url).status_code == 403
    assert http.get("/metadata-translations/queue?locale=de").status_code == 403
    assert (
        http.post(
            "/metadata-translations/org.example.App/rebase?locale=de",
            json={"revision": "a" * 40},
        ).status_code
        == 403
    )
    assert (
        http.post(
            url, json={"revision": "a" * 40, "changes": {"/component/summary": "Text"}}
        ).status_code
        == 403
    )
    queue.assert_not_called()
    source.assert_not_called()
    repo.create_pull.assert_not_called()


def test_revision_conflict_is_actionable(monkeypatch):
    http, _ = client(monkeypatch)
    submit = MagicMock(side_effect=MetadataError("source_changed"))
    monkeypatch.setattr(routes, "queue_translation", submit)
    response = http.post(
        "/metadata-translations/org.example.App?locale=de",
        json={
            "revision": "a" * 40,
            "versions": {"/component/summary": "v1"},
            "changes": {"/component/summary": "Text"},
        },
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "source_changed"
    assert submit.call_args.args[-1] == 42


def test_save_returns_queued_without_a_pull_request_url(monkeypatch):
    http, repo = client(monkeypatch)
    queue = MagicMock(return_value={"url": None, "state": "queued", "units": []})
    monkeypatch.setattr(routes, "queue_translation", queue)
    response = http.post(
        "/metadata-translations/org.example.App?locale=de",
        json={
            "revision": "a" * 40,
            "versions": {"/component/summary": "v1"},
            "changes": {"/component/summary": "Text"},
        },
    )
    assert response.status_code == 200
    assert response.json() == {"url": None, "state": "queued", "units": []}
    assert queue.call_args.args[-1] == 42
    repo.create_pull.assert_not_called()


def test_collaboration_precondition_and_conflict_payload(monkeypatch):
    http, _ = client(monkeypatch)
    unit = routes.SharedTranslationUnit(
        id="summary",
        source="Text",
        field="summary",
        context="",
        translation="Theirs",
        version="new-version",
        last_editor_id=43,
    )
    queue = MagicMock(side_effect=batches.TextConflict(unit))
    monkeypatch.setattr(routes, "queue_translation", queue)
    url = "/metadata-translations/org.example.App?locale=de"
    draft = {"revision": "a" * 40, "changes": {"summary": "Mine"}}
    assert http.post(url, json=draft).status_code == 422
    queue.assert_not_called()
    response = http.post(url, json={**draft, "versions": {"summary": "old-version"}})
    assert response.status_code == 409
    assert response.json()["detail"] == {
        "code": "text_conflict",
        "unit": unit.model_dump(),
    }


def test_read_source_returns_existing_translations_and_submission_availability(
    monkeypatch,
):
    http, _ = client(monkeypatch)
    monkeypatch.setattr(routes.config.settings, "github_bot_token", None)
    monkeypatch.setattr(
        routes,
        "read_source",
        lambda *args: SimpleNamespace(
            revision="a" * 40,
            sha="file-sha",
            path="org.example.App.metainfo.xml",
            content=b"""<component><id>org.example.App</id>
                <metadata_license>CC0-1.0</metadata_license>
                <summary>Read text</summary>
                <summary xml:lang="de">Text lesen</summary></component>""",
        ),
    )
    response = http.get("/metadata-translations/org.example.App?locale=de")
    assert response.status_code == 200
    data = response.json()
    assert data["units"][0]["translation"] == "Text lesen"
    assert data["metadata_license"] == "CC0-1.0"
    assert data["can_submit"] is False
    assert "/blob/" + "a" * 40 in data["source_url"]


@pytest.mark.parametrize(
    "conflict", ["source", "missing", "invalid", "wrong_component"]
)
def test_published_branch_conflict_returns_recoverable_snapshot(monkeypatch, conflict):
    http, repo = client(monkeypatch)
    content = b"""<component><id>org.example.App</id>
        <metadata_license>CC0-1.0</metadata_license>
        <summary>Read text</summary></component>"""
    source = MetadataSource("a" * 40, "metadata.xml", "file-sha", content)
    document = MetadataDocument(content, "org.example.App", "de")
    saved = document.apply({document.units()[0].id: "Saved translation"})
    batch = SimpleNamespace(
        recipe_target=None,
        revision=source.revision,
        path=source.path,
        source_sha=source.sha,
        source_content=content,
        content=saved,
        locale="de",
        field_edits={},
        state="submitted",
        changes={},
        error=None,
        generation=0,
        previous_translations=[],
        url="https://github.com/flathub/org.example.App/pull/1",
    )
    database = MagicMock()
    database.__enter__.return_value.query.return_value.filter_by.return_value.first.return_value = batch
    monkeypatch.setattr(batches, "get_db", lambda *args: database)
    monkeypatch.setattr(routes, "read_source", lambda *args: source)
    monkeypatch.setattr(
        routes, "read_saved_translation", batches.read_saved_translation
    )
    monkeypatch.setattr(routes.config.settings, "github_bot_token", "test-token")
    repo.get_pulls.return_value = [
        SimpleNamespace(state="open", merged=False, base=SimpleNamespace(ref="master"))
    ]
    repo.get_pull.return_value = repo.get_pulls.return_value[0]
    repo.get_contents.return_value = SimpleNamespace(
        decoded_content=saved.replace(b"Read text", b"Changed source")
    )
    if conflict == "missing":
        repo.get_contents.side_effect = GithubException(404, {"message": "Not found"})
    elif conflict == "invalid":
        repo.get_contents.return_value.decoded_content = (
            b"<component>Unescaped & text</component>"
        )
    elif conflict == "wrong_component":
        repo.get_contents.return_value.decoded_content = saved.replace(
            b"org.example.App", b"org.example.Other"
        )
    for _ in range(2):
        response = http.get("/metadata-translations/org.example.App?locale=de")
        assert response.status_code == 200
        data = response.json()
        assert data["batch_error"] == "source_changed"
        assert data["batch_state"] == "failed"
        assert data["can_submit"] is False
        assert data["revision"] == source.revision
        assert data["pull_request_url"] == batch.url
        assert data["units"][0]["source"] == "Read text"
        assert data["units"][0]["translation"] == "Saved translation"


@pytest.mark.parametrize("permissions", [(), ("modify-users",), ("manage-apps",)])
def test_dismiss_recovered_translation_requires_admin(monkeypatch, permissions):
    http, _ = client(monkeypatch, permissions=permissions)
    dismiss = MagicMock(return_value=[])
    monkeypatch.setattr(routes, "dismiss_previous_translation", dismiss)
    item = {
        "id": "/component/summary",
        "field": "summary",
        "context": "",
        "source": "Original",
        "translation": "Recovered",
        "markup": False,
    }
    response = http.post(
        "/metadata-translations/org.example.App/dismiss?locale=de", json=item
    )
    if "manage-apps" in permissions:
        assert response.status_code == 200
        assert response.json() == []
        dismiss.assert_called_once_with("org.example.App", "de", item)
    else:
        assert response.status_code == 403
        dismiss.assert_not_called()


@pytest.mark.parametrize("catalog_removed", [False, True])
def test_missing_source_exposes_read_only_snapshot(monkeypatch, catalog_removed):
    http, _ = client(monkeypatch)
    if catalog_removed:
        monkeypatch.setattr(
            routes, "_repo", MagicMock(side_effect=HTTPException(404, "app_not_found"))
        )
    else:
        monkeypatch.setattr(
            routes,
            "read_source",
            MagicMock(side_effect=MetadataError("unsupported_metadata")),
        )
    snapshot = MagicMock(
        return_value={
            "revision": "a" * 40,
            "path": "metadata.xml",
            "source_url": "",
            "locale": "de",
            "units": [],
            "metadata_license": "",
            "can_submit": False,
            "batch_error": "source_unavailable",
            "previous_translations": [
                {
                    "id": "x",
                    "field": "summary",
                    "context": "",
                    "source": "Old",
                    "translation": "Saved",
                }
            ],
        }
    )
    monkeypatch.setattr(routes, "unavailable_source_snapshot", snapshot)
    response = http.get("/metadata-translations/org.example.App?locale=de")
    assert response.status_code == 200
    assert response.json()["can_submit"] is False
    assert response.json()["previous_translations"][0]["translation"] == "Saved"
    snapshot.assert_called_once_with("org.example.App", "de")


def test_rebase_passes_revision(monkeypatch):
    http, repo = client(monkeypatch)
    rebase = MagicMock()
    monkeypatch.setattr(routes, "rebase_translation", rebase)
    url = "/metadata-translations/org.example.App/rebase?locale=de"
    assert http.post(url, json={"revision": "a" * 40}).status_code == 200
    rebase.assert_called_once_with(repo, "org.example.App", "de", "a" * 40)
    rebase.side_effect = MetadataError("source_changed")
    assert http.post(url, json={"revision": "a" * 40}).status_code == 409


def test_invalid_xml_characters_return_validation_error(monkeypatch):
    http, _ = client(monkeypatch)
    content = b"<component><id>org.example.App</id><summary>Text</summary></component>"
    document = MetadataDocument(content, "org.example.App", "de")
    monkeypatch.setattr(
        routes,
        "queue_translation",
        lambda repo, app_id, locale, revision, changes, user_id, **kwargs: (
            document.apply(changes)
        ),
    )
    response = http.post(
        "/metadata-translations/org.example.App?locale=de",
        json={
            "revision": "a" * 40,
            "changes": {document.units()[0].id: "Invalid\x00text"},
            "versions": {document.units()[0].id: "v1"},
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "invalid_characters"


def test_invalid_payload_cannot_reach_github(monkeypatch):
    http, repo = client(monkeypatch)
    submit = MagicMock()
    monkeypatch.setattr(routes, "queue_translation", submit)
    url = "/metadata-translations/org.example.App?locale=de"
    assert (
        http.post(url, json={"revision": "master", "changes": {"x": "y"}}).status_code
        == 422
    )
    assert http.post(url, json={"revision": "a" * 40, "changes": {}}).status_code == 422
    assert (
        http.get("/metadata-translations/org.example.App?locale=../de").status_code
        == 422
    )
    submit.assert_not_called()
    repo.create_pull.assert_not_called()
