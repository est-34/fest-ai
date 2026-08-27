import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 서울 기준 표기. 운영 화면이 브라우저 타임존에 따라 흔들리지 않도록 고정한다 —
// 종류마다 옵션만 다르고 규칙은 같아서 한 곳에서 만든다.
const seoul = (options: Intl.DateTimeFormatOptions = {}) => (value: string | Date) =>
  new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", ...options })

/** 서울 기준 날짜+시각. */
export const seoulDateTime = seoul()

/** 서울 기준 날짜만. 보고서 기간처럼 시각이 의미 없는 표기에 쓴다. */
export const seoulDate = seoul({ year: "numeric", month: "numeric", day: "numeric" })

/** 서울 기준 시:분. */
export const seoulTime = seoul({ hour: "2-digit", minute: "2-digit" })

/** 서울 기준 월/일 시:분. */
export const seoulShort = seoul({ month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })

/** 값이 없거나 형식이 깨졌으면 "-". 그 외에는 seoulDateTime과 같은 기준으로 표기한다. */
export function seoulMoment(value: string | Date | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "-" : seoulDateTime(date)
}

// 한국은 서머타임이 없어 연중 +09:00으로 고정이다.
const SEOUL_OFFSET = "+09:00"
const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

/**
 * `<input type="datetime-local">`의 value 형식(YYYY-MM-DDTHH:mm)으로 만든다.
 *
 * 표시(seoulDateTime 등)는 전부 축제 기준 시각인데 입력만 브라우저 로컬이라, KST가 아닌
 * 노트북에서 10:00을 입력하면 화면에 19:00으로 뜨는 식으로 어긋났다. 입력도 축제 기준으로 맞춘다.
 */
export function datetimeLocal(value: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value))
  const at = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00"
  return `${at("year")}-${at("month")}-${at("day")}T${at("hour")}:${at("minute")}`
}

/** datetimeLocal()의 역함수. datetime-local 입력값(축제 기준 시각)을 서버가 받는 ISO로 되돌린다. */
export function toIso(value: string | Date) {
  // 타임존이 붙은 값(Date·ISO 문자열)은 그대로 두고, 벽시계 문자열만 축제 기준으로 읽는다.
  if (typeof value === "string" && DATETIME_LOCAL.test(value)) return new Date(`${value}${SEOUL_OFFSET}`).toISOString()
  return new Date(value).toISOString()
}

/**
 * 같은 id의 첫 행만 남긴다.
 * 참여업체 목록은 부스마다 한 줄로 오기 때문에 업체 단위 화면에서는 대표 한 줄만 필요하다.
 */
export function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((row) => !seen.has(row.id) && seen.add(row.id))
}

/** 목록에서 값을 넣고 빼는 토글. 다중 선택 칩·체크박스가 쓰는 같은 규칙. */
export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/** 축제 기준(서울) 날짜로 오늘인지. 운영 화면의 다른 날짜 표기와 같은 기준을 쓴다. */
export function isToday(isoDate: string | null | undefined) {
  return !!isoDate && seoulDate(isoDate) === seoulDate(new Date())
}
