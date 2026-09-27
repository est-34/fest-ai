from app.infrastructure.db import one

INVITATION_SQL = """SELECT mi.*,fb.festival_id,fb.owner_membership_id,b.name AS business_name,f.name AS festival_name,
        f.organization_id FROM merchant_invitations mi
    JOIN festival_businesses fb ON fb.id=mi.festival_business_id JOIN businesses b ON b.id=fb.business_id
    JOIN festivals f ON f.id=fb.festival_id WHERE mi.token_hash=%s"""


class AuthRepository:
    def __init__(self, connection):
        self.connection = connection

    def issue_refresh_token_insert_refresh_tokens(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES(%s,%s,%s)",
            params,
        )

    def lock_state_select_login_attempts(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT failures,locked_until FROM login_attempts WHERE email=%s",
            params,
        )

    def record_failure_update_login_attempts(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE login_attempts SET failures=0,locked_until=NULL WHERE email=%s AND locked_until<now()",
            params,
        )

    def record_failure_update_login_attempts_2(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO login_attempts(email,failures) VALUES(%(email)s,1)
               ON CONFLICT(email) DO UPDATE SET
                 failures=login_attempts.failures+1,
                 locked_until=CASE WHEN login_attempts.failures+1>=%(max_failures)s
                                   THEN now()+make_interval(mins => %(lock_minutes)s) END,
                 updated_at=now()""",
            params,
        )

    def login_select_users(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT u.*,m.id AS membership_id,m.organization_id,m.role,m.festival_scope
               FROM users u JOIN memberships m ON m.user_id=u.id
               WHERE lower(u.email)=lower(%s) AND u.status='ACTIVE' AND m.status='ACTIVE'
               ORDER BY m.created_at LIMIT 1""",
            params,
        )

    def login_execute_login_attempts(self, params=()):
        connection = self.connection
        return connection.execute("DELETE FROM login_attempts WHERE email=%s", params)

    def refresh_select_refresh_tokens(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT rt.id AS refresh_id,u.*,m.id AS membership_id,m.organization_id,m.role,m.festival_scope
               FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id JOIN memberships m ON m.user_id=u.id
               WHERE rt.token_hash=%s AND rt.revoked_at IS NULL AND rt.expires_at>now()
                 AND u.status='ACTIVE' AND m.status='ACTIVE' ORDER BY m.created_at LIMIT 1""",
            params,
        )

    def refresh_select_refresh_tokens_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT user_id FROM refresh_tokens
                WHERE token_hash=%s AND revoked_at IS NOT NULL""",
            params,
        )

    def revoke_refresh_tokens(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=%s AND revoked_at IS NULL",
            params,
        )

    def refresh_update_refresh_tokens_2(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE refresh_tokens SET revoked_at=now() WHERE id=%s", params
        )

    def logout_update_refresh_tokens(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=%s AND revoked_at IS NULL",
            params,
        )

    def valid_invitation_select_OF(self, params=(), *, lock):
        connection = self.connection
        return one(
            connection, INVITATION_SQL + (" FOR UPDATE OF mi" if lock else ""), params
        )

    def lookup_invitation_select_users(self, params=()):
        connection = self.connection
        return one(
            connection, "SELECT 1 FROM users WHERE lower(email)=lower(%s)", params
        )

    def accept_invitation_select_users(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT id,email,name,status FROM users WHERE lower(email)=lower(%s)",
            params,
        )

    def accept_invitation_select_memberships(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT id,festival_scope FROM memberships WHERE user_id=%s AND organization_id=%s
            AND role='MERCHANT' AND status='ACTIVE'""",
            params,
        )

    def accept_invitation_insert_users_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO users(email,password_hash,name) VALUES(%s,%s,%s) RETURNING id,email,name",
            params,
        )

    def accept_invitation_insert_memberships_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO memberships(organization_id,user_id,role,festival_scope)
                VALUES(%s,%s,'MERCHANT',%s) RETURNING id,festival_scope""",
            params,
        )

    def accept_invitation_update_memberships(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE memberships SET festival_scope=%s WHERE id=%s", params
        )

    def accept_invitation_update_festival_businesses(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE festival_businesses SET owner_membership_id=%s,updated_at=now() WHERE id=%s",
            params,
        )

    def accept_invitation_update_merchant_invitations(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE merchant_invitations SET status='ACCEPTED',membership_id=%s,accepted_at=now() WHERE id=%s",
            params,
        )

    def change_password_select_users(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT password_hash FROM users WHERE id=%s AND status='ACTIVE'",
            params,
        )

    def change_password_update_users(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE users SET password_hash=%s WHERE id=%s", params
        )
