import { FESTIVAL_CODE, festivalApi, json, publicApi, visitorApi } from "@/shared/lib/api";
import type { Locale } from "@/shared/lib/i18n";
import { translateEntries, translateFields } from "@/shared/lib/i18n/translate-client";

/**
 * VIS-12 방문객 구역 식별.
 *
 * 브라우저 위치정보는 쓰지 않는다 — 축제장 규모에서 GPS 오차가 구역 경계보다 커서 판정
 * 신뢰도가 낮고, 동의·보유·파기 부담이 추가된다. 진입 QR 지점과 방문객의 수동 선택만
 * 사용하며, 판정 결과는 서버에서 2시간 동안만 유효하다.
 */
export interface VisitorArea {
  areaId: string | null;
  areaName: string | null;
  areaSource: "QR" | "MANUAL" | null;
  areaAssignedAt: string | null;
  validHours: number;
}

export interface PublicArea {
  id: string;
  name: string;
  areaType: string;
}

export async function fetchVisitorArea(locale: Locale = "ko"): Promise<VisitorArea> {
  const area = await visitorApi<VisitorArea>("/visitor-sessions/current/area");
  if (locale === "ko" || !area.areaName) return area;
  const translated = await translateEntries({ areaName: area.areaName }, locale);
  return { ...area, areaName: translated.areaName ?? area.areaName };
}

export function fetchPublicAreas(locale: Locale = "ko"): Promise<PublicArea[]> {
  return publicApi<PublicArea[]>(`/public/festivals/${FESTIVAL_CODE}/areas`).then((areas) => translateFields(areas, ["name"], locale));
}

export function setVisitorArea(areaId: string | null, source: "QR" | "MANUAL" = "MANUAL") {
  return visitorApi<VisitorArea>("/visitor-sessions/current/area", json("PUT", { areaId, source }));
}

export interface AdminArea {
  id: string;
  name: string;
  areaType: string;
  description?: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  version?: number;
}

/** 구역 목록은 티켓·혼잡도·인력 배치·부스 화면이 모두 쓰는 기준정보다. */
export function fetchAreas() {
  return festivalApi<AdminArea[]>(`/areas`);
}
