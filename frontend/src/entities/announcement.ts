import { festivalApi, json } from "@/shared/lib/api";

export type AnnouncementSeverity = "INFO" | "WARNING" | "EMERGENCY";
// EXPIRED는 DB 컬럼이 아니라 목록 응답의 effective_status에서만 내려온다.
export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "CLOSED" | "EXPIRED";

export interface Announcement {
  id: string;
  title: string;
  severity: AnnouncementSeverity;
  audience: string[];
  targetAreaIds: string[];
  startsAt: string;
  endsAt: string | null;
  status: AnnouncementStatus;
  version: number;
}

export const SEVERITY_OPTIONS: { value: AnnouncementSeverity; label: string }[] = [
  { value: "INFO", label: "일반" },
  { value: "WARNING", label: "주의" },
  { value: "EMERGENCY", label: "긴급" },
];

export const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  DRAFT: "초안",
  SCHEDULED: "노출 예정",
  ACTIVE: "노출 중",
  CLOSED: "종료됨",
  EXPIRED: "자동 해제됨",
};

// 종료 API는 노출 중이거나 예정인 공지만 받는다.
export function canClose(status: AnnouncementStatus) {
  return status === "ACTIVE" || status === "SCHEDULED";
}

// 발행 전 입력 검증. 서버도 같은 규칙으로 400을 내지만, 여기서 막아야 6단계 중간에
// 실패해서 초안 공지가 남는 일이 없다. 통과하면 null.
export function validatePublishInput(input: {
  title: string;
  audience: string[];
  startsAt: string;
  endsAt: string;
}) {
  if (!input.title.trim()) return "공지 내용을 입력해 주세요.";
  if (input.audience.length === 0) return "노출 대상을 1개 이상 선택해 주세요.";
  if (!input.startsAt) return "노출 시작 시각을 입력해 주세요.";
  if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    return "자동 해제 시각은 노출 시작 이후여야 해요.";
  }
  return null;
}

// 방문객 공개 목록은 audience에 "VISITOR"가 있는 공지만 내려주므로 "ALL" 같은 값은 무의미하다.
export const AUDIENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "VISITOR", label: "방문객" },
  { value: "MERCHANT", label: "입점업체" },
  { value: "STAFF", label: "운영진" },
];

interface AnnouncementRow {
  id: string;
  title: string;
  severity?: AnnouncementSeverity;
  audience?: string[];
  targetAreaIds?: string[];
  startsAt?: string;
  endsAt?: string | null;
  status?: AnnouncementStatus;
  effectiveStatus?: AnnouncementStatus;
  version: number;
}

function normalize(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity ?? "INFO",
    audience: row.audience ?? [],
    targetAreaIds: row.targetAreaIds ?? [],
    startsAt: row.startsAt ?? "",
    endsAt: row.endsAt ?? null,
    status: row.effectiveStatus ?? row.status ?? "DRAFT",
    version: row.version,
  };
}

export async function fetchAnnouncements() {
  const rows = await festivalApi<AnnouncementRow[]>(`/announcements`);
  return rows.map(normalize).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

// 방문객 공개 목록은 features/notification/api/notifications.ts가 이미 조회한다.
// 구역 목록은 entities/area.ts의 fetchAreas를 쓴다(같은 /areas, 같은 쿼리 키).

export interface PublishAnnouncementInput {
  title: string;
  body?: string;
  severity: AnnouncementSeverity;
  audience: string[];
  targetAreaIds: string[];
  startsAt: string;
  endsAt?: string;
}

/**
 * 공지 발행.
 *
 * 예전에는 공지 생성 → 콘텐츠 항목 → 버전 → 검수 제출 → 승인 → 발행을 여기서 6번 나눠
 * 호출했다. 중간 단계가 실패하면 방문객에게 보이지 않는 DRAFT 공지와 콘텐츠 항목이 남고
 * 지울 방법도 없었다. 서버가 한 트랜잭션으로 처리하는 엔드포인트 하나로 바꾼다.
 */
export function publishAnnouncement(input: PublishAnnouncementInput) {
  return festivalApi(`/announcements/publish`, json("POST", {
    title: input.title,
    body: input.body?.trim() || input.title,
    severity: input.severity,
    audience: input.audience,
    targetAreaIds: input.targetAreaIds,
    startsAt: input.startsAt,
    endsAt: input.endsAt || null,
  }));
}

export function closeAnnouncement(id: string) {
  return festivalApi(`/announcements/${id}/close`, { method: "POST" });
}
