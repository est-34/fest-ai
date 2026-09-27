from psycopg.errors import UniqueViolation

from app.infrastructure.db import jsonb
from app.shared.application.values import JsonValue
from app.shared.domain.errors import DuplicateKey


class Transaction:
    def __init__(self, connection):
        self.connection = connection

    def execute(self, sql, params=()):
        def value(item):
            return jsonb(item.value) if isinstance(item, JsonValue) else item

        adapted = (
            {k: value(v) for k, v in params.items()}
            if isinstance(params, dict)
            else tuple(value(v) for v in params)
        )
        try:
            return self.connection.execute(sql, adapted)
        except UniqueViolation as error:
            raise DuplicateKey(str(error)) from error
