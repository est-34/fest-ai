from datetime import UTC, datetime

from app.modules.engagement.application.ports import UnitOfWork
from app.modules.engagement.domain import select_course
from app.modules.privacy.api import (
    CONSENT_ITEMS,
    RETENTION_POLICY,
    WITHDRAWABLE,
    delete_ai_logs,
)
from app.shared.application.results import Result
from app.shared.application.schemas import (
    ComplaintIn,
    ConsentPatch,
    ConversationIn,
    CoursePlanIn,
    KioskAssistEventIn,
    MessageIn,
    PrivacyRequestIn,
    ReportMessageIn,
    SurveyResponseIn,
    VisitorAreaIn,
    VisitorPreferencesPatch,
)
from app.shared.application.values import JsonValue
from app.shared.domain.domain import (
    classify_issue,
    is_safe_question,
    search_terms,
    supported_language,
)
from app.shared.domain.errors import (
    DuplicateKey,
    bad_request,
    conflict,
    found,
    unauthorized,
)
from app.shared.domain.preprocessing import build_festival_context

AREA_VALID_HOURS = 2


def owned_conversation(
    connection: UnitOfWork, conversation_id: str, visitor_id
) -> None:
    found(
        connection.visitor.owned_conversation_select_ai_conversations(
            (conversation_id, visitor_id)
        ),
        "대화를 찾을 수 없습니다.",
    )


def session_area(connection: UnitOfWork, visitor_id) -> dict:
    return connection.visitor.session_area_select_festival_areas(
        (visitor_id,), valid_hours=AREA_VALID_HOURS
    )


def end_session(visitor: dict, connection: UnitOfWork) -> Result:
    connection.visitor.end_session_update_visitor_sessions((visitor["id"],))
    return Result(status_code=204)


def current_area(visitor: dict, connection: UnitOfWork):
    """VIS-12 현재 구역. 판정하지 못한 상태를 정상으로 보고 전체 대상 콘텐츠로 폴백한다."""
    return Result(
        {**session_area(connection, visitor["id"]), "validHours": AREA_VALID_HOURS}
    )


def set_area(
    body: VisitorAreaIn,
    visitor: dict,
    connection: UnitOfWork,
):
    """진입 QR 지점 또는 방문객의 수동 선택으로 구역을 판정한다. 브라우저 위치정보는 쓰지 않는다."""
    if body.area_id and (
        not connection.common.active_area((body.area_id, visitor["festival_id"]))
    ):
        raise bad_request("AREA_SCOPE_MISMATCH", "이 축제의 구역이 아닙니다.")
    connection.visitor.set_area_update_visitor_sessions(
        {
            "area_id": body.area_id,
            "area_source": body.source if body.area_id else None,
            "visitor_id": visitor["id"],
        },
    )
    return Result(
        {**session_area(connection, visitor["id"]), "validHours": AREA_VALID_HOURS}
    )


def update_preferences(
    body: VisitorPreferencesPatch,
    visitor: dict,
    connection: UnitOfWork,
):
    festival = connection.visitor.update_preferences_select_festivals(
        (visitor["festival_id"],)
    )
    language = supported_language(
        body.language or visitor["language"],
        festival["supported_languages"],
        festival["default_language"],
    )
    row = connection.visitor.update_preferences_update_visitor_sessions(
        (
            language,
            JsonValue(body.accessibility_preferences)
            if body.accessibility_preferences is not None
            else None,
            visitor["id"],
        ),
    )
    return Result(row)


