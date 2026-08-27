"참여업체(부스)와 상인 계정 초대. 공개 목록·운영자 심사·성과 지표."

from app.modules.commerce.application.ports import UnitOfWork
from app.modules.festival.api import published_festival
from app.shared.application.common import (
    created,
    in_festival,
    logged,
    patch_row,
    scoped,
)
from app.shared.application.context import ActionContext
from app.shared.application.results import Result
from app.shared.application.schemas import (
    BusinessIn,
    FestivalBusinessPatch,
    MerchantInviteIn,
    ReviewIn,
)
from app.shared.application.values import JsonValue
from app.shared.domain.errors import bad_request, found


def public_businesses(
    festival_code: str,
    connection: UnitOfWork,
    category: str | None,
):
    festival = published_festival(connection, festival_code)
    rows = connection.businesses.public_businesses_select_festival_businesses(
        {"festival_id": festival["id"], "category": category}
    )
    rows.sort(key=lambda row: row["name"])
    return Result(rows, cache_seconds=60)


def businesses(
    festival_id: str,
    connection: UnitOfWork,
    status: str | None,
):
    rows = connection.businesses.businesses_select_festival_businesses(
        {"festival_id": festival_id, "status": status}
    )
    rows.sort(key=lambda row: row["name"])
    return Result(rows)


