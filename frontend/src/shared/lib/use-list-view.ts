"use client";

import { useState } from "react";

/**
 * 관리자 목록 화면의 검색 + 나눠 그리기.
 *
 * 축제 기간에는 민원·예약·참여업체가 수백 건씩 쌓이는데 화면은 전량을 한 번에 그렸고
 * 찾을 방법도 없었다. 검색어와 노출 개수를 한 곳에서 다룬다(서버 커서가 있는 감사 로그는 제외).
 */
export function useListView<T>(
  items: T[] | undefined,
  matches: (item: T, keyword: string) => boolean,
  step = 30,
) {
  const [query, setQuery] = useState("");
  // 노출 개수를 검색어와 한 덩어리로 들고 있으면, 검색어가 바뀌는 순간 자동으로 처음부터 보여준다.
  const [view, setView] = useState({ keyword: "", limit: step });
  const keyword = query.trim().toLowerCase();
  const limit = view.keyword === keyword ? view.limit : step;

  const filtered = (items ?? []).filter((item) => !keyword || matches(item, keyword));

  return {
    query,
    setQuery,
    filtered,
    visible: filtered.slice(0, limit),
    hidden: Math.max(filtered.length - limit, 0),
    showMore: () => setView({ keyword, limit: limit + step }),
  };
}

/** 검색 대상 문자열을 한 번에 비교한다. 값이 없는 필드는 건너뛴다. */
export function includesKeyword(keyword: string, ...values: (string | null | undefined)[]) {
  return values.some((value) => value?.toLowerCase().includes(keyword));
}
