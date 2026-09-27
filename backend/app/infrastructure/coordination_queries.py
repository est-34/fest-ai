from app.infrastructure.db import one


def hit(connection, client_key: str, route_key: str, window_id: int, limit: int) -> int:
    return one(
        connection,
        """INSERT INTO request_limits(client_key,route_key,window_id) VALUES(%s,%s,%s)
        ON CONFLICT(client_key,route_key,window_id) DO UPDATE
        SET hits=least(request_limits.hits+1,%s) RETURNING hits""",
        (client_key, route_key, window_id, limit + 1),
    )["hits"]


def prune(connection, window_id: int):
    connection.execute(
        "DELETE FROM request_limits WHERE window_id<%s", (window_id - 2,)
    )


def try_alan_lock(connection, key: str) -> bool:
    return one(
        connection,
        "SELECT pg_try_advisory_xact_lock(hashtextextended(%s,0)) AS locked",
        (key,),
    )["locked"]
