from fastapi import APIRouter, Request, Response

from app.modules.commerce.application import businesses as service
from app.shared.adapters.http.deps import Db, IfMatch, Manager, ManagerOrReviewer, Scope
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    BusinessIn,
    FestivalBusinessPatch,
    MerchantInviteIn,
    ReviewIn,
)

router = APIRouter(tags=["businesses"])


@router.get("/public/festivals/{festival_code}/businesses")
def public_businesses(
    festival_code: str,
    request: Request,
    response: Response,
    connection: Db,
    category: str | None = None,
):
    return render(
        service.public_businesses(
            festival_code=festival_code,
            connection=connection,
            category=category,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/businesses")
def businesses(
    festival_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
    status: str | None = None,
):
    return render(
        service.businesses(
            festival_id=festival_id,
            connection=connection,
            status=status,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/businesses", status_code=201)
def create_business(
    festival_id: str,
    body: BusinessIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_business(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/businesses/{business_id}")
def update_festival_business(
    festival_id: str,
    business_id: str,
    body: FestivalBusinessPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
):
    return render(
        service.update_festival_business(
            festival_id=festival_id,
            business_id=business_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/businesses/{business_id}/review")
def review_business(
    festival_id: str,
    business_id: str,
    body: ReviewIn,
    request: Request,
    _: Scope,
    user: ManagerOrReviewer,
    connection: Db,
    response: Response,
):
    return render(
        service.review_business(
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


@router.get("/admin/festivals/{festival_id}/businesses/{business_id}/invitations")
def merchant_invitations(
    festival_id: str,
    business_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.merchant_invitations(
            festival_id=festival_id,
            business_id=business_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/businesses/{business_id}/invitations",
    status_code=201,
)
def create_merchant_invitation(
    festival_id: str,
    business_id: str,
    body: MerchantInviteIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_merchant_invitation(
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


@router.post(
    "/admin/festivals/{festival_id}/businesses/{business_id}/invitations/{invitation_id}/revoke"
)
def revoke_merchant_invitation(
    festival_id: str,
    business_id: str,
    invitation_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.revoke_merchant_invitation(
            festival_id=festival_id,
            business_id=business_id,
            invitation_id=invitation_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.delete(
    "/admin/festivals/{festival_id}/businesses/{business_id}/merchant", status_code=204
)
def deactivate_business_merchant(
    festival_id: str,
    business_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
) -> Response:
    return render(
        service.deactivate_business_merchant(
            festival_id=festival_id,
            business_id=business_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/business-performance")
def business_performance(
    festival_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.business_performance(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )
