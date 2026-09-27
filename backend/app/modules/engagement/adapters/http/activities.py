from typing import Literal

from fastapi import APIRouter, Query, Request, Response

from app.modules.engagement.application import activities as service
from app.shared.adapters.http.deps import Db, IdempotencyKey, Operator, Scope, Visitor
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import ContainerRentalIn, PloggingIn

router = APIRouter(tags=["activities"])


@router.get("/visitor/activity-profile")
def profile(request: Request, response: Response, visitor: Visitor, connection: Db):
    return render(service.profile(connection, visitor), request, response)


@router.get("/visitor/activities/{kind}")
def visitor_history(
    kind: Literal["plogging", "rentals"],
    request: Request,
    response: Response,
    visitor: Visitor,
    connection: Db,
    limit: int = Query(100, ge=1, le=200),
    cursor: str | None = None,
):
    return render(
        service.history(
            connection, visitor["festival_id"], kind, limit, cursor, visitor["id"]
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/activities/{kind}")
def admin_history(
    festival_id: str,
    kind: Literal["plogging", "rentals"],
    request: Request,
    response: Response,
    _: Scope,
    user: Operator,
    connection: Db,
    limit: int = Query(100, ge=1, le=200),
    cursor: str | None = None,
):
    return render(
        service.history(connection, festival_id, kind, limit, cursor), request, response
    )


@router.post("/admin/festivals/{festival_id}/activities/plogging", status_code=201)
def certify(
    festival_id: str,
    body: PloggingIn,
    request: Request,
    response: Response,
    _: Scope,
    user: Operator,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.certify(
            connection,
            action_context(request),
            user,
            festival_id,
            body,
            idempotency_key,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/activities/rentals", status_code=201)
def rent(
    festival_id: str,
    body: ContainerRentalIn,
    request: Request,
    response: Response,
    _: Scope,
    user: Operator,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.rent(
            connection,
            action_context(request),
            user,
            festival_id,
            body,
            idempotency_key,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/activities/rentals/{rental_id}/return")
def return_container(
    festival_id: str,
    rental_id: str,
    request: Request,
    response: Response,
    _: Scope,
    user: Operator,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.return_container(
            connection,
            action_context(request),
            user,
            festival_id,
            rental_id,
            idempotency_key,
        ),
        request,
        response,
    )
