/**
 * facilities.operating_hours는 자유형 JSON이라 고정 스키마가 없다({"daily":"09:00-20:00"} 등).
 * "HH:MM-HH:MM" 꼴인 값만 지금 열림/닫힘을 판정하고, 그 밖의 형태는 open을 null로 둔다 —
 * 파싱하지 못한 값을 "운영 종료"로 단정하면 없는 정보를 지어내는 것이다.
 */

const RANGE = /^\s*(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})\s*$/;

export interface OperatingStatus {
  /** 지금 운영 중이면 true, 아니면 false. 판정할 수 없으면 null. */
  open: boolean | null;
  /** 화면에 그대로 보여줄 운영시간 문자열. 값이 없으면 null. */
  hours: string | null;
}

/** 축제 기준 시각(Asia/Seoul)의 분 단위 하루 오프셋. */
function minutesOfDay(now: Date) {
  const [hour, minute] = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul",
  }).format(now).split(":");
  return Number(hour) * 60 + Number(minute);
}

export function operatingStatus(operatingHours: Record<string, string> | null | undefined, now = new Date()): OperatingStatus {
  const hours = Object.values(operatingHours ?? {}).find((value) => typeof value === "string" && value.trim()) ?? null;
  const match = hours?.match(RANGE);
  if (!match) return { open: null, hours };

  const [, openHour, openMinute, closeHour, closeMinute] = match;
  const start = Number(openHour) * 60 + Number(openMinute);
  const end = Number(closeHour) * 60 + Number(closeMinute);
  const current = minutesOfDay(now);
  // 22:00-02:00처럼 자정을 넘기는 야간 운영은 흔하다 — 이때는 범위 밖이 아니라 안이 뒤집힌다.
  return { open: start <= end ? current >= start && current < end : current >= start || current < end, hours };
}
