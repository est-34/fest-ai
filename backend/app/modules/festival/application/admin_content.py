from app.modules.festival.application.ports import UnitOfWork
from app.modules.festival.domain import validate_content_review
from app.shared.application.common import created, logged, scoped
from app.shared.application.context import ActionContext
from app.shared.application.results import Result
from app.shared.application.schemas import (
    AIDecisionIn,
    ContentItemIn,
    ContentVersionIn,
    PublishContentIn,
    ReviewIn,
)
from app.shared.application.values import JsonValue
from app.shared.domain.errors import bad_request, found, unprocessable


def versions_by_item(connection: UnitOfWork, item_ids: list) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {str(item_id): [] for item_id in item_ids}
    if item_ids:
        for version in connection.admin_content.versions_by_item_select_rows(
            ([str(item_id) for item_id in item_ids],)
        ):
            grouped[str(version["content_item_id"])].append(version)
    return grouped


def items(festival_id: str, connection: UnitOfWork):
    rows = connection.admin_content.items_select_content_items((festival_id,))
    grouped = versions_by_item(connection, [row["id"] for row in rows])
    for row in rows:
        row["versions"] = grouped[str(row["id"])]
    return Result(rows)


def create_item(
    festival_id: str,
    body: ContentItemIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if bool(body.resource_type) != bool(body.resource_id):
        raise bad_request(
            "VALIDATION_ERROR", "resourceType과 resourceId는 함께 입력해야 합니다."
        )
    if body.resource_type == "PROGRAM" and (
        not connection.admin_content.create_item_select_programs(
            (body.resource_id, festival_id)
        )
    ):
        raise bad_request(
            "FESTIVAL_SCOPE_MISMATCH", "프로그램이 같은 축제에 속하지 않습니다."
        )
    row = connection.admin_content.create_item_insert_content_items(
        (
            festival_id,
            body.content_type,
            body.resource_type,
            body.resource_id,
            body.slug,
        ),
    )
    created(connection, context, user, festival_id, "CONTENT_ITEM", row)
    return Result(row)


def item_detail(festival_id: str, item_id: str, connection: UnitOfWork):
    item = found(
        connection.admin_content.item_detail_select_content_items(
            (item_id, festival_id)
        )
    )
    item["versions"] = versions_by_item(connection, [item_id])[str(item_id)]
    return Result(item)


def create_version(
    festival_id: str,
    item_id: str,
    body: ContentVersionIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    scoped(connection, "content_items", item_id, festival_id)
    row = connection.admin_content.create_version_insert_content_versions(
        {
            "item_id": item_id,
            "created_by": user["id"],
            "language": body.language,
            "value": JsonValue(body.body),
            "change_note": body.change_note,
        },
    )
    created(connection, context, user, festival_id, "CONTENT_VERSION", row)
    return Result(row)


def submit_version(
    festival_id: str,
    version_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_content.submit_version_update_content_versions(
        (version_id, festival_id)
    )
    if not row:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "초안 버전만 검수를 요청할 수 있습니다."
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "SUBMIT_REVIEW",
        "CONTENT_VERSION",
        version_id,
        after_data=row,
    )
    return Result(row)


def review_version(
    festival_id: str,
    version_id: str,
    body: ReviewIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    version = found(
        connection.admin_content.review_version_select_content_versions(
            (version_id, festival_id)
        )
    )
    validate_content_review(version, str(user["id"]), body.decision)
    connection.admin_content.review_version_insert_content_approvals(
        (version_id, user["id"], body.decision, body.comment)
    )
    row = connection.admin_content.review_version_update_content_versions_2(
        (body.decision, version_id)
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        body.decision,
        "CONTENT_VERSION",
        version_id,
        after_data=row,
    )
    return Result(row)


def publish_item(
    festival_id: str,
    item_id: str,
    body: PublishContentIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    target = found(
        connection.admin_content.publish_item_select_content_items(
            (body.version_id, item_id, festival_id)
        )
    )
    if (
        str(target["content_item_id"]) != item_id
        or target["version_status"] != "APPROVED"
    ):
        raise unprocessable(
            "CONTENT_NOT_APPROVED", "이 항목의 승인된 버전만 게시할 수 있습니다."
        )
    row = connection.admin_content.publish_item_update_content_items_2(
        (body.version_id, item_id)
    )
    if row["resource_type"] == "PROGRAM":
        connection.admin_content.publish_item_update_programs(
            (row["resource_id"], festival_id)
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "PUBLISH",
        "CONTENT_ITEM",
        item_id,
        after_data=row,
    )
    return Result(row)


def unpublish_item(
    festival_id: str,
    item_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_content.unpublish_item_update_content_items(
        (item_id, festival_id)
    )
    if not row:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "게시 중인 콘텐츠만 종료할 수 있습니다."
        )
    if row["resource_type"] == "PROGRAM":
        connection.admin_content.unpublish_item_update_programs((row["resource_id"],))
    logged(
        connection,
        context,
        user,
        festival_id,
        "UNPUBLISH",
        "CONTENT_ITEM",
        item_id,
        after_data=row,
    )
    return Result(row)


def ai_reviews(
    festival_id: str,
    connection: UnitOfWork,
    status: str,
):
    rows = connection.admin_content.ai_reviews_select_ai_message_reports(
        {"festival_id": festival_id, "status": status}
    )
    return Result(rows)


def ai_decision(
    festival_id: str,
    review_id: str,
    body: AIDecisionIn,
    user: dict,
    connection: UnitOfWork,
):
    row = found(
        connection.admin_content.ai_decision_update_ai_message_reports(
            (body.decision, user["id"], review_id, festival_id)
        )
    )
    return Result(row)
