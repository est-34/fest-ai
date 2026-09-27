"OPS-11 개인정보 동의·파기·열람과 VIS-11 식별자 재발급 판정.\n\n기능 명세서 OPS-11 본문의 '항목별 보유기간 정책표'를 코드의 단일 기준으로 옮긴 것이다.\n정책표를 화면과 파기 배치가 함께 읽어서, 안내 문구와 실제 파기 기준이 갈라지지 않게 한다.\n\n파기는 참조 데이터까지 연쇄로 지운다. 자식 테이블 목록을 손으로 적으면 새 테이블이 생길\n때마다 빠뜨리므로(예전 purge_expired가 실제로 그랬다) FK 카탈로그를 읽어 아래에서부터\n지운다. 보유기간이 더 긴 항목(설문 응답 1년, 업체 매출 1년)은 세션(30일)이 먼저 지워질 때\n연결만 끊어 익명 행으로 남긴다 — 연쇄 파기가 더 긴 보유기간을 앞당겨 버리면 안 된다.\n"

import uuid
from typing import Any

from app.modules.privacy.application.ports import UnitOfWork
from app.shared.application.context import ActionContext

CONSENT_ITEMS: list[dict[str, Any]] = [
    {
        "key": "identifier",
        "label": "방문객 익명 식별자",
        "featureId": "VIS-11",
        "withdrawable": False,
        "basis": "예약·쿠폰·포인트의 1인당 한도와 중복 발급을 판정하기 위해 필요합니다.",
        "retention": "축제 종료 후 30일",
    },
    {
        "key": "location",
        "label": "코스·상권 추천 위치",
        "featureId": "VIS-03·BIZ-03",
        "withdrawable": True,
        "basis": "현재 위치 주변의 코스와 참여업체를 추천하는 데만 사용합니다.",
        "retention": "추천 생성 즉시 파기(확인자료만 6개월 보관)",
    },
    {
        "key": "aiLog",
        "label": "AI 질의·응답 기록",
        "featureId": "AI-03",
        "withdrawable": True,
        "basis": "잘못된 답변 신고와 안전 검수에 사용합니다.",
        "retention": "90일",
    },
    {
        "key": "survey",
        "label": "설문 응답",
        "featureId": "VIS-10",
        "withdrawable": False,
        "basis": "익명으로 수집해 만족도 집계와 결과 보고서에 사용합니다.",
        "retention": "축제 종료 후 1년",
        "notice": "설문 응답은 제출 이후 응답자를 식별할 수 없어 열람·삭제 요구 대상에서 제외됩니다.",
    },
]
WITHDRAWABLE = {item["key"] for item in CONSENT_ITEMS if item["withdrawable"]}
RETENTION_POLICY: list[dict[str, str]] = [
    {
        "key": "AI_LOG",
        "label": "AI 질의·응답 로그",
        "featureId": "AI-03",
        "retention": "90일",
        "mode": "AUTO",
    },
    {
        "key": "SURVEY_RESPONSE",
        "label": "설문 응답",
        "featureId": "VIS-10",
        "retention": "축제 종료 후 1년",
        "mode": "AUTO",
    },
    {
        "key": "BUSINESS_SALES",
        "label": "업체 매출 데이터",
        "featureId": "BIZ-04",
        "retention": "축제 종료 후 1년(동의 철회 시 즉시)",
        "mode": "AUTO",
    },
    {
        "key": "VISITOR_SESSION",
        "label": "방문객 익명 식별자",
        "featureId": "VIS-11",
        "retention": "축제 종료 후 30일",
        "mode": "AUTO",
    },
    {
        "key": "LOCATION_RECORD",
        "label": "개인위치정보 확인자료",
        "featureId": "VIS-03·BIZ-03",
        "retention": "6개월",
        "mode": "AUTO",
    },
    {
        "key": "MERCHANT_ACCOUNT",
        "label": "상인 계정",
        "featureId": "BIZ-05",
        "retention": "비활성화 후 1년",
        "mode": "AUTO",
    },
    {
        "key": "BOOKING_CONTACT",
        "label": "예약 최소 연락정보",
        "featureId": "VIS-06",
        "retention": "해당 회차 종료 후 7일",
        "mode": "NOT_COLLECTED",
    },
    {
        "key": "KIOSK_CAMERA_FRAME",
        "label": "키오스크 얼굴 검출 프레임",
        "featureId": "KIOSK-A11Y-01·ESG-G-08",
        "retention": "기기 내 분석 직후 폐기(서버 미수집)",
        "mode": "NOT_COLLECTED",
    },
    {
        "key": "AUDIT_LOG",
        "label": "감사 로그",
        "featureId": "OPS-09",
        "retention": "2년",
        "mode": "MANUAL",
    },
]


