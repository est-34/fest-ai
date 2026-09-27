import logging
import threading
from datetime import UTC, datetime

from app.bootstrap import UnitOfWork
from app.infrastructure.coordination_queries import prune
from app.infrastructure.db import pool
from app.modules.esg import api as jobs
from app.shared.application.policy import PURGE_EVERY_TICKS

logger = logging.getLogger(__name__)


def process_one_job() -> bool:
    with pool.connection() as connection:
        return jobs.process_one_job(UnitOfWork(connection))


def purge_expired() -> None:
    with pool.connection() as connection:
        prune(connection, int(datetime.now(UTC).timestamp() // 60))
        jobs.purge_expired(UnitOfWork(connection))


def start_worker() -> tuple[threading.Event, threading.Thread]:
    stopped = threading.Event()

    def run() -> None:
        ticks = 0
        while not stopped.wait(1):
            ticks += 1
            try:
                while not stopped.is_set() and process_one_job():
                    pass
                if ticks % PURGE_EVERY_TICKS == 0:
                    purge_expired()
            except Exception:
                logger.exception("잡 워커 순회 실패")

    thread = threading.Thread(target=run, name="festival-jobs", daemon=True)
    thread.start()
    return (stopped, thread)
