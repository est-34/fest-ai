from datetime import UTC, datetime, timedelta

from app.shared.domain.errors import bad_request

BOOKING_TRANSITIONS = {
    "WAITING": {"CALLED", "CANCELLED"},
    "CALLED": {"COMPLETED", "NO_SHOW", "CANCELLED"},
    "CONFIRMED": {"COMPLETED", "NO_SHOW", "CANCELLED"},
    "CANCELLED": set(),
    "NO_SHOW": set(),
    "COMPLETED": set(),
}


def validate_booking_transition(current: str, target: str) -> None:
    if target not in BOOKING_TRANSITIONS.get(current, set()):
        raise bad_request(
            "INVALID_STATE_TRANSITION",
            f"{current}에서 {target}(으)로 전이할 수 없습니다.",
        )


BOOKING_CANCEL_DEADLINE_MINUTES = 30


def validate_booking_cancel_window(starts_at, now=None) -> None:
    now = now or datetime.now(UTC)
    if starts_at - timedelta(minutes=BOOKING_CANCEL_DEADLINE_MINUTES) <= now:
        raise bad_request(
            "CANCEL_WINDOW_CLOSED",
            f"시작 {BOOKING_CANCEL_DEADLINE_MINUTES}분 전까지만 직접 취소할 수 있습니다. 현장 운영자에게 문의해 주세요.",
        )


def select_course(
    sessions: list[dict], duration_min: int, starts_at=None
) -> list[dict]:
    """겹치지 않는 회차를 요청한 소요 시간 안에서 고른다.

    starts_at을 생략하면 예전에는 deadline이 None이 되어 duration_min이 통째로 무시됐다
    (60분을 요청해도 후보 50개가 전부 코스에 들어갔다). 기준 시각이 없으면 첫 회차의
    시작 시각을 기준으로 삼는다.
    """
    if not sessions:
        return []
    cursor = starts_at or min(session["starts_at"] for session in sessions)
    deadline = cursor + timedelta(minutes=duration_min)
    selected: list[dict] = []
    used_programs: set = set()
    for session in sessions:
        if session["starts_at"] < cursor or session["ends_at"] > deadline:
            continue
        # 같은 프로그램의 다른 회차를 두 번 넣으면 코스가 아니라 중복 안내가 된다.
        program_id = session.get("program_id")
        if program_id is not None and program_id in used_programs:
            continue
        selected.append(session)
        used_programs.add(program_id)
        cursor = session["ends_at"]
    return selected
