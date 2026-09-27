import secrets

from app.modules.engagement.application.ports import UnitOfWork
from app.shared.application.common import logged
from app.shared.application.idempotency import idempotent
from app.shared.application.pagination import cursor_params, paged
from app.shared.application.results import Result
from app.shared.domain.errors import conflict, found


def profile(connection: UnitOfWork, visitor):
    return Result(found(connection.activities.profile(visitor["id"])))


def history(connection: UnitOfWork, festival_id, kind, limit, cursor, visitor_id=None):
    loader, column = (
        (connection.activities.list_plogging, "verified_at")
        if kind == "plogging"
        else (connection.activities.list_rentals, "rented_at")
    )
    rows = loader(
        {
            "festival_id": festival_id,
            "visitor_id": visitor_id,
            **cursor_params(cursor, limit),
        },
    )
    rows, page = paged(rows, limit, column)
    return Result(rows, page=page)


def certify(connection: UnitOfWork, context, user, festival_id, body, key):
    def work():
        visitor = found(
            connection.activities.visitor_by_code(
                festival_id, body.visitor_code.strip().upper()
            ),
            "해당 축제의 유효한 방문객 코드를 확인해 주세요.",
        )
        row = connection.activities.create_plogging(
            festival_id,
            visitor["id"],
            "PL-" + secrets.token_hex(8).upper(),
            body,
            user["id"],
        )
        connection.activities.credit_plogging(row)
        logged(
            connection,
            context,
            user,
            festival_id,
            "VERIFY",
            "PLOGGING",
            row["id"],
            after_data={"points": row["points"], "bagCount": row["bag_count"]},
        )
        return 201, {
            **row,
            "visitor_code": body.visitor_code.strip().upper(),
            "operator_email": user["email"],
        }

    return Result.from_idempotent(
        idempotent(
            connection,
            key=key,
            scope=f"plogging:{festival_id}:{user['id']}",
            body=body.model_dump(),
            work=work,
        )
    )


def rent(connection: UnitOfWork, context, user, festival_id, body, key):
    def work():
        visitor = found(
            connection.activities.visitor_by_code(
                festival_id, body.visitor_code.strip().upper()
            ),
            "해당 축제의 유효한 방문객 코드를 확인해 주세요.",
        )
        row = connection.activities.create_rental(
            festival_id,
            visitor["id"],
            "RC-" + secrets.token_hex(8).upper(),
            body,
            user["id"],
        )
        logged(
            connection,
            context,
            user,
            festival_id,
            "RENT",
            "CONTAINER_RENTAL",
            row["id"],
            after_data={
                "quantity": row["quantity"],
                "containerType": row["container_type"],
            },
        )
        return 201, {
            **row,
            "visitor_code": body.visitor_code.strip().upper(),
            "operator_email": user["email"],
            "status": "RENTED",
            "stamp_status": "WAITING",
            "stamp_points": 0,
        }

    return Result.from_idempotent(
        idempotent(
            connection,
            key=key,
            scope=f"rental:{festival_id}:{user['id']}",
            body=body.model_dump(),
            work=work,
        )
    )


def return_container(
    connection: UnitOfWork, context, user, festival_id, rental_id, key
):
    def work():
        row = found(connection.activities.locked_rental(festival_id, rental_id))
        if row["returned_at"] is not None:
            raise conflict("ALREADY_RETURNED", "이미 반납 처리된 대여 건입니다.")
        updated = connection.activities.return_rental(rental_id, user["id"])
        connection.activities.credit_return(updated)
        logged(
            connection,
            context,
            user,
            festival_id,
            "RETURN",
            "CONTAINER_RENTAL",
            rental_id,
            after_data={"points": 50},
        )
        return 200, {
            **updated,
            "status": "RETURNED",
            "stamp_status": "ISSUED",
            "stamp_points": 50,
        }

    return Result.from_idempotent(
        idempotent(
            connection,
            key=key,
            scope=f"return:{festival_id}:{rental_id}",
            body={},
            work=work,
        )
    )
