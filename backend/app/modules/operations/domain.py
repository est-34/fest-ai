import math
from collections import Counter

from app.shared.domain.errors import bad_request
from app.shared.domain.preprocessing import recommendation_exposure_items

TICKET_TRANSITIONS = {
    "OPEN": ["ASSIGNED"],
    "ASSIGNED": ["IN_PROGRESS"],
    "IN_PROGRESS": ["RESOLVED"],
    "RESOLVED": ["CLOSED", "IN_PROGRESS"],
    "CLOSED": [],
}


def validate_ticket_transition(
    current: str, target: str, note: str | None = None
) -> None:
    if target not in TICKET_TRANSITIONS.get(current, []):
        raise bad_request(
            "INVALID_STATE_TRANSITION",
            f"{current}에서 {target}(으)로 전이할 수 없습니다.",
        )
    if target == "CLOSED" and not (note or "").strip():
        raise bad_request("CLOSE_REASON_REQUIRED", "완료 사유가 필요합니다.")
    if current == "RESOLVED" and target == "IN_PROGRESS" and not (note or "").strip():
        raise bad_request("REOPEN_REASON_REQUIRED", "재처리 사유가 필요합니다.")


RISK_ACTIONS = {
    "crowding": "혼잡 구역에 안전 인력을 추가하고 우회 동선을 안내해 주세요.",
    "safety_incidents": "진행 중인 안전 사고를 우선 처리해 주세요.",
    "unresolved_safety_complaints": "미해결 안전 민원을 처리한 뒤 위험도를 낮춰 주세요.",
    "staffing_gap": "예비 인력을 해당 구역에 재배치해 주세요.",
    "schedule_change": "변경된 일정을 현장 담당자와 확인한 뒤 방문객 공지를 게시해 주세요.",
    "abnormal_crowd_surge": "급증 구역에 즉시 안전 인력을 배치하고 우회·대기 안내를 방문객에게 보내 주세요.",
}


ABNORMAL_SURGE_TYPE = "abnormal_crowd_surge"


RISK_POINTS = {
    "safety_incidents": (35, 15),
    "unresolved_safety_complaints": (30, 15),
    "staffing_gap": (25, 10),
    "schedule_change": (20, 20),
    ABNORMAL_SURGE_TYPE: (40, 20),
}


def risk_points(signal: dict) -> int:
    """crowding은 혼잡 구역 비율(0-100), abnormal_crowd_surge는 급증 구역 수, 나머지는 건수 기준이다."""
    value, threshold = float(signal["value"]), float(signal.get("threshold") or 0)
    # crowding만 3단계다 — 90% 이상은 임계값과 무관하게 최고점.
    if signal["type"] == "crowding":
        return 45 if value >= 90 else 30 if value >= threshold else 10
    over, under = RISK_POINTS.get(signal["type"], (10, 10))
    return over if value > threshold else under


def risk_alerts(signals: list[dict]) -> list[str]:
    """즉시 통보가 필요한 신호만 별도로 뽑는다. BUSY/FULL 비율 임계값 초과는 evidence/reasons로
    충분히 보이지만, 비정상 급증은 조용히 묻히면 안 되는 신호라 alerts로 분리한다."""
    return [
        f"{signal.get('area_name') or signal.get('area_id') or '구역 미상'} 구역: "
        f"{signal.get('window_minutes', 10)}분 내 혼잡도가 {int(signal['value'])}단계 급증했습니다."
        for signal in signals
        if signal["type"] == ABNORMAL_SURGE_TYPE
    ]


def risk_brief(signals: list[dict]) -> dict:
    """검증된 운영 신호만으로 위험도를 계산한다. 신호가 없으면 추정하지 않는다."""
    if not signals:
        return {
            "risk_level": "INSUFFICIENT_DATA",
            "risk_score": 0,
            "evidence": [],
            "alerts": [],
            "summary": "위험도를 판단할 만한 운영 데이터가 없습니다.",
            "reasons": ["혼잡·민원·일정·인력 신호가 수집되지 않았습니다."],
            "recommended_actions": [
                "현장 보고와 운영 기록을 갱신한 뒤 다시 확인해 주세요."
            ],
            "operator_notes": ["규칙 기반 결과이며, 공지 전 현장 확인이 필요합니다."],
            "policy_version": "risk-v1",
        }
    score = min(100, sum(risk_points(signal) for signal in signals))
    level = "CRITICAL" if score >= 75 else "WARNING" if score >= 40 else "NORMAL"
    types = {signal["type"] for signal in signals}
    return {
        "risk_level": level,
        "risk_score": score,
        "evidence": signals,
        "alerts": risk_alerts(signals),
        "summary": f"검증된 신호 {', '.join(sorted(types))} 기준 위험도는 {level}(점수 {score})입니다.",
        "reasons": [
            f"{signal['type']} 값 {signal['value']}을(를) 임계값 {signal.get('threshold')}과(와) 비교했습니다."
            for signal in signals
        ],
        "recommended_actions": [
            RISK_ACTIONS[name] for name in sorted(types) if name in RISK_ACTIONS
        ]
        or ["운영 신호를 계속 관찰해 주세요."],
        "operator_notes": ["규칙 기반 결과이며, 공지 전 현장 확인이 필요합니다."],
        "policy_version": "risk-v1",
    }


