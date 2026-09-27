"use client";

import { useQuery } from "@tanstack/react-query";
import { Flag, ShieldCheck } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { QueryState } from "@/shared/ui/query-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { seoulDateTime } from "@/shared/lib/utils";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { aiReviewsQuery, decideAiReview } from "../api/ai-reviews";

const DECISIONS = [
  { decision: "ANSWER_VALID", label: "정상 답변", variant: "outline" },
  { decision: "CONTENT_FIX_REQUIRED", label: "콘텐츠 보완", variant: "outline" },
  { decision: "SAFETY_POLICY_UPDATE", label: "차단 규칙 보완", variant: "destructive" },
] as const;

/** 방문객이 신고한 AI 답변 검수 큐. */
export function AiReviewQueue() {
  const reviewsQuery = useQuery(aiReviewsQuery);
  const reviews = reviewsQuery.data ?? [];
  const decide = useWrite(decideAiReview, {
    success: "검수 결과를 반영했어요.", invalidates: [aiReviewsQuery.queryKey],
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <div>
            <h2 className="text-sm font-bold text-foreground">AI 답변 안전 검토 큐</h2>
            <p className="text-xs text-muted-foreground">방문객이 신고한 답변을 원문과 함께 검토해요.</p>
          </div>
        </div>
        <Badge variant={reviews.length > 0 ? "destructive" : "secondary"}>{reviews.length}건 대기</Badge>
      </div>

      <QueryState
        query={reviewsQuery}
        empty="검토 대기 중인 AI 답변이 없습니다."
        skeleton={<Skeleton className="h-28 w-full rounded-xl" />}
      >
        {() => (
          <div className="space-y-3">
            {reviews.map((review) => (
              <article key={review.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center gap-2 text-[0.625rem] text-muted-foreground">
                  <Badge variant="destructive" className="gap-1"><Flag className="size-3" /> 사용자 신고</Badge>
                  <span>{review.safetyStatus}</span>
                  {review.modelVersion && <span>모델 {review.modelVersion}</span>}
                  <span>{seoulDateTime(review.createdAt)}</span>
                </div>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">질문</p>
                <p className="mt-1 text-sm text-foreground">{review.question}</p>
                <p className="mt-3 text-xs font-semibold text-muted-foreground">AI 답변</p>
                <p className="mt-1 whitespace-pre-line rounded-lg bg-muted/60 p-3 text-sm text-foreground">{review.answer}</p>
                <p className="mt-2 text-xs text-muted-foreground">신고 사유: {review.detail || review.reason}</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  {DECISIONS.map(({ decision, label, variant }) => (
                    <Button
                      key={decision}
                      size="sm"
                      variant={variant}
                      disabled={isPendingFor(decide, review.id)}
                      onClick={() => decide.mutate({ id: review.id, decision })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </QueryState>
      {decide.error && <p className="mt-3 text-sm text-destructive">{decide.error.message}</p>}
    </section>
  );
}
