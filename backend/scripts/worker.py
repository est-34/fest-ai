"""보고서 생성·개인정보 파기를 실행하는 전용 프로세스. API와 같은 이미지를 사용한다."""
import logging
import signal

from app.infrastructure.db import pool
from app.infrastructure.jobs import start_worker


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    pool.open(wait=True)
    stopped, thread = start_worker()
    previous = {}
    for signum in (signal.SIGINT, signal.SIGTERM):
        previous[signum] = signal.signal(signum, lambda *_: stopped.set())
    try:
        thread.join()
    finally:
        stopped.set()
        thread.join()  # 처리 중인 작업의 트랜잭션을 마친 후 연결을 닫는다.
        pool.close()
        for signum, handler in previous.items():
            signal.signal(signum, handler)


if __name__ == "__main__":
    main()
