import os

from typing import Optional
from pydantic import BaseSettings

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    app_name: str = "Flathub API"
    flatpak_user_dir: str = "/root/.local/share/flatpak"
    redis_host: str = "localhost"
    redis_port: int = 6379
    sentry_dsn: Optional[str] = None
    appstream_repos: Optional[str] = None
    datadir: str = os.path.join(ROOT_DIR, "data")


settings = Settings()
