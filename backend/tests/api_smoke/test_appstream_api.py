from contextlib import contextmanager
from types import SimpleNamespace


class TestAppstreamEndpoint:
    def test_serves_legacy_string_device_requirements(
        self, client, endpoint_app, monkeypatch
    ):
        _app, apps, _favorites, _oidc, _stats = endpoint_app
        application = apps.models.App(
            app_id="org.example.App",
            type="desktop-application",
            is_eol=False,
            appstream={
                "type": "desktop-application",
                "id": "org.example.App",
                "name": "Example",
                "summary": "An example app",
                "description": "<p>Example description</p>",
                "releases": [],
                "bundle": {"type": "flatpak", "value": "org.example.App"},
                "is_free_license": True,
                "recommends": ["keyboard", "pointing", "touch"],
            },
        )

        class AppQuery:
            def options(self, *_options):
                return self

            def filter(self, _condition):
                return self

            def first(self):
                return application

        @contextmanager
        def get_db(_role):
            yield SimpleNamespace(
                session=SimpleNamespace(query=lambda _model: AppQuery())
            )

        monkeypatch.setattr(apps, "get_db", get_db)
        monkeypatch.setattr(
            apps.models.App, "is_fully_eol", lambda *_args, **_kwargs: False
        )

        response = client.get("/appstream/org.example.App", params={"locale": "az"})

        assert response.status_code == 200
        assert response.json()["recommends"] == ["keyboard", "pointing", "touch"]

    def test_localized_content_rating_survives_cache(
        self, client, endpoint_app, monkeypatch, snapshot
    ):
        _app, apps, _favorites, _oidc, _stats = endpoint_app
        application = apps.models.App(
            app_id="org.example.App",
            type="desktop-application",
            is_eol=False,
            appstream={
                "type": "desktop-application",
                "id": "org.example.App",
                "name": "Example",
                "summary": "An example app",
                "description": "<p>Example description</p>",
                "releases": [],
                "bundle": {"type": "flatpak", "value": "org.example.App"},
                "is_free_license": True,
            },
            localization={"de": {"name": "Beispiel", "summary": "Eine Beispiel-App"}},
            content_rating_details={
                "de_DE": {
                    "categories": [
                        {"id": "violence", "level": "unknown", "description": None}
                    ],
                    "contentRatingSystem": "USK",
                    "minimumAge": 3,
                    "minimumAgeText": "3",
                }
            },
        )

        class AppQuery:
            def options(self, *_options):
                return self

            def filter(self, _condition):
                return self

            def first(self):
                return application

        @contextmanager
        def get_db(_role):
            yield SimpleNamespace(
                session=SimpleNamespace(query=lambda _model: AppQuery())
            )

        monkeypatch.setattr(apps, "get_db", get_db)
        monkeypatch.setattr(
            apps.models.App, "is_fully_eol", lambda *_args, **_kwargs: False
        )
        response = client.get("/appstream/org.example.App", params={"locale": "de"})
        assert response.status_code == 200
        assert snapshot("localized_appstream.json") == response.json()

        # Replay the actual serialized Redis entry through the endpoint decorator.
        redis = apps.database.get_redis.return_value
        redis.get.return_value = redis.setex.call_args.args[2]

        def unexpected_db_access(*_args):
            raise AssertionError("The second request should be served from cache")

        monkeypatch.setattr(apps, "get_db", unexpected_db_access)
        cached_response = client.get(
            "/appstream/org.example.App", params={"locale": "de"}
        )
        assert cached_response.status_code == 200
        assert cached_response.json() == response.json()
