import { FESTIVAL_CODE, publicApi } from "@/shared/lib/api";
import type { Locale } from "@/shared/lib/i18n";
import { translateEntries, translateFields } from "@/shared/lib/i18n/translate-client";
import { uniqueById } from "@/shared/lib/utils";

export interface RecommendedBusiness {
  businessId: string;
  name: string;
  category: string;
  score: number;
  reasons: string[];
  isSponsored: boolean;
  distanceMeters: number | null;
  areaId: string | null;
  areaName: string | null;
}

export interface RecommendationResult {
  festivalId: string;
  items: RecommendedBusiness[];
  sponsoredItems: RecommendedBusiness[];
  recommendationPolicyVersion: string;
}

export interface RecommendationQuery {
  latitude?: number;
  longitude?: number;
  category?: string;
  accessibilityRequired?: boolean;
}

// 추천 이유(reasons)는 항목별 배열이라 translateFields의 flat 필드 방식으로는 못 다룬다 —
// businessId를 키 접두어로 펼쳐서 한 번에 번역하고 순서대로 되돌려 채운다.
async function translateBusinesses(items: RecommendedBusiness[], locale: Locale): Promise<RecommendedBusiness[]> {
  if (locale === "ko" || items.length === 0) return items;
  const entries: Record<string, string> = {};
  items.forEach((item) => {
    entries[`${item.businessId}.name`] = item.name;
    entries[`${item.businessId}.category`] = item.category;
    if (item.areaName) entries[`${item.businessId}.areaName`] = item.areaName;
    item.reasons.forEach((reason, index) => {
      entries[`${item.businessId}.reason.${index}`] = reason;
    });
  });
  const translated = await translateEntries(entries, locale);
  return items.map((item) => ({
    ...item,
    name: translated[`${item.businessId}.name`] ?? item.name,
    category: translated[`${item.businessId}.category`] ?? item.category,
    areaName: item.areaName ? (translated[`${item.businessId}.areaName`] ?? item.areaName) : item.areaName,
    reasons: item.reasons.map((reason, index) => translated[`${item.businessId}.reason.${index}`] ?? reason),
  }));
}

export async function fetchBusinessRecommendations(
  { latitude, longitude, category, accessibilityRequired }: RecommendationQuery = {},
  locale: Locale = "ko",
): Promise<RecommendationResult> {
  const params = new URLSearchParams({ limit: "10" });
  // 위경도는 둘 다 있어야 서버가 받는다 — 한쪽만 보내면 400이다.
  if (latitude !== undefined && longitude !== undefined) {
    params.set("latitude", String(latitude));
    params.set("longitude", String(longitude));
  }
  if (category) params.set("category", category);
  // 서버 쿼리 이름은 snake_case다 — camelCase로 보내면 FastAPI가 조용히 무시한다.
  if (accessibilityRequired) params.set("accessibility_required", "true");
  const result = await publicApi<RecommendationResult>(`/public/festivals/${FESTIVAL_CODE}/business-recommendations?${params}`);
  const [items, sponsoredItems] = await Promise.all([
    translateBusinesses(result.items, locale),
    translateBusinesses(result.sponsoredItems, locale),
  ]);
  return { ...result, items, sponsoredItems };
}

export interface FestivalBusiness {
  id: string;
  name: string;
  category: string;
  description: string | null;
  menu: Array<{ name?: string; price?: number }> | null;
  operatingHours: Record<string, string> | null;
  accessibility: Record<string, boolean> | null;
  boothNo: string | null;
  areaName: string | null;
}

export async function fetchFestivalBusinesses(category?: string, locale: Locale = "ko"): Promise<FestivalBusiness[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const rows = await publicApi<FestivalBusiness[]>(`/public/festivals/${FESTIVAL_CODE}/businesses${query}`);
  // 서버는 부스마다 한 줄을 준다(업체당 부스가 여러 개일 수 있음). 목록에서는 대표 부스 하나만 쓴다.
  const businesses = uniqueById(rows);
  const translated = await translateFields(businesses, ["name", "category", "description", "areaName"], locale);
  // menu[].name은 배열 안 필드라 translateFields가 못 다룬다 — 항목별로 따로 번역한다.
  if (locale === "ko") return translated;
  const menuNames = translated.filter((business) => business.menu?.some((item) => item.name));
  if (menuNames.length === 0) return translated;
  const entries: Record<string, string> = {};
  menuNames.forEach((business) => {
    business.menu!.forEach((item, index) => {
      if (item.name) entries[`${business.id}.menu.${index}`] = item.name;
    });
  });
  const translatedMenuNames = await translateEntries(entries, locale);
  return translated.map((business) => (
    business.menu
      ? { ...business, menu: business.menu.map((item, index) => (
          item.name ? { ...item, name: translatedMenuNames[`${business.id}.menu.${index}`] ?? item.name } : item
        )) }
      : business
  ));
}

/** 브라우저 위치. 거부·미지원이면 위치 없이 추천을 받는다. */
export function currentPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60_000 },
    );
  });
}
