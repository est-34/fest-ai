from datetime import UTC, datetime

from app.modules.operations.application.ports import UnitOfWork
from app.modules.operations.domain import validate_ticket_transition
from app.modules.privacy.api import (
    CONSENT_ITEMS,
    RETENTION_POLICY,
    purge_personal_data,
    purge_sessions,
)
from app.shared.application.common import (
    created,
    in_festival,
    logged,
    patch_row,
    scoped,
)
from app.shared.application.context import ActionContext
from app.shared.application.pagination import cursor_params, paged
from app.shared.application.policy import PURGE_EVERY_TICKS
from app.shared.application.results import Raw, Result
from app.shared.application.schemas import (
    AnnouncementDraftIn,
    AnnouncementIn,
    AnnouncementPatch,
    CrowdSnapshotIn,
    GenericExportIn,
    IssueAnalysisPatch,
    KioskCameraPatch,
    MembershipIn,
    MembershipPatch,
    PrivacyRequestPatch,
    PublishAnnouncementIn,
    StaffAssignmentIn,
    SurveyIn,
    SurveyPatch,
    TicketIn,
    TicketPatch,
    TicketTransitionIn,
)
from app.shared.application.values import JsonValue
from app.shared.domain.domain import classify_issue
from app.shared.domain.errors import bad_request, conflict, forbidden, found


def publish_announcement_row(
    connection: UnitOfWork,
    context: ActionContext,
    user: dict,
    festival_id: str,
    announcement_id: str,
    content_version_id: str,
    body,
    *,
    only_draft: bool,
) -> dict | None:
    """공지에 게시 값을 반영하고 감사 로그를 남긴다. 시작 시각이 미래면 SCHEDULED.

    새로 만들어 바로 게시하는 경로와 초안을 게시하는 경로가 같은 UPDATE를 쓴다.
    only_draft는 초안만 게시하도록 막는다 — 조건에 걸리면 None을 돌려주고 호출부가 처리한다.
    """
    status = "SCHEDULED" if body.starts_at > datetime.now(UTC) else "ACTIVE"
    row = connection.admin_ops.publish_announcement_row_select_announcements(
        (
            content_version_id,
            body.severity,
            JsonValue(body.audience),
            JsonValue(body.target_area_ids),
            body.starts_at,
            body.ends_at,
            status,
            announcement_id,
            festival_id,
        ),
        only_draft=only_draft,
    )
    if row:
        action = "PUBLISH_EMERGENCY" if body.severity == "EMERGENCY" else "PUBLISH"
        logged(
            connection,
            context,
            user,
            festival_id,
            action,
            "ANNOUNCEMENT",
            str(announcement_id),
            after_data=row,
        )
    return row


def announcements(festival_id: str, connection: UnitOfWork):
    return Result(
        connection.admin_ops.announcements_select_announcements((festival_id,))
    )


