from app.infrastructure.db import all_rows, one, set_clause


class MerchantRepository:
    def __init__(self, connection):
        self.connection = connection

    def owned_business_select_festival_businesses(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT fb.*,b.name,b.registration_no FROM festival_businesses fb JOIN businesses b ON b.id=fb.business_id
            JOIN festivals f ON f.id=fb.festival_id WHERE fb.id=%s AND fb.owner_membership_id=%s AND f.organization_id=%s""",
            params,
        )

    def businesses_select_festival_businesses(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT DISTINCT ON (fb.id) fb.*,b.name,b.registration_no,b.address,bo.booth_no,bo.area_id
            FROM festival_businesses fb JOIN businesses b ON b.id=fb.business_id LEFT JOIN booths bo ON bo.festival_business_id=fb.id
            WHERE fb.owner_membership_id=%s ORDER BY fb.id,bo.booth_no""",
            params,
        )

    def update_business_update_businesses(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE businesses SET name=%s,updated_at=now() WHERE id=%s", params
        )

    def update_business_select_festival_businesses(self, params=(), *, values):
        connection = self.connection
        clause, values_params = set_clause(values) if values else ("", [])
        params = [*values_params, *params]
        return one(
            connection,
            f"""UPDATE festival_businesses SET {(clause + "," if clause else "")}participation_status='SUBMITTED',
            review_comment=NULL,version=version+1,updated_at=now() WHERE id=%s AND version=%s RETURNING *""",
            params,
        )

    def redeem_coupon_select_coupon_issues(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT ci.*,(ci.expires_at<=now()) AS expired,c.festival_business_id,c.name,fb.festival_id
            FROM coupon_issues ci JOIN coupons c ON c.id=ci.coupon_id JOIN festival_businesses fb ON fb.id=c.festival_business_id
            WHERE ci.id=%s AND fb.owner_membership_id=%s FOR UPDATE OF ci""",
            params,
        )

    def reverse_coupon_select_coupon_redemptions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT cr.*,fb.festival_id FROM coupon_redemptions cr JOIN festival_businesses fb ON fb.id=cr.festival_business_id
            WHERE cr.id=%s AND fb.owner_membership_id=%s FOR UPDATE OF cr""",
            params,
        )

    def reverse_coupon_update_coupon_redemptions_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            "UPDATE coupon_redemptions SET status='REVERSED',reversed_at=now(),reversal_reason=%s WHERE id=%s RETURNING *",
            params,
        )

    def reverse_coupon_update_coupon_issues(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE coupon_issues SET status=CASE WHEN expires_at>now() THEN 'ISSUED' ELSE 'EXPIRED' END WHERE id=%s",
            params,
        )

    def record_business_event_insert_business_events(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO business_events(festival_business_id,event_type,sales_amount,source) VALUES(%s,%s,%s,%s) RETURNING *",
            params,
        )

    def performance_select_business_events(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT event_type,count(*)::int AS count,coalesce(sum(sales_amount),0) AS sales_amount
            FROM business_events WHERE festival_business_id=%s GROUP BY event_type ORDER BY event_type""",
            params,
        )

    def performance_select_coupons(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT count(ci.id)::int AS issued,count(cr.id) FILTER(WHERE cr.status='REDEEMED')::int AS redeemed
            FROM coupons c LEFT JOIN coupon_issues ci ON ci.coupon_id=c.id LEFT JOIN coupon_redemptions cr ON cr.coupon_issue_id=ci.id
            WHERE c.festival_business_id=%s""",
            params,
        )
