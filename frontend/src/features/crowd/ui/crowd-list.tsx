"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { CROWD_LABEL, CROWD_TONE, fetchPublicCrowd } from "@/features/crowd/api/crowd";
import { StatusPill } from "@/shared/ui/status-pill";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState, ErrorState } from "@/shared/ui/query-state";
import { useTranslation } from "@/shared/lib/i18n";

export function CrowdList({ limit }: { limit?: number }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-crowd", locale],
    queryFn: () => fetchPublicCrowd(locale),
    // 혼잡도는 현장 상황이라 오래 캐시하면 의미가 없다.
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // 통신 실패를 "등록된 혼잡도 없음"으로 보여주면 방문객은 축제에 정보가 없는 줄로 안다.
  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (isError || !data) return <ErrorState message={t.common.loadFailed} retryLabel={t.common.retry} onRetry={() => refetch()} />;
  if (data.length === 0) return <EmptyState message={t.crowd.empty} />;

  return (
    <div className="space-y-2">
      {(limit ? data.slice(0, limit) : data).map((row) => (
        <div key={row.areaId} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{row.areaName}</p>
            <p className="text-[0.6875rem] text-muted-foreground">
              {row.estimatedWaitMin !== null ? t.crowd.waitMinutes(row.estimatedWaitMin) : t.crowd.noWait}
              {row.stale && ` · ${t.crowd.stale}`}
            </p>
          </div>
          <StatusPill tone={row.stale ? "muted" : CROWD_TONE[row.crowdLevel]} className="shrink-0 px-2.5 py-1 text-[0.6875rem]">
            {t.crowd.level[row.crowdLevel] ?? CROWD_LABEL[row.crowdLevel]}
          </StatusPill>
        </div>
      ))}
      <p className="flex items-center justify-center gap-1 text-[0.625rem] text-muted-foreground">
        <Activity className="size-3" /> {t.crowd.notice}
      </p>
    </div>
  );
}
