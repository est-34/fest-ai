"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVisitorBookings } from "@/entities/booking";
import { useNow } from "@/shared/lib/use-now";
import { fetchAnnouncementFeed, visibleAnnouncements, announcementText, type PublicAnnouncement } from "../api/notifications";

export function useVisibleAnnouncements() {
  const query = useQuery({ queryKey: ["public-announcements"], queryFn: fetchAnnouncementFeed, refetchInterval: 30_000 });
  const now = useNow(30_000);
  const visible = useMemo(() => visibleAnnouncements(query.data?.items, now), [query.data?.items, now]);
  return { ...query, visible };
}

export function useCalledBookings() {
  return useQuery({
    queryKey: ["visitor-bookings"],
    queryFn: fetchVisitorBookings,
    select: (rows) => rows.filter((booking) => booking.status === "CALLED"),
    refetchInterval: 10_000,
  });
}

export function announcementEntries(notices: PublicAnnouncement[]) {
  return Object.fromEntries(notices.flatMap((notice) => [
    [`${notice.id}.title`, notice.title],
    [`${notice.id}.body`, announcementText(notice.body)],
  ]));
}
