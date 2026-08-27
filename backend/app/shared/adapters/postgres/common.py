from app.infrastructure.db import one, set_clause


class CommonRepository:
    def __init__(self, connection):
        self.connection = connection

    def patch_row_select_rows(self, params=(), *, scope_column, table):
        connection = self.connection
        return one(
            connection,
            f"SELECT * FROM {table} WHERE id=%s AND {scope_column}=%s",
            params,
        )

    def patch_row_select_rows_2(
        self, params=(), *, values, required_status, scope_column, table
    ):
        connection = self.connection
        clause, values_params = set_clause(values)
        params = [*values_params, *params]
        if required_status is not None:
            params.append(required_status)
        return one(
            connection,
            f"""UPDATE {table} SET {clause},version=version+1,updated_at=now()
            WHERE id=%s AND {scope_column}=%s AND version=%s{(" AND status=%s" if required_status is not None else "")} RETURNING *""",
            params,
        )

    def in_festival_select_rows(self, params=(), *, table):
        connection = self.connection
        return one(
            connection, f"SELECT 1 FROM {table} WHERE id=%s AND festival_id=%s", params
        )

    def active_area(self, params):
        connection = self.connection
        return one(
            connection,
            "SELECT 1 FROM festival_areas WHERE id=%s AND festival_id=%s AND status='ACTIVE'",
            params,
        )
