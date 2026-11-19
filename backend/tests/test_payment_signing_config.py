import base64

from app.config import Settings


def test_production_warns_only_for_invalid_signing_keys(caplog):
    settings = Settings.model_construct(env="production")
    settings.warn_if_signing_keys_invalid()
    assert len(caplog.records) == 1
    caplog.clear()
    settings.session_secret_key = "a" * 32
    settings.update_token_secret = base64.b64encode(b"b" * 32).decode()
    settings.flat_manager_secret = settings.update_token_secret
    settings.warn_if_signing_keys_invalid()
    assert len(caplog.records) == 1
    caplog.clear()
    settings.flat_manager_secret = base64.b64encode(b"c" * 32).decode()
    settings.warn_if_signing_keys_invalid()
    assert not caplog.records
    settings.update_token_secret = "not-base64!"
    settings.warn_if_signing_keys_invalid()
    assert len(caplog.records) == 1
    assert "Base64" in caplog.text
    assert settings.update_token_secret not in caplog.text
