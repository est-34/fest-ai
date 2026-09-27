import { festivalApi } from "@/shared/lib/api";

export interface RiskSignal {
  type: string;
  value: number;
  threshold: number | null;
  sourceUpdatedAt: string | null;
}

export interface FestivalBrief {
  summary: string;
  /** 즉시 통보가 필요한 신호(현재는 혼잡도 급증). 서버가 evidence와 별도로 뽑아 준다. */
  alerts: string[];
  alanComment?: string;
  metricLabel: string;
  metricValue: string;
  status: "normal" | "warning" | "critical";
  sources: string[];
  generatedAt: string;
  reasons: string[];
  recommendedActions: string[];
  evidence: RiskSignal[];
}

interface RiskBriefResponse {
  riskLevel: "NORMAL" | "WARNING" | "CRITICAL" | "INSUFFICIENT_DATA";
  riskScore: number;
  evidence: RiskSignal[];
  summary: string;
  reasons: string[];
  recommendedActions: string[];
  externalAiUsed: boolean;
  alerts?: string[];
  sourceUpdatedAt: string | null;
  policyVersion: string;
}

const SIGNAL_LABEL: Record<string, string> = {
  crowding: "혼잡 구역 비율",
  unresolved_safety_complaints: "미해결 중요 민원",
  safety_incidents: "안전 사고",
  staffing_gap: "인력 미배치 구역",
  schedule_change: "최근 일정 변경",
  abnormal_crowd_surge: "혼잡도 급증 구역",
};

// 위험 점수를 만든 신호 중 임계값을 가장 크게 넘은 것이 카드에 띄울 값이다.
function worstSignal(evidence: RiskSignal[]) {
  return [...evidence].sort((a, b) => (b.value - (b.threshold ?? 0)) - (a.value - (a.threshold ?? 0)))[0];
}

export async function fetchFestivalBrief(): Promise<FestivalBrief> {
  const brief = await festivalApi<RiskBriefResponse>(`/risk-brief`, { cache: "no-store" });
  const worst = worstSignal(brief.evidence ?? []);
  return {
    summary: brief.summary,
    alerts: brief.alerts ?? [],
    // 외부 AI가 실제로 쓰였을 때만 Alan 한줄평으로 표시한다 — 규칙 문장을 AI라고 부르지 않는다.
    alanComment: brief.externalAiUsed ? brief.summary : undefined,
    metricLabel: worst ? SIGNAL_LABEL[worst.type] ?? worst.type : "위험 점수",
    metricValue: worst
      ? `${worst.value}${worst.threshold === null ? "" : ` / 기준 ${worst.threshold}`}`
      : `${brief.riskScore}점`,
    status: brief.riskLevel === "CRITICAL" ? "critical" : brief.riskLevel === "WARNING" ? "warning" : "normal",
    sources: ["혼잡 스냅샷", "운영 티켓", "인력 배치", "프로그램 일정"],
    generatedAt: brief.sourceUpdatedAt ?? new Date().toISOString(),
    reasons: brief.reasons ?? [],
    recommendedActions: brief.recommendedActions ?? [],
    evidence: brief.evidence ?? [],
  };
}
