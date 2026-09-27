import hashlib


def device_key(user_agent: str, ip: str, secret: str) -> str:
    """기기 버킷 해시.

    저장소를 비우거나 기기를 바꾸면 익명 식별자가 새로 발급되고 1인당 한도가 초기화된다.
    이를 감지하려면 식별자 밖에 남는 신호가 필요한데, 지문 수집은 하지 않기로 했으므로
    요청 헤더에서 이미 드러나는 값(User-Agent + 접속 IP)만 서명 키로 해시해 버킷으로 쓴다.
    원문은 저장하지 않고, 축제별 발급 횟수를 세는 용도로만 남는다.

    ponytail: UA+IP 버킷이라 공용 와이파이나 TRUST_PROXY_HEADERS가 꺼진 프록시 배포에서는
    서로 다른 방문객이 한 버킷에 묶여 재발급으로 잡힌다(거짓 양성). 그래서 이 신호는 차단이
    아니라 운영자 검토용으로만 쓴다 — 자동 차단이 필요해지면 현장 확인 기반 인증(QR 스팟
    재확인 등)을 더해야 하고, 브라우저 지문 수집으로 정확도를 올리는 방향은 쓰지 않는다.
    """
    raw = f"{user_agent}|{ip}"
    return hashlib.sha256(f"{secret}|{raw}".encode()).hexdigest()[:32]
