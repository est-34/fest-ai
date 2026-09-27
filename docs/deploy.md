# FESTAI 배포 가이드

백엔드·프론트엔드 배포 절차를 관리합니다. 로컬 개발 환경은 [백엔드 시작하기](../README.md#백엔드-시작하기)와 [프론트엔드 시작하기](../README.md#프론트엔드-시작하기), 선택 음성 서비스는 [음성 런타임](../README.md#음성-런타임)을 따릅니다.

## 배포 순서

1. PostgreSQL과 API 환경 변수를 준비합니다.
2. API 배포에서 마이그레이션을 완료하고 `/health/ready`를 확인합니다.
3. 같은 DB에 연결하는 전용 워커를 시작합니다.
4. API 주소를 프론트엔드에 설정하고 배포합니다.
5. [배포 후 확인](#마이그레이션과-배포-후-확인)의 업무 흐름을 점검합니다.

## 백엔드

모노레포의 `backend`에서 실행합니다. 아래 Docker 예시는 로컬 기동 확인용입니다.

### Docker

애플리케이션 이미지는 `backend/Dockerfile`로 빌드합니다. PostgreSQL은 별도로 실행되어 있어야 하며 `DATABASE_URL`로 연결합니다.

```bash
docker build -t festival-dx-backend .
docker run --rm -p 8000:8000 --env-file .env \
  -e DATABASE_URL=postgres://festival:festival@host.docker.internal:5432/festival \
  festival-dx-backend
```

위 예시는 호스트에서 `docker compose up -d postgres`로 실행한 로컬 데이터베이스에 연결합니다.

### API와 워커

백엔드 서비스에 `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT=production`을 설정합니다. 운영 환경의 `JWT_SECRET`은 32자 이상이어야 합니다. 나머지 설정은 [백엔드 설정 예시](../backend/.env.example)를 참고합니다.

[아키텍처](../README.md#아키텍처)의 API·워커 배포에는 같은 이미지를 사용합니다. 워커는 `python -m scripts.worker`로 시작하며 HTTP 헬스체크는 설정하지 않습니다. 두 서비스는 같은 `DATABASE_URL`, `JWT_SECRET`, `ENVIRONMENT`와 보존 기간 설정을 사용하고, API의 `RUN_INLINE_WORKER=false`를 유지합니다. API 배포 전에 마이그레이션을 적용하고 `/health/ready`를 확인한 후 워커를 시작합니다. 실행 명령은 [백엔드 시작하기](../README.md#백엔드-시작하기)를 따릅니다. 워커가 없으면 비동기 보고서와 개인정보 파기가 실행되지 않습니다.

운영 배포에서는 `scripts.seed`를 실행하지 않습니다. 데모 데이터를 넣을 때만 대상 환경을 확인한 후 별도로 실행합니다. 배포한 서비스의 `/docs`에서 API 문서를 확인합니다.

로컬에서 한 프로세스로만 실행할 때는 `RUN_INLINE_WORKER=true`를 명시할 수 있습니다. 워커는 SIGTERM/SIGINT를 받으면 새 잡을 집지 않고 현재 트랜잭션을 마친 후 종료합니다.

### 다중 프로세스와 DB 연결

다중 API 프로세스는 `WEB_CONCURRENCY`로 설정합니다. 요청 제한은 PostgreSQL 원자적 카운터를 공유하고, Alan의 reset+질문은 같은 DB의 트랜잭션 advisory lock으로 직렬화합니다. AI 호출은 프로세스당 최대 1개의 별도 DB 연결을 사용하므로, DB 연결 예산은 API 프로세스당 업무 풀 최대 10개 + AI 연결 최대 1개 및 워커 풀을 합산합니다. PgBouncer는 transaction 또는 session 모드를 사용합니다(statement 모드는 지원하지 않습니다). Alan 캐시·장애 차단기는 성능 최적화용 프로세스 로컬 상태로 유지합니다.

### 마이그레이션과 배포 후 확인

활동 연결용 코드는 [011_architecture.sql](../backend/db/migrations/011_architecture.sql) 마이그레이션으로 추가됩니다. 배포 시 이 파일을 포함한 전체 마이그레이션을 적용합니다. 기존 방문객 세션에도 활동 연결용 코드가 발급됩니다. 이 코드는 인증 토큰이 아니며, 방문객 조회는 세션 인증, 현장 처리는 운영자 역할과 축제 범위 검사를 거칩니다. 브라우저 데모 기록은 신뢰할 수 있는 운영자·원장 이력이 없어 자동 적립하지 않습니다. 배포 후 플로깅 등록 → 방문객 원장 조회, 용기 대여 → 반납 → 포인트 1회 적립, 보고서 잡 완료를 확인합니다.

직결 배포에서는 `TRUST_PROXY_HEADERS=false`로 설정합니다.

## 프론트엔드

모노레포의 `frontend`에서 실행합니다.

프로덕션 빌드를 로컬에서 실행하려면 다음을 사용합니다.

```bash
npm run build
npm run start
```

Vercel CLI로 배포하려면 실행합니다.

```bash
npx vercel
```

또는 GitHub 저장소를 Vercel에 연결하면 자동 배포됩니다. Vercel 프로젝트의 Root Directory를 `frontend`로 설정하고 최소한 다음 환경 변수를 설정합니다.

```dotenv
BACKEND_URL=https://<API_HOST>
NEXT_PUBLIC_FESTIVAL_CODE=EST34-2026
```

`<API_HOST>`는 배포한 API 호스트로 바꿉니다. 지도·번역·아바타·원격 음성을 쓰려면 [프론트엔드 설정 예시](../frontend/.env.example)의 나머지 키도 함께 넣습니다. 환경변수를 변경한 뒤에는 새로 배포해야 합니다.

기능상 제약과 후속 과제는 [리스크 및 미결정](../plan.md#리스크-및-미결정)을 확인합니다.
