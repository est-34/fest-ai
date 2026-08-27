from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response

from app.modules.festival.application import public as service
from app.shared.adapters.http.deps import Db
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import VisitorSessionIn

router = APIRouter(tags=["public"])


@router.get("/public/festivals/{festival_code}")
def festival_home(
    festival_code: str, request: Request, response: Response, connection: Db
):
    return render(
        service.festival_home(
            festival_code=festival_code,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/programs")
def programs(
    festival_code: str,
    request: Request,
    response: Response,
    connection: Db,
    selected_date: Annotated[date | None, Query(alias="date")] = None,
    area_id: Annotated[str | None, Query(alias="areaId")] = None,
    category: str | None = None,
    status: str = "OPEN",
    language: str | None = None,
):
    return render(
        service.programs(
            festival_code=festival_code,
            context=action_context(request),
            connection=connection,
            selected_date=selected_date,
            area_id=area_id,
            category=category,
            status=status,
            language=language,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/programs/{program_slug}")
def program_detail(
    festival_code: str,
    program_slug: str,
    request: Request,
    response: Response,
    connection: Db,
    language: str | None = None,
):
    return render(
        service.program_detail(
            festival_code=festival_code,
            program_slug=program_slug,
            context=action_context(request),
            connection=connection,
            language=language,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/areas")
def areas(festival_code: str, request: Request, response: Response, connection: Db):
    return render(
        service.areas(
            festival_code=festival_code,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/facilities")
def facilities(
    festival_code: str,
    request: Request,
    response: Response,
    connection: Db,
    type_: Annotated[str | None, Query(alias="type")] = None,
):
    return render(
        service.facilities(
            festival_code=festival_code,
            connection=connection,
            type_=type_,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/crowd")
def crowd(festival_code: str, request: Request, response: Response, connection: Db):
    return render(
        service.crowd(
            festival_code=festival_code,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/map")
def festival_map(
    festival_code: str, request: Request, response: Response, connection: Db
):
    return render(
        service.festival_map(
            festival_code=festival_code,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/announcements")
def announcements(
    festival_code: str, request: Request, response: Response, connection: Db
):
    return render(
        service.announcements(
            festival_code=festival_code,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/announcements/{announcement_id}")
def announcement(
    festival_code: str,
    announcement_id: str,
    request: Request,
    response: Response,
    connection: Db,
):
    return render(
        service.announcement(
            festival_code=festival_code,
            announcement_id=announcement_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/public/festivals/{festival_code}/visitor-sessions", status_code=201)
def create_visitor_session(
    festival_code: str,
    body: VisitorSessionIn,
    request: Request,
    connection: Db,
    response: Response,
):
    return render(
        service.create_visitor_session(
            festival_code=festival_code,
            body=body,
            context=action_context(request),
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/surveys")
def surveys(festival_code: str, request: Request, response: Response, connection: Db):
    return render(
        service.surveys(
            festival_code=festival_code,
            connection=connection,
        ),
        request,
        response,
    )