def visitor_announcements(visitor: dict, connection: UnitOfWork):
    """VIS-07 구역 대상 공지 선별 + OPS-10 세션별 노출 기록.

    공개 목록(`/public/.../announcements`)은 세션이 없어 구역을 알 수 없으므로 전체 공지만
    낼 수 있다. 여기서는 VIS-12 판정 결과로 targetAreaIds를 선별하고, 응답에 실제로 실린
    공지를 세션별로 남겨 운영자가 도달 결과를 확인할 수 있게 한다.

    구역을 판정하지 못한 세션에는 전체 대상 공지만 노출한다. 다만 안전 관련 긴급 공지는
    구역 판정 여부와 무관하게 전달한다(VIS-12 규칙).
    """
    area = session_area(connection, visitor["id"])
    rows = connection.visitor.visitor_announcements_select_announcements(
        {
            "festival_id": visitor["festival_id"],
            "area_id": str(area["area_id"]) if area["area_id"] else None,
        },
    )
    connection.notifications.deliveries(
        visitor["festival_id"],
        "ANNOUNCEMENT",
        [row["id"] for row in rows],
        visitor["id"],
    )
    return Result(
        {
            "items": rows,
            "area": area,
            "channel": {
                "type": "WEB_POLL",
                "pollSeconds": 30,
                "limitation": "이 화면을 열어 둔 동안에만 새 공지가 도착합니다. 화면을 닫거나 다른 앱을 쓰는 동안에는 알림이 도달하지 않으므로, 긴급 상황은 현장 방송과 안내 인력 안내를 함께 확인해 주세요.",
            },
        }
    )


def kiosk_assist_event(
    body: KioskAssistEventIn, visitor: dict, connection: UnitOfWork
) -> Result:
    """KIOSK-A11Y-01 익명 효과 지표.

    방문 세션 토큰으로 축제만 확인하고 세션 자체는 저장하지 않는다 — 어떤 세션이 고령으로
    추정됐는지가 남으면 "수집하지 않는다"는 ESG-G-08 규칙이 사실상 깨진다. 남는 것은
    축제·이벤트 종류·모델 버전·시각뿐이라, 지표는 건수 비율로만 계산된다.

    카메라 제안이 꺼진 축제에서도 MANUAL_LARGE_TEXT는 기록한다 — 중지 스위치를 내린 뒤
    수동 전환만으로 접근성 이용이 유지되는지 확인해야 하기 때문이다(ESG-G-08 완료 기준).
    """
    connection.visitor.kiosk_assist_event_insert_kiosk_assist_events(
        (visitor["festival_id"], body.event_type, body.model_version, body.result),
    )
    return Result(status_code=204)


def privacy_notice(visitor: dict, connection: UnitOfWork):
    """OPS-11 항목별 수집 근거·보유기간과 현재 동의 상태."""
    session = connection.visitor.session_consents((visitor["id"],))
    return Result(
        {
            "items": CONSENT_ITEMS,
            "consents": session["consents"],
            "retentionPolicy": RETENTION_POLICY,
        }
    )


def update_consents(
    body: ConsentPatch,
    visitor: dict,
    connection: UnitOfWork,
):
    """항목별 동의·철회. 필수 항목은 철회 대상이 아니고, 철회는 즉시 해당 데이터에 반영된다."""
    unknown = set(body.consents) - {item["key"] for item in CONSENT_ITEMS}
    if unknown:
        raise bad_request(
            "UNKNOWN_CONSENT_ITEM",
            f"정의되지 않은 수집 항목입니다: {', '.join(sorted(unknown))}",
        )
    locked = {
        key
        for key, granted in body.consents.items()
        if not granted and key not in WITHDRAWABLE
    }
    if locked:
        raise bad_request(
            "CONSENT_REQUIRED",
            "서비스 제공에 필요한 항목은 철회할 수 없습니다. 이용을 중단하려면 방문 세션을 종료해 주세요.",
        )
    row = connection.visitor.update_consents_update_visitor_sessions(
        (JsonValue(body.consents), visitor["id"])
    )
    purged = {}
    if body.consents.get("aiLog") is False:
        purged["aiLog"] = delete_ai_logs(connection, visitor["id"])
    return Result({"consents": row["consents"], "purged": purged})


def my_privacy_requests(visitor: dict, connection: UnitOfWork):
    return Result(
        connection.visitor.my_privacy_requests_select_privacy_requests((visitor["id"],))
    )


def create_privacy_request(
    body: PrivacyRequestIn,
    visitor: dict,
    connection: UnitOfWork,
):
    """열람·삭제 요구 접수.

    로그인 수단이 없으므로 본인확인은 요청에 실린 VIS-11 식별자(방문 세션 토큰)로 갈음한다.
    익명 설문 응답은 제출 이후 응답자를 특정할 수 없어 대상에서 제외된다(수집 화면에 사전 고지).
    """
    if connection.visitor.create_privacy_request_select_privacy_requests(
        (visitor["id"], body.request_type)
    ):
        raise conflict("DUPLICATE_ACTION", "같은 유형의 요구가 이미 처리 중입니다.")
    row = connection.visitor.create_privacy_request_insert_privacy_requests_2(
        (visitor["festival_id"], visitor["id"], body.request_type, body.detail),
    )
    return Result(
        {**row, "excluded": ["설문 응답(익명 처리되어 응답자를 특정할 수 없습니다)"]}
    )


