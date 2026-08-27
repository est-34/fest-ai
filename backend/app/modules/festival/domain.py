from app.shared.domain.errors import bad_request, unprocessable


def validate_content_review(version: dict, reviewer_id: str, decision: str) -> None:
    if version["status"] != "IN_REVIEW":
        raise bad_request(
            "INVALID_STATE_TRANSITION", "검수 중인 버전만 승인 또는 반려할 수 있습니다."
        )
    # 공지는 현장에서 즉시 나가야 하므로 작성자 자가 승인을 허용한다(감사 로그로 추적).
    if (
        decision == "APPROVED"
        and str(version["author_id"]) == reviewer_id
        and version.get("content_type") != "ANNOUNCEMENT"
    ):
        raise unprocessable(
            "AUTHOR_CANNOT_FINAL_APPROVE",
            "작성자는 자신의 콘텐츠를 최종 승인할 수 없습니다.",
        )
