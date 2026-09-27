from app.infrastructure.db import all_rows, one


class RewardsRepository:
    def __init__(self, connection):
        self.connection = connection

    def redeem_issue_insert_coupon_redemptions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO coupon_redemptions(coupon_issue_id,festival_business_id,processed_by)
                VALUES(%s,%s,%s) RETURNING *""",
            params,
        )

    def redeem_issue_update_coupon_issues(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE coupon_issues SET status='REDEEMED' WHERE id=%s", params
        )

    def redeem_issue_insert_business_events(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO business_events(festival_business_id,visitor_session_id,event_type,source) VALUES(%s,%s,'COUPON_REDEEM','COUPON')",
            params,
        )

    def insert_coupon_insert_coupons(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO coupons(festival_business_id,name,description,benefit_type,benefit_value,issue_limit,
            per_visitor_limit,valid_from,valid_until,created_by) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def public_coupons_select_coupon_issues(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT c.id,c.name,c.description,c.benefit_type,c.benefit_value,c.valid_from,c.valid_until,
            c.per_visitor_limit,
            c.issue_limit-(SELECT count(*) FROM coupon_issues ci WHERE ci.coupon_id=c.id) AS remaining,b.name AS business_name
            FROM coupons c JOIN festival_businesses fb ON fb.id=c.festival_business_id JOIN businesses b ON b.id=fb.business_id
            WHERE fb.festival_id=%s AND fb.participation_status='APPROVED' AND c.status='ACTIVE'
              AND c.valid_from<=now() AND c.valid_until>now() ORDER BY c.valid_until,c.name""",
            params,
        )

    def my_coupons_select_coupon_issues(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT ci.id,CASE WHEN ci.expires_at<=now() AND ci.status='ISSUED' THEN 'EXPIRED' ELSE ci.status END AS status,
            ci.issued_at,ci.expires_at,ci.coupon_id,c.name,c.description,c.benefit_type,c.benefit_value,b.name AS business_name
            FROM coupon_issues ci JOIN coupons c ON c.id=ci.coupon_id JOIN festival_businesses fb ON fb.id=c.festival_business_id
            JOIN businesses b ON b.id=fb.business_id WHERE ci.visitor_session_id=%s ORDER BY ci.issued_at DESC""",
            params,
        )

    def work_select_coupons(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT c.*,fb.festival_id,b.name AS business_name FROM coupons c
                JOIN festival_businesses fb ON fb.id=c.festival_business_id JOIN businesses b ON b.id=fb.business_id
                WHERE c.id=%s AND fb.festival_id=%s AND fb.participation_status='APPROVED' AND c.status='ACTIVE'
                  AND c.valid_from<=now() AND c.valid_until>now() FOR UPDATE OF c""",
            params,
        )

    def work_select_coupon_issues(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT count(*)::int AS total,
                count(*) FILTER(WHERE visitor_session_id=%s)::int AS mine FROM coupon_issues WHERE coupon_id=%s""",
            params,
        )

    def work_insert_coupon_issues_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO coupon_issues(coupon_id,visitor_session_id,issue_token_hash,expires_at)
                    VALUES(%s,%s,%s,%s) RETURNING id,status,issued_at,expires_at""",
            params,
        )

    def work_insert_business_events(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO business_events(festival_business_id,visitor_session_id,event_type,source) VALUES(%s,%s,'COUPON_ISSUE','COUPON')",
            params,
        )

    def rotate_issue_token_select_coupon_issues(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT ci.id,ci.status,(ci.expires_at<=now()) AS expired,c.name
            FROM coupon_issues ci JOIN coupons c ON c.id=ci.coupon_id
            WHERE ci.id=%s AND ci.visitor_session_id=%s FOR UPDATE OF ci""",
            params,
        )

    def rotate_issue_token_update_coupon_issues_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE coupon_issues SET issue_token_hash=%s WHERE id=%s
            RETURNING id,status,issued_at,expires_at""",
            params,
        )

    def reward_actions_select_reward_actions(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT a.id,a.action_type,a.verification_type,a.points,a.per_user_limit,a.rule,
            count(e.id)::int AS earned_count FROM reward_actions a JOIN reward_campaigns c ON c.id=a.campaign_id
            LEFT JOIN reward_events e ON e.reward_action_id=a.id AND e.visitor_session_id=%s
            WHERE c.festival_id=%s AND c.status='ACTIVE' AND c.starts_at<=now() AND c.ends_at>now()
            GROUP BY a.id ORDER BY a.action_type""",
            params,
        )

    def work_select_reward_actions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT a.*,c.festival_id,c.daily_point_limit FROM reward_actions a JOIN reward_campaigns c ON c.id=a.campaign_id
                WHERE a.id=%s AND c.festival_id=%s AND c.status='ACTIVE' AND c.starts_at<=now() AND c.ends_at>now() FOR UPDATE OF c""",
            params,
        )

    def work_select_reward_events(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT count(*)::int AS count FROM reward_events WHERE reward_action_id=%s AND visitor_session_id=%s",
            params,
        )

    def work_select_point_ledger(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT coalesce(sum(pl.points_delta),0)::int AS points FROM point_ledger pl
                JOIN reward_events re ON re.id=pl.reward_event_id JOIN reward_actions ra ON ra.id=re.reward_action_id
                WHERE pl.visitor_session_id=%s AND ra.campaign_id=%s AND pl.created_at::date=CURRENT_DATE""",
            params,
        )

    def work_insert_reward_events_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO reward_events(reward_action_id,visitor_session_id,verification_key,evidence,occurred_at)
                    VALUES(%s,%s,%s,%s,coalesce(%s,now())) RETURNING *""",
            params,
        )

    def work_insert_point_ledger_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO point_ledger(visitor_session_id,reward_event_id,points_delta,reason) VALUES(%s,%s,%s,%s) RETURNING *",
            params,
        )

    def points_select_point_ledger(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            "SELECT id,points_delta,reason,created_at FROM point_ledger WHERE visitor_session_id=%s ORDER BY created_at DESC",
            params,
        )

    def coupons_select_coupon_issues(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT c.*,(SELECT count(*) FROM coupon_issues ci WHERE ci.coupon_id=c.id)::int AS issued_count
            FROM coupons c JOIN festival_businesses fb ON fb.id=c.festival_business_id WHERE fb.festival_id=%s AND fb.id=%s ORDER BY c.created_at DESC""",
            params,
        )

    def create_coupon_select_festival_businesses(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT 1 FROM festival_businesses WHERE id=%s AND festival_id=%s AND participation_status='APPROVED'",
            params,
        )

    def redeem_coupon_on_site_select_coupon_issues(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT ci.id,ci.status,ci.visitor_session_id,(ci.expires_at<=now()) AS expired,
            c.festival_business_id,c.name FROM coupon_issues ci JOIN coupons c ON c.id=ci.coupon_id
            JOIN festival_businesses fb ON fb.id=c.festival_business_id
            WHERE ci.issue_token_hash=%s AND fb.festival_id=%s FOR UPDATE OF ci""",
            params,
        )

    def reward_campaigns_select_reward_campaigns(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT c.*, coalesce(jsonb_agg(jsonb_build_object(
                'id',a.id,'action_type',a.action_type,'verification_type',a.verification_type,
                'points',a.points,'per_user_limit',a.per_user_limit,'rule',a.rule)
                ORDER BY a.action_type) FILTER (WHERE a.id IS NOT NULL), '[]') AS actions
            FROM reward_campaigns c LEFT JOIN reward_actions a ON a.campaign_id=c.id
            WHERE c.festival_id=%s GROUP BY c.id ORDER BY c.starts_at DESC""",
            params,
        )

    def create_reward_campaign_insert_reward_campaigns(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO reward_campaigns(festival_id,name,starts_at,ends_at,daily_point_limit,created_by)
            VALUES(%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def create_reward_action_insert_reward_actions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO reward_actions(campaign_id,action_type,verification_type,points,per_user_limit,rule)
            SELECT %(campaign_id)s,%(action_type)s,%(verification_type)s,%(points)s,%(per_user_limit)s,%(jsonb_rule)s WHERE EXISTS(SELECT 1 FROM reward_campaigns WHERE id=%(campaign_id)s AND festival_id=%(festival_id)s) RETURNING *""",
            params,
        )
