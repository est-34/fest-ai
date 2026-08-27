"use client";

import { useQuery } from "@tanstack/react-query";
import { collectPages, festivalApiPaged, visitorApiPaged } from "@/shared/lib/api";

export const ACTIVITY_QUERY_KEYS = ["admin-activities", "visitor-activities", "visitor-points"];

export async function fetchActivityHistory<T>(kind: "plogging" | "rentals", admin: boolean): Promise<T[]> {
  return collectPages<T>((cursor) => {
    const query = `?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    return admin
      ? festivalApiPaged<T[]>(`/activities/${kind}${query}`)
      : visitorApiPaged<T[]>(`/visitor/activities/${kind}${query}`);
  }, { repeatedCursorError: "활동 목록의 다음 페이지를 조회할 수 없습니다." });
}

export function useActivityHistory<T>(kind: "plogging" | "rentals", admin: boolean) {
  return useQuery({
    queryKey: [admin ? "admin-activities" : "visitor-activities", kind],
    queryFn: () => fetchActivityHistory<T>(kind, admin),
    refetchInterval: 10_000,
    throwOnError: true,
  }).data ?? [];
}
