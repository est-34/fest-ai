"쿠폰과 리워드 포인트. 발급(방문객)·사용 처리(운영자·상인)·캠페인 등록(운영자)."

from app.modules.engagement.application.ports import UnitOfWork
from app.modules.festival.api import published_festival
from app.shared.application.common import created
from app.shared.application.context import ActionContext
from app.shared.application.idempotency import idempotent
from app.shared.application.results import Result
from app.shared.application.schemas import (
    CouponIn,
    CouponRedeemIn,
    RewardActionIn,
    RewardCampaignIn,
    RewardEventIn,
)
from app.shared.application.values import JsonValue
from app.shared.domain.errors import DuplicateKey, bad_request, conflict, found


def redeem_issue(
    connection: UnitOfWork,
    context: ActionContext,
    issue: dict,
    actor_id,
    festival_id: str,
) -> dict:
    """발급된 쿠폰을 사용 처리한다.

    운영자 경로(현장 QR 스캔)와 상인 경로가 같은 처리를 한다 — 발급 건을 어떻게 찾고
    누구 것인지 확인하는 부분만 각 라우트에 있다.
    """
    if issue["status"] != "ISSUED" or issue["expired"]:
        raise conflict("INVALID_COUPON_STATUS", "사용 가능 상태의 쿠폰이 아닙니다.")
    try:
        redemption = connection.rewards.redeem_issue_insert_coupon_redemptions(
            (issue["id"], issue["festival_business_id"], actor_id)
        )
    except DuplicateKey as error:
        raise conflict("DUPLICATE_ACTION", "이미 사용 처리된 쿠폰입니다.") from error
    connection.rewards.redeem_issue_update_coupon_issues((issue["id"],))
    connection.rewards.redeem_issue_insert_business_events(
        (issue["festival_business_id"], issue["visitor_session_id"])
    )
    connection.audit.audit(
        festival_id=festival_id,
        actor_id=str(actor_id),
        action="REDEEM",
        resource_type="COUPON_ISSUE",
        resource_id=str(issue["id"]),
        after_data=redemption,
        request_id=context.request_id,
    )
    return redemption


def insert_coupon(
    connection: UnitOfWork, business_id: str, body: CouponIn, created_by
) -> dict:
    """운영자 경로와 상인 경로가 같은 쿠폰을 만든다. 접근 권한 검사는 각 라우트에 있다."""
    return connection.rewards.insert_coupon_insert_coupons(
        (
            business_id,
            body.name,
            body.description,
            body.benefit_type,
            body.benefit_value,
            body.issue_limit,
            body.per_visitor_limit,
            body.starts_at,
            body.ends_at,
            created_by,
        ),
    )


def public_coupons(festival_code: str, connection: UnitOfWork):
    festival = published_festival(connection, festival_code)
    rows = connection.rewards.public_coupons_select_coupon_issues((festival["id"],))
    return Result(rows, cache_seconds=30)


def my_coupons(visitor: dict, connection: UnitOfWork):
    rows = connection.rewards.my_coupons_select_coupon_issues((visitor["id"],))
    return Result(rows)


def issue_coupon(
    coupon_id: str,
    visitor: dict,
    connection: UnitOfWork,
    idempotency_key: str | None,
):

    def work():
        coupon = found(
            connection.rewards.work_select_coupons((coupon_id, visitor["festival_id"])),
            "발급 가능한 쿠폰을 찾을 수 없습니다.",
        )
        counts = connection.rewards.work_select_coupon_issues(
            (visitor["id"], coupon_id)
        )
        if counts["total"] >= coupon["issue_limit"]:
            raise conflict("CAPACITY_EXCEEDED", "쿠폰이 모두 발급되었습니다.")
        if counts["mine"] >= coupon["per_visitor_limit"]:
            raise conflict(
                "ACTION_LIMIT_EXCEEDED", "방문객별 쿠폰 발급 한도를 초과했습니다."
            )
        token = connection.tokens.random_token("cp")
        try:
            row = connection.rewards.work_insert_coupon_issues_2(
                (
                    coupon_id,
                    visitor["id"],
                    connection.tokens.hash_token(token),
                    coupon["valid_until"],
                ),
            )
        except DuplicateKey as error:
            raise conflict("DUPLICATE_ACTION", "이미 발급받은 쿠폰입니다.") from error
        connection.rewards.work_insert_business_events(
            (coupon["festival_business_id"], visitor["id"])
        )
        return (
            201,
            {
                **row,
                "issueToken": token,
                "couponName": coupon["name"],
                "businessName": coupon["business_name"],
            },
        )

    return Result.from_idempotent(
        idempotent(
            connection,
            key=idempotency_key,
            scope=f"coupon:{visitor['id']}:{coupon_id}",
            body={},
            work=work,
        )
    )


