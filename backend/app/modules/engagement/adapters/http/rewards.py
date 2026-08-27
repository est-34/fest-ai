from fastapi import APIRouter, Request, Response

from app.modules.engagement.application import rewards as service
from app.shared.adapters.http.deps import (
    Db,
    IdempotencyKey,
    Manager,
    Operator,
    Scope,
    Visitor,
)
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    CouponIn,
    CouponRedeemIn,
    RewardActionIn,
    RewardCampaignIn,
    RewardEventIn,
)

router = APIRouter(tags=["rewards"])


@router.get("/public/festivals/{festival_code}/coupons")
def public_coupons(
    festival_code: str, request: Request, response: Response, connection: Db
):
    return render(
        service.public_coupons(
            festival_code=festival_code,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/visitor/coupons")
def my_coupons(request: Request, visitor: Visitor, connection: Db, response: Response):
    return render(
        service.my_coupons(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.post("/visitor/coupons/{coupon_id}/issues", status_code=201)
def issue_coupon(
    coupon_id: str,
    request: Request,
    response: Response,
    visitor: Visitor,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.issue_coupon(
            coupon_id=coupon_id,
            visitor=visitor,
            connection=connection,
            idempotency_key=idempotency_key,
        ),
        request,
        response,
    )


@router.post("/visitor/coupon-issues/{issue_id}/token")
def rotate_issue_token(
    issue_id: str,
    request: Request,
    visitor: Visitor,
    connection: Db,
    response: Response,
):
    return render(
        service.rotate_issue_token(
            issue_id=issue_id,
            visitor=visitor,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/visitor/reward-actions")
def reward_actions(
    request: Request, visitor: Visitor, connection: Db, response: Response
):
    return render(
        service.reward_actions(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.post("/visitor/reward-events", status_code=201)
def create_reward_event(
    body: RewardEventIn,
    request: Request,
    response: Response,
    visitor: Visitor,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.create_reward_event(
            body=body,
            visitor=visitor,
            connection=connection,
            idempotency_key=idempotency_key,
        ),
        request,
        response,
    )


@router.get("/visitor/points")
def points(request: Request, visitor: Visitor, connection: Db, response: Response):
    return render(
        service.points(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/businesses/{business_id}/coupons")
def coupons(
    festival_id: str,
    business_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.coupons(
            festival_id=festival_id,
            business_id=business_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/businesses/{business_id}/coupons", status_code=201
)
def create_coupon(
    festival_id: str,
    business_id: str,
    body: CouponIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_coupon(
            festival_id=festival_id,
            business_id=business_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/coupon-redemptions")
def redeem_coupon_on_site(
    festival_id: str,
    body: CouponRedeemIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.redeem_coupon_on_site(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/reward-campaigns")
def reward_campaigns(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.reward_campaigns(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/reward-campaigns", status_code=201)
def create_reward_campaign(
    festival_id: str,
    body: RewardCampaignIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_reward_campaign(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/reward-campaigns/{campaign_id}/actions",
    status_code=201,
)
def create_reward_action(
    festival_id: str,
    campaign_id: str,
    body: RewardActionIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_reward_action(
            festival_id=festival_id,
            campaign_id=campaign_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
