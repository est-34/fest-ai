import { festivalApi, json } from "@/shared/lib/api";
// 운영자 화면과 방문객 화면이 서버의 같은 정책표(app/privacy.py)를 받는다 — 정의는 한 곳만 둔다.
import type { ConsentItem, RetentionPolicyRow } from "@/features/privacy/api/privacy";

/** OPS-11 운영자용 개인정보 정책·요구 처리, VIS-11 식별자 검토, OPS-10 전달 결과. */

export interface PrivacyPolicy {
  retentionPolicy: RetentionPolicyRow[];
  consentItems: ConsentItem[];
  purgeSchedule: string;
  lastPurge: { createdAt: string; afterData: Record<string, number> } | null;
}

export const PRIVACY_REQUEST_STATUS_LABEL: Record<string, string> = {
  RECEIVED: "접수",
  IN_PROGRESS: "처리 중",
  COMPLETED: "완료",
  REJECTED: "거절",
};

export interface AdminPrivacyRequest {
  id: string;
  requestType: "ACCESS" | "DELETE";
  status: keyof typeof PRIVACY_REQUEST_STATUS_LABEL;
  detail: string | null;
  result: { collected?: Record<string, number>; excluded?: string[]; deletedRows?: number } | null;
  visitorSessionId: string | null;
  handlerName: string | null;
  handledAt: string | null;
  createdAt: string;
}

export function fetchPrivacyPolicy() {
  return festivalApi<PrivacyPolicy>(`/privacy/policy`);
}

export function fetchAdminPrivacyRequests() {
  return festivalApi<AdminPrivacyRequest[]>(`/privacy/requests`);
}

export function handlePrivacyRequest({ requestId, status, note }: {
  requestId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  note?: string;
}) {
  return festivalApi<AdminPrivacyRequest>(`/privacy/requests/${requestId}/handle`, json("POST", { status, note }));
}

/** 정책표에 따른 파기를 즉시 실행한다(평상시에는 잡 워커가 매일 1회 실행). 최고 관리자 전용. */
export function runPrivacyPurge() {
  return festivalApi<{ purged: Record<string, number>; policy: RetentionPolicyRow[] }>(`/privacy/purge`, { method: "POST" });
}

export interface IdentityReview {
  totals: { issuances: number; reissues: number; devices: number };
  suspects: Array<{
    deviceKey: string;
    sessionCount: number;
    firstAt: string;
    lastAt: string;
    couponIssues: number;
    rewardEvents: number;
    bookings: number;
  }>;
}

/** VIS-11 식별자 재발급과 한도 우회 의심 패턴. 자동 차단이 아니라 담당자 검토용 신호다. */
export function fetchIdentityReview() {
  return festivalApi<IdentityReview>(`/visitor-identity`);
}

export interface DeliveryReport {
  announcements: Array<{
    id: string;
    title: string;
    severity: "INFO" | "WARNING" | "EMERGENCY";
    targetAreaIds: string[];
    startsAt: string | null;
    status: string;
    deliveredSessions: number;
    firstDeliveredAt: string | null;
    lastDeliveredAt: string | null;
    firstDeliveryLagSeconds: number | null;
  }>;
  bookingCalls: { called: number; delivered: number; avgLagSeconds: number | null };
  channel: { type: string; announcementPollSeconds: number; bookingPollSeconds: number; limitation: string };
}

export function fetchDeliveryReport() {
  return festivalApi<DeliveryReport>(`/notification-deliveries`);
}

/** ESG-G-08 카메라·AI 투명성: 공개 안내, 중지 스위치, 익명 효과 지표. */
export interface KioskCameraReport {
  enabled: boolean;
  stopReason: string | null;
  notice: {
    purpose: string;
    choice: string;
    processingLocation: string;
    retention: string;
    prohibitedUse: string;
  };
  counts: Record<string, number>;
  models: { modelVersion: string; count: number; lastSeenAt: string }[];
  estimateResults?: {
    counts: Partial<Record<"SENIOR" | "OTHER" | "UNAVAILABLE", number>>;
    recent: { result: "SENIOR" | "OTHER" | "UNAVAILABLE"; modelVersion: string; createdAt: string }[];
  };
  estimateResultLoggingAvailable?: boolean;
  rates: {
    consentAcceptRate: number | null;
    estimateFailureRate: number | null;
    suggestionAcceptRate: number | null;
    manualLargeTextCount: number;
    taskCompletedCount: number;
  };
}

export function fetchKioskCameraReport() {
  return festivalApi<KioskCameraReport>("/kiosk-camera").then((report) => ({
    ...report,
    estimateResultLoggingAvailable: Boolean(report.estimateResults),
    // 백엔드 마이그레이션 전 응답도 관리자 화면이 깨지지 않도록 빈 결과로 보정한다.
    estimateResults: {
      counts: report.estimateResults?.counts ?? {},
      recent: report.estimateResults?.recent ?? [],
    },
  }));
}

export function updateKioskCamera({ enabled, stopReason }: { enabled: boolean; stopReason?: string }) {
  return festivalApi<KioskCameraReport>("/kiosk-camera", json("PATCH", { enabled, stopReason }));
}
