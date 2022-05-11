import os
from typing import Optional

from pydantic import BaseSettings

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    app_name: str = "Flathub API"
    flatpak_user_dir: str = "/root/.local/share/flatpak"
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432"
    meilisearch_url: str = "http://meilisearch:7700"
    meilisearch_master_key: Optional[str] = None
    sentry_dsn: Optional[str] = None
    appstream_repos: Optional[str] = None
    datadir: str = os.path.join(ROOT_DIR, "data")
    stats_baseurl = "https://flathub.org/stats"
    session_secret_key: str = "change-me-for-production"
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
    google_client_id: str = (
        "29861222915-aj1mcmdcutk00a5u5n8egcvpqv27lpvq.apps.googleusercontent.com"
    )
    google_client_secret: str = "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"
    google_return_url: str = "http://localhost:3000/login/google"
    cors_origins: str = "http://localhost:3000"
    stripe_secret_key: Optional[str] = None
    stripe_public_key: Optional[str] = None
    stripe_webhook_key: Optional[str] = None
    flat_manager_secret: str = "c2VjcmV0"
    update_token_secret: str = "c2VjcmV0"


settings = Settings()
