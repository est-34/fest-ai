from app.infrastructure.db import all_rows, one


class PrivacyRepository:
    def __init__(self, connection):
        self.connection = connection

    def _children_pg_constraint(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT c.conrelid::regclass::text AS table_name,a.attname AS column_name
            FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
            WHERE c.contype='f' AND c.confrelid=%s::regclass AND c.conrelid<>c.confrelid""",
            params,
        )

    def _has_id_information_schema(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name=%s AND column_name='id'""",
            params,
        )

    def delete_rows_query(self, params=(), *, child_table, column):
        connection = self.connection
        return all_rows(
            connection, f"SELECT id FROM {child_table} WHERE {column}=ANY(%s)", params
        )

    def delete_rows_query_2(self, params=(), *, child_table, column):
        connection = self.connection
        return connection.execute(
            f"DELETE FROM {child_table} WHERE {column}=ANY(%s)", params
        )

    def delete_rows_query_3(self, params=(), *, table):
        connection = self.connection
        return connection.execute(
            f"DELETE FROM {table} WHERE id=ANY(%s)", params
        ).rowcount

    def ai_logs_for_visitor(self, visitor_id):
        return all_rows(
            self.connection,
            "SELECT id FROM ai_conversations WHERE visitor_session_id=%s",
            (visitor_id,),
        )

    def expired_ai_logs(self):
        return all_rows(
            self.connection,
            "SELECT id FROM ai_conversations WHERE created_at<now()-interval '90 days'",
        )

    def expired_survey_responses(self):
        return all_rows(
            self.connection,
            """SELECT id FROM survey_responses
            WHERE EXISTS(SELECT 1 FROM surveys s JOIN festivals f ON f.id=s.festival_id
            WHERE s.id=survey_responses.survey_id AND f.ends_at<now()-interval '365 days')""",
        )

    def purge_sessions_visitor_sessions(self, *, visitor_id=None, expired_days=None):
        if visitor_id is not None:
            where, params = "id=%s", (visitor_id,)
        elif expired_days is not None:
            where, params = (
                "expires_at<now()-make_interval(days => %s)",
                (expired_days,),
            )
        else:
            where, params = (
                """EXISTS(SELECT 1 FROM festivals f
                WHERE f.id=visitor_sessions.festival_id AND f.ends_at<now()-interval '30 days')""",
                (),
            )
        return all_rows(
            self.connection, f"SELECT id FROM visitor_sessions WHERE {where}", params
        )

    def purge_sessions_query(self, params=(), *, table):
        connection = self.connection
        return connection.execute(
            f"UPDATE {table} SET visitor_session_id=NULL WHERE visitor_session_id=ANY(%s)",
            params,
        )

    def purge_personal_data_business_events(self, params=()):
        connection = self.connection
        return connection.execute(
            """DELETE FROM business_events be
            WHERE be.event_type='SALE' AND EXISTS(SELECT 1 FROM festival_businesses fb JOIN festivals f ON f.id=fb.festival_id
              WHERE fb.id=be.festival_business_id AND (NOT fb.sales_consent OR f.ends_at<now()-interval '365 days'))""",
            params,
        ).rowcount

    def purge_personal_data_business_recommendation_events(self, params=()):
        connection = self.connection
        return connection.execute(
            "DELETE FROM business_recommendation_events WHERE created_at<now()-make_interval(days => %s)",
            params,
        ).rowcount

    def purge_personal_data_users(self, params=()):
        connection = self.connection
        return connection.execute(
            """UPDATE users u
            SET email='purged-'||u.id||'@invalid',name='(파기된 계정)',password_hash='',status='PURGED'
            WHERE u.status<>'PURGED' AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id
              AND m.role='MERCHANT' AND m.status='INACTIVE' AND m.deactivated_at<now()-interval '365 days')
              AND NOT EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.status='ACTIVE')""",
            params,
        ).rowcount

    def record_identity_visitor_identity_events(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT count(*)::int AS count FROM visitor_identity_events
            WHERE festival_id=%s AND device_key=%s""",
            params,
        )

    def record_identity_visitor_identity_events_2(self, params=()):
        connection = self.connection
        return connection.execute(
            """INSERT INTO visitor_identity_events(festival_id,visitor_session_id,device_key,event_type,prior_session_count)
            VALUES(%s,%s,%s,%s,%s)""",
            params,
        )
