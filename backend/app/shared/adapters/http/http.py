"""HTTP 입력을 서비스 요청 컨텍스트로 변환한다."""

from fastapi import Request

from app.infrastructure.config import settings
from app.shared.application.context import ActionContext


def client_ip(request: Request) -> str:
    """요청 출처 IP.

    프록시 뒤에서 request.client.host는 프록시 주소라 모든 방문자가 한 값을 공유한다
    (레이트 리밋 버킷 하나를 나눠 쓰면 보호도 안 되고 정상 사용자도 막힌다).
    TRUST_PROXY_HEADERS를 켠 배포에서만 X-Forwarded-For의 첫 항목을 쓴다 — 직결 배포에서
    무조건 신뢰하면 클라이언트가 헤더를 위조해 한도를 우회할 수 있다.
    """
    if settings.trust_proxy_headers:
        first = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def action_context(request: Request) -> ActionContext:
    from app.shared.domain.identity import device_key

    return ActionContext(
        request.state.request_id,
        request.headers.get("Accept-Language"),
        device_key(
            request.headers.get("User-Agent", ""),
            client_ip(request),
            settings.jwt_secret,
        ),
    )
