"""모듈 경계, 공유 상태, 외부 I/O 트랜잭션의 회귀 검증."""

import os
import subprocess
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor

from app.infrastructure import coordination
from app.infrastructure.db import pool


def run_python(source):
    result = subprocess.run(
        [sys.executable, "-c", source],
        env=os.environ.copy(),
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )
    return result.stdout.strip()


def test_rate_limit_is_atomic_across_processes(client):
    key = "test-" + uuid.uuid4().hex
    source = f"""from app.infrastructure.db import pool
from app.infrastructure.coordination import limited
pool.open(wait=True)
try:
    print(sum(not limited({key!r}, 'probe', 10) for _ in range(8)))
finally:
    pool.close()
"""
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(run_python, [source, source]))
    assert sum(map(int, results)) == 10


def test_alan_lock_excludes_other_processes_and_releases(client):
    source = """from dataclasses import replace
from app.infrastructure import coordination
coordination.settings = replace(coordination.settings, alan_lock_wait_seconds=0.15)
try:
    with coordination.alan_guard():
        print('acquired')
except coordination.CoordinationBusy:
    print('busy')
finally:
    coordination.alan_pool.close()
"""
    with coordination.alan_guard():
        assert run_python(source) == "busy"
        # AI 세션 잠금이 업무 연결을 빌리지 않는다.
        stats = pool.get_stats()
        assert stats["pool_available"] == stats["pool_size"]
    assert run_python(source) == "acquired"


def test_visitor_ai_returns_business_connection_before_external_call(
    client, visitor, monkeypatch
):
    from app.infrastructure import ai

    conversation = client.post(
        "/api/v1/visitor/ai/conversations", headers=visitor, json={"language": "ko"}
    ).json()["data"]
    seen = []

    def answer(*_):
        stats = pool.get_stats()
        seen.append(stats["pool_size"] - stats["pool_available"])
        return "안내데스크로 와 주세요."

    monkeypatch.setattr(ai, "answer_with_festival_context", answer)
    response = client.post(
        f"/api/v1/visitor/ai/conversations/{conversation['id']}/messages",
        headers=visitor,
        json={"message": "어디로 가야 하나요?"},
    )
    assert response.status_code == 200, response.text
    assert seen == [0]


def test_visitor_session_is_rechecked_after_external_call(
    client, visitor, connection, monkeypatch
):
    from app.infrastructure import ai

    conversation = client.post(
        "/api/v1/visitor/ai/conversations", headers=visitor, json={"language": "ko"}
    ).json()["data"]

    def answer(*_):
        connection.execute(
            "UPDATE visitor_sessions SET ended_at=now() WHERE id=(SELECT visitor_session_id FROM ai_conversations WHERE id=%s)",
            (conversation["id"],),
        )
        return "뒤늦게 도착한 응답"

    monkeypatch.setattr(ai, "answer_with_festival_context", answer)
    response = client.post(
        f"/api/v1/visitor/ai/conversations/{conversation['id']}/messages",
        headers=visitor,
        json={"message": "안내해 주세요"},
    )
    assert response.status_code == 401
    assert (
        connection.execute(
            "SELECT 1 FROM ai_messages WHERE conversation_id=%s", (conversation["id"],)
        ).fetchone()
        is None
    )
