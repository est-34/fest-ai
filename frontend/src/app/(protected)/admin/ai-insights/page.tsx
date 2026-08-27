"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import { issueAnalysisQuery } from "@/entities/issue-analysis";
import { IssueAnalysisPanel } from "@/features/complaint-insight/ui/issue-analysis-panel";
import { aiReviewsQuery } from "@/features/content-review/api/ai-reviews";
import { AiReviewQueue } from "@/features/content-review/ui/ai-review-queue";
import { recommendationBiasQuery } from "@/features/recommendation-bias/api/recommendation-bias";
import { RecommendationBiasPanel } from "@/features/recommendation-bias/ui/recommendation-bias-panel";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/utils";

type Tab = "safety" | "issues" | "bias";

export default function AiInsightsPage() {
  const [tab, setTab] = useState<Tab>("safety");
  // 배지에만 쓰는 조회다. 패널이 같은 키로 다시 부르므로 요청이 늘지는 않는다.
  const { data: reviews = [] } = useQuery(aiReviewsQuery);
  const { data: bias } = useQuery(recommendationBiasQuery);
  const issues = useQuery(issueAnalysisQuery);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Sparkles className="size-4 text-primary" />
            AI 민원·추천 인사이트
          </p>
          <p className="mt-1 text-xs text-muted-foreground">백엔드 민원 분류 결과와 업체 추천 노출 편향을 함께 점검해요.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => issues.refetch()} disabled={issues.isFetching}>
          <RefreshCw className={cn("size-3.5", issues.isFetching && "animate-spin")} />
          {issues.isFetching ? "불러오는 중..." : "새로고침"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="safety" className="gap-1.5">
            안전 검수
            {reviews.length > 0 && <Badge variant="destructive" className="text-[0.625rem]">{reviews.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="issues">민원 분석</TabsTrigger>
          <TabsTrigger value="bias" className="gap-1.5">
            추천 편향
            {bias?.status === "WARNING" && <Badge variant="destructive" className="text-[0.625rem]">초과</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* hidden으로 감춘다 — 탭을 오갈 때마다 조회와 입력 중인 분류 수정이 날아가지 않도록. */}
      <div hidden={tab !== "safety"}><AiReviewQueue /></div>
      <div hidden={tab !== "issues"}><IssueAnalysisPanel /></div>
      <div hidden={tab !== "bias"}><RecommendationBiasPanel /></div>
    </div>
  );
}
