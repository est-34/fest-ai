// 예약 취소·노쇼 기준. 방문객 화면과 운영자 호출 화면이 같은 숫자를 보여줘야 현장에서
// 말이 엇갈리지 않아, 문구가 아닌 값만 여기에 두고 각 화면이 자기 언어로 표시한다.
export const BOOKING_CANCEL_DEADLINE_MINUTES = 30;
export const BOOKING_NO_SHOW_GRACE_MINUTES = 10;

// 호출 후 유예 시간이 지났는지 — 운영자 화면에서 노쇼 처리 대상을 표시하는 데 쓴다.
export function isNoShowDue(calledAt: string | null, now = Date.now()) {
  if (!calledAt) return false;
  const called = new Date(calledAt).getTime();
  if (Number.isNaN(called)) return false;
  return now - called >= BOOKING_NO_SHOW_GRACE_MINUTES * 60_000;
}

/**
 * 방문객이 직접 취소할 수 있는 시각이 지났는지. 서버(domain.validate_booking_cancel_window)와
 * 같은 규칙이라, 화면에서 버튼이 열려 있는데 서버가 400을 내는 일이 없다.
 */
export function isCancelDeadlinePassed(startsAt: string, now = Date.now()) {
  const starts = new Date(startsAt).getTime();
  if (Number.isNaN(starts)) return false;
  return starts - BOOKING_CANCEL_DEADLINE_MINUTES * 60_000 <= now;
}

// 예약 상태 표기. 예약 관리·현장 운영 화면이 각자 표를 들고 있어 같은 NO_SHOW를
// 한쪽은 "노쇼", 다른 쪽은 "미입장"으로 불렀다. 표기도 규칙과 같은 자리에 둔다.
export const BOOKING_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "예약 확정",
  WAITING: "대기 중",
  CALLED: "호출됨",
  COMPLETED: "입장 완료",
  CANCELLED: "취소",
  NO_SHOW: "노쇼",
};

export type BookingAction = "CALLED" | "NO_SHOW" | "COMPLETED";

/**
 * 상태별로 운영자가 할 수 있는 조치. 서버의 전이 규칙(app/domain.py BOOKING_TRANSITIONS)과
 * 같은 표를 둔다.
 *
 * 예약 조작 화면이 둘(현장 운영·예약 관리)이라 각자 규칙을 들고 있었고, 한쪽이 서버가
 * 거부하는 전이(CONFIRMED→호출, WAITING→이용 완료)를 버튼으로 열어 두고 있었다.
 * 두 화면이 이 표만 보게 해서 다시 어긋나지 않게 한다.
 */
export const BOOKING_ACTIONS_BY_STATUS: Record<string, BookingAction[]> = {
  WAITING: ["CALLED"],
  CALLED: ["COMPLETED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function bookingActionsFor(status: string): BookingAction[] {
  return BOOKING_ACTIONS_BY_STATUS[status] ?? [];
}
