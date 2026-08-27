from app.shared.domain.errors import bad_request, unprocessable


def validate_measurement_review(
    measurement: dict, evidence_count: int, decision: str
) -> None:
    if measurement["status"] not in {"DRAFT", "IN_REVIEW"}:
        raise bad_request(
            "INVALID_STATE_TRANSITION", "승인 대기 실적만 검토할 수 있습니다."
        )
    requirements = measurement.get("source_requirements") or {}
    if decision == "APPROVED" and (
        not measurement.get("formula")
        or not measurement.get("unit")
        or not requirements
    ):
        raise unprocessable(
            "METRIC_DEFINITION_INCOMPLETE",
            "산식·단위·출처 요건이 완성된 지표만 승인할 수 있습니다.",
        )
    if (
        decision == "APPROVED"
        and measurement.get("evidence_required")
        and evidence_count == 0
    ):
        raise unprocessable("EVIDENCE_REQUIRED", "필수 증빙을 연결해야 합니다.")
