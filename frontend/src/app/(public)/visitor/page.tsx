"use client";

import { usePublicFestivalLoader } from "@/shared/lib/use-public-festival";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  RefreshCw,
  Sparkles,
  Store,
  Stamp,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { fetchFestivalInfo, fetchSchedule } from "@/entities/festival";
import { CrowdList } from "@/features/crowd/ui/crowd-list";
import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { useVisitorMenus, type VisitorMenuKey } from "@/features/visitor-menu-settings";
import { useTranslation, type Dictionary } from "@/shared/lib/i18n";
import { Badge } from "@/shared/ui/badge";
import { LastUpdated } from "@/shared/ui/last-updated";
import { EmptyState, ErrorState } from "@/shared/ui/query-state";
import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";

const QUICK_MENU: {
  href: string;
  labelKey: keyof Dictionary["home"]["quickMenu"];
  icon: typeof CalendarDays;
  kiosk: boolean;
  menuKey?: VisitorMenuKey;
}[] = [
  {
    href: "/visitor/schedule",
    labelKey: "schedule",
    icon: CalendarDays,
    kiosk: true,
  },
  {
    href: "/visitor/stamp-tour",
    labelKey: "stampTour",
    icon: Stamp,
    kiosk: false,
    menuKey: "stampTour",
  },
  {
    href: "/visitor/nearby",
    labelKey: "nearby",
    icon: Store,
    kiosk: true,
    menuKey: "nearby",
  },
  {
    href: "/visitor/coupons/plogging",
    labelKey: "plogging",
    icon: Trash2,
    kiosk: false,
    menuKey: "coupons",
  },
];

function getGreeting(t: Dictionary) {
  const hour = new Date().getHours();
  if (hour < 11) return t.home.greetingMorning;
  if (hour < 17) return t.home.greetingAfternoon;
  return t.home.greetingEvening;
}

export default function VisitorHomePage() {
  const loadFestival = usePublicFestivalLoader();
  const { t, locale, bcp47 } = useTranslation();
  const visitorMode = useAccessibilityStore((state) => state.visitorMode);
  const menuSettings = useVisitorMenus();
  // 하단 탭·히어로 CTA 메뉴는 QUICK_MENU에 중복해 넣지 않는다.
  const quickMenu = QUICK_MENU.filter(
    (item) =>
      (visitorMode === "qr" || item.kiosk) &&
      (!item.menuKey || menuSettings[item.menuKey]),
  );
  const festivalQuery = useQuery({
    queryKey: ["festival-info", locale] as const,
    queryFn: () => fetchFestivalInfo(locale, loadFestival),
  });
  const scheduleQuery = useQuery({
    queryKey: ["schedule", locale] as const,
    queryFn: () => fetchSchedule(locale),
  });
  const festival = festivalQuery.data;
  const schedule = scheduleQuery.data;

  const today = new Date().toLocaleDateString(bcp47, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  // schedule 항목의 day는 Asia/Seoul 기준 "월/일 (요일)" 포맷이라 같은 옵션으로 맞춰야 오늘 일정이 걸러진다.
  const todayKey = new Date().toLocaleDateString(bcp47, {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  const todaySchedule = schedule?.filter((item) => item.day === todayKey);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{today}</p>
        <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-foreground">
          {getGreeting(t)}
          {t.home.greetingSuffix} 👋
        </h1>
      </div>

      <div className="bg-brand-gradient-ink overflow-hidden rounded-2xl p-5 text-primary-foreground">
        {/* 값이 없을 때 배지에 " ~ "만 남아 깨져 보이던 자리 — 도착 전에는 자리표시자를 둔다. */}
        {!festival ? (
          <div className="space-y-2" aria-busy={festivalQuery.isLoading}>
            <Skeleton className="h-5 w-28 rounded-full bg-white/25" />
            <Skeleton className="h-6 w-48 rounded-md bg-white/25" />
            <Skeleton className="h-4 w-32 rounded-md bg-white/20" />
            {!festivalQuery.isLoading && (
              <button
                type="button"
                onClick={() => festivalQuery.refetch()}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <RefreshCw className="size-3.5" /> {t.common.loadFailed} ·{" "}
                {t.common.retry}
              </button>
            )}
          </div>
        ) : (
          <>
            <Badge className="bg-white/15 text-white hover:bg-white/15">
              {festival.period.start.slice(5).replace("-", "/")} ~{" "}
              {festival.period.end.slice(5).replace("-", "/")}
            </Badge>
            <h2 className="mt-2 text-lg font-bold leading-snug">
              {festival.name}
            </h2>
            <p className="mt-1 text-xs text-primary-foreground/75">
              {festival.location}
            </p>
            <LastUpdated
              value={festival.updatedAt}
              bcp47={bcp47}
              label={t.common.lastUpdated}
              className="w-full mt-1.5 text-primary-foreground/75"
            />
          </>
        )}
        <Link
          href="/visitor/ai-guide"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background px-3.5 py-1.5 text-xs font-bold text-primary"
        >
          <Sparkles className="size-3.5" /> {t.home.aiCta}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {quickMenu.map(({ href, labelKey, icon: Icon }) => {
          // 스탬프 투어는 ESG 적립 기능 — 나머지 일반 기능과 색으로 갈라 둔다.
          const esg =
            href === "/visitor/stamp-tour" ||
            href === "/visitor/coupons/plogging";
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card py-3.5 text-center"
            >
              <span
                className={
                  esg
                    ? "inline-flex size-10 items-center justify-center rounded-full bg-esg/12 text-esg-tint"
                    : "inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary"
                }
              >
                <Icon className="size-5" />
              </span>
              <span className="text-[0.8rem] font-semibold text-foreground">
                {t.home.quickMenu[labelKey]}
              </span>
            </Link>
          );
        })}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">
            {t.home.congestionTitle}
          </h3>
          <Link
            href="/visitor/map"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary"
          >
            {t.home.mapLink} <ArrowRight className="size-3" />
          </Link>
        </div>
        <CrowdList limit={3} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">
            {t.home.todayProgramTitle}
          </h3>
          <Link
            href="/visitor/schedule"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary"
          >
            {t.home.scheduleLink} <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {/* 끝내 목록을 받지 못한 경우를 빈 목록으로 읽으면 장애가 "행사 없음"이 된다. */}
          {!schedule ? (
            scheduleQuery.isLoading ? (
              <SkeletonList count={2} className="h-14 w-full rounded-xl" />
            ) : (
              <ErrorState
                message={t.common.loadFailed}
                retryLabel={t.common.retry}
                onRetry={() => scheduleQuery.refetch()}
              />
            )
          ) : (todaySchedule ?? []).length === 0 ? (
            <EmptyState message={t.common.empty} />
          ) : null}
          {(todaySchedule ?? []).slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex w-14 shrink-0 flex-col items-center">
                <span className="text-sm font-bold text-primary">
                  {item.time}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">{item.stage}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[0.625rem]">
                {item.category}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
