from app.infrastructure.db import jsonb, one


class IdempotencyRepository:
    def __init__(self, connection):
        self.connection = connection

    def lock(self, scope, key):
        connection = self.connection
        connection.execute(
            "SELECT pg_advisory_xact_lock(hashtext(%s))", (f"{scope}:{key}",)
        )

    def previous(self, scope, key):
        connection = self.connection
        return one(
            connection,
            "SELECT * FROM idempotency_records WHERE scope=%s AND key=%s",
            (scope, key),
        )

    def save(self, scope, key, request_hash, status, response):
        connection = self.connection
        connection.execute(
            """INSERT INTO idempotency_records(scope,key,request_hash,response_status,response_body)
            VALUES(%s,%s,%s,%s,%s)""",
            (scope, key, request_hash, status, jsonb(response)),
        )
