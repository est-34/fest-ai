import type { Tone } from "@/shared/ui/status-pill";
import { currentAdmin, festivalApi, json, festivalApiAll } from "@/shared/lib/api";
import { TOPIC_LABEL, type IssueAnalysisRow } from "@/entities/issue-analysis";
import { seoulDateTime } from "@/shared/lib/utils";

// 백엔드 ops_tickets.ticket_type은 COMPLAINT/INCIDENT 둘뿐이다. 공지는 announcements가 따로 관리한다.
export type TicketType = "민원" | "사고";
export type TicketStatus = "접수" | "배정됨" | "처리중" | "해결됨" | "완료";
export type TicketApiStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketPriority = "긴급" | "높음" | "중간" | "낮음";

export const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  긴급: "critical",
  높음: "danger",
  중간: "warning",
  낮음: "neutral",
};

export interface Ticket {
  id: string;
  type: TicketType;
  title: string;
  description: string;
  assignee: string;
  status: TicketStatus;
  apiStatus: TicketApiStatus;
  version?: number;
  priority: TicketPriority;
  category: string;
  createdAt: string;
  aiTag?: string;
  urgent?: boolean;
}

export interface NewTicket {
  ticketType: "COMPLAINT" | "INCIDENT";
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
  areaId?: string;
}

export interface TicketEvent {
  id: string;
  fromStatus: TicketApiStatus | null;
  toStatus: TicketApiStatus;
  note: string | null;
  createdAt: string;
}

const NEXT_STATUS: Partial<Record<TicketApiStatus, TicketApiStatus>> = {
  OPEN: "ASSIGNED", ASSIGNED: "IN_PROGRESS", IN_PROGRESS: "RESOLVED", RESOLVED: "CLOSED",
};

export function nextTicketStatus(status: TicketApiStatus) {
  return NEXT_STATUS[status];
}

/** 버튼에는 현재 상태가 아니라 누르면 무슨 일이 벌어지는지를 쓴다. */
export const TICKET_ACTION_LABEL: Record<TicketApiStatus, string> = {
  OPEN: "내게 배정",
  ASSIGNED: "처리 시작",
  IN_PROGRESS: "해결 처리",
  RESOLVED: "완료 처리",
  CLOSED: "완료됨",
};

interface TicketRow {
  id: string; ticketType: string; title: string; description: string; assigneeId?: string;
  status: TicketApiStatus; priority: string; areaId?: string; createdAt: string; version: number;
}

const STATUS_LABEL = { OPEN: "접수", ASSIGNED: "배정됨", IN_PROGRESS: "처리중", RESOLVED: "해결됨", CLOSED: "완료" } as const;
const PRIORITY_LABEL = { LOW: "낮음", NORMAL: "중간", HIGH: "높음", EMERGENCY: "긴급" } as const;

export async function fetchTickets() {
  // 분류는 백엔드 issue-analysis가 담당한다(담당자 수정본 포함). 티켓 목록과 함께 읽어 붙인다.
  const [rows, analysis] = await Promise.all([
    // 서버가 100건에서 자르고 커서를 준다 — 화면이 상태별로 나눠 보여주므로 끝까지 모은다.
    festivalApiAll<TicketRow>(`/ops-tickets`),
    festivalApi<IssueAnalysisRow[]>(`/issue-analysis`).catch(() => [] as IssueAnalysisRow[]),
  ]);
  const byTicket = new Map(analysis.map((row) => [row.id, row.analysis]));
  return rows.map<Ticket>((row) => {
    const found = byTicket.get(row.id);
    return {
      id: row.id,
      type: row.ticketType === "INCIDENT" ? "사고" : "민원",
      title: row.title,
      description: row.description,
      assignee: row.assigneeId ? "배정 완료" : "미배정",
      status: STATUS_LABEL[row.status],
      apiStatus: row.status,
      version: row.version,
      priority: PRIORITY_LABEL[row.priority as keyof typeof PRIORITY_LABEL] ?? "중간",
      category: found ? TOPIC_LABEL[found.topic] ?? found.topic : "미분류",
      createdAt: seoulDateTime(row.createdAt),
      aiTag: found ? `${found.humanReviewed ? "담당자 확인" : "자동 분류"} · ${TOPIC_LABEL[found.topic] ?? found.topic}` : undefined,
      urgent: found?.urgent ?? row.priority === "EMERGENCY",
    };
  });
}

export function createTicket(input: NewTicket) {
  return festivalApi(`/ops-tickets`, json("POST", input));
}

export function fetchTicketEvents(ticketId: string) {
  return festivalApi<TicketEvent[]>(`/ops-tickets/${ticketId}/events`);
}

export function assignTicket({ ticket, assigneeId }: { ticket: Ticket; assigneeId: string }) {
  if (ticket.version === undefined) throw new Error("최신 티켓 정보를 다시 불러와 주세요.");
  return festivalApi(`/ops-tickets/${ticket.id}`, json("PATCH", { assigneeId, version: ticket.version }));
}

export async function transitionTicket(ticket: Ticket) {
  // 접수 상태의 첫 진행은 "내게 배정"이라 상태 변경 전에 담당자부터 붙인다.
  const assigning = ticket.apiStatus === "OPEN";
  if (assigning) {
    const admin = await currentAdmin();
    await assignTicket({ ticket, assigneeId: admin.id });
  }
  const toStatus = nextTicketStatus(ticket.apiStatus);
  if (!toStatus) throw new Error("더 진행할 상태가 없습니다.");
  const note = `FESTAI 운영 화면에서 ${assigning ? "담당자 배정" : "상태 변경"}`;
  return festivalApi(`/ops-tickets/${ticket.id}/transitions`, json("POST", { toStatus, note, attachments: [] }));
}
