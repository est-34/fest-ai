from fastapi import APIRouter, Request, Response

from app.modules.festival.application import admin_content as service
from app.shared.adapters.http.deps import (
    Db,
    Manager,
    ManagerOrReviewer,
    Operator,
    Scope,
)
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    AIDecisionIn,
    ContentItemIn,
    ContentVersionIn,
    PublishContentIn,
    ReviewIn,
)

router = APIRouter(tags=["admin-content"])


@router.get("/admin/festivals/{festival_id}/content-items")
def items(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.items(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/content-items", status_code=201)
def create_item(
    festival_id: str,
    body: ContentItemIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_item(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/content-items/{item_id}")
def item_detail(
    festival_id: str,
    item_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.item_detail(
            festival_id=festival_id,
            item_id=item_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/content-items/{item_id}/versions", status_code=201
)
def create_version(
    festival_id: str,
    item_id: str,
    body: ContentVersionIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.create_version(
            festival_id=festival_id,
            item_id=item_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/content-versions/{version_id}/submit")
def submit_version(
    festival_id: str,
    version_id: str,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.submit_version(
            festival_id=festival_id,
            version_id=version_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/content-versions/{version_id}/reviews")
def review_version(
    festival_id: str,
    version_id: str,
    body: ReviewIn,
    request: Request,
    _: Scope,
    user: ManagerOrReviewer,
    connection: Db,
    response: Response,
):
    return render(
        service.review_version(
            festival_id=festival_id,
            version_id=version_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/content-items/{item_id}/publish")
def publish_item(
    festival_id: str,
    item_id: str,
    body: PublishContentIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.publish_item(
            festival_id=festival_id,
            item_id=item_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/content-items/{item_id}/unpublish")
def unpublish_item(
    festival_id: str,
    item_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.unpublish_item(
            festival_id=festival_id,
            item_id=item_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/ai/reviews")
def ai_reviews(
    festival_id: str,
    request: Request,
    _: Scope,
    user: ManagerOrReviewer,
    connection: Db,
    response: Response,
    status: str = "OPEN",
):
    return render(
        service.ai_reviews(
            festival_id=festival_id,
            connection=connection,
            status=status,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/ai/reviews/{review_id}/decision")
def ai_decision(
    festival_id: str,
    review_id: str,
    body: AIDecisionIn,
    request: Request,
    _: Scope,
    user: ManagerOrReviewer,
    connection: Db,
    response: Response,
):
    return render(
        service.ai_decision(
            festival_id=festival_id,
            review_id=review_id,
            body=body,
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
