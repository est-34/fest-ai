import { FESTIVAL_CODE, festivalApi, json, publicApi } from "@/shared/lib/api";
import type { Locale } from "@/shared/lib/i18n";
import { translateEntries } from "@/shared/lib/i18n/translate-client";
import type { Tone } from "@/shared/ui/status-pill";

export type CrowdLevel = "QUIET" | "MODERATE" | "BUSY" | "FULL";

export const CROWD_LEVELS: CrowdLevel[] = ["QUIET", "MODERATE", "BUSY", "FULL"];

export const CROWD_LABEL: Record<CrowdLevel, string> = {
  QUIET: "여유",
  MODERATE: "보통",
  BUSY: "혼잡",
  FULL: "매우 혼잡",
};

export const CROWD_TONE: Record<CrowdLevel, Tone> = {
  QUIET: "success",
  MODERATE: "warning",
  BUSY: "busy",
  FULL: "danger",
};

export interface PublicCrowd {
  areaId: string;
  areaName: string;
  crowdLevel: CrowdLevel;
  estimatedWaitMin: number | null;
  capturedAt: string;
  stale: boolean;
}

/**
 * 공개 혼잡도는 배열이 아니라 구역 목록을 updatedAt·stale로 감싼 객체다.
 * 구역 이름도 운영자 API의 areaName이 아니라 name으로 온다 — 화면이 쓰는 모양으로 맞춰서 돌려준다.
 */
export async function fetchPublicCrowd(locale: Locale = "ko"): Promise<PublicCrowd[]> {
  const { zones } = await publicApi<{
    updatedAt: string;
    stale: boolean;
    zones: (Omit<PublicCrowd, "areaName"> & { name: string })[];
  }>(`/public/festivals/${FESTIVAL_CODE}/crowd`);
  const rows = zones.map(({ name, ...zone }) => ({ ...zone, areaName: name }));
  if (locale === "ko" || rows.length === 0) return rows;
  const entries = Object.fromEntries(rows.map((row) => [row.areaId, row.areaName]));
  const translated = await translateEntries(entries, locale);
  return rows.map((row) => ({ ...row, areaName: translated[row.areaId] ?? row.areaName }));
}

export interface AdminCrowdSnapshot extends PublicCrowd {
  id: string;
  sourceType: string;
  peopleCount: number | null;
  expiresAt: string;
  programTitle: string | null;
}

export function fetchCrowdSnapshots() {
  return festivalApi<AdminCrowdSnapshot[]>(`/crowd-snapshots`);
}

export interface NewCrowdSnapshot {
  areaId: string;
  crowdLevel: CrowdLevel;
  peopleCount?: number | null;
  estimatedWaitMin?: number | null;
  validMinutes: number;
}

export function createCrowdSnapshot({ validMinutes, ...input }: NewCrowdSnapshot) {
  const capturedAt = new Date();
  return festivalApi(`/crowd-snapshots`, json("POST", {
    ...input,
    sourceType: "MANUAL",
    capturedAt: capturedAt.toISOString(),
    // 수동 입력값은 유효기간이 지나면 stale로 표시된다 — 오래된 값을 최신처럼 보여주지 않기 위해.
    expiresAt: new Date(capturedAt.getTime() + validMinutes * 60_000).toISOString(),
  }));
}
