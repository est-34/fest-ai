"""현장 활동의 저장과 조회. 축제·방문객 범위는 쿼리에서도 제한한다."""

from app.infrastructure.db import all_rows, one
from app.infrastructure.sql import keyset


class ActivitiesRepository:
    def __init__(self, connection):
        self.connection = connection

    def visitor_by_code(self, festival_id, code):
        connection = self.connection
        return one(
            connection,
            """SELECT id FROM visitor_sessions
            WHERE festival_id=%s AND activity_code=%s AND ended_at IS NULL AND expires_at>now() FOR SHARE""",
            (festival_id, code),
        )

    def profile(self, visitor_id):
        connection = self.connection
        return one(
            connection,
            "SELECT activity_code AS visitor_code FROM visitor_sessions WHERE id=%s",
            (visitor_id,),
        )

    def list_plogging(self, params):
        connection = self.connection
        return all_rows(
            connection,
            f"""SELECT p.id,p.submission_code,v.activity_code AS visitor_code,
            p.bag_count,p.location,p.points,p.verified_at,u.email AS operator_email
            FROM plogging_submissions p JOIN visitor_sessions v ON v.id=p.visitor_session_id
            JOIN users u ON u.id=p.operator_id WHERE p.festival_id=%(festival_id)s
            AND (%(visitor_id)s::uuid IS NULL OR p.visitor_session_id=%(visitor_id)s)
            AND {keyset("verified_at", "p")} ORDER BY p.verified_at DESC,p.id DESC LIMIT %(limit)s""",
            params,
        )

    def list_rentals(self, params):
        connection = self.connection
        return all_rows(
            connection,
            f"""SELECT r.id,r.rental_code,v.activity_code AS visitor_code,r.container_type,
            r.quantity,r.station,r.rented_at,r.returned_at,u.email AS operator_email,
            CASE WHEN r.returned_at IS NULL THEN 'RENTED' ELSE 'RETURNED' END AS status,
            CASE WHEN r.returned_at IS NULL THEN 'WAITING' ELSE 'ISSUED' END AS stamp_status,
            CASE WHEN r.returned_at IS NULL THEN 0 ELSE 50 END AS stamp_points
            FROM container_rentals r JOIN visitor_sessions v ON v.id=r.visitor_session_id
            JOIN users u ON u.id=r.operator_id WHERE r.festival_id=%(festival_id)s
            AND (%(visitor_id)s::uuid IS NULL OR r.visitor_session_id=%(visitor_id)s)
            AND {keyset("rented_at", "r")} ORDER BY r.rented_at DESC,r.id DESC LIMIT %(limit)s""",
            params,
        )

    def create_plogging(self, festival_id, visitor_id, code, body, operator_id):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO plogging_submissions
            (festival_id,visitor_session_id,submission_code,bag_count,location,points,operator_id)
            VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (
                festival_id,
                visitor_id,
                code,
                body.bag_count,
                body.location,
                body.bag_count * 30,
                operator_id,
            ),
        )

    def create_rental(self, festival_id, visitor_id, code, body, operator_id):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO container_rentals
            (festival_id,visitor_session_id,rental_code,container_type,quantity,station,operator_id)
            VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            (
                festival_id,
                visitor_id,
                code,
                body.container_type,
                body.quantity,
                body.station,
                operator_id,
            ),
        )

    def locked_rental(self, festival_id, rental_id):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM container_rentals WHERE id=%s AND festival_id=%s FOR UPDATE",
            (rental_id, festival_id),
        )

    def return_rental(self, rental_id, operator_id):
        connection = self.connection
        return one(
            connection,
            "UPDATE container_rentals SET returned_at=now(),returned_by=%s WHERE id=%s RETURNING *",
            (operator_id, rental_id),
        )

    def credit_plogging(self, row):
        connection = self.connection
        connection.execute(
            """INSERT INTO point_ledger(visitor_session_id,plogging_submission_id,points_delta,reason)
            VALUES(%s,%s,%s,'PLOGGING')""",
            (row["visitor_session_id"], row["id"], row["points"]),
        )

    def credit_return(self, row):
        connection = self.connection
        connection.execute(
            """INSERT INTO point_ledger(visitor_session_id,container_rental_id,points_delta,reason)
            VALUES(%s,%s,50,'REUSABLE_CUP')""",
            (row["visitor_session_id"], row["id"]),
        )
