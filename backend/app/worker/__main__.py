import logging
import signal
import threading

from .scheduler import start_background_scheduler

logger = logging.getLogger(__name__)
stop_event = threading.Event()


def _stop(signum, frame):
    stop_event.set()


def main():
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    scheduler = start_background_scheduler()
    logger.info("Scheduler process started")
    try:
        stop_event.wait()
    finally:
        scheduler.shutdown()
        logger.info("Scheduler process stopped")


if __name__ == "__main__":
    main()
