from app.infrastructure.db import all_rows, one


class BusinessesRepository:
    def __init__(self, connection):
        self.connection = connection

    def public_businesses_select_festival_businesses(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT DISTINCT ON (fb.id) fb.id,b.name,fb.category,fb.description,fb.menu,
            fb.operating_hours,fb.accessibility,b.address,bo.booth_no,bo.area_id,a.name AS area_name
            FROM festival_businesses fb JOIN businesses b ON b.id=fb.business_id
            LEFT JOIN booths bo ON bo.festival_business_id=fb.id LEFT JOIN festival_areas a ON a.id=bo.area_id
            WHERE fb.festival_id=%(festival_id)s AND fb.participation_status='APPROVED' AND b.status='ACTIVE'
              AND (%(category)s::text IS NULL OR fb.category=%(category)s) ORDER BY fb.id,bo.booth_no""",
            params,
        )

    def businesses_select_festival_businesses(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT DISTINCT ON (fb.id) fb.*,b.registration_no,b.name,b.address,
            bo.id AS booth_id,bo.booth_no,bo.area_id
            FROM festival_businesses fb JOIN businesses b ON b.id=fb.business_id LEFT JOIN booths bo ON bo.festival_business_id=fb.id
            WHERE fb.festival_id=%(festival_id)s AND (%(status)s::text IS NULL OR fb.participation_status=%(status)s)
            ORDER BY fb.id,bo.booth_no""",
            params,
        )

    def create_business_insert_businesses(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO businesses(organization_id,registration_no,name,address)
            VALUES(%(organization_id)s,%(registration_no)s,%(name)s,%(address)s)
            ON CONFLICT(organization_id,registration_no) DO UPDATE SET name=excluded.name,address=excluded.address,updated_at=now() RETURNING *""",
            params,
        )

    def create_business_insert_festival_businesses(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO festival_businesses(festival_id,business_id,owner_membership_id,category,description,menu,operating_hours,accessibility)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
            params,
        )

    def create_business_insert_booths(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO booths(festival_business_id,area_id,booth_no) VALUES(%s,%s,%s)",
            params,
        )

    def review_business_update_festival_businesses(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE festival_businesses SET participation_status=%(decision)s,review_comment=%(comment)s,
            approved_by=%(reviewer)s,approved_at=CASE WHEN %(decision)s='APPROVED' THEN now() ELSE NULL END,
            version=version+1,updated_at=now()
            WHERE id=%(business_id)s AND festival_id=%(festival_id)s
              AND participation_status IN ('SUBMITTED','REJECTED') RETURNING *""",
            params,
        )

    def merchant_invitations_select_merchant_invitations(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT mi.id,mi.email,mi.status,mi.expires_at,mi.accepted_at,mi.created_at,
            (mi.status='PENDING' AND mi.expires_at<=now()) AS expired,u.name AS accepted_name
            FROM merchant_invitations mi LEFT JOIN memberships m ON m.id=mi.membership_id LEFT JOIN users u ON u.id=m.user_id
            WHERE mi.festival_business_id=%s ORDER BY mi.created_at DESC""",
            params,
        )

    def merchant_invitations_select_festival_businesses(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT m.id AS membership_id,m.status,u.name,u.email FROM festival_businesses fb
            JOIN memberships m ON m.id=fb.owner_membership_id JOIN users u ON u.id=m.user_id WHERE fb.id=%s""",
            params,
        )

    def create_merchant_invitation_insert_merchant_invitations(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO merchant_invitations(festival_business_id,email,token_hash,invited_by,expires_at)
            VALUES(%s,%s,%s,%s,now()+make_interval(hours => %s)) RETURNING id,email,status,expires_at,created_at""",
            params,
        )

    def revoke_merchant_invitation_update_merchant_invitations(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE merchant_invitations mi SET status='REVOKED' FROM festival_businesses fb
            WHERE mi.id=%s AND mi.festival_business_id=fb.id AND fb.id=%s AND fb.festival_id=%s AND mi.status='PENDING'
            RETURNING mi.id,mi.email,mi.status""",
            params,
        )

    def deactivate_business_merchant_select_festival_businesses(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT owner_membership_id FROM festival_businesses
            WHERE id=%s AND festival_id=%s""",
            params,
        )

    def deactivate_business_merchant_update_memberships(self, params=()):
        connection = self.connection
        return connection.execute(
            """UPDATE memberships SET status='INACTIVE',deactivated_at=coalesce(deactivated_at,now())
            WHERE id=%s AND role='MERCHANT'""",
            params,
        )

    def deactivate_business_merchant_update_festival_businesses(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE festival_businesses SET owner_membership_id=NULL,updated_at=now() WHERE id=%s",
            params,
        )

    def business_performance_select_festival_businesses(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT fb.id,b.name,fb.category,fb.is_sponsored,fb.esg_participating,fb.sales_consent,
            coalesce(e.impressions,0)::int AS impressions,coalesce(e.visits,0)::int AS visits,
            coalesce(k.coupons_issued,0)::int AS coupons_issued,coalesce(k.coupons_redeemed,0)::int AS coupons_redeemed,
            CASE WHEN fb.sales_consent THEN coalesce(e.sales_amount,0) END AS sales_amount
            FROM festival_businesses fb JOIN businesses b ON b.id=fb.business_id
            LEFT JOIN LATERAL (SELECT count(*) FILTER(WHERE be.event_type='IMPRESSION') AS impressions,
                                      count(*) FILTER(WHERE be.event_type='VISIT') AS visits,
                                      coalesce(sum(be.sales_amount),0) AS sales_amount
                               FROM business_events be WHERE be.festival_business_id=fb.id) e ON true
            LEFT JOIN LATERAL (SELECT count(ci.id) AS coupons_issued,
                                      count(cr.id) FILTER(WHERE cr.status='REDEEMED') AS coupons_redeemed
                               FROM coupons c JOIN coupon_issues ci ON ci.coupon_id=c.id
                               LEFT JOIN coupon_redemptions cr ON cr.coupon_issue_id=ci.id
                               WHERE c.festival_business_id=fb.id) k ON true
            WHERE fb.festival_id=%s AND fb.participation_status='APPROVED'
            ORDER BY b.name""",
            params,
        )
