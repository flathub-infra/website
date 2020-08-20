from os.path import expanduser

from pydantic import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Flathub API"
    ostree_repo: str = "/var/lib/flatpak/repo"
    redis_host: str = "localhost"
    redis_port: int = 6379


settings = Settings()
