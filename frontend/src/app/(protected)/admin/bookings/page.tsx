"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BellRing, Phone, UserCheck, UserX } from "lucide-react";
import {
  fetchAdminBookings,
  readReservationPhones,
  updateBookingStatus,
  type BookingAction,
  type AdminBooking,
  type VisitorBooking,
} from "@/entities/booking";
import {
  BOOKING_CANCEL_DEADLINE_MINUTES,
  BOOKING_NO_SHOW_GRACE_MINUTES,
  BOOKING_STATUS_LABEL,
  bookingActionsFor,
  isNoShowDue,
} from "@/shared/lib/booking-policy";
import { useNow } from "@/shared/lib/use-now";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { QueryState } from "@/shared/ui/query-state";
import { includesKeyword, useListView } from "@/shared/lib/use-list-view";
import { useWrite } from "@/shared/lib/use-write";
import { ListSearch, ShowMore } from "@/shared/ui/list-search";
import { SkeletonList } from "@/shared/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { seoulMoment } from "@/shared/lib/utils";

type StatusFilter = "전체" | VisitorBooking["status"];

const FILTERS: StatusFilter[] = ["전체", "WAITING", "CALLED", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"];

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-primary/10 text-primary",
  WAITING: "bg-amber-100 text-amber-700",
  CALLED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  NO_SHOW: "bg-red-100 text-red-700",
};

export default function AdminBookingsPage() {
  const [filter, setFilter] = useState<StatusFilter>("전체");
  // 호출 후 유예 시간이 지난 예약을 계속 다시 계산해야 노쇼 처리 대상이 제때 드러난다.
  const now = useNow(30_000);

  const bookings = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => fetchAdminBookings(),
    refetchInterval: 15_000,
  });

  const mutate = useWrite(updateBookingStatus, { invalidates: ["admin-bookings"] });

  const byStatus = (bookings.data ?? []).filter((booking) => filter === "전체" || booking.status === filter);
  // 전화번호는 서버 스펙에 없는 목업 값이라 방문객 브라우저의 로컬 저장소에서만 조회된다.
  const phones = readReservationPhones();
  const list = useListView(byStatus, (booking, keyword) =>
    includesKeyword(keyword, booking.programTitle, booking.queueNumber?.toString()),
  );
  const rows = list.filtered;

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    (bookings.data ?? []).forEach((booking) => map.set(booking.status, (map.get(booking.status) ?? 0) + 1));
    return map;
  }, [bookings.data]);

  const overdue = (bookings.data ?? []).filter(
    (booking) => booking.status === "CALLED" && isNoShowDue(booking.calledAt, now));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        방문객 예약과 대기 번호를 호출하고, 입장·노쇼를 현장에서 바로 처리해요.
      </p>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-foreground">예약 취소 · 노쇼 정책</h2>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>· 방문객은 시작 {BOOKING_CANCEL_DEADLINE_MINUTES}분 전까지 직접 취소할 수 있어요. 이후 취소는 현장에서 처리해요.</li>
          <li>· 호출 후 {BOOKING_NO_SHOW_GRACE_MINUTES}분이 지나면 노쇼 처리 대상이며, 아래 목록에 따로 표시돼요.</li>
          <li>· 노쇼로 처리하면 대기 순서가 사라지고 방문객 화면에도 같은 문구로 안내돼요.</li>
        </ul>
      </section>

      {overdue.length > 0 && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900"
        >
          <AlertTriangle className="size-4 shrink-0" />
          호출 후 {BOOKING_NO_SHOW_GRACE_MINUTES}분이 지난 예약이 {overdue.length}건 있어요. 입장 여부를 확인해 주세요.
        </div>
      )}

      <Tabs value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
        <TabsList className="flex-wrap">
          {FILTERS.map((value) => (
            <TabsTrigger key={value} value={value} className="gap-1.5">
              {BOOKING_STATUS_LABEL[value] ?? value}
              {value !== "전체" && (
                <span className="text-[0.625rem] text-muted-foreground">{counts.get(value) ?? 0}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ListSearch
        value={list.query}
        onChange={list.setQuery}
        placeholder="프로그램·대기번호로 검색"
        count={rows.length}
      />

      <QueryState
        query={bookings}
        empty="해당 상태의 예약이 없어요."
        emptyWhen={rows.length === 0}
        skeleton={<SkeletonList count={4} className="h-16 w-full rounded-2xl" />}
      >
        {() => (
          <div className="space-y-2">
            {list.visible.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                phone={phones[booking.id]}
                noShowDue={booking.status === "CALLED" && isNoShowDue(booking.calledAt, now)}
                pending={mutate.isPending}
                onUpdate={(status, note) => mutate.mutate({ bookingId: booking.id, status, note })}
              />
            ))}
            <ShowMore hidden={list.hidden} onShowMore={list.showMore} />
          </div>
        )}
      </QueryState>

      {mutate.error && <p className="text-xs text-destructive" role="alert">{mutate.error.message}</p>}
    </div>
  );
}

function BookingRow({
  booking,
  phone,
  noShowDue,
  pending,
  onUpdate,
}: {
  booking: AdminBooking;
  phone?: string;
  noShowDue: boolean;
  pending: boolean;
  onUpdate: (status: BookingAction, note: string) => void;
}) {
  return (
    <article
      className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${
        noShowDue ? "border-amber-300 bg-amber-50/60" : "border-border bg-card"
      }`}
    >
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${STATUS_STYLE[booking.status]}`}>
        {BOOKING_STATUS_LABEL[booking.status] ?? booking.status}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {booking.queueNumber ? `${booking.queueNumber}번 · ` : ""}{booking.programTitle}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {seoulMoment(booking.startsAt)} · {booking.partySize}명
          {booking.calledAt && ` · ${seoulMoment(booking.calledAt)} 호출`}
        </p>
        {phone && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="size-3" /> {phone}
          </p>
        )}
      </div>

      {/* 어떤 상태에서 어떤 조치가 가능한지는 서버 규칙과 같은 표(booking-policy)를 따른다. */}
      <div className="flex shrink-0 flex-wrap gap-2">
        {bookingActionsFor(booking.status).includes("CALLED") && (
          <Button size="sm" disabled={pending} onClick={() => onUpdate("CALLED", "FESTAI 운영 화면에서 호출")}>
            <BellRing className="size-3.5" /> 호출
          </Button>
        )}
        {bookingActionsFor(booking.status).includes("COMPLETED") && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onUpdate("COMPLETED", "현장 입장 확인")}>
            <UserCheck className="size-3.5" /> 입장 완료
          </Button>
        )}
        {bookingActionsFor(booking.status).includes("NO_SHOW") && (
          <ConfirmButton
            size="sm"
            variant="destructive"
            disabled={pending}
            title="노쇼로 처리할까요?"
            description={`${booking.programTitle} 예약을 노쇼로 처리하면 대기 순서가 사라져요.`}
            confirmLabel="노쇼 처리"
            onConfirm={() => onUpdate("NO_SHOW", `호출 후 ${BOOKING_NO_SHOW_GRACE_MINUTES}분 경과, 현장 미도착`)}
          >
            <UserX className="size-3.5" /> 노쇼
          </ConfirmButton>
        )}
      </div>
    </article>
  );
}
