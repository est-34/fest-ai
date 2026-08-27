from app.modules.commerce.application.ports import UnitOfWork
from app.modules.engagement.api import insert_coupon, redeem_issue
from app.shared.application.common import created, logged
from app.shared.application.context import ActionContext
from app.shared.application.results import Result
from app.shared.application.schemas import (
    BusinessEventIn,
    BusinessPatch,
    CouponIn,
    CouponRedeemIn,
    CouponReverseIn,
)
from app.shared.domain.errors import bad_request, conflict, forbidden


def owned_business(
    connection: UnitOfWork, business_id: str, user: dict, *, approved: bool = False
) -> dict:
    row = connection.merchant.owned_business_select_festival_businesses(
        (business_id, user["membership_id"], user["organization_id"])
    )
    if not row:
        raise forbidden("BUSINESS_SCOPE_DENIED", "본인 업체만 접근할 수 있습니다.")
    if approved and row["participation_status"] != "APPROVED":
        raise bad_request(
            "BUSINESS_NOT_APPROVED", "승인된 참여업체만 사용할 수 있습니다."
        )
    return row


def businesses(user: dict, connection: UnitOfWork):
    rows = connection.merchant.businesses_select_festival_businesses(
        (user["membership_id"],)
    )
    rows.sort(key=lambda row: row["updated_at"], reverse=True)
    return Result(rows)


def update_business(
    business_id: str,
    body: BusinessPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    before = owned_business(connection, business_id, user)
    if before["participation_status"] not in {
        "DRAFT",
        "SUBMITTED",
        "REJECTED",
        "APPROVED",
    }:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "수정 가능한 업체 상태가 아닙니다."
        )
    if body.name is not None:
        connection.merchant.update_business_update_businesses(
            (body.name, before["business_id"])
        )
    values = body.model_dump(exclude_none=True, exclude={"name", "version"})
    if not values and body.name is None:
        raise bad_request("VALIDATION_ERROR", "변경할 값이 없습니다.")

    row = connection.merchant.update_business_select_festival_businesses(
        (business_id, body.version), values=values
    )
    if not row:
        raise conflict("RESOURCE_VERSION_CONFLICT", "업체 정보가 이미 변경되었습니다.")
    logged(
        connection,
        context,
        user,
        str(row["festival_id"]),
        "SUBMIT",
        "FESTIVAL_BUSINESS",
        business_id,
        before_data=before,
        after_data=row,
    )
    return Result(row)


def create_coupon(
    business_id: str,
    body: CouponIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    business = owned_business(connection, business_id, user, approved=True)
    row = insert_coupon(connection, business_id, body, user["id"])
    created(connection, context, user, str(business["festival_id"]), "COUPON", row)
    return Result(row)


def redeem_coupon(
    issue_id: str,
    body: CouponRedeemIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    issue = connection.merchant.redeem_coupon_select_coupon_issues(
        (issue_id, user["membership_id"])
    )
    if not issue:
        raise forbidden(
            "BUSINESS_SCOPE_DENIED", "본인 업체의 쿠폰만 처리할 수 있습니다."
        )
    if issue["issue_token_hash"] != connection.tokens.hash_token(body.issue_token):
        raise bad_request("INVALID_COUPON_TOKEN", "쿠폰 토큰이 일치하지 않습니다.")
    return Result(
        redeem_issue(connection, context, issue, user["id"], str(issue["festival_id"]))
    )


def reverse_coupon(
    redemption_id: str,
    body: CouponReverseIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    redemption = connection.merchant.reverse_coupon_select_coupon_redemptions(
        (redemption_id, user["membership_id"])
    )
    if not redemption:
        raise forbidden(
            "BUSINESS_SCOPE_DENIED", "본인 업체의 쿠폰 사용만 취소할 수 있습니다."
        )
    if redemption["status"] != "REDEEMED":
        raise conflict("INVALID_COUPON_STATUS", "이미 취소된 사용 내역입니다.")
    row = connection.merchant.reverse_coupon_update_coupon_redemptions_2(
        (body.reason, redemption_id)
    )
    connection.merchant.reverse_coupon_update_coupon_issues(
        (redemption["coupon_issue_id"],)
    )
    logged(
        connection,
        context,
        user,
        str(redemption["festival_id"]),
        "REVERSE",
        "COUPON_REDEMPTION",
        redemption_id,
        before_data=redemption,
        after_data=row,
    )
    return Result(row)


def record_business_event(
    business_id: str,
    body: BusinessEventIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    business = owned_business(connection, business_id, user, approved=True)
    if body.event_type == "SALE" and body.sales_amount is None:
        raise bad_request("VALIDATION_ERROR", "매출 이벤트에는 금액이 필요합니다.")
    row = connection.merchant.record_business_event_insert_business_events(
        (business_id, body.event_type, body.sales_amount, body.source)
    )
    created(
        connection, context, user, str(business["festival_id"]), "BUSINESS_EVENT", row
    )
    return Result(row)


def performance(business_id: str, user: dict, connection: UnitOfWork):
    owned_business(connection, business_id, user)
    metrics = connection.merchant.performance_select_business_events((business_id,))
    coupons = connection.merchant.performance_select_coupons((business_id,))
    return Result({"events": metrics, "coupons": coupons})
