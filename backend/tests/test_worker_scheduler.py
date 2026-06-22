import importlib
import inspect
import os
import sys
from types import SimpleNamespace

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(ROOT_DIR)

# app.search connects to Meilisearch at import time; stub it out for unit tests.
sys.modules["app.search"] = SimpleNamespace()


def _import_real_worker():
    """Return the real ``app.worker`` package, even if a prior test stubbed it."""
    saved = sys.modules.pop("app.worker", None)
    try:
        return importlib.import_module("app.worker")
    finally:
        if saved is not None:
            sys.modules["app.worker"] = saved


def test_worker_init_does_not_start_scheduler():
    """``app.worker.__init__`` must be side-effect free: no scheduler startup."""
    worker = _import_real_worker()
    source = inspect.getsource(worker)
    assert "start_background_scheduler" not in source


def test_worker_init_registers_cron_actors():
    worker = _import_real_worker()
    assert hasattr(worker, "log_audit_event")
    assert hasattr(worker, "prune_audit_logs")
    assert worker.log_audit_event.actor_name == "log_audit_event"
    assert worker.prune_audit_logs.actor_name == "prune_audit_logs"


def test_cron_jobs_loaded_for_prune_and_app_picks():
    """Importing app.worker must populate cron.JOBS for the scheduled actors."""
    worker = _import_real_worker()
    from app import cron

    job_names = {f"{module}.{func}" for _, module, func in cron.JOBS}
    assert (
        f"{worker.prune_audit_logs.fn.__module__}.{worker.prune_audit_logs.fn.__name__}"
        in job_names
    )
    assert (
        f"{worker.update_app_picks.fn.__module__}.{worker.update_app_picks.fn.__name__}"
        in job_names
    )


def test_main_starts_and_shuts_down_scheduler(monkeypatch):
    saved = sys.modules.pop("app.worker", None)
    try:
        importlib.import_module("app.worker")
        worker_main = importlib.import_module("app.worker.__main__")
    finally:
        if saved is not None:
            sys.modules["app.worker"] = saved

    started = {"called": False}
    shutdown = {"called": False}

    class FakeScheduler:
        def shutdown(self):
            shutdown["called"] = True

    def fake_start():
        started["called"] = True
        return FakeScheduler()

    monkeypatch.setattr(worker_main, "start_background_scheduler", fake_start)

    wait_called = {"called": False}

    class FakeEvent:
        def wait(self):
            wait_called["called"] = True
            return True

    monkeypatch.setattr(worker_main, "stop_event", FakeEvent())

    worker_main.main()

    assert started["called"] is True
    assert wait_called["called"] is True
    assert shutdown["called"] is True
