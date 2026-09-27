"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleX, FileCheck2, Send, Undo2, Upload } from "lucide-react";
import { isPendingFor, useWrite } from "@/shared/lib/use-write";
import { festivalApi, json } from "@/shared/lib/api";
import { Badge } from "@/shared/ui/badge";
import { StatusPill, type Tone } from "@/shared/ui/status-pill";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { QueryState } from "@/shared/ui/query-state";
import { SkeletonList } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";
import { contentAction, contentPreview, type ContentVersionStatus } from "@/features/content-review/model/content";

interface ContentReview {
  reviewerId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string;
  decidedAt: string;
}

interface ContentVersion {
  id: string;
  versionNo: number;
  language: string;
  body: Record<string, unknown>;
  changeNote?: string;
  status: ContentVersionStatus;
  createdAt: string;
  reviews: ContentReview[];
}

interface ContentItem {
  id: string;
  contentType: string;
  slug: string;
  lifecycleStatus: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  publishedVersionId?: string;
  versions: ContentVersion[];
}

const STATUS = {
  DRAFT: { label: "초안", tone: "neutral" },
  IN_REVIEW: { label: "검수 중", tone: "warning" },
  APPROVED: { label: "승인", tone: "success" },
  REJECTED: { label: "반려", tone: "danger" },
} as const satisfies Record<string, { label: string; tone: Tone }>;

function fetchContentItems() {
  return festivalApi<ContentItem[]>(`/content-items`);
}

function changeContentState(input: {
  action: "SUBMIT" | "APPROVE" | "REJECT" | "PUBLISH" | "UNPUBLISH";
  itemId: string;
  versionId: string;
  comment?: string;
}) {
  if (input.action === "SUBMIT") {
    return festivalApi(`/content-versions/${input.versionId}/submit`, { method: "POST" });
  }
  if (input.action === "APPROVE" || input.action === "REJECT") {
    return festivalApi(`/content-versions/${input.versionId}/reviews`, json("POST", { decision: input.action === "APPROVE" ? "APPROVED" : "REJECTED", comment: input.comment || undefined }));
  }
  if (input.action === "PUBLISH") {
    return festivalApi(`/content-items/${input.itemId}/publish`, json("POST", { versionId: input.versionId }));
  }
  return festivalApi(`/content-items/${input.itemId}/unpublish`, { method: "POST" });
}

export default function ContentReviewPage() {
  const [comments, setComments] = useState<Record<string, string>>({});
  const items = useQuery({ queryKey: ["content-review"], queryFn: fetchContentItems });
  const data = items.data ?? [];
  const mutation = useWrite(changeContentState, {
    success: "콘텐츠 상태를 변경했어요.", invalidates: ["content-review"],
  });

  const versions = data.flatMap((item) => item.versions.map((version) => ({ item, version })));
  const reviewCount = versions.filter(({ version }) => version.status === "IN_REVIEW").length;
  const publishedCount = data.filter((item) => item.lifecycleStatus === "PUBLISHED").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">콘텐츠 버전을 검수하고 승인된 버전만 방문객 채널에 게시해요.</p>
          <p className="mt-1 text-xs text-muted-foreground">검수 대기 {reviewCount}건 · 게시 중 {publishedCount}건</p>
        </div>
        <Badge variant="outline" className="gap-1.5"><FileCheck2 className="size-3.5" /> 승인·게시 이력 추적</Badge>
      </div>

      <QueryState
        query={items}
        empty="등록된 콘텐츠 버전이 없습니다."
        emptyWhen={versions.length === 0}
        skeleton={<SkeletonList count={3} className="h-48 rounded-2xl" wrapperClassName="space-y-3" />}
      >
        {() => (
          <div className="space-y-3">
          {versions.map(({ item, version }) => {
            const isPublished = item.lifecycleStatus === "PUBLISHED" && item.publishedVersionId === version.id;
            const action = contentAction(version.status, isPublished);
            const status = STATUS[version.status];
            return (
              <article key={version.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold text-foreground">{contentPreview(version.body)}</h2>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      {isPublished && <Badge className="gap-1 text-[0.625rem]"><Upload className="size-3" /> 게시 중</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.contentType} · {item.slug} · v{version.versionNo} · {version.language.toUpperCase()}
                    </p>
                    {version.changeNote && <p className="mt-2 text-sm text-foreground/80">변경 메모: {version.changeNote}</p>}
                    {version.reviews.length > 0 && (
                      <div className="mt-3 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                        최근 검수: {version.reviews.at(-1)?.decision === "APPROVED" ? "승인" : "반려"}
                        {version.reviews.at(-1)?.comment ? ` · ${version.reviews.at(-1)?.comment}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="w-full shrink-0 space-y-2 lg:w-80">
                    {action === "REVIEW" && (
                      <Textarea
                        value={comments[version.id] ?? ""}
                        onChange={(event) => setComments((current) => ({ ...current, [version.id]: event.target.value }))}
                        placeholder="검수 의견(선택)"
                        aria-label={`${contentPreview(version.body)} 검수 의견`}
                      />
                    )}
                    <div className="flex justify-end gap-2">
                      {action === "SUBMIT" && (
                        <Button onClick={() => mutation.mutate({ action: "SUBMIT", itemId: item.id, versionId: version.id })} disabled={isPendingFor(mutation, version.id)}>
                          <Send /> 검수 요청
                        </Button>
                      )}
                      {action === "REVIEW" && <>
                        <Button variant="destructive" onClick={() => mutation.mutate({ action: "REJECT", itemId: item.id, versionId: version.id, comment: comments[version.id] })} disabled={isPendingFor(mutation, version.id)}>
                          <CircleX /> 반려
                        </Button>
                        <Button onClick={() => mutation.mutate({ action: "APPROVE", itemId: item.id, versionId: version.id, comment: comments[version.id] })} disabled={isPendingFor(mutation, version.id)}>
                          <Check /> 승인
                        </Button>
                      </>}
                      {action === "PUBLISH" && (
                        <ConfirmButton
                          disabled={isPendingFor(mutation, version.id)}
                          title="방문객에게 게시할까요?"
                          description={`"${contentPreview(version.body)}"이(가) 방문객 화면에 즉시 노출돼요.`}
                          confirmLabel="게시"
                          onConfirm={() => mutation.mutate({ action: "PUBLISH", itemId: item.id, versionId: version.id })}
                        >
                          <Upload /> 게시
                        </ConfirmButton>
                      )}
                      {action === "UNPUBLISH" && (
                        <ConfirmButton
                          variant="outline"
                          disabled={isPendingFor(mutation, version.id)}
                          title="게시를 종료할까요?"
                          description={`"${contentPreview(version.body)}"이(가) 방문객 화면에서 즉시 내려갑니다.`}
                          confirmLabel="게시 종료"
                          onConfirm={() => mutation.mutate({ action: "UNPUBLISH", itemId: item.id, versionId: version.id })}
                        >
                          <Undo2 /> 게시 종료
                        </ConfirmButton>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
