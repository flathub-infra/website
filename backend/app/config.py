import base64
import os

from pydantic_settings import BaseSettings

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    app_name: str = "Flathub API"
    flatpak_user_dir: str = "/root/.local/share/flatpak"
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432"
    meilisearch_url: str = "http://meilisearch:7700"
    meilisearch_master_key: str | None = None
    sentry_dsn: str | None = None
    appstream_repos: str | None = None
    datadir: str = os.path.join(ROOT_DIR, "data")
    stats_baseurl: str = "https://hub.flathub.org/stats"
    session_secret_key: str = "change-me-for-production"

    frontend_url: str = "http://localhost:3000"

    github_client_id: str = "71dbddbdb4288fe96a58"
    github_client_secret: str = "4e4be6b815c4c42261a27ad3dba91a8c8d8a2ac5"
    github_return_url: str = "http://localhost:3000/login/github"
    gitlab_client_id: str = (
        "9aa48d0d5ebe1e7f60f3a0c25036a74aab7a9b766c88844de46afd1e53b0ad2d"
    )
    gitlab_client_secret: str = (
        "fe364dd63c43ba8ebab5bd488df5946adfcc14366edf81c3814f6a021c61e953"
    )
    gitlab_return_url: str = "http://localhost:3000/login/gitlab"
    gnome_client_id: str = (
        "914fb36557a5b8403f5f4d4085b58119b505aad07c56505ed14362a388aae6a8"
    )
    gnome_client_secret: str = (
        "9122d58ed56789d80db5f1ed0ec6bad5d9dae612aa9d458d89ee475e01151c43"
    )
    gnome_return_url: str = "http://localhost:3000/login/gnome"
    kde_client_id: str = "foobar"
    kde_client_secret: str = "xyz123"
    kde_return_url: str = "http://localhost:3000/login/kde"
    google_client_id: str = (
        "29861222915-aj1mcmdcutk00a5u5n8egcvpqv27lpvq.apps.googleusercontent.com"
    )
    google_client_secret: str = "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"
    google_return_url: str = "http://localhost:3000/login/google"
    cors_origins: str = "http://localhost:3000 http://localhost:4200"
    stripe_secret_key: str | None = None
    stripe_public_key: str | None = None
    stripe_webhook_key: str | None = None
    env: str = "production"

    # Should match "repo-secret" in flat-manager's config
    flat_manager_secret: str = base64.b64encode(b"secret").decode()
    # Should be a unique random secret, not in flat-manager's config
    update_token_secret: str = base64.b64encode(b"update_token_secret").decode()
    # Should match "secret" in flat-manager's config
    flat_manager_build_secret: str | None = base64.b64encode(b"secret").decode()
    # The URL for flat-manager. If present, the backend will use it to queue republish jobs when storefront info
    # changes. To test in development, set the environment variable FLAT_MANAGER_API=http://host.docker.internal:8080
    # when running docker-compose.
    flat_manager_api: str | None = None

    # When set to True, moderation reviews will still be logged, but they do not have to be approved for the build to
    # be published.
    moderation_observe_only: bool = False

    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_username: str | None = None
    smtp_password: str | None = None
    email_from: str | None = None
    email_from_name: str | None = "Flathub"


settings = Settings()
