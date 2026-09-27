from fastapi import APIRouter, Request, Response

from app.modules.commerce.application import merchant as service
from app.shared.adapters.http.deps import Db, Merchant
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    BusinessEventIn,
    BusinessPatch,
    CouponIn,
    CouponRedeemIn,
    CouponReverseIn,
)

router = APIRouter(tags=["merchant"])


@router.get("/merchant/businesses")
def businesses(request: Request, user: Merchant, connection: Db, response: Response):
    return render(
        service.businesses(user=user, connection=connection),
        request,
        response,
    )


@router.patch("/merchant/businesses/{business_id}")
def update_business(
    business_id: str,
    body: BusinessPatch,
    request: Request,
    user: Merchant,
    connection: Db,
    response: Response,
):
    return render(
        service.update_business(
            business_id=business_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/merchant/businesses/{business_id}/coupons", status_code=201)
def create_coupon(
    business_id: str,
    body: CouponIn,
    request: Request,
    user: Merchant,
    connection: Db,
    response: Response,
):
    return render(
        service.create_coupon(
            business_id=business_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/merchant/coupon-issues/{issue_id}/redeem")
def redeem_coupon(
    issue_id: str,
    body: CouponRedeemIn,
    request: Request,
    user: Merchant,
    connection: Db,
    response: Response,
):
    return render(
        service.redeem_coupon(
            issue_id=issue_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/merchant/coupon-redemptions/{redemption_id}/reverse")
def reverse_coupon(
    redemption_id: str,
    body: CouponReverseIn,
    request: Request,
    user: Merchant,
    connection: Db,
    response: Response,
):
    return render(
        service.reverse_coupon(
            redemption_id=redemption_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/merchant/businesses/{business_id}/events", status_code=201)
def record_business_event(
    business_id: str,
    body: BusinessEventIn,
    request: Request,
    user: Merchant,
    connection: Db,
    response: Response,
):
    return render(
        service.record_business_event(
            business_id=business_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/merchant/businesses/{business_id}/performance")
def performance(
    business_id: str,
    request: Request,
    user: Merchant,
    connection: Db,
    response: Response,
):
    return render(
        service.performance(
            business_id=business_id,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
