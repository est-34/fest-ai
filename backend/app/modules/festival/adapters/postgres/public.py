from app.infrastructure.db import all_rows, one
from app.infrastructure.sql import safety_facility_order


class PublicRepository:
    def __init__(self, connection):
        self.connection = connection

    def published_festival_select_festivals(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT id,code,name,description,timezone,starts_at,ends_at,status,default_language,
                      supported_languages,visitor_menus,transport,
                      kiosk_camera_enabled,updated_at FROM festivals
               WHERE code=%s AND status IN ('PUBLISHED','ONGOING','ENDED')""",
            params,
        )

    def programs_select_programs(
        self,
        festival_id,
        language,
        default_language,
        limit,
        *,
        category,
        area_id,
        status,
        selected_date,
    ):
        connection = self.connection
        values: list = [festival_id, language, default_language]
        clauses = [
            "p.festival_id=%s",
            "p.status='PUBLISHED'",
            "ci.lifecycle_status='PUBLISHED'",
            "cv.language IN (%s,%s)",
        ]
        for clause, value in (
            ("p.category=%s", category),
            ("ps.area_id=%s", area_id),
            ("ps.status=%s", status),
            ("(ps.starts_at AT TIME ZONE f.timezone)::date=%s", selected_date),
        ):
            if value:
                clauses.append(clause)
                values.append(value)
        params = [*values, limit]
        return all_rows(
            connection,
            f"""SELECT p.id,p.slug,p.title,p.summary,p.category,p.accessibility,p.updated_at,cv.language,
                        ci.updated_at AS published_at,
                        jsonb_agg(DISTINCT jsonb_build_object('id',ps.id,'startsAt',ps.starts_at,'endsAt',ps.ends_at,
                          'capacity',ps.capacity,'status',ps.status,'area',jsonb_build_object('id',a.id,'name',a.name))) AS sessions
                 FROM programs p JOIN festivals f ON f.id=p.festival_id JOIN program_sessions ps ON ps.program_id=p.id
                 JOIN festival_areas a ON a.id=ps.area_id
                 JOIN content_items ci ON ci.festival_id=p.festival_id AND ci.resource_type='PROGRAM' AND ci.resource_id=p.id
                 JOIN content_versions cv ON cv.id=ci.published_version_id
                 WHERE {" AND ".join(clauses)} GROUP BY p.id,cv.language,ci.updated_at
                 ORDER BY min(ps.starts_at),p.title LIMIT %s""",
            params,
        )

    def program_detail_select_programs(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT p.id,p.slug,p.title,p.summary,p.category,p.accessibility,p.updated_at,cv.language,cv.body,
                      ci.updated_at AS published_at,
                      coalesce(jsonb_agg(jsonb_build_object('id',ps.id,'startsAt',ps.starts_at,'endsAt',ps.ends_at,
                        'capacity',ps.capacity,'status',ps.status,'area',jsonb_build_object('id',a.id,'name',a.name))
                        ORDER BY ps.starts_at) FILTER(WHERE ps.id IS NOT NULL),'[]') AS sessions
               FROM programs p JOIN content_items ci ON ci.festival_id=p.festival_id AND ci.resource_type='PROGRAM'
                 AND ci.resource_id=p.id AND ci.lifecycle_status='PUBLISHED'
               JOIN content_versions cv ON cv.id=ci.published_version_id AND cv.language IN (%(language)s,%(default_language)s)
               LEFT JOIN program_sessions ps ON ps.program_id=p.id LEFT JOIN festival_areas a ON a.id=ps.area_id
               WHERE p.festival_id=%(festival_id)s AND p.slug=%(program_slug)s AND p.status='PUBLISHED'
               GROUP BY p.id,cv.id,ci.updated_at ORDER BY (cv.language=%(language)s) DESC LIMIT 1""",
            params,
        )

    def areas_select_festival_areas(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT id,name,area_type,latitude,longitude,status,updated_at FROM festival_areas WHERE festival_id=%s AND status='ACTIVE' ORDER BY name",
            params,
        )

    def facilities_select_facilities(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            f"""SELECT f.id,f.name,f.facility_type,f.accessibility,f.operating_hours,f.status,f.updated_at,
            jsonb_build_object('id',a.id,'name',a.name,'latitude',a.latitude,'longitude',a.longitude) AS area
            FROM facilities f JOIN festival_areas a ON a.id=f.area_id WHERE f.festival_id=%(festival_id)s AND f.status='ACTIVE'
            AND (%(type)s::text IS NULL OR f.facility_type=%(type)s)
            ORDER BY {safety_facility_order("f.facility_type")},f.name""",
            params,
        )

    def crowd_select_crowd_snapshots(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT DISTINCT ON (cs.area_id) cs.area_id,a.name,cs.crowd_level,cs.people_count,
            cs.estimated_wait_min,cs.captured_at,cs.expires_at,(cs.expires_at<=now()) AS stale
            FROM crowd_snapshots cs JOIN festival_areas a ON a.id=cs.area_id
            WHERE cs.festival_id=%s AND a.status='ACTIVE' ORDER BY cs.area_id,cs.captured_at DESC""",
            params,
        )

    def crowd_select_crowd_snapshots_2(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """WITH latest AS (
              SELECT DISTINCT ON (area_id) area_id,crowd_level,expires_at FROM crowd_snapshots
              WHERE festival_id=%(festival_id)s ORDER BY area_id,captured_at DESC
            )
            SELECT DISTINCT ON (p.id) p.id,p.slug,p.title,ps.starts_at,ps.ends_at,a.id AS area_id,a.name AS area_name
            FROM program_sessions ps JOIN programs p ON p.id=ps.program_id JOIN festival_areas a ON a.id=ps.area_id
            JOIN content_items ci ON ci.festival_id=p.festival_id AND ci.resource_type='PROGRAM' AND ci.resource_id=p.id AND ci.lifecycle_status='PUBLISHED'
            LEFT JOIN latest l ON l.area_id=ps.area_id
            WHERE p.festival_id=%(festival_id)s AND p.status='PUBLISHED' AND ps.status='OPEN' AND ps.ends_at>now()
              AND (l.area_id IS NULL OR l.crowd_level NOT IN ('BUSY','FULL') OR l.expires_at<=now())
            ORDER BY p.id,ps.starts_at LIMIT 5""",
            params,
        )

    def festival_map_select_festival_areas(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT id,name,area_type,latitude,longitude,status FROM festival_areas WHERE festival_id=%s AND status='ACTIVE'",
            params,
        )

    def festival_map_select_facilities(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT id,area_id,name,facility_type,accessibility,operating_hours,status FROM facilities WHERE festival_id=%s AND status='ACTIVE'",
            params,
        )

    def festival_map_select_programs(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT DISTINCT p.id,p.slug,p.title,ps.area_id FROM programs p JOIN program_sessions ps ON ps.program_id=p.id
            JOIN content_items ci ON ci.resource_type='PROGRAM' AND ci.resource_id=p.id AND ci.lifecycle_status='PUBLISHED'
            WHERE p.festival_id=%s AND p.status='PUBLISHED' AND ps.status NOT IN ('CANCELLED','ENDED')""",
            params,
        )

    def announcements_select_announcements(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT a.id,a.title,a.severity,a.audience,a.target_area_ids,a.starts_at,a.ends_at,
            CASE WHEN a.ends_at IS NOT NULL AND a.ends_at<=now() THEN 'EXPIRED' ELSE 'ACTIVE' END AS status,
            cv.body,cv.language,a.updated_at FROM announcements a JOIN content_versions cv ON cv.id=a.content_version_id
            WHERE a.festival_id=%s AND a.status IN ('ACTIVE','SCHEDULED') AND a.starts_at<=now()
              AND (a.ends_at IS NULL OR a.ends_at>now()) AND a.audience ? 'VISITOR' AND cv.status='APPROVED'
            ORDER BY CASE a.severity WHEN 'EMERGENCY' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,a.starts_at DESC""",
            params,
        )

    def announcement_select_announcements(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT a.id,a.title,a.severity,a.audience,a.target_area_ids,a.starts_at,a.ends_at,cv.body,cv.language,a.updated_at
            FROM announcements a JOIN content_versions cv ON cv.id=a.content_version_id WHERE a.id=%s AND a.festival_id=%s
              AND a.status IN ('ACTIVE','SCHEDULED') AND a.starts_at<=now() AND (a.ends_at IS NULL OR a.ends_at>now())
              AND a.audience ? 'VISITOR' AND cv.status='APPROVED'""",
            params,
        )

    def create_visitor_session_insert_visitor_sessions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO visitor_sessions(festival_id,anonymous_token_hash,language,accessibility_preferences,
            consents,expires_at,current_area_id,area_source,area_assigned_at)
            VALUES(%(festival_id)s,%(hash_token_token)s,%(language)s,%(jsonb_accessibility_preferences)s,%(jsonb_consents)s,%(expires_at)s,%(area_id)s,%(area_source)s,CASE WHEN %(area_id)s::uuid IS NULL THEN NULL ELSE now() END) RETURNING id""",
            params,
        )

    def surveys_select_surveys(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT s.id,s.title,s.description,s.starts_at,s.ends_at,
            coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'type',q.question_type,'options',q.options,
              'required',q.required,'position',q.position) ORDER BY q.position) FILTER(WHERE q.id IS NOT NULL),'[]') AS questions
            FROM surveys s LEFT JOIN survey_questions q ON q.survey_id=s.id WHERE s.festival_id=%s AND s.status='ACTIVE'
              AND (s.starts_at IS NULL OR s.starts_at<=now()) AND (s.ends_at IS NULL OR s.ends_at>now())
            GROUP BY s.id ORDER BY s.created_at""",
            params,
        )
