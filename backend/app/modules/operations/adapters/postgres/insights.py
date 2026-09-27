from app.infrastructure.db import all_rows, one


class InsightsRepository:
    def __init__(self, connection):
        self.connection = connection

    def dashboard_select_visitor_sessions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT
            (SELECT count(*) FROM visitor_sessions WHERE festival_id=%(festival_id)s
               AND (%(time_from)s::timestamptz IS NULL OR created_at>=%(time_from)s)
               AND (%(time_to)s::timestamptz IS NULL OR created_at<=%(time_to)s))::int AS visitors,
            (SELECT count(*) FROM bookings b JOIN program_sessions ps ON ps.id=b.program_session_id
               WHERE b.festival_id=%(festival_id)s AND b.status IN ('CONFIRMED','WAITING','CALLED')
               AND (%(area_id)s::uuid IS NULL OR ps.area_id=%(area_id)s)
               AND (%(time_from)s::timestamptz IS NULL OR b.created_at>=%(time_from)s)
               AND (%(time_to)s::timestamptz IS NULL OR b.created_at<=%(time_to)s))::int AS active_bookings,
            (SELECT count(*) FROM ops_tickets WHERE festival_id=%(festival_id)s AND status NOT IN ('RESOLVED','CLOSED')
               AND (%(area_id)s::uuid IS NULL OR area_id=%(area_id)s)
               AND (%(time_from)s::timestamptz IS NULL OR created_at>=%(time_from)s)
               AND (%(time_to)s::timestamptz IS NULL OR created_at<=%(time_to)s))::int AS open_tickets,
            (SELECT count(DISTINCT fb.id) FROM festival_businesses fb LEFT JOIN booths bo ON bo.festival_business_id=fb.id
               WHERE fb.festival_id=%(festival_id)s AND fb.participation_status='APPROVED'
               AND (%(area_id)s::uuid IS NULL OR bo.area_id=%(area_id)s))::int AS approved_businesses,
            (SELECT count(*) FROM coupon_issues ci JOIN coupons c ON c.id=ci.coupon_id JOIN festival_businesses fb ON fb.id=c.festival_business_id
               WHERE fb.festival_id=%(festival_id)s
               AND (%(time_from)s::timestamptz IS NULL OR ci.issued_at>=%(time_from)s)
               AND (%(time_to)s::timestamptz IS NULL OR ci.issued_at<=%(time_to)s))::int AS coupon_issues,
            (SELECT coalesce(sum(pl.points_delta),0)::int FROM point_ledger pl JOIN visitor_sessions vs ON vs.id=pl.visitor_session_id
               WHERE vs.festival_id=%(festival_id)s
               AND (%(time_from)s::timestamptz IS NULL OR pl.created_at>=%(time_from)s)
               AND (%(time_to)s::timestamptz IS NULL OR pl.created_at<=%(time_to)s)) AS points_issued""",
            params,
        )

    def dashboard_select_crowd_snapshots(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT DISTINCT ON (cs.area_id) cs.area_id,a.name,cs.crowd_level,cs.people_count,
            cs.estimated_wait_min,cs.captured_at,cs.expires_at,(cs.expires_at<=now()) AS stale
            FROM crowd_snapshots cs JOIN festival_areas a ON a.id=cs.area_id WHERE cs.festival_id=%(festival_id)s
            AND (%(area_id)s::uuid IS NULL OR cs.area_id=%(area_id)s)
            AND (%(time_from)s::timestamptz IS NULL OR cs.captured_at>=%(time_from)s)
            AND (%(time_to)s::timestamptz IS NULL OR cs.captured_at<=%(time_to)s)
            ORDER BY cs.area_id,cs.captured_at DESC""",
            params,
        )

    def dashboard_select_visitor_sessions_2(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT language,count(*)::int AS sessions,
            count(*) FILTER(WHERE accessibility_preferences->>'languageSource'='AUTO')::int AS auto_switched,
            count(*) FILTER(WHERE accessibility_preferences->>'visitorMode'='kiosk')::int AS kiosk_sessions
            FROM visitor_sessions WHERE festival_id=%(festival_id)s
            AND (%(time_from)s::timestamptz IS NULL OR created_at>=%(time_from)s)
            AND (%(time_to)s::timestamptz IS NULL OR created_at<=%(time_to)s)
            GROUP BY language ORDER BY sessions DESC,language""",
            params,
        )

    def admin_risk_brief_select_ops_tickets(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT CASE WHEN ticket_type='COMPLAINT' THEN 'unresolved_safety_complaints' ELSE 'safety_incidents' END AS type,
            count(*)::int AS value,CASE WHEN ticket_type='COMPLAINT' THEN 3 ELSE 2 END AS threshold,
            max(updated_at) AS source_updated_at FROM ops_tickets
            WHERE festival_id=%s AND priority IN ('HIGH','EMERGENCY') AND (%s OR status NOT IN ('RESOLVED','CLOSED'))
            GROUP BY ticket_type""",
            params,
        )

    def admin_risk_brief_select_crowd_snapshots(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """WITH latest AS (SELECT DISTINCT ON (area_id) area_id,crowd_level,captured_at
            FROM crowd_snapshots WHERE festival_id=%s AND expires_at>now() ORDER BY area_id,captured_at DESC)
            SELECT 'crowding' AS type,round(100.0*count(*) FILTER (WHERE crowd_level IN ('BUSY','FULL'))/count(*))::int AS value,
            50 AS threshold,max(captured_at) AS source_updated_at FROM latest HAVING count(*)>0""",
            params,
        )

    def admin_risk_brief_select_festival_areas(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT 'staffing_gap' AS type,count(*)::int AS value,1 AS threshold,max(a.updated_at) AS source_updated_at
            FROM festival_areas a WHERE a.festival_id=%s AND a.status='ACTIVE'
              AND NOT EXISTS(SELECT 1 FROM staff_assignments sa WHERE sa.area_id=a.id AND sa.starts_at<=now() AND sa.ends_at>now())
            HAVING count(*)>0""",
            params,
        )

    def admin_risk_brief_select_program_sessions(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT 'schedule_change' AS type,count(*)::int AS value,0 AS threshold,max(updated_at) AS source_updated_at
            FROM program_sessions WHERE festival_id=%s AND updated_at>created_at+interval '1 minute'
              AND updated_at>now()-make_interval(hours => %s)
            HAVING count(*)>0""",
            params,
        )

    def admin_risk_brief_select_crowd_snapshots_2(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """WITH ranked AS (
              SELECT area_id,crowd_level,captured_at,
                     lag(crowd_level) OVER (PARTITION BY area_id ORDER BY captured_at) AS previous_level,
                     lag(captured_at) OVER (PARTITION BY area_id ORDER BY captured_at) AS previous_at
              FROM crowd_snapshots
              WHERE festival_id=%(festival_id)s AND captured_at>now()-make_interval(mins => %(surge_lookback_minutes)s)
            ), leveled AS (
              SELECT area_id,captured_at,previous_at,
                     CASE crowd_level WHEN 'QUIET' THEN 0 WHEN 'MODERATE' THEN 1 WHEN 'BUSY' THEN 2 WHEN 'FULL' THEN 3 END AS level,
                     CASE previous_level WHEN 'QUIET' THEN 0 WHEN 'MODERATE' THEN 1 WHEN 'BUSY' THEN 2 WHEN 'FULL' THEN 3 END AS previous_level_rank
              FROM ranked WHERE previous_at IS NOT NULL
            ), surged AS (
              SELECT area_id,captured_at,level-previous_level_rank AS jump FROM leveled
              WHERE captured_at<=previous_at+make_interval(mins => %(surge_window_minutes)s) AND level-previous_level_rank>=2
            )
            SELECT 'abnormal_crowd_surge' AS type,max(jump)::int AS value,2 AS threshold,max(s.captured_at) AS source_updated_at,
                   a.name AS area_name,s.area_id::text AS area_id,%(surge_window_minutes)s AS window_minutes
            FROM surged s JOIN festival_areas a ON a.id=s.area_id GROUP BY a.name,s.area_id""",
            params,
        )

    def admin_recommendation_bias_select_business_recommendation_events(
        self, params=()
    ):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT response_snapshot FROM business_recommendation_events
            WHERE festival_id=%s AND created_at>=now()-make_interval(days => %s) ORDER BY created_at DESC""",
            params,
        )

    def business_recommendations_select_coupons(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT DISTINCT ON (fb.id) fb.id,b.name,fb.category,fb.is_sponsored,fb.esg_participating,
            bo.area_id,a.name AS area_name,a.latitude,a.longitude,
            EXISTS(SELECT 1 FROM coupons c WHERE c.festival_business_id=fb.id AND c.status='ACTIVE'
                   AND c.valid_from<=now() AND c.valid_until>now()) AS coupon_available
            FROM festival_businesses fb JOIN businesses b ON b.id=fb.business_id
            LEFT JOIN booths bo ON bo.festival_business_id=fb.id AND bo.status='ACTIVE'
            LEFT JOIN festival_areas a ON a.id=bo.area_id
            WHERE fb.festival_id=%(festival_id)s AND fb.participation_status='APPROVED' AND b.status='ACTIVE'
              AND (%(category)s::text IS NULL OR fb.category=%(category)s)
              AND (NOT %(accessibility_required)s OR fb.accessibility @> '{"wheelchair": true}')
            ORDER BY fb.id,bo.booth_no""",
            params,
        )

    def business_recommendations_insert_business_recommendation_events(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO business_recommendation_events(festival_id,request_snapshot,response_snapshot,policy_version)
            VALUES(%s,%s,%s,%s)""",
            params,
        )
