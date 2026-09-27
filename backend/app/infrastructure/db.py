import json
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.infrastructure.config import settings
from app.shared.domain.errors import bad_request

# prepare_threshold=None: 트랜잭션 모드 pgbouncer(Supabase pooler 등) 뒤에서는 서버측
# prepared statement 캐시가 물리 커넥션 간에 섞여 DuplicatePreparedStatement로 죽는다
# (백그라운드 잡 폴러에서 실제 재현 확인). 세션 모드/직결에서도 부작용이 없어 항상 끈다.
pool = ConnectionPool(
    conninfo=settings.database_url,
    min_size=1,
    max_size=10,
    open=False,
    kwargs={"row_factory": dict_row, "prepare_threshold": None},
)


def jsonb(value: Any) -> Jsonb:
    return Jsonb(
        value, dumps=lambda data: json.dumps(data, default=str, ensure_ascii=False)
    )


class DatabaseSession:
    """요청의 트랜잭션. 외부 I/O 동안 커넥션을 반환하고 필요할 때 다시 얻는다."""

    def __init__(self):
        self._connection = None

    def __getattr__(self, name):
        if self._connection is None:
            self._connection = pool.getconn()
        return getattr(self._connection, name)

    def close(self, *, failed=False):
        if self._connection is None:
            return
        connection, self._connection = self._connection, None
        try:
            connection.rollback() if failed else connection.commit()
        finally:
            pool.putconn(connection)

    @contextmanager
    def external_io(self):
        # 호출자는 읽기 스냅샷을 만든 뒤에만 사용한다. 쓰기 업무의 중간 커밋에는 사용하지 않는다.
        self.close()
        yield


def database() -> Generator[DatabaseSession, None, None]:
    from app.bootstrap import UnitOfWork

    session = DatabaseSession()
    try:
        yield UnitOfWork(session)
    except BaseException:
        session.close(failed=True)
        raise
    else:
        session.close()


# 같은 값을 여러 번 쓰는 쿼리는 dict를 넘겨 %(name)s로 참조한다(위치 인자 중복을 없앤다).
Params = tuple | list | dict


def one(connection: Connection, sql: str, params: Params = ()) -> dict | None:
    return connection.execute(sql, params).fetchone()


def all_rows(connection: Connection, sql: str, params: Params = ()) -> list[dict]:
    return connection.execute(sql, params).fetchall()


def set_clause(values: dict) -> tuple[str, list]:
    """{"name":"봄축제","menu":[...]} -> ("name=%s,menu=%s", ["봄축제", Jsonb([...])]).

    키는 SQL에 그대로 들어가므로 컬럼명이어야 한다. 호출부는 모두
    `extra="forbid"` 스키마의 `model_dump()`라 필드 집합이 고정이다.
    """
    if not values:
        raise bad_request("VALIDATION_ERROR", "변경할 값이 없습니다.")
    return (
        ",".join(f"{column}=%s" for column in values),
        [
            jsonb(value) if isinstance(value, dict | list) else value
            for value in values.values()
        ],
    )
