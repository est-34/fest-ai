from fastapi import APIRouter, Query, Request, Response

from app.modules.esg.application import admin_esg as service
from app.shared.adapters.http.deps import (
    Db,
    IdempotencyKey,
    Manager,
    Operator,
    Reviewer,
    Scope,
)
from app.shared.adapters.http.http import action_context
from app.shared.adapters.http.views import render
from app.shared.application.schemas import (
    EsgReportIn,
    EvidenceIn,
    ExportIn,
    MeasurementIn,
    MeasurementPatch,
    MetricIn,
    MetricVersionIn,
    ReportPatch,
    ReviewIn,
)

router = APIRouter(tags=["admin-esg"])


@router.get("/admin/festivals/{festival_id}/esg/dashboard")
def esg_dashboard(
    festival_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
    category: str | None = None,
):
    return render(
        service.esg_dashboard(
            festival_id=festival_id,
            connection=connection,
            category=category,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/esg/metrics")
def metrics(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.metrics(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/esg/metrics", status_code=201)
def create_metric(
    festival_id: str,
    body: MetricIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_metric(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/esg/metrics/{metric_id}")
def metric(
    festival_id: str,
    metric_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.metric(
            festival_id=festival_id,
            metric_id=metric_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/esg/metrics/{metric_id}/versions", status_code=201
)
def create_metric_version(
    festival_id: str,
    metric_id: str,
    body: MetricVersionIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.create_metric_version(
            festival_id=festival_id,
            metric_id=metric_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/esg/measurements")
def measurements(
    festival_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    cursor: str | None = None,
):
    return render(
        service.measurements(
            festival_id=festival_id,
            connection=connection,
            status=status,
            limit=limit,
            cursor=cursor,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/esg/measurements", status_code=201)
def create_measurement(
    festival_id: str,
    body: MeasurementIn,
    request: Request,
    response: Response,
    _: Scope,
    user: Operator,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.create_measurement(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            idempotency_key=idempotency_key,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/esg/measurements/{measurement_id}")
def measurement(
    festival_id: str,
    measurement_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.measurement(
            festival_id=festival_id,
            measurement_id=measurement_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/esg/measurements/{measurement_id}")
def patch_measurement(
    festival_id: str,
    measurement_id: str,
    body: MeasurementPatch,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.patch_measurement(
            festival_id=festival_id,
            measurement_id=measurement_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/esg/measurements/{measurement_id}/evidence",
    status_code=201,
)
def add_evidence(
    festival_id: str,
    measurement_id: str,
    body: EvidenceIn,
    request: Request,
    _: Scope,
    user: Operator,
    connection: Db,
    response: Response,
):
    return render(
        service.add_evidence(
            festival_id=festival_id,
            measurement_id=measurement_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/esg/measurements/{measurement_id}/reviews")
def review_measurement(
    festival_id: str,
    measurement_id: str,
    body: ReviewIn,
    request: Request,
    _: Scope,
    user: Reviewer,
    connection: Db,
    response: Response,
):
    return render(
        service.review_measurement(
            festival_id=festival_id,
            measurement_id=measurement_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/esg/reports")
def reports(
    festival_id: str, request: Request, _: Scope, connection: Db, response: Response
):
    return render(
        service.reports(
            festival_id=festival_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/esg/reports", status_code=202)
def create_report(
    festival_id: str,
    body: EsgReportIn,
    request: Request,
    response: Response,
    _: Scope,
    user: Manager,
    connection: Db,
    idempotency_key: IdempotencyKey = None,
):
    return render(
        service.create_report(
            festival_id=festival_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
            idempotency_key=idempotency_key,
        ),
        request,
        response,
    )


@router.get("/admin/festivals/{festival_id}/esg/reports/{report_id}")
def report(
    festival_id: str,
    report_id: str,
    request: Request,
    _: Scope,
    connection: Db,
    response: Response,
):
    return render(
        service.report(
            festival_id=festival_id,
            report_id=report_id,
            connection=connection,
        ),
        request,
        response,
    )


@router.patch("/admin/festivals/{festival_id}/esg/reports/{report_id}")
def patch_report(
    festival_id: str,
    report_id: str,
    body: ReportPatch,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.patch_report(
            festival_id=festival_id,
            report_id=report_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post("/admin/festivals/{festival_id}/esg/reports/{report_id}/approve")
def approve_report(
    festival_id: str,
    report_id: str,
    request: Request,
    _: Scope,
    user: Reviewer,
    connection: Db,
    response: Response,
):
    return render(
        service.approve_report(
            festival_id=festival_id,
            report_id=report_id,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )


@router.post(
    "/admin/festivals/{festival_id}/esg/reports/{report_id}/exports", status_code=202
)
def export_report(
    festival_id: str,
    report_id: str,
    body: ExportIn,
    request: Request,
    _: Scope,
    user: Manager,
    connection: Db,
    response: Response,
):
    return render(
        service.export_report(
            festival_id=festival_id,
            report_id=report_id,
            body=body,
            context=action_context(request),
            user=user,
            connection=connection,
        ),
        request,
        response,
    )
