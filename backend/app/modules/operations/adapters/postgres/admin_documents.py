from app.infrastructure.db import all_rows, one, set_clause


class AdminDocumentsRepository:
    def __init__(self, connection):
        self.connection = connection

    def internal_documents_select_internal_documents(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT id,title,document_type,source_url,allowed_roles,status,updated_at
            FROM internal_documents WHERE festival_id=%s AND status='ACTIVE' AND allowed_roles ? %s
            ORDER BY updated_at DESC""",
            params,
        )

    def create_internal_document_insert_internal_documents(self, params=()):
        connection = self.connection
        return one(
            connection,
            """INSERT INTO internal_documents(festival_id,title,document_type,body,source_url,allowed_roles,created_by)
            VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING id,title,document_type,source_url,allowed_roles,status,created_at""",
            params,
        )

    def update_internal_document_select_internal_documents(self, params=()):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM internal_documents WHERE id=%s AND festival_id=%s AND status='ACTIVE'",
            params,
        )

    def update_internal_document_select_internal_documents_2(
        self, params=(), *, values
    ):
        connection = self.connection
        clause, values_params = set_clause(values) if values else ("", [])
        params = [*values_params, *params]
        return one(
            connection,
            f"""UPDATE internal_documents SET {clause},updated_at=now()
            WHERE id=%s AND festival_id=%s AND status='ACTIVE'
            RETURNING id,title,document_type,source_url,allowed_roles,status,updated_at""",
            params,
        )

    def archive_internal_document_update_internal_documents(self, params=()):
        connection = self.connection
        return one(
            connection,
            """UPDATE internal_documents SET status='ARCHIVED',updated_at=now()
            WHERE id=%s AND festival_id=%s AND status='ACTIVE' RETURNING id""",
            params,
        )

    def search_internal_documents_select_internal_documents(self, params=()):
        connection = self.connection
        return all_rows(
            connection,
            """SELECT id,title,document_type,body,source_url,updated_at FROM internal_documents
            WHERE festival_id=%(festival_id)s AND status='ACTIVE' AND allowed_roles ? %(role)s AND body ILIKE ANY(%(patterns)s)
            ORDER BY (SELECT count(*) FROM unnest(%(patterns)s::text[]) pattern WHERE body ILIKE pattern) DESC,
                     updated_at DESC LIMIT 5""",
            params,
        )
