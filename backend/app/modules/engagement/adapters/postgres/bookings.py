from app.infrastructure.db import all_rows, one
from app.infrastructure.sql import keyset


class BookingsRepository:
    def __init__(self, connection):
        self.connection = connection

    def reserved_seats_select_bookings(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT coalesce(sum(party_size),0)::int AS count FROM bookings
            WHERE program_session_id=%s AND status IN ('CONFIRMED','CALLED','COMPLETED')""",
            params,
        )

    def promote_waiting_select_program_sessions(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT capacity FROM program_sessions WHERE id=%s FOR UPDATE",
            params,
        )

    def promote_waiting_select_bookings(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT id,party_size FROM bookings WHERE program_session_id=%s AND status='WAITING'
            ORDER BY queue_number FOR UPDATE SKIP LOCKED""",
            params,
        )

    def promote_waiting_update_bookings(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE bookings SET status='CONFIRMED',queue_number=NULL,version=version+1,updated_at=now() WHERE id=%s",
            params,
        )

    def my_bookings_select_bookings(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT b.id,b.status,b.party_size,b.queue_number,b.called_at,b.created_at,b.updated_at,
            ps.starts_at,ps.ends_at,p.title AS program_title,p.slug AS program_slug,a.name AS area_name
            FROM bookings b JOIN program_sessions ps ON ps.id=b.program_session_id JOIN programs p ON p.id=ps.program_id
            JOIN festival_areas a ON a.id=ps.area_id WHERE b.visitor_session_id=%s ORDER BY ps.starts_at""",
            params,
        )

    def work_select_program_sessions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT ps.*,p.title FROM program_sessions ps JOIN programs p ON p.id=ps.program_id
                WHERE ps.id=%s AND ps.festival_id=%s AND ps.status='OPEN' AND ps.ends_at>now() FOR UPDATE OF ps""",
            params,
        )

    def work_select_bookings(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT coalesce(max(queue_number),0)+1 AS next FROM bookings WHERE program_session_id=%s",
            params,
        )

    def work_insert_bookings_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO bookings(festival_id,visitor_session_id,program_session_id,status,party_size,queue_number)
                    VALUES(%(festival_id)s,%(visitor_id)s,%(session_id)s,%(status)s,%(party_size)s,%(queue_number)s)
                    RETURNING id,status,party_size,queue_number,created_at""",
            params,
        )

    def cancel_booking_select_bookings(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT b.*,ps.starts_at FROM bookings b
            JOIN program_sessions ps ON ps.id=b.program_session_id
            WHERE b.id=%s AND b.visitor_session_id=%s FOR UPDATE OF b""",
            params,
        )

    def cancel_booking_update_bookings(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE bookings SET status='CANCELLED',cancelled_at=now(),version=version+1,updated_at=now() WHERE id=%s",
            params,
        )

    def bookings_select_bookings(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            f"""SELECT b.id,b.status,b.party_size,b.queue_number,b.called_at,b.created_at,b.updated_at,
            ps.starts_at,ps.ends_at,p.id AS program_id,p.title AS program_title
            FROM bookings b JOIN program_sessions ps ON ps.id=b.program_session_id JOIN programs p ON p.id=ps.program_id
            WHERE b.festival_id=%(festival_id)s AND (%(status)s::text IS NULL OR b.status=%(status)s)
            AND {keyset(alias="b")}
            ORDER BY b.created_at DESC,b.id DESC LIMIT %(limit)s""",
            params,
        )

    def update_booking_status_select_bookings(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM bookings WHERE id=%s AND festival_id=%s FOR UPDATE",
            params,
        )

    def update_booking_status_update_bookings_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE bookings SET status=%(status)s,
            called_at=CASE WHEN %(status)s='CALLED' THEN now() ELSE called_at END,
            completed_at=CASE WHEN %(status)s='COMPLETED' THEN now() ELSE completed_at END,
            version=version+1,updated_at=now() WHERE id=%(booking_id)s RETURNING *""",
            params,
        )
