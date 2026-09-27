from fastapi import APIRouter, Request, Response

from app.modules.festival.application import admin_core as service
from app.shared.adapters.http.deps import Db, IfMatch, Manager, Scope, User
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
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

router = APIRouter(tags=["admin-festivals"])


@router.get("/admin/festivals")
def list_festivals(request: Request, user: User, connection: Db, response: Response):
    return render(
        service.list_festivals(user=user, connection=connection),
        request,
        response,
    )


@router.post("/admin/festivals", status_code=201)
def create_festival(
    body: FestivalIn,
    request: Request,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_festival(
            body=body, context=action_context(request), user=user, connection=connection
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}")
def get_festival(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.get_festival(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}")
def update_festival(
    festival_id: str,
    body: FestivalPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
):
    return render(
        service.update_festival(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/areas")
def list_areas(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.list_areas(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/areas", status_code=201)
def create_area(
    festival_id: str,
    body: AreaIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_area(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/areas/{area_id}")
def get_area(
    festival_id: str,
    area_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.get_area(
            festival_id=festival_id,
            area_id=area_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/areas/{area_id}")
def update_area(
    festival_id: str,
    area_id: str,
    body: AreaPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
):
    return render(
        service.update_area(
            festival_id=festival_id,
            area_id=area_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.delete("/admin/festivals/{festival_id}/areas/{area_id}", status_code=204)
def archive_area(
    festival_id: str,
    area_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
) -> Response:
    return render(
        service.archive_area(
            festival_id=festival_id,
            area_id=area_id,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/facilities")
def list_facilities(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.list_facilities(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/facilities", status_code=201)
def create_facility(
    festival_id: str,
    body: FacilityIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_facility(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/facilities/{facility_id}")
def get_facility(
    festival_id: str,
    facility_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.get_facility(
            festival_id=festival_id,
            facility_id=facility_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/facilities/{facility_id}")
def update_facility(
    festival_id: str,
    facility_id: str,
    body: FacilityPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
):
    return render(
        service.update_facility(
            festival_id=festival_id,
            facility_id=facility_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.delete(
    "/admin/festivals/{festival_id}/facilities/{facility_id}", status_code=204
)
def archive_facility(
    festival_id: str,
    facility_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
) -> Response:
    return render(
        service.archive_facility(
            festival_id=festival_id,
            facility_id=facility_id,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/programs")
def list_programs(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.list_programs(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/programs", status_code=201)
def create_program(
    festival_id: str,
    body: ProgramIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_program(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/programs/{program_id}")
def get_program(
    festival_id: str,
    program_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.get_program(
            festival_id=festival_id,
            program_id=program_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/programs/{program_id}")
def update_program(
    festival_id: str,
    program_id: str,
    body: ProgramPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
):
    return render(
        service.update_program(
            festival_id=festival_id,
            program_id=program_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.delete("/admin/festivals/{festival_id}/programs/{program_id}", status_code=204)
def archive_program(
    festival_id: str,
    program_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
) -> Response:
    return render(
        service.archive_program(
            festival_id=festival_id,
            program_id=program_id,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/programs/{program_id}/sessions")
def list_sessions(
    festival_id: str,
    program_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.list_sessions(
            festival_id=festival_id,
            program_id=program_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/programs/{program_id}/sessions", status_code=201
)
def create_session(
    festival_id: str,
    program_id: str,
    body: ProgramSessionIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_session(
            festival_id=festival_id,
            program_id=program_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/program-sessions/{session_id}")
def update_session(
    festival_id: str,
    session_id: str,
    body: ProgramSessionPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
):
    return render(
        service.update_session(
            festival_id=festival_id,
            session_id=session_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.delete(
    "/admin/festivals/{festival_id}/program-sessions/{session_id}", status_code=204
)
def cancel_session(
    festival_id: str,
    session_id: str,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
    if_match: IfMatch = None,
) -> Response:
    return render(
        service.cancel_session(
            festival_id=festival_id,
            session_id=session_id,
            context=action_context(request),
            user=user,
            connection=connection,
            if_match=if_match,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/clone", status_code=201)
def clone_festival(
    festival_id: str,
    body: CloneFestivalIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.clone_festival(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