def create_announcement(
    festival_id: str,
    body: AnnouncementIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_ops.insert_announcement(
        (festival_id, body.title, user["id"])
    )
    created(connection, context, user, festival_id, "ANNOUNCEMENT", row)
    return Result(row)


def create_and_publish_announcement(
    festival_id: str,
    body: AnnouncementDraftIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """공지 작성부터 게시까지 한 요청·한 트랜잭션.

    화면이 6번의 요청으로 나눠 부르던 흐름을 서버로 옮긴다. 중간 단계가 실패하면 전부
    롤백되므로, 방문객에게 보이지 않는 DRAFT 공지와 고아 콘텐츠 항목이 남지 않는다.
    공지는 현장에서 즉시 나가야 해서 작성자 자가 승인이 허용된 유형이다(감사 로그로 추적).
    """
    announcement = connection.admin_ops.insert_announcement(
        (festival_id, body.title, user["id"])
    )
    item = connection.admin_ops.create_and_publish_announcement_insert_content_items(
        (festival_id, announcement["id"], f"announcement-{announcement['id']}"),
    )
    version = (
        connection.admin_ops.create_and_publish_announcement_insert_content_versions(
            (
                item["id"],
                user["id"],
                "ko",
                JsonValue({"title": body.title, "text": body.body}),
            ),
        )
    )
    connection.admin_ops.create_and_publish_announcement_insert_content_approvals(
        (version["id"], user["id"], "현장 공지 즉시 승인")
    )
    connection.admin_ops.create_and_publish_announcement_update_content_items(
        (version["id"], item["id"])
    )
    row = publish_announcement_row(
        connection,
        context,
        user,
        festival_id,
        str(announcement["id"]),
        str(version["id"]),
        body,
        only_draft=False,
    )
    return Result(row)


def announcement(
    festival_id: str,
    announcement_id: str,
    connection: UnitOfWork,
):
    return Result(
        found(
            connection.admin_ops.announcement_select_announcements(
                (announcement_id, festival_id)
            )
        )
    )


def update_announcement(
    festival_id: str,
    announcement_id: str,
    body: AnnouncementPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    return Result(
        patch_row(
            connection,
            context,
            user,
            "announcements",
            announcement_id,
            festival_id,
            body,
            required_status="DRAFT",
            conflict_message="초안 상태와 버전을 확인해 주세요.",
        )
    )


def publish_announcement(
    festival_id: str,
    announcement_id: str,
    body: PublishAnnouncementIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if not connection.admin_ops.publish_announcement_select_content_versions(
        (body.content_version_id, festival_id)
    ):
        raise bad_request(
            "CONTENT_NOT_APPROVED", "승인된 공지 콘텐츠만 게시할 수 있습니다."
        )
    row = publish_announcement_row(
        connection,
        context,
        user,
        festival_id,
        announcement_id,
        body.content_version_id,
        body,
        only_draft=True,
    )
    if not row:
        raise bad_request("INVALID_STATE_TRANSITION", "초안 공지만 게시할 수 있습니다.")
    return Result(row)


def close_announcement(
    festival_id: str,
    announcement_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_ops.close_announcement_update_announcements(
        (announcement_id, festival_id)
    )
    if not row:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "게시 중인 공지만 종료할 수 있습니다."
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "CLOSE",
        "ANNOUNCEMENT",
        announcement_id,
        after_data=row,
    )
    return Result(row)


def visible_ticket(
    connection: UnitOfWork, ticket_id: str, festival_id: str, user: dict
) -> dict:
    return found(
        connection.admin_ops.visible_ticket_select_ops_tickets(
            {
                "ticket_id": ticket_id,
                "festival_id": festival_id,
                "role": user["role"],
                "user_id": user["id"],
            },
        )
    )


def tickets(
    festival_id: str,
    user: dict,
    connection: UnitOfWork,
    status: str | None,
    limit: int,
    cursor: str | None,
):
    """티켓 목록.

    축제 기간 내내 쌓이는 목록이라 전량 반환은 응답이 무한정 커진다. 감사 로그와 같은
    (created_at, id) 키셋 커서를 쓴다 — 우선순위 정렬은 페이지 안에서 다시 적용한다.
    """
    rows = connection.admin_ops.tickets_select_ops_tickets(
        {
            "festival_id": festival_id,
            "role": user["role"],
            "user_id": user["id"],
            "status": status,
            **cursor_params(cursor, limit),
        },
    )
    rows, page = paged(rows, limit)
    priority_rank = {"EMERGENCY": 1, "HIGH": 2, "NORMAL": 3}
    rows.sort(
        key=lambda row: (priority_rank.get(row["priority"], 4), row["created_at"])
    )
    return Result(rows, page=page)


def create_ticket(
    festival_id: str,
    body: TicketIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_ops.create_ticket_insert_ops_tickets(
        (
            festival_id,
            body.ticket_type,
            body.title,
            body.description,
            body.area_id,
            body.priority,
            body.assignee_id,
            user["id"],
        ),
    )
    connection.admin_ops.create_ticket_insert_ops_ticket_events((row["id"], user["id"]))
    created(connection, context, user, festival_id, "OPS_TICKET", row)
    return Result(row)


def ticket(
    festival_id: str,
    ticket_id: str,
    user: dict,
    connection: UnitOfWork,
):
    return Result(visible_ticket(connection, ticket_id, festival_id, user))


def patch_ticket(
    festival_id: str,
    ticket_id: str,
    body: TicketPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    visible_ticket(connection, ticket_id, festival_id, user)
    return Result(
        patch_row(
            connection,
            context,
            user,
            "ops_tickets",
            ticket_id,
            festival_id,
            body,
            conflict_message="최신 티켓을 다시 조회해 주세요.",
        )
    )


def transition_ticket(
    festival_id: str,
    ticket_id: str,
    body: TicketTransitionIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    ticket = visible_ticket(connection, ticket_id, festival_id, user)
    validate_ticket_transition(ticket["status"], body.to_status, body.note)
    if body.to_status == "ASSIGNED" and (not ticket["assignee_id"]):
        raise bad_request("ASSIGNEE_REQUIRED", "담당자를 먼저 지정해 주세요.")
    row = connection.admin_ops.transition_ticket_update_ops_tickets(
        {"status": body.to_status, "ticket_id": ticket_id}
    )
    connection.admin_ops.transition_ticket_insert_ops_ticket_events(
        (
            ticket_id,
            user["id"],
            ticket["status"],
            body.to_status,
            body.note,
            JsonValue(body.attachments),
        ),
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "TRANSITION",
        "OPS_TICKET",
        ticket_id,
        before_data={"status": ticket["status"]},
        after_data={"status": body.to_status},
    )
    return Result(row)


def ticket_events(
    festival_id: str,
    ticket_id: str,
    user: dict,
    connection: UnitOfWork,
):
    visible_ticket(connection, ticket_id, festival_id, user)
    return Result(
        connection.admin_ops.ticket_events_select_ops_ticket_events((ticket_id,))
    )


def issue_analysis(festival_id: str, connection: UnitOfWork):
    rows = connection.admin_ops.issue_analysis_select_ops_tickets((festival_id,))
    for row in rows:
        inferred = classify_issue(
            f"{row['title']} {row['description']}", row["priority"]
        )
        topic, sentiment, urgent, note = (
            row.pop(field) for field in ("topic", "sentiment", "urgent", "note")
        )
        row["analysis"] = {
            "topic": topic or inferred["topic"],
            "sentiment": sentiment or inferred["sentiment"],
            "urgent": inferred["urgent"] if urgent is None else urgent,
            "humanReviewed": row["updated_at"] is not None,
            "note": note,
        }
    return Result(rows)


def override_issue_analysis(
    festival_id: str,
    ticket_id: str,
    body: IssueAnalysisPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    scoped(connection, "ops_tickets", ticket_id, festival_id)
    row = connection.admin_ops.override_issue_analysis_insert_issue_analysis_overrides(
        (ticket_id, body.topic, body.sentiment, body.urgent, body.note, user["id"]),
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "UPDATE",
        "ISSUE_ANALYSIS",
        ticket_id,
        after_data=row,
    )
    return Result(row)


def surveys(festival_id: str, connection: UnitOfWork):
    """설문 목록. 등록·수정 API가 없어 시드로만 만들 수 있던 것을 운영 화면에서 다루게 한다."""
    return Result(connection.admin_ops.surveys_select_survey_responses((festival_id,)))


def create_survey(
    festival_id: str,
    body: SurveyIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_ops.create_survey_insert_surveys(
        (
            festival_id,
            body.title,
            body.description,
            body.starts_at,
            body.ends_at,
            body.status,
            body.prevent_duplicates,
        ),
    )
    for position, question in enumerate(body.questions, 1):
        connection.admin_ops.create_survey_insert_survey_questions(
            (
                row["id"],
                question.prompt,
                question.question_type,
                JsonValue(question.options),
                question.required,
                position,
            ),
        )
    created(connection, context, user, festival_id, "SURVEY", row)
    return Result(row)


def update_survey(
    festival_id: str,
    survey_id: str,
    body: SurveyPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
):
    """설문 자체만 수정한다. 응답이 이미 쌓인 문항을 바꾸면 집계가 뒤섞이므로 문항은 건드리지 않는다."""
    return Result(
        patch_row(
            connection, context, user, "surveys", survey_id, festival_id, body, if_match
        )
    )


def survey_summary(
    festival_id: str,
    survey_id: str,
    connection: UnitOfWork,
):
    """방문객 제출·중복방지·익명 저장은 있었지만 운영자가 결과를 모아 볼 API가 없었다.
    개별 응답(visitor_session_id 등)은 절대 내보내지 않고 문항별 집계만 돌려준다."""
    survey = found(
        connection.admin_ops.survey_summary_select_surveys((survey_id, festival_id))
    )
    response_count = connection.admin_ops.survey_summary_select_survey_responses(
        (survey_id,)
    )["count"]
    questions = connection.admin_ops.survey_summary_select_survey_questions(
        (survey_id,)
    )
    answers = connection.admin_ops.survey_summary_select_survey_answers((survey_id,))
    answers_by_question: dict[str, list] = {}
    for answer in answers:
        answers_by_question.setdefault(str(answer["question_id"]), []).append(
            answer["value"]
        )

    def summarize(question: dict) -> dict:
        values = answers_by_question.get(str(question["id"]), [])
        average_rating = None
        if question["question_type"] == "RATING":
            numeric = [
                float(value) for value in values if isinstance(value, int | float)
            ]
            average_rating = round(sum(numeric) / len(numeric), 2) if numeric else None
        option_counts: Raw = Raw()
        if question["question_type"] in ("SINGLE_CHOICE", "MULTIPLE_CHOICE"):
            for value in values:
                for option in value if isinstance(value, list) else [value]:
                    if isinstance(option, str):
                        option_counts[option] = option_counts.get(option, 0) + 1
        return {
            "question_id": question["id"],
            "prompt": question["prompt"],
            "question_type": question["question_type"],
            "response_count": len(values),
            "average_rating": average_rating,
            "option_counts": option_counts,
        }

    return Result(
        {
            "survey_id": survey_id,
            "title": survey["title"],
            "response_count": response_count,
            "anonymous": True,
            "duplicate_prevention": survey["prevent_duplicates"],
            "questions": [summarize(question) for question in questions],
        }
    )


def same_organization(organization_id: str, user: dict) -> None:
    if organization_id != str(user["organization_id"]):
        raise forbidden()


def staff_assignments(festival_id: str, connection: UnitOfWork):
    rows = connection.admin_ops.staff_assignments_select_staff_assignments(
        (festival_id,)
    )
    return Result(rows)


def create_staff_assignment(
    festival_id: str,
    body: StaffAssignmentIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if not connection.admin_ops.create_staff_assignment_select_memberships(
        (body.membership_id, body.area_id, festival_id)
    ):
        raise bad_request(
            "FESTIVAL_SCOPE_MISMATCH", "인력과 구역의 축제 범위를 확인해 주세요."
        )
    if connection.admin_ops.create_staff_assignment_select_staff_assignments(
        (body.membership_id, body.ends_at, body.starts_at)
    ):
        raise conflict("SCHEDULE_CONFLICT", "해당 인력의 근무 시간이 겹칩니다.")
    row = connection.admin_ops.create_staff_assignment_insert_staff_assignments_2(
        (
            festival_id,
            body.membership_id,
            body.area_id,
            body.duty_role,
            body.task,
            body.starts_at,
            body.ends_at,
            user["id"],
        ),
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "ASSIGN",
        "STAFF_ASSIGNMENT",
        str(row["id"]),
        after_data=row,
    )
    return Result(row)


def acknowledge_assignment(
    festival_id: str,
    assignment_id: str,
    user: dict,
    connection: UnitOfWork,
):
    row = found(
        connection.admin_ops.acknowledge_assignment_update_staff_assignments(
            (assignment_id, festival_id, user["membership_id"])
        ),
        "본인에게 배정된 업무를 찾을 수 없습니다.",
    )
    return Result(row)


def crowd_snapshots(festival_id: str, connection: UnitOfWork):
    return Result(
        connection.admin_ops.crowd_snapshots_select_crowd_snapshots((festival_id,))
    )


def create_crowd_snapshot(
    festival_id: str,
    body: CrowdSnapshotIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if not in_festival(connection, "festival_areas", body.area_id, festival_id):
        raise bad_request("AREA_SCOPE_MISMATCH", "구역이 같은 축제에 속하지 않습니다.")
    if body.program_session_id and (
        not in_festival(
            connection, "program_sessions", body.program_session_id, festival_id
        )
    ):
        raise bad_request(
            "FESTIVAL_SCOPE_MISMATCH", "프로그램 회차가 같은 축제에 속하지 않습니다."
        )
    row = connection.admin_ops.create_crowd_snapshot_insert_crowd_snapshots(
        (
            festival_id,
            body.area_id,
            body.program_session_id,
            body.source_type,
            body.crowd_level,
            body.people_count,
            body.estimated_wait_min,
            body.captured_at,
            body.expires_at,
            user["id"],
        ),
    )
    created(connection, context, user, festival_id, "CROWD_SNAPSHOT", row)
    return Result(row)


def memberships(
    organization_id: str,
    user: dict,
    connection: UnitOfWork,
):
    same_organization(organization_id, user)
    return Result(
        connection.admin_ops.memberships_select_memberships((organization_id,))
    )


def create_membership(
    organization_id: str,
    body: MembershipIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    same_organization(organization_id, user)
    account = connection.admin_ops.create_membership_insert_users(
        (str(body.email), connection.tokens.hash_password(body.password), body.name)
    )
    if not account:
        raise conflict(
            "EMAIL_ALREADY_REGISTERED",
            "이미 등록된 이메일입니다. 기존 계정에 소속을 추가하려면 계정 담당자에게 문의해 주세요.",
        )
    row = connection.admin_ops.create_membership_insert_memberships(
        (organization_id, account["id"], body.role, JsonValue(body.festival_scope)),
    )
    row["user"] = account
    created(
        connection,
        context,
        user,
        None,
        "MEMBERSHIP",
        row,
        {"email": account["email"], "role": body.role},
    )
    return Result(row)


def patch_membership(
    organization_id: str,
    membership_id: str,
    body: MembershipPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    same_organization(organization_id, user)
    if membership_id == str(user["membership_id"]) and (
        body.role is not None or body.status is not None
    ):
        raise bad_request(
            "SELF_ROLE_CHANGE_DENIED",
            "본인 소속의 역할과 상태는 다른 최고 관리자가 변경해야 합니다.",
        )
    before = found(
        connection.admin_ops.membership_by_id((membership_id, organization_id))
    )
    row = found(
        connection.admin_ops.patch_membership_update_memberships_2(
            {
                "role": body.role,
                "scope": JsonValue(body.festival_scope)
                if body.festival_scope is not None
                else None,
                "status": body.status,
                "membership_id": membership_id,
                "organization_id": organization_id,
            },
        )
    )
    logged(
        connection,
        context,
        user,
        None,
        "UPDATE",
        "MEMBERSHIP",
        membership_id,
        before_data=before,
        after_data=row,
    )
    return Result(row)


def deactivate_membership(
    organization_id: str,
    membership_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
) -> Result:
    same_organization(organization_id, user)
    if membership_id == str(user["membership_id"]):
        raise bad_request(
            "SELF_DEACTIVATION_DENIED", "현재 소속은 비활성화할 수 없습니다."
        )
    before = found(
        connection.admin_ops.membership_by_id((membership_id, organization_id))
    )
    connection.admin_ops.deactivate_membership_update_memberships(
        (membership_id, organization_id)
    )
    logged(
        connection,
        context,
        user,
        None,
        "DEACTIVATE",
        "MEMBERSHIP",
        membership_id,
        before_data=before,
        after_data={"status": "INACTIVE"},
    )
    return Result(status_code=204)


def audit_logs(
    festival_id: str,
    connection: UnitOfWork,
    limit: int,
    action: str | None,
    resource_type: str | None,
    cursor: str | None,
):
    """(created_at, id) 키셋 페이지네이션.

    예전에는 nextCursor=None, hasNext=False가 하드코딩돼 있어 limit 상한(100건) 너머는
    볼 방법이 없었다. 한 건 더 읽어서 다음 페이지 존재 여부를 판단한다.

    행위자는 users를 조인해 이름·이메일까지 준다. actor_id(UUID)만 내려주면 감사 화면이
    "3f2a1b0c…" 같은 값밖에 못 보여줘서 누가 무엇을 했는지 추적이 되지 않는다.
    """
    rows = connection.admin_ops.audit_logs_select_audit_logs(
        {
            "festival_id": festival_id,
            "action": action,
            "resource_type": resource_type,
            **cursor_params(cursor, limit),
        },
    )
    rows, page = paged(rows, limit)
    return Result(rows, page=page)


def create_export(
    festival_id: str,
    body: GenericExportIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """운영 데이터 내보내기. 결과 파일은 `GET /jobs/{jobId}`의 result.artifacts에 담긴다."""
    columns = connection.admin_ops.export_columns(body.resource_type)
    if not columns:
        raise bad_request(
            "UNSUPPORTED_EXPORT", f"내보낼 수 없는 대상입니다: {body.resource_type}"
        )
    rows = connection.admin_ops.create_export_select_rows(
        (festival_id,), resource_type=body.resource_type
    )
    artifact = connection.exports.build_table_artifact(
        rows, columns, body.format, f"{body.resource_type.lower()}-{festival_id[:8]}"
    )
    row = connection.admin_ops.create_export_insert_jobs(
        (
            festival_id,
            body.resource_type,
            JsonValue(
                {"format": body.format, "rowCount": len(rows), "artifacts": [artifact]}
            ),
        ),
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "EXPORT",
        body.resource_type,
        str(row["id"]),
        after_data={"format": body.format, "rowCount": len(rows)},
    )
    return Result({"jobId": row["id"], "status": row["status"], "rowCount": len(rows)})


PRIVACY_EXCLUDED = [
    "설문 응답(VIS-10) — 제출 이후 응답자를 특정할 수 없어 보유기간 경과 시 일괄 파기만 적용합니다."
]


def privacy_policy(connection: UnitOfWork):
    """OPS-11 항목별 보유기간 정책표와 동의 항목. 방문객 화면과 같은 정의를 쓴다."""
    last_purge = connection.admin_ops.privacy_policy_select_audit_logs()
    return Result(
        {
            "retentionPolicy": RETENTION_POLICY,
            "consentItems": CONSENT_ITEMS,
            "purgeSchedule": f"{PURGE_EVERY_TICKS // 3600 or 1}시간마다 자동 실행",
            "lastPurge": last_purge,
        }
    )


def privacy_requests(
    festival_id: str,
    connection: UnitOfWork,
    status: str | None,
):
    return Result(
        connection.admin_ops.privacy_requests_select_privacy_requests(
            {"festival_id": festival_id, "status": status}
        )
    )


def handle_privacy_request(
    festival_id: str,
    privacy_request_id: str,
    body: PrivacyRequestPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """열람·삭제 요구 처리.

    삭제를 완료하면 해당 방문 세션의 데이터를 참조 데이터까지 연쇄 파기한다. 요구 자체는
    이력으로 남아야 하므로, 세션을 지우기 전에 요구와의 연결을 끊고 결과 요약만 남긴다.
    """
    before = found(
        connection.admin_ops.handle_privacy_request_select_privacy_requests(
            (privacy_request_id, festival_id)
        )
    )
    if before["status"] in ("COMPLETED", "REJECTED"):
        raise bad_request("INVALID_STATE_TRANSITION", "이미 종결된 요구입니다.")
    result = None
    if body.status == "COMPLETED":
        if not before["visitor_session_id"]:
            raise bad_request(
                "SUBJECT_NOT_IDENTIFIABLE",
                "식별자가 없어 대상 데이터를 특정할 수 없습니다.",
            )
        summary = connection.admin_ops.handle_privacy_request_select_rows(
            {"session_id": before["visitor_session_id"]},
        )
        result = {"collected": summary, "excluded": PRIVACY_EXCLUDED}
        if before["request_type"] == "DELETE":
            connection.admin_ops.handle_privacy_request_update_privacy_requests(
                (privacy_request_id,)
            )
            result["deletedRows"] = purge_sessions(
                connection, visitor_id=before["visitor_session_id"]
            )
    row = connection.admin_ops.handle_privacy_request_update_privacy_requests_2(
        (
            body.status,
            body.note,
            JsonValue(result) if result else None,
            user["id"],
            privacy_request_id,
        ),
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        body.status,
        "PRIVACY_REQUEST",
        privacy_request_id,
        before_data=before,
        after_data=row,
    )
    return Result(row)


def run_privacy_purge(
    festival_id: str, context: ActionContext, user: dict, connection: UnitOfWork
):
    """정책표에 따른 파기를 즉시 실행한다. 평상시에는 잡 워커가 주기적으로 같은 함수를 돌린다."""
    counts = purge_personal_data(connection)
    logged(
        connection,
        context,
        user,
        festival_id,
        "PURGE_MANUAL",
        "PERSONAL_DATA",
        None,
        after_data=counts,
    )
    return Result({"purged": counts, "policy": RETENTION_POLICY})


def visitor_identity(festival_id: str, connection: UnitOfWork):
    """VIS-11 식별자 재발급과 한도 우회 의심 패턴.

    같은 기기 버킷에서 식별자가 두 번 이상 발급되면 저장소 초기화·기기 변경으로 1인당
    한도가 초기화됐을 수 있다. 발급 횟수와 그 세션들의 쿠폰·리워드·예약 건수를 함께 보여
    운영자가 부정 패턴을 판단할 수 있게 한다.
    """
    rows = connection.admin_ops.visitor_identity_select_visitor_identity_events(
        (festival_id,)
    )
    totals = connection.admin_ops.visitor_identity_select_visitor_identity_events_2(
        (festival_id,)
    )
    return Result({"totals": totals, "suspects": rows})


def notification_deliveries(festival_id: str, connection: UnitOfWork):
    """OPS-10 발송 이력과 세션별 노출 확인 결과.

    웹 폴링이 유일한 채널이라 '도달'은 해당 화면을 열어 둔 세션의 폴링 응답에 실렸는지로만
    확인된다. 백그라운드·종료 세션은 도달 보장 범위 밖이므로 노출 세션 수만 사실대로 센다.
    """
    announcements = connection.admin_ops.notification_deliveries_select_min(
        (festival_id,)
    )
    calls = connection.admin_ops.notification_deliveries_select_nd((festival_id,))
    return Result(
        {
            "announcements": announcements,
            "bookingCalls": calls,
            "channel": {
                "type": "WEB_POLL",
                "announcementPollSeconds": 30,
                "bookingPollSeconds": 10,
                "limitation": "웹 폴링은 화면이 열려 있는 세션에만 도달합니다. 백그라운드·종료 세션은 도달 보장 범위에서 제외되므로 긴급 상황은 현장 방송 등 오프라인 수단을 병행해야 합니다.",
            },
        }
    )


KIOSK_CAMERA_NOTICE = {
    "purpose": "키오스크 화면의 글씨 크기를 제안하기 위해서만 얼굴을 일시적으로 감지해 연령대를 추정합니다. 신원 확인이 아닙니다.",
    "choice": "카메라 사용은 선택입니다. 거절하거나 카메라가 없어도 모든 기능을 그대로 이용할 수 있고, 큰 글씨·음성 안내는 언제든 버튼으로 켤 수 있습니다.",
    "processingLocation": "추정은 키오스크 기기 안에서만 수행됩니다.",
    "retention": "영상·얼굴 이미지·특징값·추정 연령은 저장하지 않고 분석 직후 폐기하며 서버로 전송하지 않습니다.",
    "prohibitedUse": "추정 결과를 가격·입장·자격·추천 우선순위·서비스 이용 제한에 사용하지 않습니다.",
}


def kiosk_camera_state(connection: UnitOfWork, festival_id: str) -> dict:
    row = found(
        connection.admin_ops.kiosk_camera_state_select_festivals((festival_id,))
    )
    return {
        "enabled": row["kiosk_camera_enabled"],
        "stopReason": row["kiosk_camera_stop_reason"],
        "notice": KIOSK_CAMERA_NOTICE,
    }


def kiosk_camera(festival_id: str, connection: UnitOfWork):
    """ESG-G-08 카메라·AI 투명성 화면: 공개 안내, 중지 스위치 상태, 익명 효과 지표.

    지표는 kiosk_assist_events 건수만으로 계산한다 — 방문객 세션과 잇지 않으므로 개별
    이용자가 어떤 추정을 받았는지는 조회할 수 없다. 연령대 판정 결과도 익명 범주와
    시각·모델 버전만 남기며 영상·얼굴 특징값·추정 나이는 저장하지 않는다.
    """
    counts = {
        row["event_type"]: row["count"]
        for row in connection.admin_ops.kiosk_camera_select_kiosk_assist_events(
            (festival_id,)
        )
    }
    models = connection.admin_ops.kiosk_camera_select_kiosk_assist_events_2(
        (festival_id,)
    )
    estimate_result_counts = {
        row["result"]: row["count"]
        for row in connection.admin_ops.kiosk_camera_select_kiosk_assist_events_3(
            (festival_id,)
        )
    }
    estimate_result_log = (
        connection.admin_ops.kiosk_camera_select_kiosk_assist_events_4((festival_id,))
    )
    granted = counts.get("CONSENT_GRANTED", 0)
    suggested = counts.get("SUGGESTED", 0)
    accepted = counts.get("ACCEPTED", 0)
    return Result(
        {
            **kiosk_camera_state(connection, festival_id),
            "counts": counts,
            "models": models,
            "estimateResults": {
                "counts": estimate_result_counts,
                "recent": estimate_result_log,
            },
            "rates": {
                "consentAcceptRate": _rate(granted, counts.get("CONSENT_SHOWN", 0)),
                "estimateFailureRate": _rate(counts.get("ESTIMATE_FAILED", 0), granted),
                "suggestionAcceptRate": _rate(accepted, suggested),
                "manualLargeTextCount": counts.get("MANUAL_LARGE_TEXT", 0),
                "taskCompletedCount": counts.get("TASK_COMPLETED", 0),
            },
        }
    )


def _rate(part: int, total: int) -> float | None:
    return round(part / total, 3) if total else None


def update_kiosk_camera(
    festival_id: str,
    body: KioskCameraPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """카메라 제안 켜기·중지. 편향·오탐이 확인되면 여기서 내리고 수동 접근성 모드만 남긴다.

    중지 사유를 감사 로그에 남긴다 — 정기 점검 결과가 기록으로 남지 않으면 ESG-G-08의
    '감시·중지 장치'가 스위치 하나로 끝나 버린다.
    """
    if not body.enabled and (not (body.stop_reason or "").strip()):
        raise bad_request(
            "STOP_REASON_REQUIRED", "카메라 제안을 중지할 때는 사유를 입력해 주세요."
        )
    before = kiosk_camera_state(connection, festival_id)
    connection.admin_ops.update_kiosk_camera_update_festivals(
        (body.enabled, None if body.enabled else body.stop_reason.strip(), festival_id),
    )
    after = kiosk_camera_state(connection, festival_id)
    logged(
        connection,
        context,
        user,
        festival_id,
        "KIOSK_CAMERA_TOGGLE",
        "FESTIVALS",
        festival_id,
        before_data={"enabled": before["enabled"], "stopReason": before["stopReason"]},
        after_data={"enabled": after["enabled"], "stopReason": after["stopReason"]},
    )
    return Result(after)


def get_job(job_id: str, user: dict, connection: UnitOfWork):
    row = found(
        connection.admin_ops.get_job_select_jobs(
            {
                "job_id": job_id,
                "organization_id": user["organization_id"],
                "super_admin": user["role"] == "SUPER_ADMIN",
                "scope": JsonValue(user["festival_scope"]),
            },
        )
    )
    return Result(row)
