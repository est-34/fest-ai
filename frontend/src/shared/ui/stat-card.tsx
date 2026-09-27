import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  helper?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "warning" | "success" | "esg";
  className?: string;
  /** 주면 카드 전체가 해당 화면으로 가는 링크가 된다 — 숫자를 보고 바로 처리하러 갈 수 있게. */
  href?: string;
}

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-card text-foreground",
  primary: "bg-primary text-primary-foreground",
  warning: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  success: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  esg: "bg-esg/8 text-foreground dark:bg-esg/15",
};

export function StatCard({ label, value, helper, icon: Icon, tone = "default", className, href }: StatCardProps) {
  const rootClassName = cn(
    "rounded-2xl border border-border p-4",
    toneStyles[tone],
    tone === "primary" && "border-transparent",
    href && "block transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    className,
  );

  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium", tone === "primary" ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {label}
        </span>
        {Icon && <Icon className={cn("size-4", tone === "primary" ? "text-primary-foreground/80" : "text-muted-foreground")} />}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {helper && (
        <div className={cn("mt-1 text-xs", tone === "primary" ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {helper}
        </div>
      )}
    </>
  );

  if (href) return <Link href={href} className={rootClassName}>{body}</Link>;
  return <div className={rootClassName}>{body}</div>;
}
