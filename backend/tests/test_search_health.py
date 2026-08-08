import os
import sys

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

from app import search_health


def test_health_check_fails_closed_when_redis_unavailable(monkeypatch):
    def raise_connection_error(_key):
        raise RuntimeError("redis unavailable")

    monkeypatch.setattr(search_health.redis_conn, "scard", raise_connection_error)

    assert search_health.has_hybrid_task_failures() is True
