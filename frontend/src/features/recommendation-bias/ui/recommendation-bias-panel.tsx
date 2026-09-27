"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Scale } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { queryErrorMessage } from "@/shared/ui/query-state";
import { Meter } from "@/shared/ui/meter";
import { cn } from "@/shared/lib/utils";
import { recommendationBiasQuery } from "../api/recommendation-bias";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

interface ExposureRow {
  key: string;
  label: string;
  share: number;
  exceeded: boolean;
}

function ExposureList({ title, items, threshold }: { title: string; items: ExposureRow[]; threshold: number }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <Badge variant="outline" className="text-[0.625rem]">기준 {percent(threshold)}</Badge>
      </div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">최근 집계할 추천 노출이 없습니다.</p>
        ) : (
          items.slice(0, 5).map((item) => (
            <div key={`${title}-${item.key}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-foreground">{item.label}</span>
                <span className={cn("tabular-nums", item.exceeded ? "font-bold text-red-600" : "text-muted-foreground")}>
                  {percent(item.share)}
                </span>
              </div>
              <Meter percent={item.share * 100} tone={item.exceeded ? "danger" : "primary"} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** 업체 추천이 특정 업체·업종에 쏠렸는지 점검한다(BIZ-03). */
export function RecommendationBiasPanel() {
  const query = useQuery(recommendationBiasQuery);
  const report = query.data;
  const exceeded = report?.status === "WARNING";

  const businessRows = (report?.businessExposures ?? []).map((row) => ({
    key: row.businessId,
    label: row.name,
    share: row.exposureShare,
    exceeded: row.isOverThreshold,
  }));
  const categoryRows = (report?.categoryExposures ?? []).map((row) => ({
    key: row.category,
    label: row.category,
    share: row.exposureShare,
    exceeded: row.isOverThreshold,
  }));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-foreground">추천 편향 점검</h2>
            <p className="text-xs text-muted-foreground">
              {report?.summary ?? "추천 이벤트를 모으면 편향 점검 결과가 표시돼요."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <Badge variant={exceeded ? "destructive" : "secondary"}>
              {exceeded ? "기준 초과" : report.status === "PASS" ? "정상 범위" : "데이터 부족"}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn("size-3.5", query.isFetching && "animate-spin")} />
            즉시 점검
          </Button>
        </div>
      </div>

      {query.isError ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          추천 편향 API에 연결할 수 없습니다. {queryErrorMessage(query.error)}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">점검 구간</p>
            <p className="mt-1 text-lg font-bold text-foreground">최근 {report?.windowDays ?? 7}일</p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">노출 이력 보존 기간 내</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">수집 이벤트</p>
            <p className="mt-1 text-lg font-bold text-foreground">{report?.checkedEventCount ?? 0}건</p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">방문객 추천 요청 수</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">전체 노출</p>
            <p className="mt-1 text-lg font-bold text-foreground">{report?.totalExposures ?? 0}회</p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">
              업체 {percent(report?.thresholds.maxBusinessExposureShare ?? 0.6)} / 업종 {percent(report?.thresholds.maxCategoryExposureShare ?? 0.75)}
            </p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">광고 노출</p>
            <p className="mt-1 text-lg font-bold text-foreground">{report?.sponsoredExposures ?? 0}회</p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">일반 추천과 분리 집계</p>
          </div>
        </div>
      )}

      {report && (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <ExposureList title="업체별 노출" items={businessRows} threshold={report.thresholds.maxBusinessExposureShare} />
            <ExposureList title="업종별 노출" items={categoryRows} threshold={report.thresholds.maxCategoryExposureShare} />
          </div>
          <ul className="mt-3 space-y-1">
            {report.recommendedActions.map((action) => (
              <li key={action} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                {action}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
