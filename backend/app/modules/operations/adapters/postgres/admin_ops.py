from app.infrastructure.db import all_rows, one
from app.infrastructure.sql import keyset

VISIBLE_TICKET = "(ticket_type='COMPLAINT' OR %(role)s<>'FIELD_OPERATOR' OR assignee_id=%(user_id)s OR created_by=%(user_id)s)"


EXPORT_SOURCES: dict[str, tuple[str, tuple[str, ...]]] = {
    "AUDIT_LOG": (
        "SELECT al.created_at,al.action,al.resource_type,al.resource_id,al.actor_id,\n                            u.name AS actor_name,u.email AS actor_email,al.request_id\n                     FROM audit_logs al LEFT JOIN users u ON u.id=al.actor_id\n                     WHERE al.festival_id=%s ORDER BY al.created_at DESC LIMIT 10000",
        (
            "created_at",
            "action",
            "resource_type",
            "resource_id",
            "actor_id",
            "actor_name",
            "actor_email",
            "request_id",
        ),
    ),
    "OPS_TICKET": (
        "SELECT created_at,ticket_type,title,priority,status,area_id,assignee_id,resolved_at,closed_at\n                      FROM ops_tickets WHERE festival_id=%s ORDER BY created_at DESC LIMIT 10000",
        (
            "created_at",
            "ticket_type",
            "title",
            "priority",
            "status",
            "area_id",
            "assignee_id",
            "resolved_at",
            "closed_at",
        ),
    ),
    "BOOKING": (
        "SELECT b.created_at,b.status,b.party_size,b.queue_number,p.title AS program_title,ps.starts_at\n                   FROM bookings b JOIN program_sessions ps ON ps.id=b.program_session_id\n                   JOIN programs p ON p.id=ps.program_id WHERE b.festival_id=%s ORDER BY b.created_at DESC LIMIT 10000",
        (
            "created_at",
            "status",
            "party_size",
            "queue_number",
            "program_title",
            "starts_at",
        ),
    ),
}


SESSION_DATA_SUMMARY = "SELECT\n    (SELECT count(*) FROM bookings WHERE visitor_session_id=%(session_id)s)::int AS bookings,\n    (SELECT count(*) FROM coupon_issues WHERE visitor_session_id=%(session_id)s)::int AS coupon_issues,\n    (SELECT count(*) FROM reward_events WHERE visitor_session_id=%(session_id)s)::int AS reward_events,\n    (SELECT coalesce(sum(points_delta),0)::int FROM point_ledger WHERE visitor_session_id=%(session_id)s) AS points,\n    (SELECT count(*) FROM course_plans WHERE visitor_session_id=%(session_id)s)::int AS course_plans,\n    (SELECT count(*) FROM ai_messages m JOIN ai_conversations c ON c.id=m.conversation_id\n       WHERE c.visitor_session_id=%(session_id)s)::int AS ai_messages"


