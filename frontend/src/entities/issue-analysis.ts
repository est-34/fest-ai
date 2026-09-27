import { festivalApi, json } from "@/shared/lib/api";

export const ISSUE_TOPICS = ["SAFETY", "CROWD", "FACILITY", "GUIDANCE", "OTHER"] as const;
export const ISSUE_SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;

export type IssueTopic = (typeof ISSUE_TOPICS)[number];
export type IssueSentiment = (typeof ISSUE_SENTIMENTS)[number];

export const TOPIC_LABEL: Record<string, string> = {
  SAFETY: "안전·사고",
  CROWD: "혼잡·대기",
  FACILITY: "편의시설",
  GUIDANCE: "안내·동선",
  OTHER: "기타",
};

export const SENTIMENT_LABEL: Record<string, string> = {
  POSITIVE: "긍정",
  NEUTRAL: "중립",
  NEGATIVE: "부정",
};

export interface IssueAnalysisRow {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  updatedAt: string | null;
  analysis: {
    topic: IssueTopic;
    sentiment: IssueSentiment;
    urgent: boolean;
    humanReviewed: boolean;
    note: string | null;
  };
}

export function fetchIssueAnalysis() {
  return festivalApi<IssueAnalysisRow[]>(`/issue-analysis`);
}

/** 페이지 헤더의 새로고침과 분석 패널이 같은 키를 쓰므로 두 곳에서 불러도 요청은 한 번이다. */
export const issueAnalysisQuery = { queryKey: ["issue-analysis"], queryFn: fetchIssueAnalysis };

export interface IssueOverride {
  ticketId: string;
  topic: IssueTopic;
  sentiment: IssueSentiment;
  urgent: boolean;
  note?: string | null;
}

export function overrideIssueAnalysis({ ticketId, ...body }: IssueOverride) {
  return festivalApi(`/issue-analysis/${ticketId}`, json("PATCH", body));
}

