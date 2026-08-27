import { festivalApi, json } from "@/shared/lib/api";

export const DOCUMENT_ROLES = ["SUPER_ADMIN", "FESTIVAL_MANAGER", "FIELD_OPERATOR", "REVIEWER", "MERCHANT"] as const;

export interface NewInternalDocument {
  title: string;
  documentType: string;
  body: string;
  sourceUrl?: string;
  allowedRoles: string[];
}

export interface InternalDocument {
  id: string;
  title: string;
  documentType: string;
  sourceUrl: string | null;
  allowedRoles: string[];
  status: string;
  /** 등록 응답은 created_at, 목록은 updated_at을 준다. */
  createdAt?: string;
  updatedAt?: string;
}

export function createInternalDocument(input: NewInternalDocument) {
  return festivalApi<InternalDocument>(`/internal-documents`, json("POST", input));
}

/** 본인 역할이 열람할 수 있는 문서만 내려온다 — 검색과 같은 기준. */
export function fetchInternalDocuments() {
  return festivalApi<InternalDocument[]>(`/internal-documents`);
}

export type InternalDocumentPatch = Partial<NewInternalDocument>;

/** 등록만 되고 고칠 수 없어서 오타 하나도 수정하지 못하던 것을 메운다. */
export function updateInternalDocument(id: string, input: InternalDocumentPatch) {
  return festivalApi<InternalDocument>(`/internal-documents/${id}`, json("PATCH", input));
}

/** 감사 대상 문서라 실제로 지우지 않고 보관 처리한다(목록·검색에서 빠진다). */
export function archiveInternalDocument(id: string) {
  return festivalApi<void>(`/internal-documents/${id}`, { method: "DELETE" });
}

export interface OperationsSearchResult {
  answer: string;
  sources: Array<{ documentId: string; title: string; sourceUrl: string | null }>;
}

/** 권한 범위의 운영 문서만 검색하고, 결과 본문은 서버에서 개인정보가 마스킹된다. */
export function searchOperations(question: string) {
  return festivalApi<OperationsSearchResult>(`/ai/operations/search`, json("POST", { question }));
}
