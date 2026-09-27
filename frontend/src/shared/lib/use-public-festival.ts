"use client";

import { useQueryClient } from "@tanstack/react-query";
import { fetchPublicFestival, PUBLIC_FESTIVAL_KEY } from "./public-festival";

/** 번역·메뉴·언어별 결과의 갱신 주기는 호출자가 정하고 원본만 공유한다. */
export function usePublicFestivalLoader(staleTime = 30_000) {
  const client = useQueryClient();
  return () => client.fetchQuery({ queryKey: PUBLIC_FESTIVAL_KEY, queryFn: fetchPublicFestival, staleTime });
}
