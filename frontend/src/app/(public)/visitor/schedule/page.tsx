"use client";

import { usePublicFestivalLoader } from "@/shared/lib/use-public-festival";

import { useQuery } from "@tanstack/react-query";
import { fetchFestivalInfo, fetchSchedule } from "@/entities/festival";
import { useTranslation } from "@/shared/lib/i18n";
import { Badge } from "@/shared/ui/badge";
import { LastUpdated } from "@/shared/ui/last-updated";
import { QueryState } from "@/shared/ui/query-state";
import { SkeletonList } from "@/shared/ui/skeleton";
import { TONE } from "@/shared/ui/status-pill";
import { VisitorPageTitle } from "@/widgets/visitor-nav/visitor-page-title";

const CATEGORY_STYLE: Record<string, string> = {
  공연: TONE.accent,
  체험: TONE.success,
  전시: TONE.plain,
  푸드: TONE.warning,
  행사: TONE.neutral,
};

export default function SchedulePage() {
  const loadFestival = usePublicFestivalLoader();
  const { t, locale, bcp47 } = useTranslation();
  const scheduleQuery = useQuery({
    queryKey: ["schedule", locale] as const,
    queryFn: () => fetchSchedule(locale),
  });
  const schedule = scheduleQuery.data;
  // 일정 API는 갱신 시각을 내려주지 않아, 같은 축제의 updated_at을 기준 시각으로 쓴다.
  const { data: festival } = useQuery({
    queryKey: ["festival-info", locale] as const,
    queryFn: () => fetchFestivalInfo(locale, loadFestival),
  });

  const grouped = (schedule ?? []).reduce<Record<string, typeof schedule>>(
    (acc, item) => {
      acc[item.day] = [...(acc[item.day] ?? []), item];
      return acc;
    },
    {},
  );

  return (
    <>
      <VisitorPageTitle>{t.schedule.title}</VisitorPageTitle>
      <div className="px-4 pt-0 pb-6">
        <p className="text-xs text-muted-foreground">{t.schedule.subtitle}</p>
        <LastUpdated
          value={festival?.updatedAt}
          bcp47={bcp47}
          label={t.common.lastUpdated}
          className="mt-1 text-muted-foreground"
        />

        <QueryState
          query={scheduleQuery}
          className="mt-4"
          skeleton={
            <SkeletonList
              count={3}
              className="h-14 w-full rounded-xl"
              wrapperClassName="mt-4 space-y-2.5"
            />
          }
          errorMessage={t.common.loadFailed}
          retryLabel={t.common.retry}
          empty={t.common.empty}
        >
          {() => (
            <div className="mt-4 space-y-5">
              {Object.entries(grouped).map(([day, items]) => (
                <div key={day}>
                  <h2 className="mb-2 text-sm font-bold text-primary">{day}</h2>
                  <div className="space-y-2">
                    {items!.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                      >
                        <span className="w-12 shrink-0 text-sm font-bold text-foreground">
                          {item.time}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.stage}
                          </p>
                        </div>
                        <Badge
                          className={`shrink-0 text-[0.625rem] ${CATEGORY_STYLE[item.category]}`}
                        >
                          {t.festivalData.category[item.category]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryState>
      </div>
    </>
  );
}
