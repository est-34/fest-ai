"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicFestivalLoader } from "@/shared/lib/use-public-festival";

export type VisitorMenuKey = "reservation" | "stampTour" | "survey" | "coupons" | "nearby";

export type VisitorMenus = Record<VisitorMenuKey, boolean>;

export const VISITOR_MENU_ITEMS: { key: VisitorMenuKey; label: string; description: string }[] = [
  { key: "reservation", label: "예약·대기", description: "방문객 앱의 예약·모바일 대기표 메뉴 노출 여부" },
  { key: "stampTour", label: "스탬프투어", description: "방문객 앱의 스탬프투어 메뉴 노출 여부" },
  { key: "coupons", label: "ESG 순환", description: "방문객 앱의 다회용기 대여·반납·스탬프 메뉴 노출 여부" },
  { key: "nearby", label: "지역상권", description: "방문객 앱의 주변 상권 추천 메뉴 노출 여부" },
  { key: "survey", label: "만족도조사", description: "방문객 앱의 만족도조사 메뉴 노출 여부" },
];

export const ALL_MENUS_ON: VisitorMenus = {
  reservation: true, stampTour: true, coupons: true, nearby: true, survey: true,
};

/**
 * 축제 단위 설정이라 서버(festivals.visitor_menus)가 단일 출처다.
 * 로딩 중에는 전부 노출로 두어 메뉴가 나타났다 사라지는 깜빡임 대신 사라지기만 하게 한다.
 */
export function useVisitorMenus(): VisitorMenus {
  const loadFestival = usePublicFestivalLoader(60_000);
  const { data } = useQuery({
    queryKey: ["visitor-menus"],
    queryFn: async () => {
      const festival = await loadFestival();
      return { ...ALL_MENUS_ON, ...(festival.visitorMenus ?? {}) };
    },
    staleTime: 60_000,
  });
  return data ?? ALL_MENUS_ON;
}
