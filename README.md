# FESTAI

지역축제의 방문객 안내, 현장 운영, ESG 성과 관리를 연결하는 AI·ESG 플랫폼입니다. 방문객 웹·운영자 콘솔·참여업체 콘솔과 API를 하나의 저장소에서 관리합니다.

## 아키텍처

![FESTAI 시스템 아키텍처](docs/assets/architecture.svg)

화살표는 주요 실행 흐름을 나타냅니다. 구현 세부 규칙은 [구현 계획](plan.md#구현-구조)을 참고합니다.

## 기술 스택

주요 구성과 의존성의 기준 파일은 다음과 같습니다.

| 영역 | 구성 | 의존성 |
| --- | --- | --- |
| 백엔드 | Python · FastAPI · PostgreSQL · Psycopg · PyJWT | [pyproject.toml](backend/pyproject.toml) |
| 프론트엔드 | Next.js · React · TypeScript · TanStack Query · Tailwind CSS · shadcn | [package.json](frontend/package.json) |
| 음성 런타임 | CosyVoice 3 · PyTorch · SoundFile | [requirements.txt](backend/voice/requirements.txt) |

외부 서비스 설정은 [프론트엔드 연동](#외부-서비스-연결)과 [음성 런타임](#음성-런타임), 배포는 [배포 가이드](docs/deploy.md)를 참고합니다.

## 시작하기

1. [백엔드 시작하기](#백엔드-시작하기): PostgreSQL·마이그레이션·시드·API 실행.
2. [프론트엔드 시작하기](#프론트엔드-시작하기): 의존성·환경 변수 설정·개발 서버 실행.
3. [로컬 웹](http://localhost:3000)과 [API 문서](http://localhost:8000/docs)를 엽니다.

## 사용 방법

| 대상 | 화면 | 주요 기능 |
| --- | --- | --- |
| 공통 | `/` | 랜딩 페이지 |
| 방문객 | `/visitor` | AI·음성 안내, 예약·대기표, 쿠폰·리워드·설문 |
| 운영자 | `/admin` | 콘텐츠 검수, 현장 운영, 참여업체 심사, ESG·감사 로그 |
| 참여업체 | `/merchant` | 부스·메뉴·쿠폰 관리 |
| 초대 수락 | `/merchant-invite` | 참여업체 가입 |

로그인은 [데모 계정](#데모-계정과-시드)을 참고합니다. [방문객](docs/assets/VisitorWeb/)·[운영자](docs/assets/AdminConsole/)·[참여업체](docs/assets/Merchant/) 화면 이미지는 로컬 데모 데이터로 촬영했습니다.

## 테스트

실행 환경별로 [백엔드](#백엔드-테스트)·[프론트엔드](#프론트엔드-테스트)·[음성 런타임](#음성-런타임-테스트)을 검증합니다. 검증 범위는 [구현 계획](plan.md#검증-전략)에서 관리합니다.

## 백엔드

방문객 QR 모바일 웹·운영자 콘솔·참여업체 콘솔이 사용하는 REST API 서버입니다.

플로깅·다회용기 기록과 포인트는 서버에 저장합니다. 방문객 화면의 서버 발급 QR 코드를 운영자가 스캔해 처리하며, 기존 브라우저 데모 기록은 자동 이관·적립하지 않습니다.

### 백엔드 시작하기

#### 사전 요구사항

- Python 3.12 이상
- Docker

#### 설치 및 실행

`backend` 디렉터리에서 실행합니다.

```bash
cp .env.example .env
docker compose up -d postgres
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/python -m scripts.migrate
.venv/bin/python -m scripts.seed
.venv/bin/uvicorn app.main:app --reload
# 별도 터미널에서 보고서·개인정보 파기 워커 실행
.venv/bin/python -m scripts.worker
```

#### 환경 변수

설정 항목과 예시는 [.env.example](backend/.env.example)을 참고합니다. 배포 환경 설정은 [배포 가이드](docs/deploy.md)를 따릅니다.

코드의 기본값과 검증 조건은 [설정 코드](backend/app/infrastructure/config.py)에서 확인합니다.

### 백엔드 사용 방법

#### API 접속

- API: `http://localhost:8000/api/v1`
- Swagger UI: `http://localhost:8000/docs`
- OpenAPI: `http://localhost:8000/openapi.json`
- Liveness: `http://localhost:8000/health/live`
- Readiness: `http://localhost:8000/health/ready` (DB 연결까지 확인)

#### 데모 계정과 시드

데모 계정의 비밀번호는 모두 `ChangeMe123!`입니다.

| 역할 | 이메일 |
| --- | --- |
| 최고 관리자 | `admin@example.com` |
| 축제 담당자 | `manager@example.com` |
| 검토 담당자 | `reviewer@example.com` |
| 현장 운영자 | `operator@example.com` |
| 참여 상인 | `merchant@example.com` |

`scripts.seed`는 조직·운영자·상인 5명, `EST34-2026` 축제, 구역·시설, 게시 프로그램, 설문, 운영 티켓, E·S·G 승인 실적과 참여업체·쿠폰·혼잡·리워드·운영 문서를 중복 없이 생성합니다. 데모 데이터를 더 채울 때는 다음을 씁니다.

```bash
.venv/bin/python -m scripts.jeju_esg_2026          # 드라이런(롤백), --apply로 커밋
psql "$DATABASE_URL" -f scripts/est34_2026_demo_enrichment.sql   # EST34-2026 운영 데이터 보강
psql "$DATABASE_URL" -f scripts/allen_demo_data.sql              # ALLEN-DEMO-2026 샌드박스 축제
```

시드와 위 계정은 로컬 및 데모 환경 전용입니다. 실제 운영 환경에서는 시드를 실행하지 말고 강한 `JWT_SECRET`과 별도 계정 정책을 사용해야 합니다. 시드를 다시 실행하면 데모 계정 비밀번호가 위 기본값으로 갱신됩니다.

엔드포인트별 요청·응답은 실행 중인 서버의 Swagger UI에서 확인합니다. 보고서 출력 제약은 [구현 계획](plan.md#리스크-및-미결정)을 참고합니다.

### 백엔드 테스트

`backend` 디렉터리에서 실행합니다.

```bash
.venv/bin/python -m pytest -q
.venv/bin/python -m compileall -q app scripts tests
API_URL=http://127.0.0.1:8000/api/v1 .venv/bin/python -m scripts.smoke
```

테스트에는 전용 로컬 PostgreSQL이 필요합니다. `DATABASE_URL`을 테스트 DB로 지정하세요. API 픽스처가 마이그레이션·시드를 적용하고, 잡 테스트는 별도 워커의 처리 단계를 명시적으로 실행하므로 테스트 중 워커를 함께 띄우지 않습니다. DB 연결 실패로 건너뛴 테스트는 통과로 보지 않습니다. `scripts.smoke`에는 실행 중인 API 서버도 필요합니다.

테스트와 스모크는 시드·업무 데이터를 생성하므로 로컬 또는 전용 데모 환경에서만 실행합니다. 검증 범위는 [검증 전략](plan.md#검증-전략), 상세 케이스는 [tests](backend/tests/)를 참고합니다.

## 프론트엔드

방문객 QR 모바일 웹·운영자 콘솔·참여업체 콘솔을 제공하는 Next.js 앱입니다.

### 프론트엔드 시작하기

#### 사전 요구사항

- Node.js 20 이상, npm
- [백엔드 시작하기](#백엔드-시작하기)에 따라 마이그레이션·시드를 적용하고 실행한 API 서버

#### 설치 및 실행

`frontend` 디렉터리에서 실행합니다.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

브라우저에서 [로컬 앱](http://localhost:3000)을 엽니다.

#### 환경 변수

설정 항목과 예시는 [.env.example](frontend/.env.example)을 참고합니다. 배포 환경 설정은 [배포 가이드](docs/deploy.md)를 따릅니다.

`BACKEND_URL`에는 `/api/v1`을 붙이지 않습니다. `NEXT_PUBLIC_` 접두사가 없는 값은 Next 서버에서만 읽습니다.

### 프론트엔드 사용 방법

#### 화면 접속

역할별 화면 경로와 주요 기능은 [프로젝트 사용 방법](#사용-방법)을 참고합니다.

운영자·상인 로그인 정보는 [데모 계정](#데모-계정과-시드)을 참고합니다.
전체 화면 경로는 [src/app](frontend/src/app/)에서 확인합니다.

#### 다국어 사전 재생성

UI 문구의 원본은 `src/shared/lib/i18n/dictionaries/ko.ts` 하나입니다. `en/zh/ja`는 생성물이라
직접 고치지 말고 ko.ts를 고친 뒤 아래를 실행합니다.

```bash
GOOGLE_TRANSLATE_API_KEY=... npm run i18n
```

`npm test`가 ko.ts 해시를 대조하므로, 재생성을 잊으면 테스트가 먼저 깨집니다.

다국어는 **방문객 화면에만** 적용됩니다. 운영자 콘솔(`/admin`)과 참여업체 콘솔(`/merchant`)은
한국어 문구를 화면에 직접 씁니다 — 언어 전환은 방문객 화면의 표시 언어만 바꿉니다.

#### 외부 서비스 연결

Kakao 지도는 개발 주소를 Kakao Developers의 도메인에 등록해야 사용할 수 있습니다. 키가 없으면 좌표 목록을 표시합니다.
번역 API 키가 없으면 생성된 UI 사전만 사용하며 운영자가 작성한 콘텐츠는 원문으로 표시합니다.
LiveAvatar 테스트에서는 `LIVEAVATAR_SANDBOX=true`를 사용합니다.

원격 음성의 설치·연결은 [음성 런타임](#음성-런타임)를 따릅니다. 원격 합성 실패 시 브라우저 내장 음성으로 대체됩니다.

### 프론트엔드 테스트

`frontend` 디렉터리에서 실행합니다.

```bash
npm test
npm run lint
npm run build
```

테스트는 TypeScript 소스를 직접 트랜스파일하므로 사전 빌드가 필요하지 않습니다. 검사 항목은 [tests](frontend/tests/), 검증 전략은 [구현 계획](plan.md#검증-전략)을 참고합니다.

## 음성 런타임

AI 축제 안내 문장을 참조 음성 기반으로 합성하는 선택 음성 서비스입니다. 축제 API와 별도 프로세스로 실행합니다.

### 음성 런타임 시작하기

#### 사전 요구사항

- CosyVoice를 실행할 Python·PyTorch·GPU 환경
- CosyVoice 저장소, Fun-CosyVoice3-0.5B 모델 가중치, 참조 WAV 파일

CosyVoice 환경 준비는 [공식 설치 안내](https://github.com/FunAudioLLM/CosyVoice#install)를 따릅니다. 모델 저장소와 가중치는 이 저장소에 포함하지 않습니다.

#### 환경 변수

CosyVoice 의존성이 설치된 Python 환경을 활성화한 뒤 런타임을 실행할 셸에서 설정합니다. 아래는 Windows PowerShell 예시입니다.

```powershell
$env:COSYVOICE_REPO_PATH = "C:\models\CosyVoice"
$env:COSYVOICE_MODEL_PATH = "C:\models\Fun-CosyVoice3-0.5B"
$env:COSYVOICE_PROMPT_WAV = "C:\models\CosyVoice\asset\zero_shot_prompt.wav"
```

macOS·Linux 셸에서는 `export COSYVOICE_REPO_PATH=/path/to/CosyVoice`처럼 지정합니다.
참조 WAV 경로를 생략하면 CosyVoice 저장소의 `asset/zero_shot_prompt.wav`를 사용합니다.

#### 설치 및 실행

모노레포의 `backend/voice` 디렉터리에서 실행합니다.

```bash
python -m pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8100
```

### 음성 런타임 사용 방법

#### 프론트엔드 연결

모노레포의 `frontend/.env.local`에 설정하고 Next.js 서버를 다시 실행합니다.

```dotenv
NEXT_PUBLIC_VOICE_MODE=remote
VOICE_RUNTIME_URL=http://127.0.0.1:8100
```

`VOICE_RUNTIME_URL`은 Next.js 서버에서 접근할 주소입니다. 서로 다른 호스트에서 실행하면 해당 런타임 주소로 바꿉니다.
프론트엔드의 `/api/voice/synthesize` 프록시가 런타임을 호출합니다.

#### API

실행 중인 서버의 [Swagger UI](http://127.0.0.1:8100/docs)에서 합성을 요청할 수 있습니다. API 구현과 모델 로딩은 [server.py](backend/voice/server.py)에서 관리합니다.

### 음성 런타임 테스트

서버 실행 후 별도 터미널에서 상태를 확인합니다. Windows PowerShell에서는 `curl` 대신 `curl.exe`를 사용합니다.

```bash
curl http://127.0.0.1:8100/health
```

`ready: true`는 모델이 메모리에 로드되었음을 뜻합니다. 실제 음성 생성까지 확인하려면 Swagger UI에서 `POST /v1/speech/synthesize`에 안내 문장을 입력합니다. 모델·가중치 없이 상태 응답만 받는 것으로 합성 검증을 대신할 수는 없습니다.

## 관련 문서

- [요구사항](spec.md) · [구현 계획](plan.md) · [작업 지침](AGENTS.md)
- [배포 가이드](docs/deploy.md) · [음성 런타임](#음성-런타임)
- [핵심 기능](docs/assets/features.svg) · [시스템 아키텍처](#아키텍처)
- [화면 이미지 및 다이어그램](docs/assets/): `fest-ai/docs/assets/`에 모아두었습니다.

팀: [강덕현](https://github.com/duckduck-e)(프론트엔드) · [김나영](https://github.com/nadanaya)(백엔드) · [서하니](https://github.com/gksl3690)(기획) · [심주혜](https://github.com/juuhye)(프론트엔드) · [정상겸](https://github.com/ken-jeong)(풀스택).
