"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ListChecks, Sparkles, TrendingUp, UserCheck } from "lucide-react";
import { PRIORITY_TONE } from "@/entities/ticket";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { SelectField } from "@/shared/ui/select-field";
import { useWrite } from "@/shared/lib/use-write";
import { Skeleton } from "@/shared/ui/skeleton";
import { StatusPill } from "@/shared/ui/status-pill";
import { Meter } from "@/shared/ui/meter";
import {
  ISSUE_SENTIMENTS,
  ISSUE_TOPICS,
  issueAnalysisQuery,
  overrideIssueAnalysis,
  SENTIMENT_LABEL,
  TOPIC_LABEL,
  type IssueAnalysisRow,
  type IssueSentiment,
  type IssueTopic,
} from "@/entities/issue-analysis";
import {
  buildImprovementTasks,
  buildRecurringIssues,
  buildTopicBreakdown,
} from "../api/issue-analysis";

const PAGE_SIZE = 20;

const TOPIC_OPTIONS = ISSUE_TOPICS.map((value) => ({ value, label: TOPIC_LABEL[value] }));
const SENTIMENT_OPTIONS = ISSUE_SENTIMENTS.map((value) => ({ value, label: SENTIMENT_LABEL[value] }));

function OverrideRow({ row, onSave, saving }: {
  row: IssueAnalysisRow;
  onSave: (value: { topic: IssueTopic; sentiment: IssueSentiment; urgent: boolean }) => void;
  saving: boolean;
}) {
  const [topic, setTopic] = useState<IssueTopic>(row.analysis.topic);
  const [sentiment, setSentiment] = useState<IssueSentiment>(row.analysis.sentiment);
  const [urgent, setUrgent] = useState(row.analysis.urgent);
  const dirty = topic !== row.analysis.topic || sentiment !== row.analysis.sentiment || urgent !== row.analysis.urgent;

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="mr-auto min-w-0 truncate text-sm font-semibold text-foreground">{row.title}</p>
        {row.analysis.humanReviewed ? (
          <Badge variant="secondary" className="gap-1 text-[0.625rem]"><UserCheck className="size-3" /> 담당자 수정</Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-[0.625rem]"><Sparkles className="size-3" /> 자동 분류</Badge>
        )}
        {row.analysis.urgent && <Badge variant="destructive" className="text-[0.625rem]">긴급</Badge>}
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.description}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <SelectField
          value={topic}
          onValueChange={(value) => setTopic(value as IssueTopic)}
          options={TOPIC_OPTIONS}
          size="sm"
          className="w-32"
          aria-label="분류"
        />
        <SelectField
          value={sentiment}
          onValueChange={(value) => setSentiment(value as IssueSentiment)}
          options={SENTIMENT_OPTIONS}
          size="sm"
          className="w-24"
          aria-label="감성"
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="size-3.5 accent-red-600" />
          긴급
        </label>
        <Button size="sm" variant="outline" className="ml-auto" disabled={!dirty || saving} onClick={() => onSave({ topic, sentiment, urgent })}>
          분류 저장
        </Button>
      </div>
    </div>
  );
}

/** 민원·사고 티켓 자동 분류 결과와 담당자 수정. */
export function IssueAnalysisPanel() {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const issues = useQuery(issueAnalysisQuery);
  const override = useWrite(overrideIssueAnalysis, {
    success: "분류를 수정했어요.", invalidates: [issueAnalysisQuery.queryKey],
  });

  const rows = useMemo(() => issues.data ?? [], [issues.data]);
  const breakdown = useMemo(() => buildTopicBreakdown(rows), [rows]);
  const recurring = useMemo(() => buildRecurringIssues(rows), [rows]);
  const improvementTasks = useMemo(() => buildImprovementTasks(rows), [rows]);
  const maxCount = Math.max(...breakdown.map((entry) => entry.count), 1);

  if (issues.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (issues.isError) {
    return <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{issues.error.message}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-1.5">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">주제별 접수 현황</h2>
        </div>
        {breakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">분석할 민원·사고 티켓이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((entry) => (
              <div key={entry.topic}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{entry.label}</span>
                  <span className="text-muted-foreground">{entry.count}건{entry.urgent > 0 && ` · 긴급 ${entry.urgent}`}</span>
                </div>
                <Meter percent={(entry.count / maxCount) * 100} tone={entry.urgent > 0 ? "danger" : "primary"} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-1.5">
          <AlertTriangle className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">반복 이슈</h2>
        </div>
        {recurring.length === 0 ? (
          <p className="text-xs text-muted-foreground">현재 반복되는 이슈가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {recurring.map((issue) => (
              <div key={issue.topic} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{issue.label}</p>
                  <Badge variant="secondary" className="text-[0.625rem]">{issue.count}건 반복</Badge>
                </div>
                <ul className="mt-1.5 list-inside list-disc text-xs text-muted-foreground">
                  {/* 같은 제목의 티켓이 여러 건이라 제목은 키가 되지 못한다. */}
                  {issue.examples.map((example, index) => <li key={index}>{example}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <div className="mb-3 flex items-center gap-1.5">
          <ListChecks className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">권장 개선 과제</h2>
          <span className="text-[0.6875rem] text-muted-foreground">미해결 티켓 분류 기준</span>
        </div>
        {improvementTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">미해결 민원·사고가 없어 제안할 과제가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {improvementTasks.map((task) => (
              <div key={task.title} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{task.title}</p>
                  <StatusPill tone={PRIORITY_TONE[task.priority]} className="shrink-0">
                    {task.priority}
                  </StatusPill>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{task.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
        <div className="mb-3 flex items-center gap-1.5">
          <UserCheck className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">분류 검토·수정</h2>
          <span className="text-[0.6875rem] text-muted-foreground">자동 분류가 틀렸다면 담당자가 직접 고칠 수 있어요.</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">분류할 티켓이 없습니다.</p>
        ) : (
          <>
            <div className="space-y-2.5">
              {rows.slice(0, limit).map((row) => (
                <OverrideRow
                  key={`${row.id}-${row.updatedAt ?? "auto"}`}
                  row={row}
                  saving={override.isPending}
                  onSave={(value) => override.mutate({ ticketId: row.id, ...value })}
                />
              ))}
            </div>
            {rows.length > limit && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                  더 보기
                </Button>
                <p className="text-[0.6875rem] text-muted-foreground">전체 {rows.length}건 중 {limit}건 표시 중</p>
              </div>
            )}
          </>
        )}
        {override.error && <p className="mt-3 text-sm text-destructive">{override.error.message}</p>}
      </div>
    </div>
  );
}