def create_business(
    festival_id: str,
    body: BusinessIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    business = connection.businesses.create_business_insert_businesses(
        {
            "organization_id": user["organization_id"],
            "registration_no": body.registration_no,
            "name": body.name,
            "address": JsonValue(body.address),
        },
    )
    row = connection.businesses.create_business_insert_festival_businesses(
        (
            festival_id,
            business["id"],
            body.owner_membership_id,
            body.category,
            body.description,
            JsonValue(body.menu),
            JsonValue(body.operating_hours),
            JsonValue(body.accessibility),
        ),
    )
    if body.area_id and body.booth_no:
        if not in_festival(connection, "festival_areas", body.area_id, festival_id):
            raise bad_request(
                "AREA_SCOPE_MISMATCH", "부스 구역이 같은 축제에 속하지 않습니다."
            )
        connection.businesses.create_business_insert_booths(
            (row["id"], body.area_id, body.booth_no)
        )
    created(connection, context, user, festival_id, "FESTIVAL_BUSINESS", row)
    return Result(
        {**row, "name": business["name"], "registrationNo": business["registration_no"]}
    )


def update_festival_business(
    festival_id: str,
    business_id: str,
    body: FestivalBusinessPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
):
    """운영자가 참여업체 속성을 고친다.

    광고 노출(is_sponsored)과 ESG 참여(esg_participating)는 방문객 추천 점수와 광고 분리에
    쓰이는 값인데 설정할 API가 없어 DB를 직접 고치는 수밖에 없었다.
    """
    return Result(
        patch_row(
            connection,
            context,
            user,
            "festival_businesses",
            business_id,
            festival_id,
            body,
            if_match,
        )
    )


def review_business(
    festival_id: str,
    business_id: str,
    body: ReviewIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.businesses.review_business_update_festival_businesses(
        {
            "decision": body.decision,
            "comment": body.comment,
            "reviewer": user["id"],
            "business_id": business_id,
            "festival_id": festival_id,
        },
    )
    if not row:
        raise bad_request(
            "INVALID_STATE_TRANSITION",
            "제출 또는 반려 상태의 업체만 검토할 수 있습니다.",
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        body.decision,
        "FESTIVAL_BUSINESS",
        business_id,
        after_data=row,
    )
    return Result(row)


INVITATION_HOURS = 72


def merchant_invitations(
    festival_id: str,
    business_id: str,
    connection: UnitOfWork,
):
    """업체에 발급한 상인 계정 초대와 현재 연결된 계정."""
    scoped(connection, "festival_businesses", business_id, festival_id)
    rows = connection.businesses.merchant_invitations_select_merchant_invitations(
        (business_id,)
    )
    owner = connection.businesses.merchant_invitations_select_festival_businesses(
        (business_id,)
    )
    return Result({"invitations": rows, "owner": owner})


def create_merchant_invitation(
    festival_id: str,
    business_id: str,
    body: MerchantInviteIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    """상인 계정 초대 발급.

    계정은 이 링크로만 만들어진다(자율 가입 없음). 사업자 증빙은 BIZ-01 업체 승인 절차에서
    이미 확인하므로 여기서 다시 검증하지 않는다. 토큰 원문은 응답으로 한 번만 나가고
    서버에는 해시만 남는다 — 유출된 DB로 초대를 수락할 수 없게.
    """
    scoped(
        connection,
        "festival_businesses",
        business_id,
        festival_id,
        "참여업체를 찾을 수 없습니다.",
    )
    token = connection.tokens.random_token("mi")
    row = connection.businesses.create_merchant_invitation_insert_merchant_invitations(
        (
            business_id,
            str(body.email).lower(),
            connection.tokens.hash_token(token),
            user["id"],
            INVITATION_HOURS,
        ),
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "INVITE",
        "MERCHANT_ACCOUNT",
        str(row["id"]),
        after_data={"email": row["email"], "businessId": business_id},
    )
    return Result(
        {
            **row,
            "inviteToken": token,
            "name": body.name,
            "expiresInHours": INVITATION_HOURS,
        }
    )


def revoke_merchant_invitation(
    festival_id: str,
    business_id: str,
    invitation_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.businesses.revoke_merchant_invitation_update_merchant_invitations(
        (invitation_id, business_id, festival_id)
    )
    if not row:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "대기 중인 초대만 회수할 수 있습니다."
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "REVOKE",
        "MERCHANT_ACCOUNT",
        invitation_id,
        after_data=row,
    )
    return Result(row)


def deactivate_business_merchant(
    festival_id: str,
    business_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
) -> Result:
    """업체와 연결된 상인 계정을 비활성화한다(축제 종료 후 정리).

    계정을 지우지 않고 비활성화만 한다 — 보유기간(비활성화 후 1년)이 지나면 OPS-11 파기
    배치가 개인정보를 지운다. 업체 연결도 끊어 이후 본인 확인이 성립하지 않게 한다.
    """
    business = found(
        connection.businesses.deactivate_business_merchant_select_festival_businesses(
            (business_id, festival_id)
        )
    )
    if not business["owner_membership_id"]:
        raise bad_request(
            "MERCHANT_NOT_LINKED", "이 업체에 연결된 상인 계정이 없습니다."
        )
    connection.businesses.deactivate_business_merchant_update_memberships(
        (business["owner_membership_id"],)
    )
    connection.businesses.deactivate_business_merchant_update_festival_businesses(
        (business_id,)
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "DEACTIVATE",
        "MERCHANT_ACCOUNT",
        str(business["owner_membership_id"]),
        after_data={"businessId": business_id},
    )
    return Result(status_code=204)


MIN_COMPARISON_SAMPLE = 5


def business_performance(festival_id: str, connection: UnitOfWork):
    """BIZ-04 운영자용 업체별 전환 지표와 전체 참여 성과.

    매출은 수집 동의(sales_consent)가 있는 업체만 집계·표시한다. 비교 통계는 표본이
    MIN_COMPARISON_SAMPLE 미만이면 개별 업체 실적이 역산되므로 내려주지 않는다.
    """
    rows = connection.businesses.business_performance_select_festival_businesses(
        (festival_id,)
    )
    for row in rows:
        row["redemption_rate"] = (
            round(row["coupons_redeemed"] / row["coupons_issued"] * 100, 1)
            if row["coupons_issued"]
            else None
        )
        row["visit_rate"] = (
            round(row["visits"] / row["impressions"] * 100, 1)
            if row["impressions"]
            else None
        )
    totals = {
        key: sum((row[key] for row in rows))
        for key in ("impressions", "visits", "coupons_issued", "coupons_redeemed")
    }
    totals["businesses"] = len(rows)
    totals["salesConsented"] = sum((1 for row in rows if row["sales_consent"]))
    comparison = None
    if len(rows) >= MIN_COMPARISON_SAMPLE:
        rates = sorted(
            (
                row["redemption_rate"]
                for row in rows
                if row["redemption_rate"] is not None
            )
        )
        comparison = {
            "averageRedemptionRate": round(sum(rates) / len(rates), 1)
            if rates
            else None,
            "medianRedemptionRate": rates[len(rates) // 2] if rates else None,
            "averageCouponsIssued": round(totals["coupons_issued"] / len(rows), 1),
        }
    return Result(
        {
            "items": rows,
            "totals": totals,
            "comparison": comparison,
            "comparisonSuppressed": comparison is None,
            "minComparisonSample": MIN_COMPARISON_SAMPLE,
            "salesNotice": "매출은 수집 동의를 받은 업체만 집계합니다.",
        }
    )
