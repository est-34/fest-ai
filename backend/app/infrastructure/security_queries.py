from app.infrastructure.db import one


def current_user_users(connection, params=()):
    return one(
        connection,
        """SELECT u.id,u.email,u.name,m.id AS membership_id,m.organization_id,m.role,m.festival_scope
           FROM users u JOIN memberships m ON m.user_id=u.id
           WHERE u.id=%s AND m.id=%s AND u.status='ACTIVE' AND m.status='ACTIVE'""",
        params,
    )


def festival_access_festivals(connection, params=()):
    return one(
        connection, "SELECT id,organization_id FROM festivals WHERE id=%s", params
    )


def current_visitor_visitor_sessions(connection, params=()):
    return one(
        connection,
        """SELECT id,festival_id,language,accessibility_preferences FROM visitor_sessions
           WHERE anonymous_token_hash=%s AND ended_at IS NULL AND expires_at>now()""",
        params,
    )
