from app.infrastructure.db import all_rows, jsonb, one


class VisitorRepository:
    def __init__(self, connection):
        self.connection = connection

    def owned_conversation_select_ai_conversations(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT 1 FROM ai_conversations WHERE id=%s AND visitor_session_id=%s",
            params,
        )

    def session_area_select_festival_areas(self, params=(), *, valid_hours):
        connection = self.connection
        current_area = f"CASE WHEN area_assigned_at>now()-make_interval(hours => {valid_hours}) THEN current_area_id END"
        return one(
            connection,
            f"""SELECT {current_area} AS area_id,area_source,area_assigned_at,
            (SELECT name FROM festival_areas fa WHERE fa.id={current_area}) AS area_name
            FROM visitor_sessions WHERE id=%s""",
            params,
        )

    def end_session_update_visitor_sessions(self, params=()):
        connection = self.connection
        return connection.execute(
            """UPDATE visitor_sessions SET ended_at=now(),accessibility_preferences='{}',consents='{}',
            current_area_id=NULL,area_source=NULL,area_assigned_at=NULL WHERE id=%s""",
            params,
        )

    def set_area_update_visitor_sessions(self, params=()):
        connection = self.connection
        return connection.execute(
            """UPDATE visitor_sessions SET current_area_id=%(area_id)s,area_source=%(area_source)s,
            area_assigned_at=CASE WHEN %(area_id)s::uuid IS NULL THEN NULL ELSE now() END WHERE id=%(visitor_id)s""",
            params,
        )

    def update_preferences_select_festivals(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT supported_languages,default_language FROM festivals WHERE id=%s",
            params,
        )

    def update_preferences_update_visitor_sessions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE visitor_sessions SET language=%s,accessibility_preferences=coalesce(%s,accessibility_preferences)
            WHERE id=%s RETURNING id,language,accessibility_preferences,expires_at""",
            params,
        )

    def visitor_announcements_select_announcements(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT a.id,a.title,a.severity,a.audience,a.target_area_ids,a.starts_at,a.ends_at,
            cv.body,cv.language,a.updated_at FROM announcements a JOIN content_versions cv ON cv.id=a.content_version_id
            WHERE a.festival_id=%(festival_id)s AND a.status IN ('ACTIVE','SCHEDULED') AND a.starts_at<=now()
              AND (a.ends_at IS NULL OR a.ends_at>now()) AND a.audience ? 'VISITOR' AND cv.status='APPROVED'
              AND (a.target_area_ids='[]'::jsonb OR a.severity='EMERGENCY'
                   OR (%(area_id)s::uuid IS NOT NULL AND a.target_area_ids ? %(area_id)s::text))
            ORDER BY CASE a.severity WHEN 'EMERGENCY' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,a.starts_at DESC""",
            params,
        )

    def kiosk_assist_event_insert_kiosk_assist_events(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO kiosk_assist_events(festival_id,event_type,model_version,result)
            VALUES(%s,%s,%s,%s)""",
            params,
        )

    def session_consents(self, params=()):
        connection = self.connection
        return one(
            connection, "SELECT consents FROM visitor_sessions WHERE id=%s", params
        )

    def update_consents_update_visitor_sessions(self, params=()):
        connection = self.connection
        return one(
            connection,
            "UPDATE visitor_sessions SET consents=consents||%s WHERE id=%s RETURNING consents",
            params,
        )

    def my_privacy_requests_select_privacy_requests(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT id,request_type,status,detail,result,created_at,handled_at
            FROM privacy_requests WHERE visitor_session_id=%s ORDER BY created_at DESC""",
            params,
        )

    def create_privacy_request_select_privacy_requests(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT 1 FROM privacy_requests WHERE visitor_session_id=%s AND request_type=%s
            AND status IN ('RECEIVED','IN_PROGRESS')""",
            params,
        )

    def create_privacy_request_insert_privacy_requests_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO privacy_requests(festival_id,visitor_session_id,request_type,detail)
            VALUES(%s,%s,%s,%s) RETURNING id,request_type,status,detail,created_at""",
            params,
        )

    def submit_survey_select_surveys(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT * FROM surveys WHERE id=%s AND festival_id=%s AND status='ACTIVE'
            AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>now())""",
            params,
        )

    def submit_survey_select_survey_questions(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT id,required FROM survey_questions WHERE survey_id=%s",
            params,
        )

    def submit_survey_insert_survey_responses(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO survey_responses(survey_id,visitor_session_id) VALUES(%s,%s) RETURNING id,created_at",
            params,
        )

    def submit_survey_insert_survey_answers(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO survey_answers(response_id,question_id,value) VALUES(%s,%s,%s)",
            params,
        )

    def submit_complaint_insert_ops_tickets(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO ops_tickets(festival_id,ticket_type,title,description,priority)
            VALUES(%s,'COMPLAINT',%s,%s,%s) RETURNING id,status,priority,created_at""",
            params,
        )

    def create_course_plan_select_program_sessions(
        self,
        festival_id,
        starts_at,
        excluded_program_ids,
        *,
        interests,
        area_id,
        accessibility,
    ):
        connection = self.connection
        params = [festival_id, starts_at, excluded_program_ids]
        clauses = [
            "ps.festival_id=%s",
            "ps.status='OPEN'",
            "p.status='PUBLISHED'",
            "ps.starts_at>=%s",
            "NOT (p.id=ANY(%s::uuid[]))",
        ]
        for clause, value in (
            ("p.category=ANY(%s)", interests),
            ("ps.area_id=%s", area_id),
            (
                "p.accessibility @> %s",
                jsonb(accessibility) if accessibility else None,
            ),
        ):
            if value:
                clauses.append(clause)
                params.append(value)
        return all_rows(
            connection,
            f"""SELECT ps.id,ps.starts_at,ps.ends_at,p.id AS program_id,p.title,p.category,a.name AS area_name
            FROM program_sessions ps JOIN programs p ON p.id=ps.program_id JOIN festival_areas a ON a.id=ps.area_id
            WHERE {" AND ".join(clauses)} ORDER BY ps.starts_at LIMIT 50""",
            params,
        )

    def create_course_plan_insert_course_plans(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO course_plans(visitor_session_id,input_preferences,expected_duration_min) VALUES(%s,%s,%s) RETURNING *",
            params,
        )

    def create_course_plan_insert_course_items(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO course_items(course_plan_id,program_session_id,sequence_no,recommendation_reason)
                VALUES(%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def start_conversation_select_festivals(self, params=()):
        connection = self.connection
        return one(connection, "SELECT id FROM festivals WHERE code=%s", params)

    def start_conversation_insert_ai_conversations(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO ai_conversations(festival_id,visitor_session_id,language) VALUES(%s,%s,%s) RETURNING id,language,created_at",
            params,
        )

    def send_message_insert_ai_messages(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO ai_messages(conversation_id,question,answer,safety_status,fallback,context)
                VALUES(%s,%s,%s,'BLOCKED',%s,%s) RETURNING *""",
            params,
        )

    def send_message_select_content_items(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT content_version_id,body,language,content_type,resource_type,slug,updated_at,festival_code
            FROM (SELECT cv.id AS content_version_id,cv.body,cv.language,ci.content_type,ci.resource_type,
                    ci.slug,ci.updated_at,f.code AS festival_code,
                    coalesce(cv.body->>'title','') AS title,
                    coalesce(cv.body->>'title','') || ' ' || coalesce(cv.body->>'summary','') || ' ' ||
                    coalesce(cv.body->>'description','') || ' ' || coalesce(cv.body->>'text','') AS haystack
                  FROM content_items ci
                  JOIN content_versions cv ON cv.id=ci.published_version_id JOIN festivals f ON f.id=ci.festival_id
                  WHERE ci.festival_id=%(festival_id)s AND ci.lifecycle_status='PUBLISHED' AND cv.status='APPROVED') candidates
            WHERE haystack ILIKE ANY(%(patterns)s)
            ORDER BY (SELECT count(*) FROM unnest(%(patterns)s::text[]) pattern WHERE haystack ILIKE pattern) DESC,
                     (SELECT count(*) FROM unnest(%(patterns)s::text[]) pattern WHERE title ILIKE pattern) DESC,
                     updated_at DESC, slug LIMIT 3""",
            params,
        )

    def send_message_insert_ai_messages_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO ai_messages(conversation_id,question,answer,safety_status,freshness_at,fallback,context)
            VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def send_message_insert_ai_message_sources(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO ai_message_sources(message_id,content_version_id,rank) VALUES(%s,%s,%s)",
            params,
        )

    def message_history_select_ai_messages(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT m.id,m.question,m.answer,m.safety_status,m.freshness_at,m.fallback,m.created_at,
            coalesce(jsonb_agg(jsonb_build_object('contentVersionId',s.content_version_id,'rank',s.rank) ORDER BY s.rank)
              FILTER(WHERE s.content_version_id IS NOT NULL),'[]') AS sources FROM ai_messages m
            LEFT JOIN ai_message_sources s ON s.message_id=m.id WHERE m.conversation_id=%s GROUP BY m.id ORDER BY m.created_at""",
            params,
        )

    def report_message_select_ai_messages(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT m.id FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id
            WHERE m.id=%s AND c.visitor_session_id=%s""",
            params,
        )

    def report_message_insert_ai_message_reports(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO ai_message_reports(message_id,visitor_session_id,reason,detail)
            VALUES(%s,%s,%s,%s) RETURNING id,status,created_at""",
            params,
        )

    def active_visitor(self, params):
        connection = self.connection
        return one(
            connection,
            "SELECT id FROM visitor_sessions WHERE id=%s AND festival_id=%s AND ended_at IS NULL AND expires_at>now() FOR SHARE",
            params,
        )
