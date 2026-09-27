import { FESTIVAL_CODE, festivalApi, festivalApiAll, idempotent, json, publicApi, visitorApi } from "@/shared/lib/api";
import { readJson, writeJson } from "@/shared/lib/local-store";
import type { BookingAction } from "@/shared/lib/booking-policy";

export interface VisitorBooking {
  id: string;
  status: "CONFIRMED" | "WAITING" | "CALLED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  partySize: number;
  queueNumber: number | null;
  calledAt: string | null;
  startsAt: string;
  endsAt: string;
  programTitle: string;
  programSlug: string;
  areaName: string;
}

export interface BookableSession {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  status: string;
  areaName: string;
}

interface PublicProgram {
  title: string;
  slug: string;
  sessions: Array<{ id: string; startsAt: string; endsAt: string; capacity: number | null; status: string; area?: { name?: string } }>;
}

export function fetchVisitorBookings() { return visitorApi<VisitorBooking[]>("/visitor/bookings"); }

export async function fetchBookableSessions(): Promise<BookableSession[]> {
  const programs = await publicApi<PublicProgram[]>(`/public/festivals/${FESTIVAL_CODE}/programs`);
  return programs.flatMap((program) => program.sessions
    .filter((session) => session.status === "OPEN")
    .map((session) => ({
      id: session.id, title: program.title, slug: program.slug, startsAt: session.startsAt,
      endsAt: session.endsAt, capacity: session.capacity, status: session.status, areaName: session.area?.name ?? "장소 미정",
    })));
}

/** 서버는 1~20명을 받지만 현장 대기열 운영상 한 번에 6명까지만 고르게 한다. */
export const MAX_PARTY_SIZE = 6;

// phone은 서버 스펙에 없다 — 예약자 구분용 목업 값이라 호출부가 성공 후 로컬에만 저장한다.
export function createBooking({ sessionId, partySize = 1 }: { sessionId: string; partySize?: number; phone?: string }) {
  return visitorApi<VisitorBooking>(`/visitor/program-sessions/${sessionId}/bookings`, idempotent("POST", { partySize }));
}

const RESERVATION_PHONE_STORAGE_KEY = "festai-reservation-phones";

export function readReservationPhones() {
  return readJson<Record<string, string>>(RESERVATION_PHONE_STORAGE_KEY, {});
}

export function saveReservationPhone(bookingId: string, phone: string) {
  writeJson(RESERVATION_PHONE_STORAGE_KEY, { ...readReservationPhones(), [bookingId]: phone });
}

export function cancelBooking(bookingId: string) {
  return visitorApi<void>(`/visitor/bookings/${bookingId}`, { method: "DELETE" });
}

export interface AdminBooking {
  id: string;
  status: VisitorBooking["status"];
  partySize: number;
  queueNumber: number | null;
  calledAt: string | null;
  startsAt: string;
  programTitle: string;
}

export function fetchAdminBookings(status?: VisitorBooking["status"]) {
  // 서버가 100건에서 자르고 커서를 준다 — 화면이 상태 탭을 클라이언트에서 거르므로 끝까지 모은다.
  return festivalApiAll<AdminBooking>(`/bookings${status ? `?status=${status}` : ""}`);
}

// 상태 전이 규칙은 shared/lib/booking-policy가 서버와 같은 표로 들고 있다.
export type { BookingAction } from "@/shared/lib/booking-policy";

const ACTION_NOTE: Record<BookingAction, string> = {
  CALLED: "FESTAI 운영 화면에서 호출",
  NO_SHOW: "호출 후 미방문 처리",
  COMPLETED: "이용 완료 처리",
};

// note를 주면 감사 로그에 그대로 남는다(예: "호출 후 15분 경과, 현장 미도착").
export function updateBookingStatus({ bookingId, status, note }: { bookingId: string; status: BookingAction; note?: string }) {
  return festivalApi(`/bookings/${bookingId}/status`, json("POST", { status, note: note ?? ACTION_NOTE[status] }));
}

// 대기(WAITING) 예약만 호출할 수 있다 — 확정(CONFIRMED) 예약은 자리가 이미 보장돼 호출 대상이 아니다.
export function callBooking(bookingId: string) {
  return updateBookingStatus({ bookingId, status: "CALLED" });
}