def _children(connection: UnitOfWork, table: str) -> list[dict]:
    """table을 참조하는 (자식 테이블, FK 컬럼). 자기참조 FK는 제외한다."""
    return connection.privacy._children_pg_constraint((table,))


def _has_id(connection: UnitOfWork, table: str) -> bool:
    return bool(connection.privacy._has_id_information_schema((table,)))


def delete_rows(
    connection: UnitOfWork, table: str, ids: list, path: frozenset[str] = frozenset()
) -> int:
    """ids의 행과 이를 참조하는 모든 자식 행을 아래에서부터 지운다.

    path는 이미 지나온 테이블이다 — content_items↔content_versions처럼 서로를 참조하는
    쌍이 있어서 없으면 무한 재귀가 된다.
    """
    if not ids:
        return 0
    for child in _children(connection, table):
        child_table, column = (child["table_name"], child["column_name"])
        if child_table in path or child_table == table:
            continue
        if _has_id(connection, child_table):
            child_ids = [
                row["id"]
                for row in connection.privacy.delete_rows_query(
                    (ids,), child_table=child_table, column=column
                )
            ]
            delete_rows(connection, child_table, child_ids, path | {table})
        else:
            connection.privacy.delete_rows_query_2(
                (ids,), child_table=child_table, column=column
            )
    return connection.privacy.delete_rows_query_3((ids,), table=table)


def delete_ai_logs(connection: UnitOfWork, visitor_id) -> int:
    rows = connection.privacy.ai_logs_for_visitor(visitor_id)
    return delete_rows(connection, "ai_conversations", [row["id"] for row in rows])


ANONYMIZE_ON_SESSION_PURGE = ("survey_responses", "business_events")


def purge_sessions(
    connection: UnitOfWork, *, visitor_id=None, expired_days: int | None = None
) -> int:
    """방문 세션 파기. 더 긴 보유기간 항목의 연결을 먼저 끊고 나머지를 연쇄 파기한다."""
    ids = [
        row["id"]
        for row in connection.privacy.purge_sessions_visitor_sessions(
            visitor_id=visitor_id, expired_days=expired_days
        )
    ]
    if not ids:
        return 0
    for table in ANONYMIZE_ON_SESSION_PURGE:
        connection.privacy.purge_sessions_query((ids,), table=table)
    return delete_rows(connection, "visitor_sessions", ids)


def purge_personal_data(connection: UnitOfWork) -> dict[str, int]:
    """정책표에 따라 보유기간이 지난 개인정보를 파기하고 항목별 건수를 돌려준다."""
    counts: dict[str, int] = {}
    counts["AI_LOG"] = delete_rows(
        connection,
        "ai_conversations",
        [row["id"] for row in connection.privacy.expired_ai_logs()],
    )
    counts["SURVEY_RESPONSE"] = delete_rows(
        connection,
        "survey_responses",
        [row["id"] for row in connection.privacy.expired_survey_responses()],
    )
    counts["BUSINESS_SALES"] = connection.privacy.purge_personal_data_business_events()
    counts["VISITOR_SESSION"] = purge_sessions(connection)
    counts["LOCATION_RECORD"] = (
        connection.privacy.purge_personal_data_business_recommendation_events(
            (connection.policy.recommendation_event_retention_days,)
        )
    )
    counts["MERCHANT_ACCOUNT"] = connection.privacy.purge_personal_data_users()
    if any(counts.values()):
        connection.audit.audit(
            festival_id=None,
            actor_id=None,
            action="PURGE",
            resource_type="PERSONAL_DATA",
            resource_id=None,
            request_id=f"job_{uuid.uuid4()}",
            after_data=counts,
        )
    return counts


def record_identity(
    connection: UnitOfWork, festival_id, session_id, context: ActionContext
) -> dict:
    """세션 발급을 기기 버킷 단위로 기록한다. 같은 버킷의 두 번째부터는 재발급으로 본다."""
    key = context.device_key
    prior = connection.privacy.record_identity_visitor_identity_events(
        (festival_id, key)
    )["count"]
    event_type = "REISSUED" if prior else "ISSUED"
    connection.privacy.record_identity_visitor_identity_events_2(
        (festival_id, session_id, key, event_type, prior)
    )
    return {"eventType": event_type, "priorSessionCount": prior}
