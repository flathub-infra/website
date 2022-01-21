import os
from typing import Optional

from pydantic import BaseSettings

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    app_name: str = "Flathub API"
    flatpak_user_dir: str = "/root/.local/share/flatpak"
    redis_host: str = "localhost"
    redis_port: int = 6379
    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432"
    sentry_dsn: Optional[str] = None
    appstream_repos: Optional[str] = None
    datadir: str = os.path.join(ROOT_DIR, "data")
    stats_baseurl = "https://flathub.org/stats"
    enable_login_support: bool = False
    session_secret_key: str = "change-me-for-production"


settings = Settings()
