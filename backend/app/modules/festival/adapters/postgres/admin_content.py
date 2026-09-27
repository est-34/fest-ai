from app.infrastructure.db import all_rows, one

VERSIONS_SQL = """SELECT cv.*,coalesce(jsonb_agg(jsonb_build_object('reviewerId',ca.reviewer_id,
    'decision',ca.decision,'comment',ca.comment,'decidedAt',ca.decided_at)) FILTER(WHERE ca.id IS NOT NULL),'[]') reviews
    FROM content_versions cv LEFT JOIN content_approvals ca ON ca.content_version_id=cv.id
    WHERE cv.content_item_id=ANY(%s::uuid[]) GROUP BY cv.id ORDER BY cv.version_no DESC"""


class AdminContentRepository:
    def __init__(self, connection):
        self.connection = connection

    def versions_by_item_select_rows(self, params=()):
        connection = self.connection
        return all_rows(connection, VERSIONS_SQL, params)

    def items_select_content_items(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT ci.*,cv.version_no,cv.language,cv.status AS published_version_status
            FROM content_items ci LEFT JOIN content_versions cv ON cv.id=ci.published_version_id
            WHERE ci.festival_id=%s ORDER BY ci.updated_at DESC""",
            params,
        )

    def create_item_select_programs(self, params=()):
        connection = self.connection
        return one(
            connection, "SELECT 1 FROM programs WHERE id=%s AND festival_id=%s", params
        )

    def create_item_insert_content_items(self, params=()):
        connection = self.connection
        return one(
            connection,
            "INSERT INTO content_items(festival_id,content_type,resource_type,resource_id,slug) VALUES(%s,%s,%s,%s,%s) RETURNING *",
            params,
        )

    def item_detail_select_content_items(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM content_items WHERE id=%s AND festival_id=%s",
            params,
        )

    def create_version_insert_content_versions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO content_versions(content_item_id,author_id,version_no,language,body,change_note)
            SELECT %(item_id)s,%(created_by)s,coalesce(max(version_no),0)+1,%(language)s,%(value)s,%(change_note)s FROM content_versions
            WHERE content_item_id=%(item_id)s AND language=%(language)s RETURNING *""",
            params,
        )

    def submit_version_update_content_versions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE content_versions cv SET status='IN_REVIEW' FROM content_items ci
            WHERE cv.id=%s AND cv.content_item_id=ci.id AND ci.festival_id=%s AND cv.status='DRAFT' RETURNING cv.*""",
            params,
        )

    def review_version_select_content_versions(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT cv.*,ci.content_type FROM content_versions cv JOIN content_items ci ON ci.id=cv.content_item_id
            WHERE cv.id=%s AND ci.festival_id=%s""",
            params,
        )

    def review_version_insert_content_approvals(self, params=()):
        connection = self.connection
        return connection.execute(
            "INSERT INTO content_approvals(content_version_id,reviewer_id,decision,comment) VALUES(%s,%s,%s,%s)",
            params,
        )

    def review_version_update_content_versions_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            "UPDATE content_versions SET status=%s WHERE id=%s RETURNING *",
            params,
        )

    def publish_item_select_content_items(self, params=()):
        connection = self.connection
        return one(
            connection,
            """SELECT ci.*,cv.status AS version_status,cv.content_item_id FROM content_items ci
            JOIN content_versions cv ON cv.id=%s WHERE ci.id=%s AND ci.festival_id=%s""",
            params,
        )

    def publish_item_update_content_items_2(self, params=()):
        connection = self.connection
        return one(
            connection,
            "UPDATE content_items SET published_version_id=%s,lifecycle_status='PUBLISHED',updated_at=now() WHERE id=%s RETURNING *",
            params,
        )

    def publish_item_update_programs(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE programs SET status='PUBLISHED',updated_at=now(),version=version+1 WHERE id=%s AND festival_id=%s",
            params,
        )

    def unpublish_item_update_content_items(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE content_items SET lifecycle_status='UNPUBLISHED',updated_at=now()
            WHERE id=%s AND festival_id=%s AND lifecycle_status='PUBLISHED' RETURNING *""",
            params,
        )

    def unpublish_item_update_programs(self, params=()):
        connection = self.connection
        return connection.execute(
            "UPDATE programs SET status='UNPUBLISHED',updated_at=now(),version=version+1 WHERE id=%s",
            params,
        )

    def ai_reviews_select_ai_message_reports(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT r.*,m.question,m.answer,m.safety_status,m.model_version FROM ai_message_reports r
            JOIN ai_messages m ON m.id=r.message_id JOIN ai_conversations c ON c.id=m.conversation_id
            WHERE c.festival_id=%(festival_id)s AND (%(status)s::text IS NULL OR r.status=%(status)s)
            ORDER BY r.created_at""",
            params,
        )

    def ai_decision_update_ai_message_reports(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE ai_message_reports r SET status='CLOSED',decision=%s,reviewer_id=%s,reviewed_at=now()
            FROM ai_messages m,ai_conversations c WHERE r.id=%s AND r.message_id=m.id AND m.conversation_id=c.id
            AND c.festival_id=%s AND r.status='OPEN' RETURNING r.*""",
            params,
        )
