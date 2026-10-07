class TestOidcDiscoveryEndpoint:
    def test_returns_protocol_metadata(
        self, client, endpoint_app, monkeypatch, snapshot
    ):
        _app, _apps, _favorites, oidc, _stats = endpoint_app
        monkeypatch.setattr(oidc.config.settings, "oidc_enabled", True)
        monkeypatch.setattr(oidc.config.settings, "oidc_issuer", "https://flathub.org")

        response = client.get("/.well-known/openid-configuration")

        assert response.status_code == 200
        assert snapshot("oidc_discovery.json") == response.json()
