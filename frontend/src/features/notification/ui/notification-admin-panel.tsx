"use client";

import { useQuery } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { fetchAdminBookings } from "@/entities/booking";
import { canClose, fetchAnnouncements } from "@/entities/announcement";
import { EmptyState } from "@/shared/ui/query-state";
import { seoulMoment } from "@/shared/lib/utils";
import { AnnouncementPublishForm } from "./announcement-publish-form";
import { BookingCallPanel } from "./booking-call-panel";
import { RecentAnnouncements } from "./recent-announcements";

export function NotificationAdminPanel() {
  const bookings = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: () => fetchAdminBookings(),
    refetchInterval: 15_000,
  });
  const announcements = useQuery({ queryKey: ["announcements"], queryFn: fetchAnnouncements });
  const calledBookings = (bookings.data ?? []).filter((booking) => booking.status === "CALLED");
  const liveCount =
    (announcements.data ?? []).filter((item) => canClose(item.status)).length + calledBookings.length;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="size-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">방문객 알림 관리</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            발행한 공지는 지정한 대상·구역·시간에만 노출되고, 긴급 공지는 상단에 고정돼요.
          </p>
        </div>
        <span className="text-xs font-medium text-muted-foreground">현재 {liveCount}건</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnnouncementPublishForm />
        <BookingCallPanel query={bookings} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RecentAnnouncements query={announcements} />
        <div>
          <h3 className="mb-2 text-xs font-bold text-muted-foreground">최근 예약 호출</h3>
          <div className="space-y-2">
            {calledBookings.length === 0 && <EmptyState message="호출한 예약이 없어요." />}
            {calledBookings.slice(0, 4).map((booking) => (
              <div key={booking.id} className="rounded-xl border border-border p-3">
                <p className="truncate text-sm font-semibold">
                  {booking.queueNumber ? `${booking.queueNumber}번 · ` : ""}
                  {booking.programTitle}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {booking.calledAt ? `${seoulMoment(booking.calledAt)} 호출` : "호출됨"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
