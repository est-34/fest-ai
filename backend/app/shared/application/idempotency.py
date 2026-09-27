"""요청 멱등성: 업무 처리와 응답 기록을 하나의 트랜잭션에 묶는다."""

import hashlib
import json
from collections.abc import Callable
from typing import Any

from app.shared.application.ports import UnitOfWork
from app.shared.domain.errors import AppError, conflict


def idempotent(
    connection: UnitOfWork,
    *,
    key: str | None,
    scope: str,
    body: Any,
    work: Callable[[], tuple[int, dict]],
) -> tuple[int, dict, bool]:
    if not key:
        raise AppError(
            400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key 헤더가 필요합니다."
        )
    request_hash = hashlib.sha256(
        json.dumps(body, sort_keys=True, default=str, ensure_ascii=False).encode()
    ).hexdigest()
    connection.idempotency.lock(scope, key)
    previous = connection.idempotency.previous(scope, key)
    if previous:
        if previous["request_hash"] != request_hash:
            raise conflict(
                "IDEMPOTENCY_KEY_REUSED",
                "같은 키에 다른 요청 본문을 사용할 수 없습니다.",
            )
        return previous["response_status"], previous["response_body"], True
    status, response = work()
    connection.idempotency.save(scope, key, request_hash, status, response)
    return status, response, False
