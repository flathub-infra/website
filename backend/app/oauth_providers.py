from collections.abc import Callable
from dataclasses import dataclass, field

from authlib.integrations.httpx_client import OAuth2Client

from . import config


@dataclass(frozen=True)
class OAuthProviderConfig:
    client_id: Callable[[], str]
    client_secret: Callable[[], str]
    redirect_uri: Callable[[], str]
    token_url: str
    authorize_url: str | None = None
    scope: str | None = None
    authorize_params: dict[str, str] = field(default_factory=dict)


PROVIDERS: dict[str, OAuthProviderConfig] = {
    "github": OAuthProviderConfig(
        client_id=lambda: config.settings.github_client_id,
        client_secret=lambda: config.settings.github_client_secret,
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        redirect_uri=lambda: config.settings.github_return_url,
        scope="read:user read:org user:email",
        authorize_params={"allow_signup": "false"},
    ),
    "gitlab": OAuthProviderConfig(
        client_id=lambda: config.settings.gitlab_client_id,
        client_secret=lambda: config.settings.gitlab_client_secret,
        authorize_url="https://gitlab.com/oauth/authorize",
        token_url="https://gitlab.com/oauth/token",
        redirect_uri=lambda: config.settings.gitlab_return_url,
        scope="read_user openid",
        authorize_params={"response_type": "code"},
    ),
    "gnome": OAuthProviderConfig(
        client_id=lambda: config.settings.gnome_client_id,
        client_secret=lambda: config.settings.gnome_client_secret,
        authorize_url="https://gitlab.gnome.org/oauth/authorize",
        token_url="https://gitlab.gnome.org/oauth/token",
        redirect_uri=lambda: config.settings.gnome_return_url,
        scope="read_user openid",
        authorize_params={"response_type": "code"},
    ),
    "google": OAuthProviderConfig(
        client_id=lambda: config.settings.google_client_id,
        client_secret=lambda: config.settings.google_client_secret,
        token_url="https://www.googleapis.com/oauth2/v4/token",
        redirect_uri=lambda: config.settings.google_return_url,
    ),
    "kde": OAuthProviderConfig(
        client_id=lambda: config.settings.kde_client_id,
        client_secret=lambda: config.settings.kde_client_secret,
        authorize_url="https://invent.kde.org/oauth/authorize",
        token_url="https://invent.kde.org/oauth/token",
        redirect_uri=lambda: config.settings.kde_return_url,
        scope="read_user openid",
        authorize_params={"response_type": "code"},
    ),
}


def get_provider_config(provider: str) -> OAuthProviderConfig:
    return PROVIDERS[provider]


def get_oauth_client(provider: str) -> OAuth2Client:
    cfg = get_provider_config(provider)
    return OAuth2Client(
        client_id=cfg.client_id(),
        client_secret=cfg.client_secret(),
        redirect_uri=cfg.redirect_uri(),
        scope=cfg.scope,
        token_endpoint_auth_method="client_secret_post",
    )
