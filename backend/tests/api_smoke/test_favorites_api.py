from contextlib import contextmanager
from types import SimpleNamespace


class TestFavoritesCountEndpoint:
    def test_returns_favorites_count(self, client, endpoint_app, monkeypatch, snapshot):
        _app, _apps, favorites, _oidc, _stats = endpoint_app

        class Query:
            def filter(self, _condition):
                return self

            def count(self):
                return 7

        @contextmanager
        def get_db(_role):
            yield SimpleNamespace(query=lambda _model: Query())

        monkeypatch.setattr(favorites, "get_db", get_db)

        response = client.get("/favorites/org.example.App/count")

        assert response.status_code == 200
        assert snapshot("favorites_count.json") == response.json()
