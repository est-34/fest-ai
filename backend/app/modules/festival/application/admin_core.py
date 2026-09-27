from app.modules.festival.application.ports import UnitOfWork
from app.shared.application.common import archive, created, logged, patch_row
from app.shared.application.context import ActionContext
from app.shared.application.results import Result
from app.shared.application.schemas import (
    AreaIn,
    AreaPatch,
    CloneFestivalIn,
    FacilityIn,
    FacilityPatch,
    FestivalIn,
    FestivalPatch,
    ProgramIn,
    ProgramPatch,
    ProgramSessionIn,
    ProgramSessionPatch,
)
from app.shared.application.values import JsonValue
from app.shared.domain.errors import bad_request, forbidden, found


def list_festivals(user: dict, connection: UnitOfWork):
    rows = connection.admin_core.list_festivals_select_festivals(
        {
            "organization_id": user["organization_id"],
            "super_admin": user["role"] == "SUPER_ADMIN",
            "scope": JsonValue(user["festival_scope"]),
        },
    )
    return Result(rows)


def create_festival(
    body: FestivalIn, context: ActionContext, user: dict, connection: UnitOfWork
):
    if user["role"] != "SUPER_ADMIN" and "*" not in user["festival_scope"]:
        raise forbidden("FESTIVAL_SCOPE_DENIED", "새 축제를 만들 권한이 없습니다.")
    row = connection.admin_core.insert_festival(
        (
            user["organization_id"],
            body.code,
            body.name,
            body.description,
            body.timezone,
            body.starts_at,
            body.ends_at,
            body.default_language,
            JsonValue(body.supported_languages),
        ),
    )
    created(connection, context, user, str(row["id"]), "FESTIVAL", row)
    return Result(row)


def get_festival(festival_id: str, connection: UnitOfWork):
    return Result(connection.admin_core.festival_by_id((festival_id,)))


def update_festival(
    festival_id: str,
    body: FestivalPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
):
    return Result(
        patch_row(
            connection,
            context,
            user,
            "festivals",
            festival_id,
            festival_id,
            body,
            if_match,
        )
    )


def list_areas(festival_id: str, connection: UnitOfWork):
    return Result(
        connection.admin_core.list_areas_select_festival_areas((festival_id,))
    )


