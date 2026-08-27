# 기술 구조 및 설계 — FESTAI

[요구사항](../01-func/01-requirements.md) · [디자인 기준](../02-uxui/01-design.md) · [테스트 명세](../04-test/01-verification.md) · [README](../../README.md)

## 아키텍처와 경계

실행 흐름은 [아키텍처 그림](../../README.md#아키텍처)을 기준으로 한다.

### 아키텍처 결정

- 백엔드는 7개 업무 모듈의 단일 배포 모듈러 모놀리스·헥사고날 구조이며 API와 워커가 같은 코드·DB를 공유한다.
- 입력 어댑터(HTTP·워커) → 유스케이스 → 도메인·출력 포트(`Protocol`) 방향으로만 의존하며, PostgreSQL·AI·토큰·내보내기 어댑터는 `bootstrap.py`에서 조립한다. 프론트엔드 FSD 구조와 선택 음성 런타임은 유지한다.

### 모듈 경계와 의존성

| 모듈 | 담당 업무 | 참조 허용 모듈 |
| --- | --- | --- |
| `identity` | 로그인·토큰·초대 수락 | 없음 |
| `festival` | 축제·구역·프로그램·공개 조회·콘텐츠 게시 | `privacy` |
| `engagement` | 방문 세션·안내·예약·쿠폰·리워드·활동 | `festival`, `privacy` |
| `commerce` | 업체·상인 | `engagement`, `festival` |
| `operations` | 현장 운영·운영 문서·인사이트 | `festival`, `privacy` |
| `esg` | 지표·보고서 | `privacy` |
| `privacy` | 동의 정책·파기 | 없음 |

- 모듈 간 호출은 `api.py`의 명시적 export로 제한하며 타 모듈 저장소 직접 import와 이벤트 버스 도입을 금지한다(읽기 조인·원자적 교차 SQL은 소유 모듈 저장소에 배치).
- HTTP 어댑터가 요청 검증·권한·응답 변환을 맡고 유스케이스에는 프레임워크 객체를 전달하지 않는다. 경계 검증은 [아키텍처 경계 검증](../04-test/01-verification.md#아키텍처-경계-검증)을 따른다.

### 트랜잭션과 외부 호출

- 프로세스 간 요청 제한은 PostgreSQL 원자적 카운터로, Alan reset+질문은 전용 연결 advisory lock으로 조정한다(AI 연결 풀은 업무 풀과 분리하고 대기 한도 부여).
- 외부 AI 호출은 조회 트랜잭션 종료 후 실행하며 결과 저장 시 세션·권한을 재검증한다. 공통 감사·수정은 `shared/application`에서 관리한다.
- 플로깅·다회용기 API는 서버 발급 QR 코드로 세션을 조회하고 축제·역할·멱등성·반납 중복을 검사한다(프론트는 TanStack Query로 서버 기록만 조회).

### 조회와 UI 공유

- 공개 축제·ESG·예약·내보내기 잡의 원본 쿼리는 공유하고 SQL 조립은 PostgreSQL 어댑터가 맡으며, 화면별 변환·갱신 주기·오류 대체는 소비자가 유지한다. 프론트는 쿠폰 폼·활동 안내·방문객 QR UI만 공유한다.

## 소스 구조

- 배치: 프론트 `frontend/src/{app,widgets,features,entities,shared}`(엔티티는 단일 파일, 기능은 다중 파일일 때만 폴더, 다국어 사전 커밋), 백엔드 `backend/app/modules/<업무>/{application,adapters/{http,postgres},domain.py}`, 공통 `backend/app/shared/`, 인프라 `backend/app/infrastructure/`, 진입점 `main.py`(요청 추적·오류 변환·레이트 리밋), 음성 `backend/voice/`.
- DB 무결성은 단방향 마이그레이션과 CHECK·트리거로 보강한다.
- 실행·배포 안내: [백엔드](../../README.md#백엔드-시작하기) · [프론트엔드](../../README.md#프론트엔드-시작하기) · [음성 런타임](../../README.md#음성-런타임-시작하기) · [배포 가이드](../05-ops/01-deploy.md#api와-워커)

## 남은 작업과 리스크

### 단계별 계획

1. 아래 리스크의 해결 방식·제공자를 확정한다.
2. [현재 제외 기능](../01-func/01-requirements.md#범위) 확대 시 요구사항·완료 기준을 먼저 정의한다.

| 항목 | 현재 제약·대기 이유 | 재개 조건·작업 |
| --- | --- | --- |
| PDF 한글 출력 | 표준 14폰트 한글 손실을 DOCX·`textLossWarning`으로 안내 | 한글 폰트 임베딩 보완 후 출력 검증 |
| 증빙 파일 | 저장소·악성코드 검사 제공자 미확정 | 제공자·범위 확정 후 요구사항·연동 설계 정의 |
