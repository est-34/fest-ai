from datetime import UTC, date, datetime, timedelta

from app.modules.festival.application.ports import UnitOfWork
from app.modules.privacy.api import record_identity
from app.shared.application.context import ActionContext
from app.shared.application.results import Result
from app.shared.application.schemas import VisitorSessionIn
from app.shared.application.values import JsonValue
from app.shared.domain.domain import supported_language
from app.shared.domain.errors import found

PUBLIC_PROGRAM_LIMIT = 200


def published_festival(connection: UnitOfWork, code: str) -> dict:
    return found(
        connection.public.published_festival_select_festivals((code,)),
        "게시된 축제를 찾을 수 없습니다.",
    )


def visitor_language(
    festival: dict, requested: str | None, context: ActionContext
) -> str:
    return supported_language(
        requested or context.language,
        festival["supported_languages"],
        festival["default_language"],
    )


def festival_home(festival_code: str, connection: UnitOfWork):
    result = published_festival(connection, festival_code)
    return Result(result, cache_seconds=120)


def programs(
    festival_code: str,
    context: ActionContext,
    connection: UnitOfWork,
    selected_date: date | None,
    area_id: str | None,
    category: str | None,
    status: str,
    language: str | None,
):
    festival = published_festival(connection, festival_code)
    language = visitor_language(festival, language, context)
    rows = connection.public.programs_select_programs(
        festival["id"],
        language,
        festival["default_language"],
        PUBLIC_PROGRAM_LIMIT + 1,
        category=category,
        area_id=area_id,
        status=status,
        selected_date=selected_date,
    )
    has_next = len(rows) > PUBLIC_PROGRAM_LIMIT
    rows = rows[:PUBLIC_PROGRAM_LIMIT]
    return Result(
        rows,
        page={"nextCursor": None, "hasNext": has_next, "limit": PUBLIC_PROGRAM_LIMIT},
        cache_seconds=60,
    )


def program_detail(
    festival_code: str,
    program_slug: str,
    context: ActionContext,
    connection: UnitOfWork,
    language: str | None,
):
    festival = published_festival(connection, festival_code)
    language = visitor_language(festival, language, context)
    row = found(
        connection.public.program_detail_select_programs(
            {
                "language": language,
                "default_language": festival["default_language"],
                "festival_id": festival["id"],
                "program_slug": program_slug,
            },
        ),
        "게시된 프로그램을 찾을 수 없습니다.",
    )
    return Result(row, cache_seconds=60)


def areas(festival_code: str, connection: UnitOfWork):
    festival = published_festival(connection, festival_code)
    rows = connection.public.areas_select_festival_areas((festival["id"],))
    return Result(rows, cache_seconds=60)


def facilities(
    festival_code: str,
    connection: UnitOfWork,
    type_: str | None,
):
    festival = published_festival(connection, festival_code)
    rows = connection.public.facilities_select_facilities(
        {"festival_id": festival["id"], "type": type_}
    )
    return Result(rows, cache_seconds=60)


def crowd(festival_code: str, connection: UnitOfWork):
    festival = published_festival(connection, festival_code)
    zones = connection.public.crowd_select_crowd_snapshots((festival["id"],))
    crowded = any(
        (
            zone["crowd_level"] in ("BUSY", "FULL") and (not zone["stale"])
            for zone in zones
        )
    )
    alternatives = (
        connection.public.crowd_select_crowd_snapshots_2(
            {"festival_id": festival["id"]}
        )
        if crowded
        else []
    )
    for zone in zones:
        zone["alternative_programs"] = (
            alternatives if zone["crowd_level"] in ("BUSY", "FULL") else []
        )
    return Result(
        {
            "updatedAt": max((zone["captured_at"] for zone in zones), default=None),
            "stale": not any((not zone["stale"] for zone in zones)) if zones else True,
            "zones": zones,
            "sources": ["crowd_snapshots", "program_sessions"],
        },
        cache_seconds=15,
    )


def festival_map(festival_code: str, connection: UnitOfWork):
    festival = published_festival(connection, festival_code)
    areas_data = connection.public.festival_map_select_festival_areas((festival["id"],))
    facilities_data = connection.public.festival_map_select_facilities(
        (festival["id"],)
    )
    programs_data = connection.public.festival_map_select_programs((festival["id"],))
    return Result(
        {
            "festivalTimezone": festival["timezone"],
            "areas": areas_data,
            "facilities": facilities_data,
            "programs": programs_data,
        },
        cache_seconds=60,
    )


def announcements(festival_code: str, connection: UnitOfWork):
    festival = published_festival(connection, festival_code)
    rows = connection.public.announcements_select_announcements((festival["id"],))
    return Result(rows, cache_seconds=15)


def announcement(
    festival_code: str,
    announcement_id: str,
    connection: UnitOfWork,
):
    festival = published_festival(connection, festival_code)
    row = found(
        connection.public.announcement_select_announcements(
            (announcement_id, festival["id"])
        ),
        "노출 중인 공지를 찾을 수 없습니다.",
    )
    return Result(row, cache_seconds=15)


def create_visitor_session(
    festival_code: str,
    body: VisitorSessionIn,
    context: ActionContext,
    connection: UnitOfWork,
):
    festival = published_festival(connection, festival_code)
    token = connection.tokens.random_token("vs")
    expires_at = datetime.now(UTC) + timedelta(
        hours=connection.policy.visitor_session_hours
    )
    language = visitor_language(festival, body.language, context)
    area_id = (
        body.area_id
        if body.area_id
        and connection.common.active_area((body.area_id, festival["id"]))
        else None
    )
    row = connection.public.create_visitor_session_insert_visitor_sessions(
        {
            "festival_id": festival["id"],
            "hash_token_token": connection.tokens.hash_token(token),
            "language": language,
            "jsonb_accessibility_preferences": JsonValue(
                body.accessibility_preferences
            ),
            "jsonb_consents": JsonValue(body.consents),
            "expires_at": expires_at,
            "area_id": area_id,
            "area_source": "QR" if area_id else None,
        },
    )
    identity = record_identity(connection, festival["id"], row["id"], context)
    return Result(
        {
            "id": row["id"],
            "sessionToken": token,
            "expiresAt": expires_at,
            "language": language,
            "accessibilityPreferences": body.accessibility_preferences,
            "areaId": area_id,
            "identity": identity,
            "festival": {
                "code": festival["code"],
                "timezone": festival["timezone"],
                "supportedLanguages": festival["supported_languages"],
            },
        }
    )


def surveys(festival_code: str, connection: UnitOfWork):
    festival = published_festival(connection, festival_code)
    rows = connection.public.surveys_select_surveys((festival["id"],))
    return Result(rows, cache_seconds=30)
