import asyncio
import logging
import os
import socket
import sys
import time
from pathlib import Path

import memray
from starlette.types import Message, Receive, Scope, Send

from .main import app as backend_app

logger = logging.getLogger(__name__)


async def _finish_capture(
    tracker: memray.Tracker, capture: Path, duration: float, stop: asyncio.Event
) -> None:
    try:
        try:
            await asyncio.wait_for(stop.wait(), timeout=duration)
        except TimeoutError:
            pass
    finally:
        tracker.__exit__(None, None, None)

    for name, options in (("peak", []), ("retained", ["--leaks"])):
        output = capture.with_suffix(f".{name}.html")
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "memray",
            "flamegraph",
            "--no-web",
            "--confidential-files",
            "all",
            *options,
            "--output",
            str(output),
            str(capture),
        )
        if await process.wait() != 0:
            raise RuntimeError(f"Memray flamegraph failed for {capture}")
        logger.info("Memory flamegraph: %s", output)


async def app(scope: Scope, receive: Receive, send: Send) -> None:
    if scope["type"] != "lifespan":
        await backend_app(scope, receive, send)
        return

    directory = Path(os.environ["MEMRAY_OUTPUT_DIR"])
    duration = float(os.environ.get("MEMRAY_DURATION", "60"))
    if not 0 < duration < float("inf"):
        raise ValueError("MEMRAY_DURATION must be a finite positive number")
    directory.mkdir(parents=True, exist_ok=True)
    capture = directory / f"{socket.gethostname()}-{os.getpid()}-{time.time_ns()}.bin"
    tracker = memray.Tracker(capture, native_traces=True, trace_python_allocators=True)
    tracker.__enter__()
    stop = asyncio.Event()
    task = asyncio.create_task(_finish_capture(tracker, capture, duration, stop))

    async def send_with_capture(message: Message) -> None:
        if message["type"] in {
            "lifespan.shutdown.complete",
            "lifespan.shutdown.failed",
            "lifespan.startup.failed",
        }:
            stop.set()
            await task
        await send(message)

    try:
        await backend_app(scope, receive, send_with_capture)
    finally:
        stop.set()
        await task
