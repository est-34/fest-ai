"""HTTP와 독립적인 서비스 처리 결과. JSON 변환은 views가 담당한다."""

from dataclasses import dataclass
from typing import Any


class Raw(dict):
    """설문 보기처럼 키가 사용자 데이터인 사전."""


@dataclass
class Result:
    data: Any = None
    page: dict | None = None
    status_code: int | None = None
    cache_seconds: int | None = None
    replayed: bool = False

    @classmethod
    def from_idempotent(cls, result):
        status, data, replayed = result
        return cls(data=data, status_code=status, replayed=replayed)
