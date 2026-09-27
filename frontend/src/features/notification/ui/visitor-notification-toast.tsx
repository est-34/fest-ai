"use client";

import { useVisibleAnnouncements, useCalledBookings } from "../model/use-notices";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Megaphone } from "lucide-react";
import { announcementText } from "@/features/notification/api/notifications";
import { useAutoTranslate, useTranslation } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

type ToastItem =
  | {
      id: string;
      kind: "call";
      queueNumber: number | null;
      programTitle: string;
      areaName: string;
    }
  | {
      id: string;
      kind: "notice";
      title: string;
      body: string;
      severity: "INFO" | "WARNING" | "EMERGENCY";
    };

/** 새 공지·예약 호출을 알림 시트와 함께 상단에서 잠깐 알려준다. */
export function VisitorNotificationToast() {
  const { t, locale } = useTranslation();
  const notices = useVisibleAnnouncements();
  const calls = useCalledBookings();
  const noticeList = notices.visible;
  const currentItems = useMemo<ToastItem[]>(() => [
    ...(calls.data ?? []).map((call) => ({
      id: `call:${call.id}`,
      kind: "call" as const,
      queueNumber: call.queueNumber,
      programTitle: call.programTitle,
      areaName: call.areaName,
    })),
    ...noticeList.map((notice) => ({
      id: `notice:${notice.id}`,
      kind: "notice" as const,
      title: notice.title,
      body: announcementText(notice.body),
      severity: notice.severity,
    })),
  ], [calls.data, noticeList]);

  const translated = useAutoTranslate(
    Object.fromEntries(currentItems.flatMap((item) =>
      item.kind === "call"
        ? [[`${item.id}.program`, item.programTitle], [`${item.id}.area`, item.areaName]]
        : [[`${item.id}.title`, item.title], [`${item.id}.body`, item.body]],
    )),
    locale,
  ).translated;

  const initialized = useRef(false);
  const seenIds = useRef(new Set<string>());
  const queue = useRef<ToastItem[]>([]);
  const [active, setActive] = useState<ToastItem | null>(null);

  useEffect(() => {
    if (!notices.isSuccess || !calls.isSuccess) return;
    const incoming = currentItems.filter((item) => !seenIds.current.has(item.id));
    currentItems.forEach((item) => seenIds.current.add(item.id));
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (incoming.length) queue.current.push(...incoming);
  }, [calls.isSuccess, currentItems, notices.isSuccess]);

  useEffect(() => {
    if (!active && queue.current.length) setActive(queue.current.shift() ?? null);
  }, [active, currentItems]);

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => setActive(null), 5_200);
    return () => window.clearTimeout(timeout);
  }, [active]);

  if (!active) return null;

  const notice = active.kind === "notice";
  const title = notice
    ? translated[`${active.id}.title`] ?? active.title
    : active.queueNumber
      ? t.notification.ticketCall(active.queueNumber)
      : t.notification.fallbackTicketLabel;
  const detail = notice
    ? translated[`${active.id}.body`] ?? active.body
    : `${translated[`${active.id}.program`] ?? active.programTitle} · ${translated[`${active.id}.area`] ?? active.areaName}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl animate-visitor-notification-toast",
          notice && active.severity === "EMERGENCY"
            ? "border-red-200 bg-red-50 text-red-900"
            : "border-primary/20 bg-card text-foreground",
        )}
      >
        <span className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          notice && active.severity === "EMERGENCY" ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary",
        )}>
          {notice ? (active.severity === "EMERGENCY" ? <AlertTriangle className="size-4" /> : <Megaphone className="size-4" />) : <CalendarClock className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-muted-foreground">
            {notice ? (active.severity === "EMERGENCY" ? t.notification.emergencyBadge : t.notification.noticesTitle) : t.notification.reservationCallTitle}
          </p>
          <p className="mt-0.5 truncate text-sm font-bold">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
}