def rotate_issue_token(issue_id: str, visitor: dict, connection: UnitOfWork):
    """쿠폰 사용 토큰 재발급.

    서버에는 해시만 남아서 발급 응답을 놓치면(기기 교체, 저장소 삭제) QR을 다시 만들 수 없고,
    쿠폰은 이미 발급돼 재발급도 막혀 있어 방문객이 영영 쓸 수 없는 상태가 됐다.
    새 토큰을 발급하고 해시를 교체한다 — 예전 토큰은 그 즉시 무효가 되므로 잃어버린
    QR 사진이 남의 손에 있어도 쓰이지 않는다.
    """
    issue = found(
        connection.rewards.rotate_issue_token_select_coupon_issues(
            (issue_id, visitor["id"])
        ),
        "발급받은 쿠폰을 찾을 수 없습니다.",
    )
    if issue["status"] != "ISSUED" or issue["expired"]:
        raise conflict(
            "INVALID_COUPON_STATUS", "사용 가능 상태의 쿠폰만 재발급할 수 있습니다."
        )
    token = connection.tokens.random_token("cp")
    row = connection.rewards.rotate_issue_token_update_coupon_issues_2(
        (connection.tokens.hash_token(token), issue_id)
    )
    return Result({**row, "issueToken": token, "couponName": issue["name"]})


def reward_actions(visitor: dict, connection: UnitOfWork):
    rows = connection.rewards.reward_actions_select_reward_actions(
        (visitor["id"], visitor["festival_id"])
    )
    return Result(
        [
            {
                "id": row["id"],
                "action_type": row["action_type"],
                "points": row["points"],
                "verification_type": row["verification_type"],
                "name": (row["rule"] or {}).get("name", row["action_type"]),
                "location": (row["rule"] or {}).get("location", ""),
                "completed": row["earned_count"] >= row["per_user_limit"],
            }
            for row in rows
        ]
    )


def create_reward_event(
    body: RewardEventIn,
    visitor: dict,
    connection: UnitOfWork,
    idempotency_key: str | None,
):

    def work():
        action = found(
            connection.rewards.work_select_reward_actions(
                (body.reward_action_id, visitor["festival_id"])
            ),
            "참여 가능한 리워드 행동을 찾을 수 없습니다.",
        )
        count = connection.rewards.work_select_reward_events(
            (body.reward_action_id, visitor["id"])
        )["count"]
        if count >= action["per_user_limit"]:
            raise conflict("ACTION_LIMIT_EXCEEDED", "행동별 참여 한도를 초과했습니다.")
        allowed_keys = (action["rule"] or {}).get("verificationKeys")
        if allowed_keys and body.verification_key not in allowed_keys:
            raise bad_request(
                "INVALID_VERIFICATION", "유효하지 않은 행동 인증 값입니다."
            )
        today_points = connection.rewards.work_select_point_ledger(
            (visitor["id"], action["campaign_id"])
        )["points"]
        if today_points + action["points"] > action["daily_point_limit"]:
            raise conflict(
                "DAILY_POINT_LIMIT_EXCEEDED", "일일 포인트 한도를 초과했습니다."
            )
        try:
            event = connection.rewards.work_insert_reward_events_2(
                (
                    body.reward_action_id,
                    visitor["id"],
                    body.verification_key,
                    JsonValue(body.evidence),
                    body.occurred_at,
                ),
            )
        except DuplicateKey as error:
            raise conflict("DUPLICATE_ACTION", "이미 인증된 행동입니다.") from error
        ledger = connection.rewards.work_insert_point_ledger_2(
            (visitor["id"], event["id"], action["points"], action["action_type"]),
        )
        return (201, {"event": event, "points": ledger["points_delta"]})

    return Result.from_idempotent(
        idempotent(
            connection,
            key=idempotency_key,
            scope=f"reward:{visitor['id']}:{body.reward_action_id}",
            body=body.model_dump(),
            work=work,
        )
    )


