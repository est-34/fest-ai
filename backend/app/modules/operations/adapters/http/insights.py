from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request, Response

from app.modules.operations.application import insights as service
from app.shared.adapters.http.deps import Db, Scope
from app.shared.adapters.http.views import render

router = APIRouter(tags=["insights"])


@router.get("/admin/festivals/{festival_id}/dashboard")
def dashboard(
    festival_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
    area_id: Annotated[str | None, Query(alias="areaId")] = None,
    time_from: Annotated[datetime | None, Query(alias="timeFrom")] = None,
    time_to: Annotated[datetime | None, Query(alias="timeTo")] = None,
):
    return render(
        service.dashboard(
            festival_id=festival_id,
            connection=connection,
            area_id=area_id,
            time_from=time_from,
            time_to=time_to,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/risk-brief")
def admin_risk_brief(
    festival_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
    include_resolved: bool = False,
):
    return render(
        service.admin_risk_brief(
            festival_id=festival_id,
            connection=connection,
            include_resolved=include_resolved,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/recommendation-bias")
def admin_recommendation_bias(
    festival_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
    window_days: Annotated[int, Query(ge=1, le=90)] = 7,
    max_business_share: Annotated[float, Query(gt=0, le=1)] = 0.6,
    max_category_share: Annotated[float, Query(gt=0, le=1)] = 0.75,
):
    return render(
        service.admin_recommendation_bias(
            festival_id=festival_id,
            connection=connection,
            window_days=window_days,
            max_business_share=max_business_share,
            max_category_share=max_category_share,
        ),
        request,
        response,
    )


@router.get("/public/festivals/{festival_code}/business-recommendations")
def business_recommendations(
    festival_code: str,
    request: Request,
    connection: Db,
    response: Response,
    latitude: Annotated[float | None, Query(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Query(ge=-180, le=180)] = None,
    category: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    accessibility_required: bool = False,
):
    return render(
        service.business_recommendations(
            festival_code=festival_code,
            connection=connection,
            latitude=latitude,
            longitude=longitude,
            category=category,
            limit=limit,
            accessibility_required=accessibility_required,
        ),
        request,
        response,
    )
