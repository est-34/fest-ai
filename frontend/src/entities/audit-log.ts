import { festivalApiPaged } from "@/shared/lib/api";

export interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogRow {
  id: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  createdAt: string;
}

function normalize(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    action: row.action,
    resourceType: row.resourceType ?? null,
    resourceId: row.resourceId ?? null,
    actorId: row.actorId ?? null,
    actorName: row.actorName ?? null,
    actorEmail: row.actorEmail ?? null,
    beforeData: row.beforeData ?? null,
    afterData: row.afterData ?? null,
    createdAt: row.createdAt,
  };
}

export interface AuditLogFilter {
  action?: string;
  resourceType?: string;
}

/** 한 번에 받아올 수 있는 최대 건수. 그 너머는 nextCursor로 이어서 받는다. */
export const AUDIT_LOG_MAX_LIMIT = 100;

export interface AuditLogPage {
  entries: AuditLogEntry[];
  nextCursor: string | null;
  hasNext: boolean;
}

/**
 * 커서 페이지네이션. 예전에는 백엔드가 nextCursor를 항상 null로 내려줘서 100건이 천장이었다.
 * cursor는 서버가 만든 불투명한 값이라 클라이언트가 해석하지 않는다.
 */
export async function fetchAuditLogs(filter: AuditLogFilter = {}, limit = 50, cursor?: string): Promise<AuditLogPage> {
  const params = new URLSearchParams({ limit: String(Math.min(limit, AUDIT_LOG_MAX_LIMIT)) });
  if (filter.action) params.set("action", filter.action);
  if (filter.resourceType) params.set("resourceType", filter.resourceType);
  if (cursor) params.set("cursor", cursor);
  const { data, page } = await festivalApiPaged<AuditLogRow[]>(`/audit-logs?${params.toString()}`);
  return { entries: data.map(normalize), nextCursor: page?.nextCursor ?? null, hasNext: Boolean(page?.hasNext) };
}
