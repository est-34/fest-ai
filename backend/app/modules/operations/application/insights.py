from datetime import datetime

from app.modules.festival.api import published_festival
from app.modules.operations.application.ports import UnitOfWork
from app.modules.operations.domain import (
    recommendation_bias,
    risk_brief,
    score_business,
)
from app.shared.application.results import Result
from app.shared.application.values import JsonValue
from app.shared.domain.errors import bad_request

RECOMMENDATION_POLICY = "biz-rec-v1"
SCHEDULE_CHANGE_HOURS = 24
SPONSORED_LIMIT = 3
SURGE_LOOKBACK_MINUTES = 30
SURGE_WINDOW_MINUTES = 10


def dashboard(
    festival_id: str,
    connection: UnitOfWork,
    area_id: str | None,
    time_from: datetime | None,
    time_to: datetime | None,
):
    filters = {
        "festival_id": festival_id,
        "area_id": area_id,
        "time_from": time_from,
        "time_to": time_to,
    }
    stats = connection.insights.dashboard_select_visitor_sessions(filters)
    crowd = connection.insights.dashboard_select_crowd_snapshots(filters)
    languages = connection.insights.dashboard_select_visitor_sessions_2(filters)
    return Result(
        {
            "stats": stats,
            "crowd": crowd,
            "languages": languages,
            "updatedAt": max((row["captured_at"] for row in crowd), default=None),
            "sources": [
                "visitor_sessions",
                "bookings",
                "ops_tickets",
                "crowd_snapshots",
                "coupon_issues",
                "point_ledger",
            ],
            "filters": {"areaId": area_id, "timeFrom": time_from, "timeTo": time_to},
        }
    )


def admin_risk_brief(
    festival_id: str,
    connection: UnitOfWork,
    include_resolved: bool,
):
    tickets = connection.insights.admin_risk_brief_select_ops_tickets(
        (festival_id, include_resolved)
    )
    crowding = connection.insights.admin_risk_brief_select_crowd_snapshots(
        (festival_id,)
    )
    staffing = connection.insights.admin_risk_brief_select_festival_areas(
        (festival_id,)
    )
    schedule = connection.insights.admin_risk_brief_select_program_sessions(
        (festival_id, SCHEDULE_CHANGE_HOURS)
    )
    surge = connection.insights.admin_risk_brief_select_crowd_snapshots_2(
        {
            "festival_id": festival_id,
            "surge_lookback_minutes": SURGE_LOOKBACK_MINUTES,
            "surge_window_minutes": SURGE_WINDOW_MINUTES,
        },
    )
    signals = crowding + tickets + staffing + schedule + surge
    brief = risk_brief(signals)
    with connection.external_io():
        summary = (
            connection.ai.briefing(connection.ai.RISK_INSTRUCTION, brief["reasons"])
            if signals
            else None
        )
    return Result(
        {
            **brief,
            "festival_id": festival_id,
            "summary": summary or brief["summary"],
            "external_ai_used": summary is not None,
            "source_updated_at": max(
                (signal["source_updated_at"] for signal in signals), default=None
            ),
            "include_resolved": include_resolved,
        }
    )


def admin_recommendation_bias(
    festival_id: str,
    connection: UnitOfWork,
    window_days: int,
    max_business_share: float,
    max_category_share: float,
):
    events = connection.insights.admin_recommendation_bias_select_business_recommendation_events(
        (festival_id, window_days)
    )
    audit = recommendation_bias(events, max_business_share, max_category_share)
    return Result({**audit, "festival_id": festival_id, "window_days": window_days})


def business_recommendations(
    festival_code: str,
    connection: UnitOfWork,
    latitude: float | None,
    longitude: float | None,
    category: str | None,
    limit: int,
    accessibility_required: bool,
):
    if (latitude is None) != (longitude is None):
        raise bad_request(
            "VALIDATION_ERROR", "latitude와 longitude는 함께 입력해야 합니다."
        )
    festival = published_festival(connection, festival_code)
    rows = connection.insights.business_recommendations_select_coupons(
        {
            "festival_id": festival["id"],
            "category": category,
            "accessibility_required": accessibility_required,
        },
    )
    scored = sorted(
        (score_business(row, latitude, longitude, category) for row in rows),
        key=lambda item: (-item["score"], item["business_id"]),
    )
    result = {
        "festival_id": str(festival["id"]),
        "items": [item for item in scored if not item["is_sponsored"]][:limit],
        "sponsored_items": [item for item in scored if item["is_sponsored"]][
            : min(limit, SPONSORED_LIMIT)
        ],
        "recommendation_policy_version": RECOMMENDATION_POLICY,
    }
    connection.insights.business_recommendations_insert_business_recommendation_events(
        (
            festival["id"],
            JsonValue(
                {
                    "latitude": latitude,
                    "longitude": longitude,
                    "category": category,
                    "limit": limit,
                    "accessibility_required": accessibility_required,
                }
            ),
            JsonValue(result),
            RECOMMENDATION_POLICY,
        ),
    )
    return Result(result)
