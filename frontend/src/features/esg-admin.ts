import type { EsgMetricDefinition, MetricVersion } from "@/entities/esg";
import { festivalApi, idempotent, json } from "@/shared/lib/api";

export const MEASUREMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "작성 중",
  IN_REVIEW: "검토 중",
  APPROVED: "승인",
  REJECTED: "반려",
  SUPERSEDED: "정정됨",
};

export interface NewMeasurement {
  metricVersionId: string;
  value: number;
  sourceType: string;
  sourceRef?: string;
  measuredAt: string;
  /** 정정할 때만 채운다 — 승인된 실적은 수정 대신 새 실적이 원본을 대체한다. */
  supersedesId?: string;
}

export function createMeasurement(input: NewMeasurement) {
  // 같은 지표·같은 근거를 두 번 올리면 서버가 중복으로 막는다.
  return festivalApi(`/esg/measurements`,
    idempotent("POST", { ...input, dedupeKey: `${input.metricVersionId}:${input.measuredAt}:${input.value}` }));
}

export function reviewMeasurement({ measurementId, decision, comment }: { measurementId: string; decision: "APPROVED" | "REJECTED"; comment?: string }) {
  return festivalApi(`/esg/measurements/${measurementId}/reviews`, json("POST", { decision, comment }));
}

export interface NewEvidence {
  measurementId: string;
  fileId: string;
  fileHash: string;
  evidenceType: string;
}

/** 파일 저장소가 확정되지 않아 백엔드는 외부 fileId와 해시만 연결한다. */
export function addEvidence({ measurementId, ...body }: NewEvidence) {
  return festivalApi(`/esg/measurements/${measurementId}/evidence`, json("POST", body));
}

export interface EsgReport {
  id: string;
  title: string;
  status: "GENERATING" | "DRAFT" | "APPROVED" | "EXPORTED" | "FAILED";
  format: string;
  periodFrom: string;
  periodTo: string;
  createdAt: string;
  /** 운영자가 편집한 서술부(제목·머리말·비고). 산출물의 본문에 그대로 반영된다. */
  editMetadata?: { title?: string; intro?: string; note?: string } | null;
  snapshot?: { metrics?: Array<{ name: string; category: string; value: number; unit: string }> } | null;
}

export function fetchReports() {
  return festivalApi<EsgReport[]>(`/esg/reports`);
}

export function approveReport(reportId: string) {
  return festivalApi(`/esg/reports/${reportId}/approve`, { method: "POST" });
}

export function exportReport({ reportId, format }: { reportId: string; format: "PDF" | "DOCX" }) {
  return festivalApi<{ jobId: string; status: string }>(`/esg/reports/${reportId}/exports`, json("POST", { format }));
}

export interface EsgDashboard {
  metrics: Array<{ id: string; name: string; category: string; unit: string | null; approvedCount: number; unapprovedCount: number }>;
  dataQualityWarnings: Array<{ metricId: string; type: "MISSING_DATA" | "UNAPPROVED_DATA"; count: number }>;
  aiBrief: string | null;
  externalAiUsed: boolean;
}

/** 데이터 품질 경고와 외부 AI 브리핑. 서버가 내려주는데 화면이 쓰지 않고 있었다. */
export function fetchEsgDashboard() {
  return festivalApi<EsgDashboard>(`/esg/dashboard`);
}

/** ESG-01 지표 정의. 산식·단위·목표·증빙 요건이 없는 지표는 실적 승인 대상이 아니다. */
export function createMetric(input: { name: string; category: "E" | "S" | "G" }) {
  return festivalApi<EsgMetricDefinition>(`/esg/metrics`, json("POST", input));
}

/**
 * 지표 정의는 수정하지 않고 새 버전을 쌓는다 — 이미 승인된 실적이 어떤 산식으로 집계됐는지
 * 추적할 수 있어야 하기 때문이다(서버가 version_no를 매긴다).
 */
export function createMetricVersion({ metricId, ...body }: {
  metricId: string;
  formula: string;
  unit: string;
  target?: number | null;
  sourceRequirements: Record<string, unknown>;
  evidenceRequired: boolean;
}) {
  return festivalApi<MetricVersion>(`/esg/metrics/${metricId}/versions`, json("POST", body));
}

/** ESG-06 보고서 서술부 편집. 수치는 승인 실적 스냅샷이라 편집 대상이 아니다. */
export interface ReportEdit {
  title?: string;
  intro?: string;
  note?: string;
}

export function updateReport({ reportId, editMetadata }: { reportId: string; editMetadata: ReportEdit }) {
  return festivalApi<EsgReport>(`/esg/reports/${reportId}`, json("PATCH", { editMetadata }));
}
