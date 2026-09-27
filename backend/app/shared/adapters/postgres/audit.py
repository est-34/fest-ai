"""변경 이력의 영속화. 업무 변경과 같은 연결로 기록한다."""

from typing import Any

from app.infrastructure.db import jsonb


class AuditRepository:
    def __init__(self, connection):
        self.connection = connection

    def audit(
        self,
        *,
        festival_id: str | None,
        actor_id: str | None,
        action: str,
        resource_type: str,
        resource_id: str | None,
        request_id: str,
        before_data: Any = None,
        after_data: Any = None,
    ) -> None:
        connection = self.connection
        connection.execute(
            """INSERT INTO audit_logs(festival_id,actor_id,action,resource_type,resource_id,before_data,after_data,request_id)
               VALUES(%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                festival_id,
                actor_id,
                action,
                resource_type,
                resource_id,
                jsonb(before_data) if before_data is not None else None,
                jsonb(after_data) if after_data is not None else None,
                request_id,
            ),
        )