def submit_survey(
    survey_id: str,
    body: SurveyResponseIn,
    visitor: dict,
    connection: UnitOfWork,
):
    survey = found(
        connection.visitor.submit_survey_select_surveys(
            (survey_id, visitor["festival_id"])
        ),
        "참여 가능한 설문을 찾을 수 없습니다.",
    )
    questions = connection.visitor.submit_survey_select_survey_questions((survey_id,))
    allowed = {str(question["id"]) for question in questions}
    submitted = {answer.question_id for answer in body.answers}
    if not submitted <= allowed:
        raise bad_request(
            "INVALID_QUESTION", "설문에 속하지 않은 질문이 포함되어 있습니다."
        )
    if any(
        (
            question["required"] and str(question["id"]) not in submitted
            for question in questions
        )
    ):
        raise bad_request("REQUIRED_ANSWER_MISSING", "필수 질문에 답변해 주세요.")
    try:
        row = connection.visitor.submit_survey_insert_survey_responses(
            (survey_id, visitor["id"] if survey["prevent_duplicates"] else None),
        )
        for answer in body.answers:
            connection.visitor.submit_survey_insert_survey_answers(
                (row["id"], answer.question_id, JsonValue(answer.value))
            )
        return Result(row)
    except DuplicateKey as error:
        raise conflict("DUPLICATE_ACTION", "이미 이 설문에 응답했습니다.") from error


def submit_complaint(
    body: ComplaintIn,
    visitor: dict,
    connection: UnitOfWork,
):
    title = f"[{body.category}] {body.title}" if body.category else body.title
    analysis = classify_issue(f"{title} {body.description}")
    priority = "HIGH" if analysis["urgent"] else "NORMAL"
    row = connection.visitor.submit_complaint_insert_ops_tickets(
        (visitor["festival_id"], title, body.description, priority)
    )
    return Result(row)


def create_course_plan(
    body: CoursePlanIn,
    visitor: dict,
    connection: UnitOfWork,
):
    consents = connection.visitor.session_consents((visitor["id"],))["consents"]
    if consents.get("location") is False:
        body = body.model_copy(update={"area_id": None})
    required_accessibility = {
        key: True for key, value in body.accessibility.items() if value is True
    }
    sessions = connection.visitor.create_course_plan_select_program_sessions(
        visitor["festival_id"],
        body.starts_at or datetime.now(UTC),
        body.excluded_program_ids,
        interests=body.interests,
        area_id=body.area_id,
        accessibility=required_accessibility,
    )
    selected = found(
        select_course(sessions, body.duration_min, body.starts_at),
        "조건에 맞는 운영 중 프로그램을 찾을 수 없습니다.",
    )
    plan = connection.visitor.create_course_plan_insert_course_plans(
        (visitor["id"], JsonValue(body.model_dump()), body.duration_min)
    )
    items = []
    for sequence, session in enumerate(selected, 1):
        item = connection.visitor.create_course_plan_insert_course_items(
            (
                plan["id"],
                session["id"],
                sequence,
                f"{session['category']} 관심사와 운영 시간을 반영했습니다.",
            ),
        )
        items.append({**item, "program": session})
    return Result({**plan, "items": items})


def start_conversation(
    body: ConversationIn,
    visitor: dict,
    connection: UnitOfWork,
):
    if body.festival_code:
        festival = connection.visitor.start_conversation_select_festivals(
            (body.festival_code,)
        )
        if not festival or str(festival["id"]) != str(visitor["festival_id"]):
            raise bad_request(
                "FESTIVAL_SESSION_MISMATCH", "방문 세션과 축제가 일치하지 않습니다."
            )
    row = connection.visitor.start_conversation_insert_ai_conversations(
        (visitor["festival_id"], visitor["id"], body.language)
    )
    return Result(row)


