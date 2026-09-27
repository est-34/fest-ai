import type { Locale } from "./locale";

/**
 * 번역이 실패해 원문(한국어)을 그대로 보여주고 있는지.
 *
 * 실패해도 화면은 뜨게(fail open) 두지만, 아무 표시가 없으면 외국어 방문객은 자기가
 * 못 읽는 글자를 보면서 이유를 알 수 없다. 구독자에게 알려 배지를 띄운다.
 */
let degraded = false;
const listeners = new Set<() => void>();

export function isTranslationDegraded() {
  return degraded;
}

export function subscribeTranslationState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setDegraded(value: boolean) {
  if (degraded === value) return;
  degraded = value;
  listeners.forEach((listener) => listener());
}

/**
 * Calls the /api/i18n/translate route to auto-translate admin-authored content.
 * Safe to call from anywhere that has `fetch` (browser or server) — fails open
 * (returns the original Korean entries) so a flaky translation call never
 * breaks the page.
 */
export async function translateEntries(
  entries: Record<string, string>,
  locale: Locale,
): Promise<Record<string, string>> {
  if (locale === "ko" || Object.keys(entries).length === 0) return entries;

  try {
    const res = await fetch("/api/i18n/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, entries }),
    });
    if (!res.ok) {
      setDegraded(true);
      return entries;
    }
    const data = (await res.json()) as { entries: Record<string, string>; degraded?: boolean };
    setDegraded(Boolean(data.degraded));
    return data.entries;
  } catch {
    setDegraded(true);
    return entries;
  }
}

/**
 * `items`의 지정한 텍스트 필드들을 한 번의 요청으로 번역해 되돌려준다.
 * 항목별 필드를 개별 키(`${id}.${field}`)로 묶어 보내므로 호출 수는 항상 1회다.
 */
export async function translateFields<T extends { id: string }>(
  items: T[],
  fields: Array<keyof T & string>,
  locale: Locale,
): Promise<T[]> {
  if (locale === "ko" || items.length === 0) return items;
  // 값이 비어 있는 필드는 보내지 않는다 — String(null)="null"이 그대로 번역돼 화면에 뜬다.
  const entries = Object.fromEntries(
    items.flatMap((item) => fields
      .filter((field) => typeof item[field] === "string" && item[field] !== "")
      .map((field) => [`${item.id}.${field}`, String(item[field])])),
  );
  const text = await translateEntries(entries, locale);
  return items.map((item) => ({
    ...item,
    ...Object.fromEntries(fields.map((field) => [field, text[`${item.id}.${field}`] ?? item[field]])),
  }));
}
