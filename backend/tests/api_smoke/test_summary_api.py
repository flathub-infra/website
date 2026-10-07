from contextlib import contextmanager
from types import SimpleNamespace


class TestSummaryEndpoint:
    def test_enriches_runtime_metadata(
        self, client, endpoint_app, monkeypatch, snapshot
    ):
        _app, apps, _favorites, _oidc, _stats = endpoint_app
        runtime = SimpleNamespace(
            summary={
                "branches": {"stable": {"installed_size": 1234, "name": "Runtime"}}
            }
        )
        application = SimpleNamespace(
            summary={
                "arches": ["x86_64"],
                "metadata": {
                    "name": "Example",
                    "runtime": "org.example.Runtime/x86_64/stable",
                },
            }
        )

        @contextmanager
        def get_db(_role):
            yield object()

        monkeypatch.setattr(apps, "get_db", get_db)
        monkeypatch.setattr(
            apps.models.App,
            "by_appid",
            lambda _db, app_id: application if app_id == "org.example.App" else runtime,
        )
        monkeypatch.setattr(apps.models.App, "is_fully_eol", lambda *_args: False)
        monkeypatch.setattr(apps.models.App, "get_eol_data", lambda *_args: False)

        response = client.get("/summary/org.example.App")

        assert response.status_code == 200
        assert snapshot("summary_runtime_metadata.json") == response.json()