def send_message(
    conversation_id: str,
    body: MessageIn,
    visitor: dict,
    connection: UnitOfWork,
):
    owned_conversation(connection, conversation_id, visitor["id"])
    if not is_safe_question(body.message):
        fallback = {"type": "HELP_DESK"}
        row = connection.visitor.send_message_insert_ai_messages(
            (
                conversation_id,
                body.message,
                "보안 또는 개인정보와 관련된 요청에는 답변할 수 없습니다.",
                JsonValue(fallback),
                JsonValue(body.context),
            ),
        )
        return Result(
            {
                "messageId": row["id"],
                "answer": row["answer"],
                "safetyStatus": "BLOCKED",
                "sources": [],
                "fallback": fallback,
                "externalAiUsed": False,
            }
        )
    patterns = [f"%{term}%" for term in search_terms(body.message)]
    sources = (
        connection.visitor.send_message_select_content_items(
            {"festival_id": visitor["festival_id"], "patterns": patterns}
        )
        if patterns
        else []
    )
    allowed = bool(sources)
    excerpts = [
        source["body"].get("summary")
        or source["body"].get("description")
        or source["body"].get("title")
        for source in sources
    ]
    festival_context = build_festival_context(
        connection.context.load_festival_context_rows(visitor["festival_id"])
    )
    with connection.external_io():
        generated = connection.ai.answer_with_festival_context(
            body.message, festival_context
        )
        freshness_at = festival_context["source_updated_at"]
        if not generated and allowed:
            generated = connection.ai.grounded_answer(body.message, sources)
            freshness_at = sources[0]["updated_at"]
    # AI 응답 대기 중 종료/파기된 세션에는 새 메시지를 기록하지 않는다.
    if not connection.visitor.active_visitor((visitor["id"], visitor["festival_id"])):
        raise unauthorized(
            "TOKEN_EXPIRED", "방문 세션이 만료되었거나 유효하지 않습니다."
        )
    owned_conversation(connection, conversation_id, visitor["id"])
    if generated:
        answer = generated
        allowed = True
        fallback = None
    else:
        answer = (
            "\n\n".join(filter(None, excerpts))
            if allowed
            else "승인된 축제 정보에서 충분한 근거를 찾지 못했습니다."
        )
        fallback = (
            None
            if allowed
            else {
                "type": "HELP_DESK",
                "message": "현장 안내데스크 또는 공식 연락처를 이용해 주세요.",
            }
        )
        freshness_at = sources[0]["updated_at"] if sources else None
    row = connection.visitor.send_message_insert_ai_messages_2(
        (
            conversation_id,
            body.message,
            answer,
            "ALLOWED" if allowed else "INSUFFICIENT_GROUNDING",
            freshness_at,
            JsonValue(fallback) if fallback else None,
            JsonValue(body.context),
        ),
    )
    response_sources = []
    for rank, source in enumerate(sources, 1):
        connection.visitor.send_message_insert_ai_message_sources(
            (row["id"], source["content_version_id"], rank)
        )
        response_sources.append(
            {
                "contentVersionId": source["content_version_id"],
                "title": source["body"].get("title") or source["slug"],
                "resourceType": source["content_type"],
                "resourceUrl": f"/public/festivals/{source['festival_code']}/programs/{source['slug']}"
                if source["resource_type"] == "PROGRAM"
                else f"/public/festivals/{source['festival_code']}",
                "rank": rank,
            }
        )
    return Result(
        {
            "messageId": row["id"],
            "answer": row["answer"],
            "safetyStatus": row["safety_status"],
            "freshnessAt": row["freshness_at"],
            "sources": response_sources,
            "fallback": fallback,
            "externalAiUsed": generated is not None,
        }
    )


def message_history(
    conversation_id: str,
    visitor: dict,
    connection: UnitOfWork,
):
    owned_conversation(connection, conversation_id, visitor["id"])
    rows = connection.visitor.message_history_select_ai_messages((conversation_id,))
    return Result(rows)


def report_message(
    message_id: str,
    body: ReportMessageIn,
    visitor: dict,
    connection: UnitOfWork,
):
    found(
        connection.visitor.report_message_select_ai_messages(
            (message_id, visitor["id"])
        ),
        "메시지를 찾을 수 없습니다.",
    )
    row = connection.visitor.report_message_insert_ai_message_reports(
        (message_id, visitor["id"], body.reason, body.detail)
    )
    return Result(row)
