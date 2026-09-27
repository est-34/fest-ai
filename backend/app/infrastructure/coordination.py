"""PostgreSQL을 이용한 프로세스 간 요청 제한과 공유 AI 세션 잠금."""

import hashlib
import threading
import time
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

from app.infrastructure import coordination_queries as model
from app.infrastructure.config import settings
from app.infrastructure.db import pool

# AI 전용 연결은 업무 풀에 포함하지 않는다. 하나의 client_id를 쓰므로 프로세스당 하나면 충분하다.
alan_pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=0,
    max_size=1,
    open=False,
    kwargs={"row_factory": dict_row, "autocommit": True, "prepare_threshold": None},
)
_pool_open_lock = threading.Lock()


class CoordinationBusy(RuntimeError):
    pass


def limited(ip: str, route_key: str, limit: int) -> bool:
    window = int(time.time() // 60)
    # 원본 IP는 카운터에 남기지 않는다.
    key = hashlib.sha256(ip.encode()).hexdigest()
    with pool.connection() as connection:
        return model.hit(connection, key, route_key, window, limit) > limit


@contextmanager
def alan_guard():
    # Transaction advisory lock은 PgBouncer transaction pooler에서도 같은 물리 세션을
    # 유지하도록 트랜잭션을 연 상태에서 보유한다. 외부 I/O용 풀만 점유한다.
    with _pool_open_lock:
        if alan_pool.closed:
            alan_pool.open()
    deadline = time.monotonic() + settings.alan_lock_wait_seconds
    key = f"alan:{settings.alan_client_id}"
    try:
        with alan_pool.connection(
            timeout=max(0.01, settings.alan_lock_wait_seconds)
        ) as connection:
            with connection.transaction():
                while not model.try_alan_lock(connection, key):
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise CoordinationBusy(
                            "다른 API 프로세스가 Alan을 사용 중입니다."
                        )
                    time.sleep(min(0.05, remaining))
                yield  # 트랜잭션이 끝나면 잠금은 자동 해제된다.
    except PoolTimeout as error:
        raise CoordinationBusy("Alan 호출 대기 한도를 초과했습니다.") from error
