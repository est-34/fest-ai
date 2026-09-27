class NotificationsRepository:
    def __init__(self, connection):
        self.connection = connection

    def deliveries(
        self,
        festival_id,
        resource_type: str,
        resource_ids: list,
        session_id,
    ) -> None:
        """폴링 응답에 실린 항목의 노출을 세션별로 남긴다(OPS-10). 행마다 왕복하지 않고 한 문장으로 넣는다."""
        connection = self.connection
        connection.execute(
            """INSERT INTO notification_deliveries(festival_id,resource_type,resource_id,visitor_session_id)
               SELECT %s,%s,unnest(%s::uuid[]),%s ON CONFLICT DO NOTHING""",
            (
                festival_id,
                resource_type,
                [str(resource_id) for resource_id in resource_ids],
                session_id,
            ),
        )
