import { json, visitorApi } from "@/shared/lib/api";

/** OPS-11 방문객 개인정보 고지·동의·요구. 항목 정의와 보유기간은 서버 정책표가 단일 기준이다. */
export interface ConsentItem {
  key: string;
  label: string;
  featureId: string;
  withdrawable: boolean;
  basis: string;
  retention: string;
  notice?: string;
}

export interface RetentionPolicyRow {
  key: string;
  label: string;
  featureId: string;
  retention: string;
  mode: "AUTO" | "MANUAL" | "NOT_COLLECTED";
}

export interface PrivacyNotice {
  items: ConsentItem[];
  consents: Record<string, boolean>;
  retentionPolicy: RetentionPolicyRow[];
}

export interface PrivacyRequest {
  id: string;
  requestType: "ACCESS" | "DELETE";
  status: "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  detail: string | null;
  result: { collected?: Record<string, number>; excluded?: string[]; deletedRows?: number } | null;
  createdAt: string;
  handledAt: string | null;
}

export function fetchPrivacyNotice() {
  return visitorApi<PrivacyNotice>("/visitor/privacy");
}

export function updateConsents(consents: Record<string, boolean>) {
  return visitorApi<{ consents: Record<string, boolean>; purged: Record<string, number> }>(
    "/visitor/privacy/consents",
    json("PATCH", { consents }),
  );
}

export function fetchPrivacyRequests() {
  return visitorApi<PrivacyRequest[]>("/visitor/privacy/requests");
}

export function createPrivacyRequest(requestType: "ACCESS" | "DELETE", detail?: string) {
  return visitorApi<PrivacyRequest & { excluded: string[] }>(
    "/visitor/privacy/requests",
    json("POST", { requestType, detail }),
  );
}