def points(visitor: dict, connection: UnitOfWork):
    ledger = connection.rewards.points_select_point_ledger((visitor["id"],))
    return Result(
        {"balance": sum((row["points_delta"] for row in ledger)), "ledger": ledger}
    )


def coupons(
    festival_id: str,
    business_id: str,
    connection: UnitOfWork,
):
    return Result(
        connection.rewards.coupons_select_coupon_issues((festival_id, business_id))
    )


def create_coupon(
    festival_id: str,
    business_id: str,
    body: CouponIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if not connection.rewards.create_coupon_select_festival_businesses(
        (business_id, festival_id)
    ):
        raise bad_request(
            "BUSINESS_NOT_APPROVED", "승인된 참여업체만 쿠폰을 발행할 수 있습니다."
        )
    row = insert_coupon(connection, business_id, body, user["id"])
    created(connection, context, user, festival_id, "COUPON", row)
    return Result(row)


def redeem_coupon_on_site(
    festival_id: str,
    body: CouponRedeemIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """현장 운영자가 방문객 QR(사용 토큰)을 읽어 쿠폰을 사용 처리한다.

    상인용 경로(/merchant/coupon-issues/{issue_id}/redeem)는 업체 소유자로 범위가 묶여 있어
    운영자가 대신 처리할 수 없다. 여기서는 축제 범위로만 제한하고, 스캔한 토큰 하나로 발급
    건을 찾는다 — QR에 발급 ID까지 담지 않아도 되도록.
    """
    issue = connection.rewards.redeem_coupon_on_site_select_coupon_issues(
        (connection.tokens.hash_token(body.issue_token), festival_id)
    )
    if not issue:
        raise bad_request(
            "INVALID_COUPON_TOKEN", "이 축제에서 발급된 쿠폰을 찾을 수 없습니다."
        )
    redemption = redeem_issue(connection, context, issue, user["id"], festival_id)
    return Result({**redemption, "couponName": issue["name"]})


def reward_campaigns(festival_id: str, connection: UnitOfWork):
    """등록한 캠페인과 적립 행동을 다시 볼 수 있어야 운영자가 중복 등록을 피한다."""
    rows = connection.rewards.reward_campaigns_select_reward_campaigns((festival_id,))
    return Result(rows)


def create_reward_campaign(
    festival_id: str,
    body: RewardCampaignIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.rewards.create_reward_campaign_insert_reward_campaigns(
        (
            festival_id,
            body.name,
            body.starts_at,
            body.ends_at,
            body.daily_point_limit,
            user["id"],
        ),
    )
    created(connection, context, user, festival_id, "REWARD_CAMPAIGN", row)
    return Result(row)


def create_reward_action(
    festival_id: str,
    campaign_id: str,
    body: RewardActionIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if body.verification_type != "SELF" and (
        not (body.rule or {}).get("verificationKeys")
    ):
        raise bad_request(
            "VERIFICATION_KEYS_REQUIRED",
            "SELF가 아닌 인증 방식은 rule.verificationKeys에 인증 값을 1개 이상 등록해야 합니다.",
        )
    row = found(
        connection.rewards.create_reward_action_insert_reward_actions(
            {
                "campaign_id": campaign_id,
                "action_type": body.action_type,
                "verification_type": body.verification_type,
                "points": body.points,
                "per_user_limit": body.per_user_limit,
                "jsonb_rule": JsonValue(body.rule),
                "festival_id": festival_id,
            },
        )
    )
    created(connection, context, user, festival_id, "REWARD_ACTION", row)
    return Result(row)
