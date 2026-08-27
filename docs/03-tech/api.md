# REST API 명세 — FESTAI

[기능 명세](../01-func/01-requirements.md) · [테스트 명세](../04-test/01-verification.md)

## HTTP 계약

- 라우팅 오류(404·405)를 포함한 모든 오류는 공통 `error`·`meta` 형식을 따르며 405 `Allow` 등 프로토콜 헤더를 보존한다. 401은 Bearer 인증을 안내하고 인증·개인 데이터 응답은 캐시하지 않는다.

## 진입점과 원본

- 기본 경로: `/api/v1`, Scalar: `/docs`, OpenAPI: `/openapi.json`, 수동 호출: [Bruno 컬렉션](../../backend/bruno).
- 원본: [앱 진입점](../../backend/app/main.py) · [업무 모듈](../../backend/app/modules)(`adapters/http/`) · [공통 입력 모델](../../backend/app/shared/application/schemas.py) · [HTTP 의존성](../../backend/app/shared/adapters/http/deps.py) · [인증 구현](../../backend/app/infrastructure/security.py)

## 요청과 응답

- 운영 사용자 인증과 익명 방문 세션 인증을 분리하고 라우트별 역할·축제 범위를 검사한다.
- 쓰기 경로의 `Idempotency-Key`·`If-Match` 적용은 HTTP 어댑터가 정의하며, 재생된 멱등 요청은 `Idempotency-Replayed` 헤더로 표시한다.
- [응답 변환](../../backend/app/shared/adapters/http/views.py) 성공 형식은 camelCase 키의 `{data, page?, meta}`(204·파일 내보내기 제외)이며, 오류는 `{error: {code, message, details, retryable}, meta: {requestId, serverTime}}`(입력 검증 오류는 400)이다.

## 선택 음성 런타임 API

별도 프로세스([server.py](../../backend/voice/server.py), 자체 `/docs`·`/openapi.json` 제공, `/api/v1` 미사용; 실행·검증: [음성 런타임](../../README.md#음성-런타임-시작하기) · [테스트 안내](../../README.md#음성-런타임-테스트)).

| 요청 | 입력·응답 |
| --- | --- |
| `GET /health` | 설정 상태·모델 준비 여부(`ready`)·캐시 크기 |
| `POST /v1/speech/synthesize` | `text`(1~2,000자), `language`(기본 `ko-KR`), `provider`(기본 `cosyvoice3`) → `audioBase64`, `mimeType: audio/wav`, `provider` |

미지원 provider는 501, 합성 실패는 503이며 FastAPI 기본 `{detail}` 형식을 사용한다.
