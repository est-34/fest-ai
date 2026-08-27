from app.infrastructure.db import all_rows, one
from app.infrastructure.sql import safety_facility_order

FESTIVAL_INSERT = """INSERT INTO festivals(organization_id,code,name,description,timezone,starts_at,ends_at,default_language,supported_languages)
    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *"""


class AdminCoreRepository:
    def __init__(self, connection):
        self.connection = connection

    def list_festivals_select_festivals(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT id,code,name,description,timezone,starts_at,ends_at,status,default_language,
            supported_languages,version,updated_at FROM festivals WHERE organization_id=%(organization_id)s
            AND (%(super_admin)s OR %(scope)s::jsonb ? id::text OR %(scope)s::jsonb ? '*') ORDER BY starts_at DESC""",
            params,
        )

    def insert_festival(self, params=()):
        connection = self.connection
        return one(connection, FESTIVAL_INSERT, params)

    def festival_by_id(self, params=()):
        connection = self.connection
        return one(connection, "SELECT * FROM festivals WHERE id=%s", params)

    def list_areas_select_festival_areas(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM festival_areas WHERE festival_id=%s ORDER BY name",
            params,
        )

    def create_area_insert_festival_areas(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO festival_areas(festival_id,name,area_type,description,latitude,longitude,status)
            VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def get_area_select_festival_areas(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM festival_areas WHERE id=%s AND festival_id=%s",
            params,
        )

    def list_facilities_select_facilities(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            f"SELECT * FROM facilities WHERE festival_id=%s ORDER BY {safety_facility_order()},name",
            params,
        )

    def create_facility_insert_facilities(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO facilities(festival_id,area_id,name,facility_type,accessibility,operating_hours,status)
            SELECT %(festival_id)s,%(area_id)s,%(name)s,%(facility_type)s,%(jsonb_accessibility)s,%(jsonb_operating_hours)s,%(status)s WHERE EXISTS(SELECT 1 FROM festival_areas WHERE id=%(area_id)s AND festival_id=%(festival_id)s) RETURNING *""",
            params,
        )

    def get_facility_select_facilities(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM facilities WHERE id=%s AND festival_id=%s",
            params,
        )

    def list_programs_select_programs(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM programs WHERE festival_id=%s ORDER BY created_at DESC",
            params,
        )

    def create_program_insert_programs(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO programs(festival_id,slug,title,summary,category,accessibility,status) VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            params,
        )

    def get_program_select_programs(self, params=()):
        connection = self.connection
        return one(
            connection, "SELECT * FROM programs WHERE id=%s AND festival_id=%s", params
        )

    def list_sessions_select_program_sessions(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM program_sessions WHERE festival_id=%s AND program_id=%s ORDER BY starts_at",
            params,
        )

    def create_session_insert_program_sessions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO program_sessions(festival_id,program_id,area_id,starts_at,ends_at,capacity,status)
            SELECT %(festival_id)s,%(program_id)s,%(area_id)s,%(starts_at)s,%(ends_at)s,%(capacity)s,%(status)s WHERE EXISTS(SELECT 1 FROM programs WHERE id=%(program_id)s AND festival_id=%(festival_id)s)
            AND EXISTS(SELECT 1 FROM festival_areas WHERE id=%(area_id)s AND festival_id=%(festival_id)s) RETURNING *""",
            params,
        )

    def clone_festival_insert_festival_areas(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO festival_areas(festival_id,name,area_type,description,latitude,longitude,status)
            SELECT %s,name,area_type,description,latitude,longitude,'ACTIVE' FROM festival_areas
            WHERE festival_id=%s AND status='ACTIVE'""",
            params,
        )

    def clone_festival_insert_facilities(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO facilities(festival_id,area_id,name,facility_type,accessibility,operating_hours,status)
            SELECT %(target_festival_id)s,new_area.id,f.name,f.facility_type,f.accessibility,f.operating_hours,'ACTIVE'
            FROM facilities f JOIN festival_areas old_area ON old_area.id=f.area_id
            JOIN festival_areas new_area ON new_area.festival_id=%(target_festival_id)s AND new_area.name=old_area.name
            WHERE f.festival_id=%(festival_id)s AND f.status='ACTIVE'""",
            params,
        )

    def clone_festival_insert_programs(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO programs(festival_id,slug,title,summary,category,accessibility,status)
            SELECT %s,slug,title,summary,category,accessibility,'DRAFT' FROM programs
            WHERE festival_id=%s AND status<>'ARCHIVED'""",
            params,
        )

    def clone_festival_insert_program_sessions(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO program_sessions(festival_id,program_id,area_id,starts_at,ends_at,capacity,status)
            SELECT %(target_festival_id)s,new_program.id,new_area.id,ps.starts_at+%(shift)s,ps.ends_at+%(shift)s,ps.capacity,'OPEN'
            FROM program_sessions ps JOIN programs old_program ON old_program.id=ps.program_id
            JOIN festival_areas old_area ON old_area.id=ps.area_id
            JOIN programs new_program ON new_program.festival_id=%(target_festival_id)s AND new_program.slug=old_program.slug
            JOIN festival_areas new_area ON new_area.festival_id=%(target_festival_id)s AND new_area.name=old_area.name
            WHERE ps.festival_id=%(festival_id)s AND ps.status<>'CANCELLED'""",
            params,
        )

    def clone_festival_select_festival_areas(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT
            (SELECT count(*)::int FROM festival_areas WHERE festival_id=%(target_festival_id)s) AS areas,
            (SELECT count(*)::int FROM facilities WHERE festival_id=%(target_festival_id)s) AS facilities,
            (SELECT count(*)::int FROM programs WHERE festival_id=%(target_festival_id)s) AS programs,
            (SELECT count(*)::int FROM program_sessions WHERE festival_id=%(target_festival_id)s) AS sessions""",
            params,
        )
