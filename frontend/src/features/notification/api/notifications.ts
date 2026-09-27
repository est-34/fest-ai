import { visitorApi } from "@/shared/lib/api";
import type { VisitorArea } from "@/entities/area";

export interface PublicAnnouncement {
  id: string;
  title: string;
  severity: "INFO" | "WARNING" | "EMERGENCY";
  body: { text?: string; content?: string } | string;
  startsAt: string;
  // 운영자가 지정한 자동 해제 시각. 지정하지 않으면 내려오지 않거나 null이다.
  endsAt?: string | null;
  updatedAt: string;
}

/** OPS-10 웹 폴링 채널 안내. 화면을 열어 둔 동안에만 도달한다는 한계를 서버가 함께 내려준다. */
export interface NoticeChannel {
  type: string;
  pollSeconds: number;
  limitation: string;
}

export interface VisitorNoticeFeed {
  items: PublicAnnouncement[];
  area: VisitorArea;
  channel: NoticeChannel;
}

/**
 * 방문 세션으로 공지를 받는다.
 *
 * 공개 목록(`/public/.../announcements`)은 세션이 없어 구역을 알 수 없으므로 구역 대상
 * 공지를 걸러낼 수 없고, 도달 결과도 남지 않는다. 세션 경로를 쓰면 VIS-12 구역 판정으로
 * 대상 공지가 선별되고 노출 사실이 OPS-10 전달 이력에 기록된다.
 */
export function fetchAnnouncementFeed() {
  return visitorApi<VisitorNoticeFeed>("/visitor/announcements");
}

export function announcementText(body: PublicAnnouncement["body"]) {
  if (typeof body === "string") return body;
  return body.text ?? body.content ?? "자세한 내용은 운영 안내를 확인해 주세요.";
}

const SEVERITY_RANK: Record<PublicAnnouncement["severity"], number> = {
  EMERGENCY: 0,
  WARNING: 1,
  INFO: 2,
};

export function isEmergency(announcement: PublicAnnouncement) {
  return announcement.severity === "EMERGENCY";
}

function withinWindow(announcement: PublicAnnouncement, now: number) {
  const startsAt = new Date(announcement.startsAt).getTime();
  if (Number.isFinite(startsAt) && startsAt > now) return false;
  if (!announcement.endsAt) return true;
  const endsAt = new Date(announcement.endsAt).getTime();
  return !Number.isFinite(endsAt) || endsAt > now;
}

/**
 * 방문객에게 실제로 보여줄 공지만 남기고 순서를 정한다.
 * - 노출 시작 전이거나 자동 해제 시각이 지난 공지는 서버 응답에 남아 있어도 화면에서 뺀다.
 * - 긴급 > 주의 > 일반 순으로 고정해서, API가 내려준 순서와 무관하게 긴급 공지가 항상 맨 위에 온다.
 */
export function visibleAnnouncements(list: PublicAnnouncement[] | undefined, now: number) {
  return (list ?? [])
    .filter((announcement) => withinWindow(announcement, now))
    .sort((a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.updatedAt.localeCompare(a.updatedAt));
}
