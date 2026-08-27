from concurrent.futures import ThreadPoolExecutor

import pytest


def data(response, expected=200):
    assert response.status_code == expected, response.text
    return response.json()["data"]


@pytest.fixture
def activity_code(client, visitor):
    return data(client.get("/api/v1/visitor/activity-profile", headers=visitor))[
        "visitorCode"
    ]


def test_activity_identity_is_server_issued_and_stable(client, visitor, activity_code):
    assert activity_code.startswith("VIS-") and len(activity_code) >= 24
    assert (
        data(client.get("/api/v1/visitor/activity-profile", headers=visitor))[
            "visitorCode"
        ]
        == activity_code
    )


def test_plogging_credits_once_and_is_visible_to_visitor(
    client, festival, operator, visitor, activity_code, unique, connection
):
    base = f"/api/v1/admin/festivals/{festival['id']}/activities/plogging"
    headers = {**operator, "Idempotency-Key": unique("plogging")}
    body = {"visitorCode": activity_code, "bagCount": 2, "location": "회수존"}
    row = data(client.post(base, headers=headers, json=body), 201)
    replay = client.post(base, headers=headers, json=body)
    assert data(replay, 201)["id"] == row["id"]
    assert replay.headers["Idempotency-Replayed"] == "true"
    assert (
        client.post(base, headers=headers, json={**body, "bagCount": 3}).status_code
        == 409
    )
    history = data(client.get("/api/v1/visitor/activities/plogging", headers=visitor))
    assert [item["id"] for item in history] == [row["id"]]
    assert history[0]["operatorEmail"] == "operator@example.com"
    points = data(client.get("/api/v1/visitor/points", headers=visitor))
    assert points["balance"] == 60
    assert (
        connection.execute(
            "SELECT count(*) AS n FROM point_ledger WHERE plogging_submission_id=%s",
            (row["id"],),
        ).fetchone()["n"]
        == 1
    )
    assert connection.execute(
        "SELECT 1 FROM audit_logs WHERE resource_id=%s AND action='VERIFY'",
        (row["id"],),
    ).fetchone()


def rent(client, festival, operator, activity_code, unique):
    base = f"/api/v1/admin/festivals/{festival['id']}/activities/rentals"
    row = data(
        client.post(
            base,
            headers={**operator, "Idempotency-Key": unique("rent")},
            json={
                "visitorCode": activity_code,
                "containerType": "CUP",
                "quantity": 2,
                "station": "그린존",
            },
        ),
        201,
    )
    return base, row


def test_return_is_atomic_under_concurrent_operators(
    client, festival, operator, visitor, activity_code, unique, connection
):
    base, row = rent(client, festival, operator, activity_code, unique)
    assert data(client.get("/api/v1/visitor/points", headers=visitor))["balance"] == 0
    keys = [unique("return"), unique("return")]

    def return_one(key):
        return client.post(
            f"{base}/{row['id']}/return", headers={**operator, "Idempotency-Key": key}
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(return_one, keys))
    assert sorted(r.status_code for r in responses) == [200, 409]
    winner = next(i for i, r in enumerate(responses) if r.status_code == 200)
    assert data(return_one(keys[winner]))["stampPoints"] == 50
    assert data(client.get("/api/v1/visitor/points", headers=visitor))["balance"] == 50
    history = data(client.get("/api/v1/visitor/activities/rentals", headers=visitor))
    assert history[0]["status"] == "RETURNED" and history[0]["stampPoints"] == 50
    assert (
        connection.execute(
            "SELECT count(*) AS n FROM point_ledger WHERE container_rental_id=%s",
            (row["id"],),
        ).fetchone()["n"]
        == 1
    )


def test_activity_writes_enforce_role_scope_and_validation(
    client, festival, reviewer, operator, visitor, activity_code, unique, connection
):
    base = f"/api/v1/admin/festivals/{festival['id']}/activities/plogging"
    body = {"visitorCode": activity_code, "bagCount": 1, "location": "회수존"}
    headers = {**operator, "Idempotency-Key": unique("auth")}
    assert (
        client.post(
            base, headers={**reviewer, "Idempotency-Key": unique("denied")}, json=body
        ).status_code
        == 403
    )
    assert client.post(base, headers=visitor, json=body).status_code == 401
    assert client.post(base, headers=operator, json=body).status_code == 400
    assert (
        client.post(base, headers=headers, json={**body, "bagCount": 0}).status_code
        == 400
    )
    assert (
        client.post(base, headers=headers, json={**body, "points": 9999}).status_code
        == 400
    )
    connection.execute(
        "UPDATE visitor_sessions SET expires_at=now()-interval '1 second' WHERE activity_code=%s",
        (activity_code,),
    )
    assert client.post(base, headers=headers, json=body).status_code == 404


def test_visitor_cannot_read_another_visitors_activities(
    client, festival, operator, visitor, activity_code, unique
):
    _, row = rent(client, festival, operator, activity_code, unique)
    session = data(
        client.post(
            f"/api/v1/public/festivals/{festival['code']}/visitor-sessions",
            json={"language": "ko"},
        ),
        201,
    )
    other = {"Authorization": f"Bearer {session['sessionToken']}"}
    assert data(client.get("/api/v1/visitor/activities/rentals", headers=other)) == []
    assert (
        data(client.get("/api/v1/visitor/activities/rentals", headers=visitor))[0]["id"]
        == row["id"]
    )


def test_activity_and_points_roll_back_when_audit_fails(
    client, festival, operator, activity_code, unique, connection, monkeypatch
):
    from app.modules.engagement.application import activities
    from app.shared.domain.errors import AppError

    def fail(*args, **kwargs):
        raise AppError(503, "AUDIT_UNAVAILABLE", "감사 기록 실패")

    monkeypatch.setattr(activities, "logged", fail)
    base = f"/api/v1/admin/festivals/{festival['id']}/activities/plogging"
    response = client.post(
        base,
        headers={**operator, "Idempotency-Key": unique("rollback")},
        json={"visitorCode": activity_code, "bagCount": 1, "location": "롤백 테스트"},
    )
    assert response.status_code == 503
    assert (
        connection.execute(
            "SELECT 1 FROM plogging_submissions p JOIN visitor_sessions v ON v.id=p.visitor_session_id WHERE v.activity_code=%s",
            (activity_code,),
        ).fetchone()
        is None
    )
    assert (
        connection.execute(
            "SELECT 1 FROM point_ledger p JOIN visitor_sessions v ON v.id=p.visitor_session_id WHERE v.activity_code=%s",
            (activity_code,),
        ).fetchone()
        is None
    )


def test_activity_history_supports_cursor_pagination(
    client, festival, operator, visitor, activity_code, unique
):
    rent(client, festival, operator, activity_code, unique)
    rent(client, festival, operator, activity_code, unique)
    url = "/api/v1/visitor/activities/rentals?limit=1"
    first = client.get(url, headers=visitor).json()
    assert first["page"]["hasNext"] is True
    second = client.get(
        url + "&cursor=" + first["page"]["nextCursor"], headers=visitor
    ).json()
    assert second["page"]["hasNext"] is False
    assert first["data"][0]["id"] != second["data"][0]["id"]
