from app.modules.esg.application.ports import UnitOfWork
from app.modules.esg.domain import validate_measurement_review
from app.shared.application.common import created, logged, scoped
from app.shared.application.context import ActionContext
from app.shared.application.idempotency import idempotent
from app.shared.application.pagination import cursor_params, paged
from app.shared.application.results import Result
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
from app.shared.application.values import JsonValue
from app.shared.domain.errors import (
    DuplicateKey,
    bad_request,
    conflict,
    found,
    unprocessable,
)


def esg_dashboard(
    festival_id: str,
    connection: UnitOfWork,
    category: str | None,
):
    rows = connection.admin_esg.esg_dashboard_select_esg_metric_versions(
        {"festival_id": festival_id, "category": category}
    )
    warnings = [
        {
            "metricId": row["id"],
            "type": "MISSING_DATA" if row["approved_count"] == 0 else "UNAPPROVED_DATA",
            "count": row["unapproved_count"],
        }
        for row in rows
        if row["approved_count"] == 0 or row["unapproved_count"] > 0
    ]
    context = [
        f"{row['name']}({row['category']}) 승인값 {row['approved_value']}{row['unit'] or ''}, 달성률 {row['achievement_rate']}%, 미승인 {row['unapproved_count']}건"
        for row in rows
    ]
    with connection.external_io():
        brief = (
            connection.ai.briefing(connection.ai.ESG_INSTRUCTION, context)
            if context
            else None
        )
    return Result(
        {
            "metrics": rows,
            "dataQualityWarnings": warnings,
            "source": "APPROVED_MEASUREMENTS_ONLY",
            "aiBrief": brief,
            "externalAiUsed": brief is not None,
        }
    )


def metrics(festival_id: str, connection: UnitOfWork):
    rows = connection.admin_esg.metrics_select_esg_metrics((festival_id,))
    return Result(rows)


