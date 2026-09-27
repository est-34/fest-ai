/**
 * 설문-매장 연결 표기 규칙.
 *
 * 백엔드 설문 API에는 스탬프 스팟(매장)과 설문을 잇는 필드가 없다. 대신 제목 앞에
 * "[매장명]"을 붙이는 규칙으로 연결을 표현한다 — 관리자 화면에서 매장을 선택하면
 * 이 접두어가 자동으로 붙고, 방문객 화면은 접두어의 매장명을 스탬프 완료 여부와 대조한다.
 */
const LINKED_STORE_PATTERN = /^\[(.+?)\]\s*/;

/** 제목에서 연결된 매장명을 읽는다. 접두어가 없으면 매장과 무관한 공용 설문이다. */
export function linkedStoreName(title: string): string | null {
  const match = LINKED_STORE_PATTERN.exec(title.trim());
  const name = match?.[1]?.trim();
  return name || null;
}

/** 매장 접두어를 떼거나 새로 붙인 제목을 만든다. storeName이 null이면 접두어를 없앤다. */
export function withLinkedStoreName(title: string, storeName: string | null) {
  const bare = title.replace(LINKED_STORE_PATTERN, "").trim();
  return storeName ? `[${storeName}] ${bare}` : bare;
}
