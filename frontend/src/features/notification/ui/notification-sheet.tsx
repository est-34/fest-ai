"use client";

import { useVisibleAnnouncements, useCalledBookings, announcementEntries } from "../model/use-notices";

import { useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, Check, Info, Megaphone, Pin } from "lucide-react";
import { announcementText, isEmergency } from "@/features/notification/api/notifications";
import { useAutoTranslate, useTranslation } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { iconTileClass, iconTileLabelClass } from "@/shared/ui/icon-tile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

export function NotificationSheet() {
  const { t, locale, bcp47 } = useTranslation();
  const notices = useVisibleAnnouncements();
  const calls = useCalledBookings();
  const [readIds, setReadIds] = useState<string[]>([]);
  // 긴급 공지를 맨 위에 고정하고, 자동 해제 시각이 지난 공지는 목록에서 뺀다.
  const noticeList = notices.visible;
  const notificationIds = [...(calls.data ?? []).map((item) => item.id), ...noticeList.map((item) => item.id)];
  const unreadCount = notificationIds.filter((id) => !readIds.includes(id)).length;
  const markRead = (id: string) => setReadIds((current) => current.includes(id) ? current : [...current, id]);

  // 운영자가 작성한 공지·예약 정보는 사전에 없으므로 요청 시점에 자동 번역한다.
  const { translated: callText } = useAutoTranslate(
    Object.fromEntries((calls.data ?? []).flatMap((call) => [
      [`${call.id}.program`, call.programTitle],
      [`${call.id}.area`, call.areaName],
    ])),
    locale,
  );
  const { translated: noticeText } = useAutoTranslate(
    {
      ...announcementEntries(noticeList),
      ...(notices.data?.channel ? { "channel.limitation": notices.data.channel.limitation } : {}),
    },
    locale,
  );

  return <Sheet onOpenChange={(open) => { if (open) setReadIds(notificationIds); }}>
    <SheetTrigger render={<Button variant="ghost" className={cn("relative", iconTileClass)} aria-label={t.notification.ariaLabel(unreadCount)} />}>
      <Bell className="size-5" />{unreadCount > 0 && <span className="absolute right-3 top-1 size-1.5 rounded-full bg-destructive" />}
      <span className={iconTileLabelClass}>{t.notification.shortLabel}</span>
    </SheetTrigger>
    <SheetContent side="bottom" className="mx-auto max-h-[78dvh] max-w-md rounded-t-3xl">
      <SheetHeader className="border-b border-border pb-3"><div className="flex items-center justify-between gap-3 pr-9"><div><SheetTitle className="text-lg font-bold">{t.notification.sheetTitle}</SheetTitle><SheetDescription className="mt-1 text-xs">{t.notification.sheetDescription}</SheetDescription></div>{unreadCount > 0 && <Button variant="ghost" size="sm" onClick={() => setReadIds(notificationIds)}><Check className="size-3.5" />{t.notification.markAllRead}</Button>}</div></SheetHeader>
      <div className="overflow-y-auto px-4 pb-6">
        <section className="pt-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">{t.notification.reservationCallTitle}</h3><Link href="/visitor/reservation" className="text-xs font-semibold text-primary">{t.notification.reservationCallLink}</Link></div>
          {calls.data?.length ? <div className="space-y-2">{calls.data.map((call) => <Link key={call.id} href="/visitor/reservation" onClick={() => markRead(call.id)} className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3"><span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"><CalendarClock className="size-4" /></span><span><span className="text-sm font-bold">{call.queueNumber ? t.notification.ticketCall(call.queueNumber) : t.notification.fallbackTicketLabel}</span><span className="mt-1 block text-xs text-muted-foreground">{callText[`${call.id}.program`] ?? call.programTitle} · {callText[`${call.id}.area`] ?? call.areaName}</span>{call.calledAt && <span className="mt-1.5 block text-[0.6875rem] font-medium text-primary">{new Date(call.calledAt).toLocaleString(bcp47)}</span>}</span></Link>)}</div> : <div className="flex items-center gap-3 rounded-2xl border border-dashed p-4 text-xs text-muted-foreground"><Info className="size-4" />{t.notification.emptyReservationCalls}</div>}
        </section>
        <section className="pt-5"><h3 className="mb-2 text-sm font-bold">{t.notification.noticesTitle}</h3><div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">
          {noticeList.map((notice) => <button key={notice.id} type="button" onClick={() => markRead(notice.id)} className={cn("flex w-full items-start gap-3 p-3 text-left hover:bg-muted/60", isEmergency(notice) && "border-l-4 border-destructive bg-destructive/5")}><span className={`grid size-9 shrink-0 place-items-center rounded-full ${notice.severity === "INFO" ? "bg-secondary" : "bg-destructive/10 text-destructive"}`}><Megaphone className="size-4" /></span><span>{isEmergency(notice) && <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[0.625rem] font-bold text-white"><Pin className="size-2.5" />{t.notification.pinnedBadge}</span>}<span className="block text-sm font-semibold">{noticeText[`${notice.id}.title`] ?? notice.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{noticeText[`${notice.id}.body`] ?? announcementText(notice.body)}</span><span className="mt-1 block text-[0.6875rem] text-muted-foreground">{t.common.lastUpdated(new Date(notice.updatedAt).toLocaleString(bcp47))}</span>{notice.endsAt && <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">{t.notification.autoCloseAt(new Date(notice.endsAt).toLocaleString(bcp47))}</span>}</span></button>)}
          {!notices.isLoading && !noticeList.length && <p className="p-4 text-xs text-muted-foreground">{t.notification.emptyNotices}</p>}
        </div>
        {notices.data?.channel && <p className="mt-2 rounded-xl bg-muted/60 p-3 text-[0.6875rem] leading-5 text-muted-foreground">{noticeText["channel.limitation"] ?? notices.data.channel.limitation}</p>}
        </section>
      </div>
    </SheetContent>
  </Sheet>;
}
