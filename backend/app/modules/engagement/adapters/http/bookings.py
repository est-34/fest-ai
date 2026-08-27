from fastapi import APIRouter, Query, Request, Response

from app.modules.engagement.application import bookings as service
from app.shared.adapters.http.deps import Db, IdempotencyKey, Operator, Scope, Visitor
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import BookingIn, BookingStatusIn

router = APIRouter(tags=["bookings"])


@router.get("/visitor/bookings")
def my_bookings(request: Request, visitor: Visitor, connection: Db, response: Response):
    return render(
        service.my_bookings(visitor=visitor, connection=connection),
        request,
        response,
    )


@router.post("/visitor/program-sessions/{session_id}/bookings", status_code=201)
def create_booking(
    session_id: str,
    body: BookingIn,
    request: Request,
    response: Response,
    visitor: Visitor,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.create_booking(
            session_id=session_id,
            body=body,
            visitor=visitor,
            connection=connection,
            idempotency_key=idempotency_key,
        ),
        request,
        response,
    )


@router.delete("/visitor/bookings/{booking_id}", status_code=204)
def cancel_booking(
    booking_id: str,
    visitor: Visitor,
    connection: Db,
    request: Request,
    response: Response,
) -> Response:
    return render(
        service.cancel_booking(
            booking_id=booking_id, visitor=visitor, connection=connection
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/bookings")
def bookings(
    festival_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    cursor: str | None = None,
):
    return render(
        service.bookings(
            festival_id=festival_id,
            connection=connection,
            status=status,
            limit=limit,
            cursor=cursor,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/bookings/{booking_id}/status")
def update_booking_status(
    festival_id: str,
    booking_id: str,
    body: BookingStatusIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.update_booking_status(
            festival_id=festival_id,
            booking_id=booking_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
