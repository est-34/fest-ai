/**
 * localStorage에 JSON으로 담아 두는 값의 읽기·쓰기.
 *
 * 데모 저장소(플로깅·다회용기)와 기기 보관 값(쿠폰 사용 토큰·예약 연락처·AI 대화)이 각자
 * `try { JSON.parse(getItem(...)) } catch { 기본값 }`을 들고 있었다. 같은 규칙을 한 곳에 둔다.
 * 이 파일은 React에 기대지 않는다.
 */

/** JSON 문자열이 없거나 깨졌으면 fallback. */
export function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 값이 없거나 깨졌으면 fallback. 저장 값이 깨진 것은 없는 것으로 본다. */
export function readJson<T>(key: string, fallback: T): T {
  return typeof window === "undefined" ? fallback : parseJson(window.localStorage.getItem(key), fallback);
}

/**
 * 저장하고 구독자에게 알린다.
 *
 * 브라우저의 storage 이벤트는 *다른* 탭에만 뜨므로 같은 탭에는 직접 알린다.
 * 저장 공간이 없어도 호출부의 동작 자체는 이미 끝났으므로 막지 않는다.
 */
export function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 화면 갱신까지 막을 이유가 없다.
  }
  window.dispatchEvent(new Event("storage"));
}
