import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * 상태 표시용 색조. 화면마다 따로 적어 두던 Tailwind 클래스 문자열을 한 곳에 모았다.
 * 새 상태를 추가할 때는 여기 있는 색조 중 하나를 고르고, 새 색을 만들지 않는다.
 */
export const TONE = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  /** 즉시 대응이 필요한 최상위 단계(긴급 티켓 등)만 쓴다. */
  critical: "bg-red-600 text-white",
  busy: "bg-orange-100 text-orange-700",
  neutral: "bg-slate-100 text-slate-700",
  accent: "bg-primary/10 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  /** 만료·대체된 값처럼 흐리게 보여야 하는 것. */
  muted: "bg-muted text-muted-foreground",
  plain: "bg-muted text-foreground",
} as const;

export type Tone = keyof typeof TONE;

/** 목록 행에 붙는 작은 상태 알약. 크기·굵기를 바꿔야 하면 className으로 덮어쓴다. */
export function StatusPill({ tone, className, children }: { tone: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[0.625rem] font-bold", TONE[tone], className)}>{children}</span>;
}
