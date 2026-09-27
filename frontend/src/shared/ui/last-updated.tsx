"use client";

import { History } from "lucide-react";
import { cn } from "@/shared/lib/utils";

// 방문객이 보는 정보가 "언제 기준인지"를 화면마다 같은 형식으로 보여준다.
// 값이 없거나 파싱되지 않으면 아무것도 그리지 않는다 — 잘못된 시각을 보여주는 것보다 낫다.
export function LastUpdated({
  value,
  bcp47,
  label,
  className,
}: {
  value: string | undefined | null;
  bcp47: string;
  label: (formatted: string) => string;
  className?: string;
}) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return (
    <p className={cn("inline-flex items-center gap-1 text-[0.6875rem] font-medium", className)}>
      <History className="size-3 shrink-0" aria-hidden="true" />
      <time dateTime={date.toISOString()}>
        {label(date.toLocaleString(bcp47, { dateStyle: "medium", timeStyle: "short" }))}
      </time>
    </p>
  );
}
