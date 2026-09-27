import { festivalApi } from "@/shared/lib/api";

/** 언어별 이용 로그(AI-05). auto_switched는 첫 발화로 자동 전환된 세션 수. */
export interface LanguageUsage {
  language: string;
  sessions: number;
  autoSwitched: number;
  kioskSessions: number;
}

/** OPS-07 현장 입력 기준 구역별 혼잡·대기. expiresAt이 지난 값은 stale로 표시된다. */
export interface CrowdRow {
  areaId: string;
  name: string;
  crowdLevel: "QUIET" | "MODERATE" | "BUSY" | "FULL";
  peopleCount: number | null;
  estimatedWaitMin: number | null;
  capturedAt: string;
  stale: boolean;
}

export interface OpsFilters {
  areaId?: string;
  timeFrom?: string;
  timeTo?: string;
}

export interface OpsSnapshot {
  visitors: number;
  activeBookings: number;
  openTickets: number;
  approvedBusinesses: number;
  couponIssues: number;
  pointsIssued: number;
  languages: LanguageUsage[];
  crowd: CrowdRow[];
  updatedAt: string | null;
  /** 어떤 원천 테이블을 합산했는지. 화면이 숫자와 함께 근거를 밝히기 위해 쓴다(OPS-03). */
  sources: string[];
  filters: OpsFilters;
}

/** 축제·구역·시간 필터로 핵심 현황을 좁힌다. 값이 없으면 축제 전체 기간을 집계한다. */
export async function fetchOpsSnapshot(filters: OpsFilters = {}): Promise<OpsSnapshot> {
  const query = new URLSearchParams();
  if (filters.areaId) query.set("areaId", filters.areaId);
  // datetime-local 값은 타임존이 없어 그대로 보내면 서버가 UTC로 읽는다.
  if (filters.timeFrom) query.set("timeFrom", new Date(filters.timeFrom).toISOString());
  if (filters.timeTo) query.set("timeTo", new Date(filters.timeTo).toISOString());
  const response = await festivalApi<{
    stats: Omit<OpsSnapshot, "languages" | "crowd" | "updatedAt" | "sources" | "filters">;
    languages: LanguageUsage[];
    crowd: CrowdRow[];
    updatedAt: string | null;
    sources: string[];
    filters: OpsFilters;
  }>(`/dashboard${query.size ? `?${query}` : ""}`);
  return {
    ...response.stats,
    languages: response.languages,
    crowd: response.crowd,
    updatedAt: response.updatedAt,
    sources: response.sources,
    filters: response.filters,
  };
}