def create_area(
    festival_id: str,
    body: AreaIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_core.create_area_insert_festival_areas(
        (
            festival_id,
            body.name,
            body.area_type,
            body.description,
            body.latitude,
            body.longitude,
            body.status,
        ),
    )
    created(connection, context, user, festival_id, "FESTIVAL_AREAS", row)
    return Result(row)


def get_area(festival_id: str, area_id: str, connection: UnitOfWork):
    return Result(
        found(
            connection.admin_core.get_area_select_festival_areas((area_id, festival_id))
        )
    )


def update_area(
    festival_id: str,
    area_id: str,
    body: AreaPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
):
    return Result(
        patch_row(
            connection,
            context,
            user,
            "festival_areas",
            area_id,
            festival_id,
            body,
            if_match,
        )
    )


def archive_area(
    festival_id: str,
    area_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
) -> Result:
    return archive(
        connection, context, user, "festival_areas", area_id, festival_id, if_match
    )


def list_facilities(festival_id: str, connection: UnitOfWork):
    return Result(
        connection.admin_core.list_facilities_select_facilities((festival_id,))
    )


def create_facility(
    festival_id: str,
    body: FacilityIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_core.create_facility_insert_facilities(
        {
            "festival_id": festival_id,
            "area_id": body.area_id,
            "name": body.name,
            "facility_type": body.facility_type,
            "jsonb_accessibility": JsonValue(body.accessibility),
            "jsonb_operating_hours": JsonValue(body.operating_hours),
            "status": body.status,
        },
    )
    if not row:
        raise bad_request("AREA_SCOPE_MISMATCH", "구역이 같은 축제에 속하지 않습니다.")
    created(connection, context, user, festival_id, "FACILITIES", row)
    return Result(row)


def get_facility(
    festival_id: str,
    facility_id: str,
    connection: UnitOfWork,
):
    return Result(
        found(
            connection.admin_core.get_facility_select_facilities(
                (facility_id, festival_id)
            )
        )
    )


def update_facility(
    festival_id: str,
    facility_id: str,
    body: FacilityPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
):
    return Result(
        patch_row(
            connection,
            context,
            user,
            "facilities",
            facility_id,
            festival_id,
            body,
            if_match,
        )
    )


def archive_facility(
    festival_id: str,
    facility_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
) -> Result:
    return archive(
        connection, context, user, "facilities", facility_id, festival_id, if_match
    )


def list_programs(festival_id: str, connection: UnitOfWork):
    return Result(connection.admin_core.list_programs_select_programs((festival_id,)))


def create_program(
    festival_id: str,
    body: ProgramIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_core.create_program_insert_programs(
        (
            festival_id,
            body.slug,
            body.title,
            body.summary,
            body.category,
            JsonValue(body.accessibility),
            body.status,
        ),
    )
    created(connection, context, user, festival_id, "PROGRAMS", row)
    return Result(row)


def get_program(
    festival_id: str,
    program_id: str,
    connection: UnitOfWork,
):
    return Result(
        found(
            connection.admin_core.get_program_select_programs((program_id, festival_id))
        )
    )


def update_program(
    festival_id: str,
    program_id: str,
    body: ProgramPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
):
    return Result(
        patch_row(
            connection,
            context,
            user,
            "programs",
            program_id,
            festival_id,
            body,
            if_match,
        )
    )


def archive_program(
    festival_id: str,
    program_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
) -> Result:
    return archive(
        connection, context, user, "programs", program_id, festival_id, if_match
    )


def list_sessions(
    festival_id: str,
    program_id: str,
    connection: UnitOfWork,
):
    return Result(
        connection.admin_core.list_sessions_select_program_sessions(
            (festival_id, program_id)
        )
    )


def create_session(
    festival_id: str,
    program_id: str,
    body: ProgramSessionIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_core.create_session_insert_program_sessions(
        {
            "festival_id": festival_id,
            "program_id": program_id,
            "area_id": body.area_id,
            "starts_at": body.starts_at,
            "ends_at": body.ends_at,
            "capacity": body.capacity,
            "status": body.status,
        },
    )
    if not row:
        raise bad_request(
            "FESTIVAL_SCOPE_MISMATCH", "프로그램과 구역의 축제 범위를 확인해 주세요."
        )
    created(connection, context, user, festival_id, "PROGRAM_SESSIONS", row)
    return Result(row)


def update_session(
    festival_id: str,
    session_id: str,
    body: ProgramSessionPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
):
    return Result(
        patch_row(
            connection,
            context,
            user,
            "program_sessions",
            session_id,
            festival_id,
            body,
            if_match,
        )
    )


def cancel_session(
    festival_id: str,
    session_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    if_match: str | None,
) -> Result:
    return archive(
        connection,
        context,
        user,
        "program_sessions",
        session_id,
        festival_id,
        if_match,
        status="CANCELLED",
    )


def clone_festival(
    festival_id: str,
    body: CloneFestivalIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if user["role"] != "SUPER_ADMIN" and "*" not in user["festival_scope"]:
        raise forbidden("FESTIVAL_SCOPE_DENIED", "복제 축제를 만들 권한이 없습니다.")
    source = connection.admin_core.festival_by_id((festival_id,))
    row = connection.admin_core.insert_festival(
        (
            user["organization_id"],
            body.code,
            body.name,
            source["description"],
            source["timezone"],
            body.starts_at,
            body.ends_at,
            source["default_language"],
            JsonValue(source["supported_languages"]),
        ),
    )
    shift = body.starts_at - source["starts_at"]
    connection.admin_core.clone_festival_insert_festival_areas((row["id"], festival_id))
    connection.admin_core.clone_festival_insert_facilities(
        {"target_festival_id": row["id"], "festival_id": festival_id}
    )
    connection.admin_core.clone_festival_insert_programs((row["id"], festival_id))
    connection.admin_core.clone_festival_insert_program_sessions(
        {"target_festival_id": row["id"], "shift": shift, "festival_id": festival_id},
    )
    copied = connection.admin_core.clone_festival_select_festival_areas(
        {"target_festival_id": row["id"]}
    )
    logged(
        connection,
        context,
        user,
        str(row["id"]),
        "CLONE",
        "FESTIVAL",
        str(row["id"]),
        after_data={"sourceFestivalId": festival_id, "copied": copied},
    )
    return Result({**row, "copied": copied})
