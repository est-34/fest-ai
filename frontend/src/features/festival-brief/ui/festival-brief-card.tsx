"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, RefreshCw, Search, Sparkles } from "lucide-react";
import { fetchFestivalBrief, type FestivalBrief } from "@/features/festival-brief/api/festival-brief";
import { Button } from "@/shared/ui/button";
import { seoulDateTime } from "@/shared/lib/utils";
import { useWrite } from "@/shared/lib/use-write";

const QUERY_KEY = ["festival-ai-brief"] as const;

export function FestivalBriefCard({ initialBrief = null }: { initialBrief?: FestivalBrief | null }) {
  const queryClient = useQueryClient();
  const { data, error, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchFestivalBrief,
    initialData: initialBrief ?? undefined,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const regenerate = useWrite(fetchFestivalBrief, {
    onSuccess: (brief) => {
      queryClient.setQueryData<FestivalBrief>(QUERY_KEY, brief);
    },
  });

  const sources = data?.sources ?? [];
  const generatedAt = data?.generatedAt ? new Date(data.generatedAt) : null;
  const generatedAtLabel =
    generatedAt && !Number.isNaN(generatedAt.getTime()) ? seoulDateTime(generatedAt) : null;
  const activeError = regenerate.error ?? error;
  const isInitialLoading = isLoading && !data;
  const isRegenerating = regenerate.isPending;
  const statusLabel = data
    ? isRegenerating
      ? "재생성 중"
      : isFetching
        ? "확인 중"
        : "저장됨"
    : isError || regenerate.isError
      ? "생성 실패"
      : "조회 중";

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-secondary p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-primary">
            <span className="grid size-8 place-items-center rounded-full bg-primary/10">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">운영 위험 한줄 브리핑</h2>
              <p className="text-[0.625rem] text-muted-foreground">혼잡·민원·인력·일정 신호를 합산해 우선 조치가 필요한 내용을 요약</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-border bg-background px-4 py-3 text-foreground">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <p className="text-xs font-extrabold text-primary">{data?.alanComment ? "Alan 한줄평" : "규칙 기반 요약"}</p>
              <span className="rounded-full bg-muted px-2 py-1 text-[0.625rem] font-bold text-muted-foreground">
                {statusLabel}
              </span>
            </div>

            {data?.metricLabel && (
              <div className="flex w-fit items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                <AlertTriangle className="size-4" />
                <div>
                  <p className="text-[0.625rem] font-semibold">{data.metricLabel}</p>
                  <p className="text-lg font-extrabold">{data.metricValue}</p>
                </div>
              </div>
            )}

            {/* 급증 경보는 evidence에 묻히면 안 되는 신호라 서버가 alerts로 따로 뽑아 준다. */}
            {(data?.alerts.length ?? 0) > 0 && (
              <ul className="space-y-1 rounded-xl border border-red-300 bg-red-50 px-3 py-2" role="alert">
                {data?.alerts.map((alert) => (
                  <li key={alert} className="flex items-start gap-1.5 text-xs font-semibold leading-5 text-red-800">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    {alert}
                  </li>
                ))}
              </ul>
            )}

            {data ? (
              <div className="space-y-2">
                <blockquote className="text-sm font-semibold leading-6 text-foreground">“{data.alanComment ?? data.summary}”</blockquote>
                {data.recommendedActions.length > 0 && (
                  <ul className="space-y-1 border-t border-border pt-2">
                    {data.recommendedActions.map((action) => (
                      <li key={action} className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                        {action}
                      </li>
                    ))}
                  </ul>
                )}
                {isRegenerating && (
                  <p className="inline-flex items-center gap-1.5 text-[0.625rem] font-medium text-muted-foreground">
                    <RefreshCw className="size-3 animate-spin" />
                    새 한줄평을 만들고 있어요. 기존 저장값은 그대로 유지돼요.
                  </p>
                )}
              </div>
            ) : isError || regenerate.isError ? (
              <div className="flex items-start gap-3 text-red-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-6">아직 표시할 위험 브리핑이 없습니다.</p>
                  <p className="mt-1 text-xs font-medium leading-5 text-red-700">
                    운영 위험 신호를 불러오지 못했어요. 축제 접근 권한과 백엔드 상태를 확인해 주세요.
                  </p>
                  {activeError instanceof Error && <p className="mt-2 text-[0.625rem] text-red-600">{activeError.message}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-foreground">
                <RefreshCw className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-6">
                    {isInitialLoading ? "운영 위험 브리핑을 불러오는 중이에요." : "위험 브리핑을 확인하는 중이에요."}
                  </p>
                  <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
                    수집된 혼잡·민원·인력·일정 신호를 기준으로 요약해요.
                  </p>
                </div>
              </div>
            )}
          </div>

          {data && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Search className="size-3" />
                근거 {sources.length}개
              </span>
              {generatedAtLabel && (
                <>
                  <span>·</span>
                  <span>{generatedAtLabel} 기준</span>
                </>
              )}
              {sources.map((source) => (
                <span key={source} className="rounded-full bg-background/70 px-2 py-1">
                  {source}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching || isRegenerating}>
            <RefreshCw className={isFetching && !isRegenerating ? "animate-spin" : ""} />
            {isFetching && !isRegenerating ? "확인 중" : "다시 확인"}
          </Button>
          <Button size="sm" onClick={() => regenerate.mutate()} disabled={isFetching || isRegenerating}>
            <Sparkles className={isRegenerating ? "animate-pulse" : ""} />
            {isRegenerating ? "생성 중" : "새로 생성"}
          </Button>
        </div>
      </div>
    </section>
  );
}
