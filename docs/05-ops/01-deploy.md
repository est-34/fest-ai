# 배포 가이드 — FESTAI

[문서 안내](../../README.md#관련-문서) · [백엔드 시작하기](../../README.md#백엔드-시작하기) · [프론트엔드 시작하기](../../README.md#프론트엔드-시작하기) · [음성 런타임](../../README.md#음성-런타임-시작하기)

## 배포 순서

1. PostgreSQL 및 API 환경 변수 준비 → 2. API 마이그레이션 완료 및 `/health/ready` 확인 → 3. 동일 DB 연결 전용 워커 기동 → 4. 프론트엔드 API 주소 설정·배포 → 5. [배포 후 확인](#마이그레이션과-배포-후-확인) 점검.

## 백엔드

### Docker

`backend/`에서 `backend/Dockerfile`로 빌드하며 외부 PostgreSQL을 `DATABASE_URL`로 연결한다.

```bash
docker build -t festival-dx-backend .
docker run --rm -p 8000:8000 --env-file .env \
  -e DATABASE_URL=postgres://festival:festival@host.docker.internal:5432/festival \
  festival-dx-backend
```

### API와 워커

- 필수 설정([backend/.env.example](../../backend/.env.example)): `DATABASE_URL`, `JWT_SECRET`(운영 32자 이상), `ENVIRONMENT=production`(직결 배포 시 `TRUST_PROXY_HEADERS=false`). 운영 배포에서는 `scripts.seed`를 실행하지 않는다.
- [아키텍처](../../README.md#아키텍처)의 API와 워커(`python -m scripts.worker`, HTTP 헬스체크 미설정, SIGTERM/SIGINT 시 현재 트랜잭션 완료 후 종료)는 같은 이미지·DB·보존 기간 설정을 공유하며, API는 `RUN_INLINE_WORKER=false`를 유지한다(단일 프로세스 로컬 실행 시에만 `true`). 기동 순서는 [배포 순서](#배포-순서)를 따른다.

### 다중 프로세스와 DB 연결

다중 API 프로세스는 `WEB_CONCURRENCY`로 설정한다. 요청 제한(PostgreSQL 원자적 카운터)과 Alan reset+질문(트랜잭션 advisory lock)은 DB로 동기화하고, Alan 캐시·장애 차단기는 프로세스 로컬로 유지한다. DB 연결 예산은 `API 프로세스 수 × (업무 풀 최대 10 + AI 전용 최대 1) + 워커 풀`로 산정하며, PgBouncer는 `transaction` 또는 `session` 모드만 지원한다(`statement` 미지원).

### 마이그레이션과 배포 후 확인

전체 마이그레이션([011_architecture.sql](../../backend/db/migrations/011_architecture.sql) 포함) 적용 시 기존 방문객 세션에도 활동 연결 코드가 발급된다(인증 토큰이 아니며 조회는 세션 인증, 현장 처리는 운영자 역할·축제 범위 검사 수행; 구 브라우저 데모 기록은 미적립). 배포 후 플로깅 등록→원장 조회, 용기 대여→반납→1회 적립, 보고서 잡 완료와 `/docs`를 확인한다.

## 프론트엔드

`frontend/` 기준 로컬 프로덕션 실행은 `npm run build && npm run start`, Vercel 배포는 `npx vercel` 또는 GitHub 연동(Root Directory: `frontend`)을 사용한다.

```dotenv
BACKEND_URL=https://<API_HOST>
NEXT_PUBLIC_FESTIVAL_CODE=EST34-2026
```

지도·번역·아바타·원격 음성 키는 [frontend/.env.example](../../frontend/.env.example)을 참고하며 환경 변수 변경 후 재배포한다. 제약 및 후속 과제는 [남은 작업과 리스크](../03-tech/01-architecture.md#남은-작업과-리스크)를 따른다.
