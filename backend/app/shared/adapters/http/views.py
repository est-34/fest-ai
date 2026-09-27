"""API 뷰: 결과를 기존 JSON envelope·상태 코드·캐시 헤더로 변환한다."""

import re
from datetime import UTC, datetime
from typing import Any

from fastapi import Request, Response

from app.shared.application.results import Raw, Result
from app.shared.application.schemas import camel

SNAKE_KEY = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$")


def camelize(value: Any) -> Any:
    """응답 본문의 키를 camelCase로 통일한다. 요청 본문은 pydantic alias가 이미 맡고 있다."""
    if isinstance(value, Raw):
        return value
    if isinstance(value, dict):
        return {
            (
                camel(key) if isinstance(key, str) and SNAKE_KEY.match(key) else key
            ): camelize(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [camelize(item) for item in value]
    return value


def meta(request: Request) -> dict:
    return {
        "requestId": request.state.request_id,
        "serverTime": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }


def success(request: Request, data: Any, *, page: dict | None = None) -> dict:
    response = {"data": camelize(data)}
    if page is not None:
        response["page"] = camelize(page)
    response["meta"] = meta(request)
    return response


def render(result: Result, request: Request, response: Response):
    if result.status_code == 204:
        return Response(status_code=204)
    if result.status_code is not None:
        response.status_code = result.status_code
    if result.cache_seconds is not None:
        seconds = result.cache_seconds
        response.headers["Cache-Control"] = (
            f"public, max-age={seconds}, stale-while-revalidate={seconds}"
        )
    if result.replayed:
        response.headers["Idempotency-Replayed"] = "true"
    return success(request, result.data, page=result.page)
