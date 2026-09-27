"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

// 로딩·빈 데이터·오류를 구분해서 보여주기 위한 공용 상태 표시. 문구는 화면(다국어)에서 넘긴다.
export function ErrorState({
  message = "데이터를 불러오지 못했어요.",
  retryLabel = "다시 시도",
  onRetry,
  className,
}: {
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center",
        className,
      )}
    >
      <p className="text-xs text-destructive">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ message, className }: { message: string; className?: string }) {
  return (
    <p className={cn("rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground", className)}>
      {message}
    </p>
  );
}

export function queryErrorMessage(error: unknown, fallback = "데이터를 불러오지 못했어요.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * 로딩 → 오류 → 빈 목록 → 본문 순서로 그리는 공통 분기.
 * 화면마다 같은 삼항 사슬을 쓰던 것을 한 곳으로 모았다.
 * 빈 조건은 기본이 "배열이 비었을 때"이고, 가공한 목록을 쓰는 화면은 emptyWhen으로 넘긴다.
 */
export function QueryState<T>({
  query,
  skeleton,
  empty,
  emptyWhen,
  errorMessage,
  retryLabel,
  className,
  children,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    data: T | undefined;
    refetch: () => unknown;
  };
  skeleton?: ReactNode;
  empty?: string;
  emptyWhen?: boolean;
  errorMessage?: string;
  retryLabel?: string;
  /** 오류·빈 상태 박스에 함께 붙일 여백 등의 클래스. */
  className?: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return skeleton ?? <Skeleton className={cn("h-24 w-full rounded-xl", className)} />;
  // 데이터가 끝내 도착하지 않은 경우(오류·오프라인으로 멈춘 조회)는 빈 목록이 아니라 실패다.
  // 여기서 빈 상태를 보여주면 통신 장애가 "행사 없음"으로 읽힌다.
  if (query.isError || query.data === undefined) {
    return (
      <ErrorState
        className={className}
        message={errorMessage ?? queryErrorMessage(query.error)}
        retryLabel={retryLabel}
        onRetry={() => query.refetch()}
      />
    );
  }
  const isEmpty = emptyWhen ?? (Array.isArray(query.data) && query.data.length === 0);
  if (empty && isEmpty) return <EmptyState className={className} message={empty} />;
  return children(query.data);
}