def distance_meters(lat1, lon1, lat2, lon2) -> int | None:
    if None in (lat1, lon1, lat2, lon2):
        return None
    phi1, phi2 = math.radians(float(lat1)), math.radians(float(lat2))
    hav = (
        math.sin(math.radians(float(lat2) - float(lat1)) / 2) ** 2
        + math.cos(phi1)
        * math.cos(phi2)
        * math.sin(math.radians(float(lon2) - float(lon1)) / 2) ** 2
    )
    return round(6371000 * 2 * math.atan2(math.sqrt(hav), math.sqrt(1 - hav)))


def score_business(
    business: dict, latitude=None, longitude=None, category: str | None = None
) -> dict:
    score, reasons = 0.25, ["영업 중인 승인 업체입니다."]
    if category and business["category"] == category:
        score += 0.25
        reasons.append("요청한 업종과 일치합니다.")
    if business.get("coupon_available"):
        score += 0.15
        reasons.append("사용 가능한 쿠폰이 있습니다.")
    if business.get("esg_participating"):
        score += 0.10
        reasons.append("ESG·지역상생 프로그램 참여 업체입니다.")
    distance = distance_meters(
        latitude, longitude, business.get("latitude"), business.get("longitude")
    )
    if distance is not None and distance < 1000:
        score += 0.25 * (1 - distance / 1000)
        reasons.append(f"현재 위치에서 약 {distance}m 거리입니다.")
    return {
        "business_id": str(business["id"]),
        "name": business["name"],
        "category": business["category"],
        "score": round(min(score, 1.0), 2),
        "reasons": reasons,
        "is_sponsored": bool(business.get("is_sponsored")),
        "distance_meters": distance,
        "area_id": str(business["area_id"]) if business.get("area_id") else None,
        "area_name": business.get("area_name"),
    }


def recommendation_bias(
    events: list[dict],
    max_business_share: float = 0.6,
    max_category_share: float = 0.75,
) -> dict:
    """추천 노출이 특정 업체·업종에 쏠렸는지 점검한다. 광고 노출도 함께 집계한다."""
    businesses: Counter[str] = Counter()
    sponsored: Counter[str] = Counter()
    categories: Counter[str] = Counter()
    labels: dict[str, dict] = {}
    # 추천 편향 전처리 회귀 방지: response_snapshot이 dict가 아니거나(방어적 스키마 변화),
    # item이 dict가 아니거나 business_id가 공백뿐인 경우까지 recommendation_exposure_items가
    # 한곳에서 걸러준다. 여기서 다시 인라인으로 파싱하면 그 방어가 새는 경로가 생긴다.
    for item in recommendation_exposure_items(events):
        business_id = item["business_id"]
        businesses[business_id] += 1
        categories[str(item["category"])] += 1
        labels[business_id] = {"name": item["name"], "category": item["category"]}
        if item["is_sponsored"]:
            sponsored[business_id] += 1
    total = sum(businesses.values())
    share = (lambda count: round(count / total, 4)) if total else (lambda count: 0.0)
    business_rows = [
        {
            "business_id": business_id,
            **labels[business_id],
            "total_exposures": count,
            "sponsored_exposures": sponsored[business_id],
            "exposure_share": share(count),
            "is_over_threshold": share(count) > max_business_share,
        }
        for business_id, count in businesses.most_common()
    ]
    category_rows = [
        {
            "category": name,
            "total_exposures": count,
            "exposure_share": share(count),
            "is_over_threshold": share(count) > max_category_share,
        }
        for name, count in categories.most_common()
    ]
    over = [row for row in business_rows + category_rows if row["is_over_threshold"]]
    if not total:
        status, summary, actions = (
            "INSUFFICIENT_DATA",
            "편향을 판단할 추천 노출 기록이 없습니다.",
            ["추천 트래픽이 쌓인 뒤 다시 점검해 주세요."],
        )
    elif over:
        status, summary, actions = (
            "WARNING",
            "일부 업체 또는 업종의 노출이 임계값을 넘었습니다.",
            [
                "임계값을 넘은 대상의 노출 사유를 확인하고 필요하면 노출 순환 정책을 조정해 주세요."
            ],
        )
    else:
        status, summary, actions = (
            "PASS",
            "임계값을 넘는 노출 쏠림이 없습니다.",
            ["주간 편향 점검을 계속 유지해 주세요."],
        )
    return {
        "status": status,
        "summary": summary,
        "checked_event_count": len(events),
        "total_exposures": total,
        "sponsored_exposures": sum(sponsored.values()),
        "business_exposures": business_rows,
        "category_exposures": category_rows,
        "thresholds": {
            "max_business_exposure_share": max_business_share,
            "max_category_exposure_share": max_category_share,
        },
        "recommended_actions": actions,
    }