class AdminOpsRepository:
    def export_columns(self, resource_type: str) -> tuple[str, ...] | None:
        source = EXPORT_SOURCES.get(resource_type)
        return source[1] if source else None

    def __init__(self, connection):
        self.connection = connection

    def publish_announcement_row_select_announcements(self, params=(), *, only_draft):
        connection = self.connection
        return one(
            connection,
            f"""UPDATE announcements SET content_version_id=%s,severity=%s,audience=%s,target_area_ids=%s,\n        starts_at=%s,ends_at=%s,status=%s,version=version+1,updated_at=now()\n        WHERE id=%s AND festival_id=%s{(" AND status='DRAFT'" if only_draft else "")} RETURNING *""",
            params,
        )

    def announcements_select_announcements(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT *,CASE WHEN ends_at IS NOT NULL AND ends_at<=now()
            AND status IN('ACTIVE','SCHEDULED') THEN 'EXPIRED' ELSE status END AS effective_status
            FROM announcements WHERE festival_id=%s ORDER BY created_at DESC""",
            params,
        )

    def insert_announcement(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO announcements(festival_id,title,created_by) VALUES(%s,%s,%s) RETURNING *",
            params,
        )

    def create_and_publish_announcement_insert_content_items(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO content_items(festival_id,content_type,resource_type,resource_id,slug)
            VALUES(%s,'ANNOUNCEMENT','ANNOUNCEMENT',%s,%s) RETURNING *""",
            params,
        )

    def create_and_publish_announcement_insert_content_versions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO content_versions(content_item_id,author_id,version_no,language,body,status)
            VALUES(%s,%s,1,%s,%s,'APPROVED') RETURNING *""",
            params,
        )

    def create_and_publish_announcement_insert_content_approvals(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO content_approvals(content_version_id,reviewer_id,decision,comment) VALUES(%s,%s,'APPROVED',%s)",
            params,
        )

    def create_and_publish_announcement_update_content_items(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE content_items SET published_version_id=%s,lifecycle_status='PUBLISHED',updated_at=now() WHERE id=%s",
            params,
        )

    def announcement_select_announcements(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM announcements WHERE id=%s AND festival_id=%s",
            params,
        )

    def publish_announcement_select_content_versions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT cv.id FROM content_versions cv JOIN content_items ci ON ci.id=cv.content_item_id
            WHERE cv.id=%s AND ci.festival_id=%s AND cv.status='APPROVED'""",
            params,
        )

    def close_announcement_update_announcements(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE announcements SET status='CLOSED',ends_at=least(coalesce(ends_at,now()),now()),version=version+1,updated_at=now()
            WHERE id=%s AND festival_id=%s AND status IN('ACTIVE','SCHEDULED') RETURNING *""",
            params,
        )

    def visible_ticket_select_ops_tickets(self, params=()):
        connection = self.connection
        return one(
            connection,
            f"""SELECT * FROM ops_tickets
            WHERE id=%(ticket_id)s AND festival_id=%(festival_id)s AND {VISIBLE_TICKET}""",
            params,
        )

    def tickets_select_ops_tickets(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            f"""SELECT * FROM ops_tickets WHERE festival_id=%(festival_id)s AND {VISIBLE_TICKET}
            AND (%(status)s::text IS NULL OR status=%(status)s)
            AND {keyset()}
            ORDER BY created_at DESC,id DESC LIMIT %(limit)s""",
            params,
        )

    def create_ticket_insert_ops_tickets(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO ops_tickets(festival_id,ticket_type,title,description,area_id,priority,assignee_id,created_by)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def create_ticket_insert_ops_ticket_events(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO ops_ticket_events(ticket_id,actor_id,to_status,note) VALUES(%s,%s,'OPEN','티켓 생성')",
            params,
        )

    def transition_ticket_update_ops_tickets(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE ops_tickets SET status=%(status)s,version=version+1,updated_at=now(),
            resolved_at=CASE WHEN %(status)s='RESOLVED' THEN now() ELSE resolved_at END,
            closed_at=CASE WHEN %(status)s='CLOSED' THEN now() ELSE closed_at END
            WHERE id=%(ticket_id)s RETURNING *""",
            params,
        )

    def transition_ticket_insert_ops_ticket_events(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO ops_ticket_events(ticket_id,actor_id,from_status,to_status,note,attachments)
            VALUES(%s,%s,%s,%s,%s,%s)""",
            params,
        )

    def ticket_events_select_ops_ticket_events(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT * FROM ops_ticket_events WHERE ticket_id=%s ORDER BY created_at",
            params,
        )

    def issue_analysis_select_ops_tickets(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT t.id,t.title,t.description,t.priority,t.status,o.topic,o.sentiment,o.urgent,o.note,o.updated_at
            FROM ops_tickets t LEFT JOIN issue_analysis_overrides o ON o.ticket_id=t.id WHERE t.festival_id=%s ORDER BY t.created_at DESC""",
            params,
        )

    def override_issue_analysis_insert_issue_analysis_overrides(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO issue_analysis_overrides(ticket_id,topic,sentiment,urgent,note,updated_by)
            VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(ticket_id) DO UPDATE SET topic=excluded.topic,sentiment=excluded.sentiment,
            urgent=excluded.urgent,note=excluded.note,updated_by=excluded.updated_by,updated_at=now() RETURNING *""",
            params,
        )

    def surveys_select_survey_responses(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT s.*,
            (SELECT count(*) FROM survey_responses r WHERE r.survey_id=s.id)::int AS response_count,
            coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'questionType',q.question_type,
              'options',q.options,'required',q.required,'position',q.position) ORDER BY q.position)
              FILTER(WHERE q.id IS NOT NULL),'[]') AS questions
            FROM surveys s LEFT JOIN survey_questions q ON q.survey_id=s.id
            WHERE s.festival_id=%s GROUP BY s.id ORDER BY s.created_at DESC""",
            params,
        )

    def create_survey_insert_surveys(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO surveys(festival_id,title,description,starts_at,ends_at,status,prevent_duplicates)
            VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def create_survey_insert_survey_questions(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO survey_questions(survey_id,prompt,question_type,options,required,position)
                VALUES(%s,%s,%s,%s,%s,%s)""",
            params,
        )

    def survey_summary_select_surveys(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT id,title,prevent_duplicates FROM surveys WHERE id=%s AND festival_id=%s",
            params,
        )

    def survey_summary_select_survey_responses(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT count(*)::int AS count FROM survey_responses WHERE survey_id=%s",
            params,
        )

    def survey_summary_select_survey_questions(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT id,prompt,question_type,position FROM survey_questions WHERE survey_id=%s ORDER BY position",
            params,
        )

    def survey_summary_select_survey_answers(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT sa.question_id,sa.value FROM survey_answers sa
            JOIN survey_responses sr ON sr.id=sa.response_id WHERE sr.survey_id=%s""",
            params,
        )

    def staff_assignments_select_staff_assignments(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT sa.*,u.name AS staff_name,m.role FROM staff_assignments sa
            JOIN memberships m ON m.id=sa.membership_id JOIN users u ON u.id=m.user_id
            WHERE sa.festival_id=%s ORDER BY sa.starts_at,u.name""",
            params,
        )

    def create_staff_assignment_select_memberships(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT 1 FROM memberships m JOIN festivals f ON f.organization_id=m.organization_id
            JOIN festival_areas a ON a.festival_id=f.id WHERE m.id=%s AND a.id=%s AND f.id=%s AND m.status='ACTIVE'""",
            params,
        )

    def create_staff_assignment_select_staff_assignments(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT 1 FROM staff_assignments WHERE membership_id=%s AND starts_at<%s AND ends_at>%s",
            params,
        )

    def create_staff_assignment_insert_staff_assignments_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO staff_assignments(festival_id,membership_id,area_id,duty_role,task,starts_at,ends_at,created_by)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def acknowledge_assignment_update_staff_assignments(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE staff_assignments SET acknowledged_at=now(),updated_at=now()
            WHERE id=%s AND festival_id=%s AND membership_id=%s RETURNING *""",
            params,
        )

    def crowd_snapshots_select_crowd_snapshots(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT cs.*,a.name AS area_name,p.title AS program_title
            FROM crowd_snapshots cs JOIN festival_areas a ON a.id=cs.area_id
            LEFT JOIN program_sessions ps ON ps.id=cs.program_session_id LEFT JOIN programs p ON p.id=ps.program_id
            WHERE cs.festival_id=%s ORDER BY cs.captured_at DESC LIMIT 200""",
            params,
        )

    def create_crowd_snapshot_insert_crowd_snapshots(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO crowd_snapshots(festival_id,area_id,program_session_id,source_type,crowd_level,
            people_count,estimated_wait_min,captured_at,expires_at,created_by) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def memberships_select_memberships(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT m.id,m.user_id,u.email,u.name,m.role,m.festival_scope,m.status,m.created_at
            FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=%s ORDER BY m.created_at""",
            params,
        )

    def create_membership_insert_users(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO users(email,password_hash,name) VALUES(%s,%s,%s)
            ON CONFLICT(email) DO NOTHING RETURNING id,email,name""",
            params,
        )

    def create_membership_insert_memberships(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO memberships(organization_id,user_id,role,festival_scope) VALUES(%s,%s,%s,%s) RETURNING *",
            params,
        )

    def membership_by_id(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM memberships WHERE id=%s AND organization_id=%s",
            params,
        )

    def patch_membership_update_memberships_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE memberships SET role=coalesce(%(role)s,role),
            festival_scope=coalesce(%(scope)s,festival_scope),status=coalesce(%(status)s,status),
            deactivated_at=CASE WHEN coalesce(%(status)s,status)='INACTIVE' THEN coalesce(deactivated_at,now()) END
            WHERE id=%(membership_id)s AND organization_id=%(organization_id)s RETURNING *""",
            params,
        )

    def deactivate_membership_update_memberships(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE memberships SET status='INACTIVE',deactivated_at=coalesce(deactivated_at,now()) WHERE id=%s AND organization_id=%s",
            params,
        )

    def audit_logs_select_audit_logs(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            f"""SELECT al.*,u.name AS actor_name,u.email AS actor_email
            FROM audit_logs al LEFT JOIN users u ON u.id=al.actor_id
            WHERE al.festival_id=%(festival_id)s
            AND (%(action)s::text IS NULL OR al.action=%(action)s)
            AND (%(resource_type)s::text IS NULL OR al.resource_type=%(resource_type)s)
            AND {keyset(alias="al")}
            ORDER BY al.created_at DESC,al.id DESC LIMIT %(limit)s""",
            params,
        )

    def create_export_select_rows(self, params=(), *, resource_type):
        connection = self.connection
        return all_rows(connection, EXPORT_SOURCES[resource_type][0], params)

    def create_export_insert_jobs(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO jobs(festival_id,job_type,resource_type,status,result)
            VALUES(%s,'EXPORT',%s,'COMPLETED',%s) RETURNING *""",
            params,
        )

    def privacy_policy_select_audit_logs(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT created_at,after_data FROM audit_logs
            WHERE action='PURGE' AND resource_type='PERSONAL_DATA' ORDER BY created_at DESC LIMIT 1""",
            params,
        )

    def privacy_requests_select_privacy_requests(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT pr.*,u.name AS handler_name FROM privacy_requests pr
            LEFT JOIN users u ON u.id=pr.handled_by WHERE pr.festival_id=%(festival_id)s
            AND (%(status)s::text IS NULL OR pr.status=%(status)s) ORDER BY pr.created_at DESC LIMIT 200""",
            params,
        )

    def handle_privacy_request_select_privacy_requests(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM privacy_requests WHERE id=%s AND festival_id=%s FOR UPDATE",
            params,
        )

    def handle_privacy_request_select_rows(self, params=()):
        connection = self.connection
        return one(connection, SESSION_DATA_SUMMARY, params)

    def handle_privacy_request_update_privacy_requests(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE privacy_requests SET visitor_session_id=NULL WHERE id=%s", params
        )

    def handle_privacy_request_update_privacy_requests_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE privacy_requests SET status=%s,detail=coalesce(%s,detail),result=%s,
            handled_by=%s,handled_at=now(),updated_at=now() WHERE id=%s RETURNING *""",
            params,
        )

    def visitor_identity_select_visitor_identity_events(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """WITH buckets AS (
              SELECT device_key,array_agg(visitor_session_id) AS session_ids,count(*)::int AS session_count,
                     min(created_at) AS first_at,max(created_at) AS last_at
              FROM visitor_identity_events WHERE festival_id=%s GROUP BY device_key HAVING count(*)>1
            )
            SELECT left(b.device_key,8) AS device_key,b.session_count,b.first_at,b.last_at,
              (SELECT count(*) FROM coupon_issues ci WHERE ci.visitor_session_id=ANY(b.session_ids))::int AS coupon_issues,
              (SELECT count(*) FROM reward_events re WHERE re.visitor_session_id=ANY(b.session_ids))::int AS reward_events,
              (SELECT count(*) FROM bookings bk WHERE bk.visitor_session_id=ANY(b.session_ids))::int AS bookings
            FROM buckets b ORDER BY b.session_count DESC,b.last_at DESC LIMIT 100""",
            params,
        )

    def visitor_identity_select_visitor_identity_events_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT count(*)::int AS issuances,
            count(*) FILTER(WHERE event_type='REISSUED')::int AS reissues,
            count(DISTINCT device_key)::int AS devices FROM visitor_identity_events WHERE festival_id=%s""",
            params,
        )

    def notification_deliveries_select_min(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT a.id,a.title,a.severity,a.target_area_ids,a.starts_at,a.status,
            count(nd.id)::int AS delivered_sessions,min(nd.delivered_at) AS first_delivered_at,max(nd.delivered_at) AS last_delivered_at,
            round(extract(epoch FROM min(nd.delivered_at)-a.starts_at))::int AS first_delivery_lag_seconds
            FROM announcements a LEFT JOIN notification_deliveries nd
              ON nd.resource_type='ANNOUNCEMENT' AND nd.resource_id=a.id
            WHERE a.festival_id=%s AND a.status<>'DRAFT' GROUP BY a.id ORDER BY a.starts_at DESC NULLS LAST LIMIT 100""",
            params,
        )

    def notification_deliveries_select_nd(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT count(*) FILTER(WHERE b.status='CALLED')::int AS called,
            count(nd.id)::int AS delivered,
            round(avg(extract(epoch FROM nd.delivered_at-b.called_at)))::int AS avg_lag_seconds
            FROM bookings b LEFT JOIN notification_deliveries nd
              ON nd.resource_type='BOOKING_CALL' AND nd.resource_id=b.id
            WHERE b.festival_id=%s AND b.called_at IS NOT NULL""",
            params,
        )

    def kiosk_camera_state_select_festivals(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT kiosk_camera_enabled,kiosk_camera_stop_reason FROM festivals WHERE id=%s",
            params,
        )

    def kiosk_camera_select_kiosk_assist_events(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT event_type,count(*)::int AS count FROM kiosk_assist_events
               WHERE festival_id=%s GROUP BY event_type""",
            params,
        )

    def kiosk_camera_select_kiosk_assist_events_2(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT coalesce(model_version,'(미기록)') AS model_version,count(*)::int AS count,
            max(created_at) AS last_seen_at FROM kiosk_assist_events WHERE festival_id=%s
            GROUP BY 1 ORDER BY count DESC""",
            params,
        )

    def kiosk_camera_select_kiosk_assist_events_3(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT result,count(*)::int AS count FROM kiosk_assist_events
               WHERE festival_id=%s AND event_type='ESTIMATE_RESULT'
               GROUP BY result ORDER BY result""",
            params,
        )

    def kiosk_camera_select_kiosk_assist_events_4(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT result,
            coalesce(model_version,'(미기록)') AS model_version,created_at
            FROM kiosk_assist_events
            WHERE festival_id=%s AND event_type='ESTIMATE_RESULT'
            ORDER BY created_at DESC LIMIT 100""",
            params,
        )

    def update_kiosk_camera_update_festivals(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE festivals SET kiosk_camera_enabled=%s,kiosk_camera_stop_reason=%s WHERE id=%s",
            params,
        )

    def get_job_select_jobs(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT j.* FROM jobs j JOIN festivals f ON f.id=j.festival_id
            WHERE j.id=%(job_id)s AND f.organization_id=%(organization_id)s
            AND (%(super_admin)s OR %(scope)s::jsonb ? j.festival_id::text OR %(scope)s::jsonb ? '*')""",
            params,
        )
