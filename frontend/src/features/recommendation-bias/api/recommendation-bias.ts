import { festivalApi } from "@/shared/lib/api";

export interface BusinessExposure {
  businessId: string;
  name: string;
  category: string;
  totalExposures: number;
  sponsoredExposures: number;
  exposureShare: number;
  isOverThreshold: boolean;
}

export interface CategoryExposure {
  category: string;
  totalExposures: number;
  exposureShare: number;
  isOverThreshold: boolean;
}

export interface RecommendationBiasReport {
  festivalId: string;
  windowDays: number;
  status: "PASS" | "WARNING" | "INSUFFICIENT_DATA";
  summary: string;
  checkedEventCount: number;
  totalExposures: number;
  sponsoredExposures: number;
  businessExposures: BusinessExposure[];
  categoryExposures: CategoryExposure[];
  thresholds: { maxBusinessExposureShare: number; maxCategoryExposureShare: number };
  recommendedActions: string[];
}

/** 백엔드는 GET 한 번으로 최근 window_days의 노출 이력을 그때그때 집계한다(저장된 리포트가 아니다). */
export function fetchRecommendationBiasReport(windowDays = 7) {
  return festivalApi<RecommendationBiasReport>(`/recommendation-bias?window_days=${windowDays}`, { cache: "no-store" });
}

/** 탭 배지와 편향 패널이 같은 키를 쓰므로 두 곳에서 불러도 요청은 한 번이다. */
export const recommendationBiasQuery = {
  queryKey: ["recommendation-bias"],
  queryFn: () => fetchRecommendationBiasReport(),
  retry: 1,
};
