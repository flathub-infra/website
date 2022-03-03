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
    sentry_dsn: Optional[str] = None
    appstream_repos: Optional[str] = None
    datadir: str = os.path.join(ROOT_DIR, "data")
    stats_baseurl = "https://flathub.org/stats"
    enable_login_support: bool = False
    session_secret_key: str = "change-me-for-production"
    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432"
    github_client_id: str = "71dbddbdb4288fe96a58"
    github_client_secret: str = "4e4be6b815c4c42261a27ad3dba91a8c8d8a2ac5"
    github_return_url: str = "http://localhost:3000/login/github"
    cors_origins: str = "http://localhost:3000"


settings = Settings()