def create_metric(
    festival_id: str,
    body: MetricIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_esg.create_metric_insert_esg_metrics(
        (festival_id, body.name, body.category, user["id"])
    )
    created(connection, context, user, festival_id, "ESG_METRIC", row)
    return Result(row)


def metric(
    festival_id: str,
    metric_id: str,
    connection: UnitOfWork,
):
    row = found(
        connection.admin_esg.metric_select_esg_metrics((metric_id, festival_id))
    )
    row["versions"] = connection.admin_esg.metric_select_esg_metric_versions(
        (metric_id,)
    )
    return Result(row)


def create_metric_version(
    festival_id: str,
    metric_id: str,
    body: MetricVersionIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    scoped(connection, "esg_metrics", metric_id, festival_id)
    row = connection.admin_esg.create_metric_version_insert_esg_metric_versions(
        {
            "metric_id": metric_id,
            "formula": body.formula,
            "unit": body.unit,
            "target": body.target,
            "jsonb_source_requirements": JsonValue(body.source_requirements),
            "evidence_required": body.evidence_required,
            "created_by": user["id"],
        },
    )
    created(connection, context, user, festival_id, "ESG_METRIC_VERSION", row)
    return Result(row)


def measurements(
    festival_id: str,
    connection: UnitOfWork,
    status: str | None,
    limit: int,
    cursor: str | None,
):
    """실적 목록. 측정 시각(measured_at, id) 키셋 커서로 자른다 — 화면 정렬 키와 같아야 이어진다."""
    rows = connection.admin_esg.measurements_select_esg_evidence(
        {"festival_id": festival_id, "status": status, **cursor_params(cursor, limit)},
    )
    rows, page = paged(rows, limit, "measured_at")
    return Result(rows, page=page)


def create_measurement(
    festival_id: str,
    body: MeasurementIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    idempotency_key: str | None,
):

    def work():
        if not connection.admin_esg.work_select_esg_metric_versions(
            (body.metric_version_id, festival_id)
        ):
            raise bad_request(
                "FESTIVAL_SCOPE_MISMATCH", "지표 버전이 같은 축제에 속하지 않습니다."
            )
        try:
            row = connection.admin_esg.work_insert_esg_measurements(
                (
                    festival_id,
                    body.metric_version_id,
                    body.value,
                    body.source_type,
                    body.source_ref,
                    body.dedupe_key,
                    body.measured_at,
                    body.supersedes_id,
                    user["id"],
                ),
            )
        except DuplicateKey as error:
            raise conflict(
                "DUPLICATE_MEASUREMENT",
                "같은 지표 버전과 중복 키의 실적이 이미 존재합니다.",
            ) from error
        created(connection, context, user, festival_id, "ESG_MEASUREMENT", row)
        return (201, row)

    return Result.from_idempotent(
        idempotent(
            connection,
            key=idempotency_key,
            scope=f"esg-measurement:{festival_id}",
            body=body.model_dump(),
            work=work,
        )
    )


def measurement(
    festival_id: str,
    measurement_id: str,
    connection: UnitOfWork,
):
    row = found(
        connection.admin_esg.measurement_select_esg_measurements(
            (measurement_id, festival_id)
        )
    )
    row["evidence"] = connection.admin_esg.measurement_select_esg_evidence(
        (measurement_id,)
    )
    row["reviews"] = connection.admin_esg.measurement_select_esg_reviews(
        (measurement_id,)
    )
    return Result(row)


def patch_measurement(
    festival_id: str,
    measurement_id: str,
    body: MeasurementPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    before = connection.admin_esg.patch_measurement_select_esg_measurements(
        (measurement_id, festival_id)
    )
    row = connection.admin_esg.patch_measurement_update_esg_measurements_2(
        (
            body.value,
            body.source_type,
            body.source_ref,
            body.measured_at,
            measurement_id,
            festival_id,
        ),
    )
    if not row:
        raise bad_request(
            "IMMUTABLE_APPROVED_MEASUREMENT", "승인 전 실적만 수정할 수 있습니다."
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "UPDATE",
        "ESG_MEASUREMENT",
        measurement_id,
        before_data=before,
        after_data=row,
    )
    return Result(row)


def add_evidence(
    festival_id: str,
    measurement_id: str,
    body: EvidenceIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if not connection.admin_esg.add_evidence_select_esg_measurements(
        (measurement_id, festival_id)
    ):
        raise bad_request(
            "IMMUTABLE_APPROVED_MEASUREMENT",
            "승인 전 실적에만 증빙을 추가할 수 있습니다.",
        )
    row = connection.admin_esg.add_evidence_insert_esg_evidence(
        (
            measurement_id,
            body.file_id,
            body.file_hash,
            body.evidence_type,
            body.issued_at,
        ),
    )
    created(connection, context, user, festival_id, "ESG_EVIDENCE", row)
    return Result(row)


def review_measurement(
    festival_id: str,
    measurement_id: str,
    body: ReviewIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = found(
        connection.admin_esg.review_measurement_select_esg_evidence(
            (measurement_id, festival_id)
        )
    )
    validate_measurement_review(row, row["evidence_count"], body.decision)
    connection.admin_esg.review_measurement_insert_esg_reviews(
        (measurement_id, user["id"], body.decision, body.comment)
    )
    updated = connection.admin_esg.review_measurement_update_esg_measurements(
        (body.decision, measurement_id)
    )
    if body.decision == "APPROVED" and updated["supersedes_id"]:
        connection.admin_esg.supersede_measurement((updated["supersedes_id"],))
    logged(
        connection,
        context,
        user,
        festival_id,
        body.decision,
        "ESG_MEASUREMENT",
        measurement_id,
        after_data=updated,
    )
    return Result(updated)


def reports(festival_id: str, connection: UnitOfWork):
    return Result(connection.admin_esg.reports_select_esg_reports((festival_id,)))


def create_report(
    festival_id: str,
    body: EsgReportIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
    idempotency_key: str | None,
):
    if body.period.from_ >= body.period.to:
        raise bad_request("VALIDATION_ERROR", "보고 기간을 확인해 주세요.")

    def work():
        report = connection.admin_esg.work_insert_esg_reports(
            (
                festival_id,
                body.title,
                body.period.from_,
                body.period.to,
                body.compare_with_festival_id,
                body.format,
                user["id"],
            ),
        )
        job = connection.admin_esg.work_insert_jobs((festival_id, report["id"]))
        logged(
            connection,
            context,
            user,
            festival_id,
            "GENERATE",
            "ESG_REPORT",
            str(report["id"]),
            after_data={"jobId": str(job["id"])},
        )
        return (
            202,
            {"reportId": report["id"], "jobId": job["id"], "status": "GENERATING"},
        )

    return Result.from_idempotent(
        idempotent(
            connection,
            key=idempotency_key,
            scope=f"esg-report:{festival_id}",
            body=body.model_dump(),
            work=work,
        )
    )


def report(
    festival_id: str,
    report_id: str,
    connection: UnitOfWork,
):
    return Result(
        found(connection.admin_esg.report_select_esg_reports((report_id, festival_id)))
    )


def patch_report(
    festival_id: str,
    report_id: str,
    body: ReportPatch,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    row = connection.admin_esg.patch_report_update_esg_reports(
        (JsonValue(body.edit_metadata), report_id, festival_id)
    )
    if not row:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "초안 보고서만 편집할 수 있습니다."
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "UPDATE",
        "ESG_REPORT",
        report_id,
        after_data=row,
    )
    return Result(row)


def approve_report(
    festival_id: str,
    report_id: str,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    report = found(
        connection.admin_esg.approve_report_select_esg_reports((report_id, festival_id))
    )
    if str(report["created_by"]) == str(user["id"]):
        raise unprocessable(
            "AUTHOR_CANNOT_FINAL_APPROVE",
            "작성자는 자신이 만든 보고서를 승인할 수 없습니다.",
        )
    row = connection.admin_esg.approve_report_update_esg_reports_2(
        (report_id, festival_id)
    )
    if not row:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "초안 보고서만 승인할 수 있습니다."
        )
    logged(
        connection,
        context,
        user,
        festival_id,
        "APPROVED",
        "ESG_REPORT",
        report_id,
        after_data=row,
    )
    return Result(row)


def export_report(
    festival_id: str,
    report_id: str,
    body: ExportIn,
    context: ActionContext,
    user: dict,
    connection: UnitOfWork,
):
    if not connection.admin_esg.export_report_select_esg_reports(
        (report_id, festival_id)
    ):
        raise bad_request(
            "INVALID_STATE_TRANSITION", "승인된 보고서만 내보낼 수 있습니다."
        )
    job = connection.admin_esg.export_report_insert_jobs(
        (festival_id, report_id, JsonValue({"format": body.format}))
    )
    logged(
        connection,
        context,
        user,
        festival_id,
        "EXPORT",
        "ESG_REPORT",
        report_id,
        after_data={"jobId": str(job["id"]), "format": body.format},
    )
    return Result({"jobId": job["id"], "status": job["status"]})
