"프로그램 회차 예약·대기표. 방문객이 잡고 운영자가 상태를 옮긴다."

from app.modules.engagement.application.ports import UnitOfWork
from app.modules.engagement.domain import (
    validate_booking_cancel_window,
    validate_booking_transition,
)
from app.shared.application.common import logged
from app.shared.application.context import ActionContext
from app.shared.application.idempotency import idempotent
from app.shared.application.pagination import cursor_params, paged
from app.shared.application.results import Result
from app.shared.application.schemas import BookingIn, BookingStatusIn
from app.shared.domain.errors import DuplicateKey, conflict, found


def reserved_seats(connection: UnitOfWork, session_id) -> int:
    """정원을 차지하고 있는 인원. 입장 완료(COMPLETED)도 자리를 쓴 것이다 —
    빼면 운영자가 입장 처리를 할수록 자리가 비어 보여서 회차 진행 중에 정원 초과 예약이 확정됐다."""
    return connection.bookings.reserved_seats_select_bookings((session_id,))["count"]


def promote_waiting(connection: UnitOfWork, session_id) -> None:
    """빈 자리만큼 대기를 순번대로 확정한다.

    예전에는 선두 한 건만 봤다 — 5명이 취소해도 한 건만 올라갔고, 선두가 인원 때문에 못
    들어가면 뒤에 맞는 대기가 있어도 자리가 비어 있는 채로 남았다.
    인원이 안 맞는 대기는 건너뛰되 순번은 그대로 두어 다음 취소 때 다시 후보가 된다.
    """
    session = connection.bookings.promote_waiting_select_program_sessions((session_id,))
    waiting = connection.bookings.promote_waiting_select_bookings((session_id,))
    taken = reserved_seats(connection, session_id)
    for booking in waiting:
        if (
            session["capacity"] is not None
            and taken + booking["party_size"] > session["capacity"]
        ):
            continue
        connection.bookings.promote_waiting_update_bookings((booking["id"],))
        taken += booking["party_size"]


def my_bookings(visitor: dict, connection: UnitOfWork):
    rows = connection.bookings.my_bookings_select_bookings((visitor["id"],))
    connection.notifications.deliveries(
        visitor["festival_id"],
        "BOOKING_CALL",
        [row["id"] for row in rows if row["status"] == "CALLED"],
        visitor["id"],
    )
    return Result(rows)


def create_booking(
    session_id: str,
    body: BookingIn,
    visitor: dict,
    connection: UnitOfWork,
    idempotency_key: str | None,
):

    def work():
        session = found(
            connection.bookings.work_select_program_sessions(
                (session_id, visitor["festival_id"])
            ),
            "예약 가능한 프로그램 회차를 찾을 수 없습니다.",
        )
        confirmed = (
            session["capacity"] is None
            or reserved_seats(connection, session_id) + body.party_size
            <= session["capacity"]
        )
        queue_number = (
            None
            if confirmed
            else connection.bookings.work_select_bookings((session_id,))["next"]
        )
        try:
            row = connection.bookings.work_insert_bookings_2(
                {
                    "festival_id": visitor["festival_id"],
                    "visitor_id": visitor["id"],
                    "session_id": session_id,
                    "status": "CONFIRMED" if confirmed else "WAITING",
                    "party_size": body.party_size,
                    "queue_number": queue_number,
                },
            )
        except DuplicateKey as error:
            raise conflict(
                "DUPLICATE_ACTION", "같은 회차의 예약 또는 대기표가 이미 있습니다."
            ) from error
        return (
            201,
            {**row, "programTitle": session["title"], "startsAt": session["starts_at"]},
        )

    return Result.from_idempotent(
        idempotent(
            connection,
            key=idempotency_key,
            scope=f"booking:{visitor['id']}:{session_id}",
            body=body.model_dump(),
            work=work,
        )
    )


def cancel_booking(booking_id: str, visitor: dict, connection: UnitOfWork) -> Result:
    booking = found(
        connection.bookings.cancel_booking_select_bookings((booking_id, visitor["id"]))
    )
    validate_booking_transition(booking["status"], "CANCELLED")
    validate_booking_cancel_window(booking["starts_at"])
    connection.bookings.cancel_booking_update_bookings((booking_id,))
    if booking["status"] in ("CONFIRMED", "CALLED"):
        promote_waiting(connection, booking["program_session_id"])
    return Result(status_code=204)


def bookings(
    festival_id: str,
    connection: UnitOfWork,
    status: str | None,
    limit: int,
    cursor: str | None,
):
    """예약·대기표 목록. 티켓과 같은 (created_at, id) 키셋 커서로 자른다."""
    rows = connection.bookings.bookings_select_bookings(
        {"festival_id": festival_id, "status": status, **cursor_params(cursor, limit)},
    )
    rows, page = paged(rows, limit)
    rows.sort(
        key=lambda row: (
            row["starts_at"],
            row["queue_number"] is not None,
            row["queue_number"] or 0,
            row["created_at"],
        )
    )
    return Result(rows, page=page)


def update_booking_status(
    festival_id: str,
    booking_id: str,
    body: BookingStatusIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    booking = found(
        connection.bookings.update_booking_status_select_bookings(
            (booking_id, festival_id)
        )
    )
    validate_booking_transition(booking["status"], body.status)
    row = connection.bookings.update_booking_status_update_bookings_2(
        {"status": body.status, "booking_id": booking_id}
    )
    if body.status == "NO_SHOW":
        promote_waiting(connection, booking["program_session_id"])
    logged(
        connection,
        context,
        user,
        festival_id,
        body.status,
        "BOOKING",
        booking_id,
        before_data=booking,
        after_data={**row, "note": body.note},
    )
    return Result(row)
