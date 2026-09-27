import logging
from datetime import UTC, datetime

from app.modules.esg.application.ports import UnitOfWork
from app.modules.privacy.api import purge_personal_data, purge_sessions
from app.shared.application.values import JsonValue

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 3


def _comparison(connection: UnitOfWork, report: dict) -> list[dict]:
    """비교 대상 축제의 같은 지표 실적.

    compareWithFestivalId는 받아서 저장만 하고 스냅샷에 반영되지 않아, 화면에 비교를 그릴
    방법이 없었다. 지표 이름이 같은 것끼리 짝지어 값 차이를 계산한다(축제마다 지표 행이
    따로 있어 id로는 이어지지 않는다).
    """
    if not report.get("compare_with_festival_id"):
        return []
    other = connection.jobs.report_metrics(
        (
            report["compare_with_festival_id"],
            report["period_from"],
            report["period_to"],
        ),
    )
    return [
        {
            "name": row["name"],
            "category": row["category"],
            "unit": row["unit"],
            "value": row["value"],
        }
        for row in other
    ]


def _generate_esg_report(connection: UnitOfWork, job: dict) -> dict:
    report = connection.jobs.report_by_id((job["resource_id"],))
    if not report:
        raise ValueError("report not found")
    metrics = connection.jobs.report_metrics(
        (report["festival_id"], report["period_from"], report["period_to"])
    )
    comparison = _comparison(connection, report)
    baseline = {row["name"]: row["value"] for row in comparison}
    for metric in metrics:
        if metric["name"] in baseline:
            metric["comparisonValue"] = baseline[metric["name"]]
            metric["comparisonDelta"] = round(
                (metric["value"] or 0) - (baseline[metric["name"]] or 0), 4
            )
    snapshot = {
        "generatedAt": datetime.now(UTC).isoformat(),
        "metrics": metrics,
        "comparison": {
            "festivalId": str(report["compare_with_festival_id"]),
            "metrics": comparison,
        }
        if comparison
        else None,
    }
    connection.jobs._generate_esg_report_esg_reports_2(
        (JsonValue(snapshot), job["resource_id"])
    )
    return {"reportId": str(job["resource_id"])}


def _export_esg_report(connection: UnitOfWork, job: dict) -> dict:
    report = connection.jobs.report_by_id((job["resource_id"],))
    if not report:
        raise ValueError("report not found")
    if report["status"] != "APPROVED":
        raise ValueError("report is not in APPROVED status")
    export_format = (job.get("result") or {}).get("format") or report["format"]
    artifact = connection.exports.build_report_artifact(report, export_format)
    connection.jobs._export_esg_report_esg_reports_2((job["resource_id"],))
    return {
        "reportId": str(job["resource_id"]),
        "format": export_format,
        "artifacts": [artifact],
    }


JOB_HANDLERS = {
    "GENERATE_ESG_REPORT": (_generate_esg_report, True),
    "EXPORT_ESG_REPORT": (_export_esg_report, False),
}


def fail_job(
    connection: UnitOfWork,
    job: dict,
    handler_known: bool,
    revert_resource: bool,
    error: Exception,
) -> None:
    """실패 처리.

    한도 안이면 PENDING으로 되돌려 다음 순회에서 다시 집게 한다. 알 수 없는 job_type은
    다시 시도해도 결과가 같으므로 곧바로 FAILED로 굳힌다.
    """
    attempts = job["attempts"] + 1
    retryable = handler_known and attempts < MAX_ATTEMPTS
    connection.jobs.fail_job_jobs(
        ("PENDING" if retryable else "FAILED", attempts, str(error), job["id"]),
    )
    logger.warning(
        "잡 실패 %s (%s) 시도 %s/%s: %s",
        job["id"],
        job["job_type"],
        attempts,
        MAX_ATTEMPTS,
        error,
    )
    if not retryable and job["resource_type"] == "ESG_REPORT" and revert_resource:
        connection.jobs.fail_job_esg_reports((job["resource_id"],))


def process_one_job(connection: UnitOfWork) -> bool:
    job = connection.jobs.process_one_job_jobs((MAX_ATTEMPTS,))
    if not job:
        return False
    connection.jobs.process_one_job_jobs_2((job["id"],))
    handler, revert_resource = JOB_HANDLERS.get(job["job_type"], (None, False))
    try:
        with connection.transaction():
            if not handler:
                raise ValueError(f"unsupported job type: {job['job_type']}")
            result = handler(connection, job)
        connection.jobs.process_one_job_jobs_3((JsonValue(result), job["id"]))
    except Exception as error:
        fail_job(connection, job, handler is not None, revert_resource, error)
    return True


def purge_expired(connection: UnitOfWork) -> None:
    """만료·폐기 데이터 정리와 OPS-11 개인정보 파기.

    운영 부산물(멱등성 레코드·리프레시 토큰)은 여기서 지우고, 개인정보 항목은 보유기간
    정책표를 단일 기준으로 쓰는 privacy.purge_personal_data가 참조 데이터까지 연쇄로
    지운다. 파기 결과는 감사 로그(OPS-09)에 남는다.

    끝나지 않은 축제의 세션은 정책표 대상이 아니므로, 만료된 지 오래된 세션은 기존
    보존 기간으로 함께 정리한다(축제가 ENDED로 넘어가지 않은 채 방치되는 경우 대비).
    """
    connection.jobs.purge_expired_idempotency_records(
        (connection.policy.idempotency_retention_days,)
    )
    connection.jobs.purge_expired_refresh_tokens()
    counts = purge_personal_data(connection)
    stale = purge_sessions(
        connection,
        expired_days=connection.policy.visitor_session_retention_days,
    )
    logger.info("개인정보 파기: %s, 만료 세션 %s건", counts, stale)
