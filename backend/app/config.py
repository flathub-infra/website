from os.path import expanduser
from typing import Optional

from pydantic import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Flathub API"
    ostree_repo: str = "/root/.local/share/flatpak/repo"
    redis_host: str = "localhost"
    redis_port: int = 6379
    github_token: Optional[str] = None
    sentry_dsn: Optional[str] = None


settings = Settings()
