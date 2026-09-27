"use client";

import type { ReactNode } from "react";
import { ScanLine, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { QrScanner } from "@/shared/ui/qr-scanner";

export const ACTIVITY_STATIONS = ["메인 광장 회수존", "푸드존 F-2", "공연장 입구"];

export function ActivityHeader({ icon: Icon, title, description, user, roleDescription, pointsLabel, readOnlyMessage, canProcess }: {
  icon: LucideIcon;
  title: string;
  description: string;
  user: { email: string; role: string } | null;
  roleDescription: string;
  pointsLabel: string;
  readOnlyMessage: string;
  canProcess: boolean;
}) {
  return <>
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-primary/5 p-5 dark:border-emerald-900/70 dark:from-emerald-950/40 dark:to-primary/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"><Icon className="size-5" /></span>
          <div><h2 className="text-base font-bold text-foreground">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
        </div>
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"><UserRound className="size-3" /> 담당 현장관리자</Badge>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-emerald-200/70 pt-3 text-xs dark:border-emerald-900/70">
        <span className="font-semibold text-foreground">{user?.email ?? "운영자"}</span>
        <span className="text-muted-foreground">{user?.role ?? "운영자"} · {roleDescription}</span>
        <span className="text-muted-foreground">{pointsLabel}</span>
      </div>
    </div>
    {!canProcess && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{readOnlyMessage}</div>}
  </>;
}

export function ActivityVisitorCode({ field, disabled, onScan }: {
  field: { value: string; onChange: (event: { target: { value: string } }) => void };
  disabled: boolean;
  onScan: () => void;
}) {
  return <div className="space-y-1 lg:col-span-2">
    <Label htmlFor="visitor-code">방문객 코드</Label>
    <div className="flex gap-2">
      <Input id="visitor-code" {...field} placeholder="방문객 QR의 코드" autoComplete="off" disabled={disabled} required />
      <Button type="button" size="icon" variant="outline" aria-label="방문객 QR 스캔" disabled={disabled} onClick={onScan}><ScanLine className="size-4" /></Button>
    </div>
  </div>;
}

export function ActivityScanner({ label, onScan, children }: { label: string; onScan: (value: string) => void; children: ReactNode }) {
  return <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
    <QrScanner label={label} onScan={onScan} />
    <p className="mt-2 text-[11px] text-muted-foreground">{children}</p>
  </div>;
}

export function ActivitySteps({ steps, footer }: { steps: { icon: LucideIcon; title: string; description: ReactNode }[]; footer: string }) {
  return <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-4">
    <p className="text-xs font-semibold text-foreground">현장 처리 흐름</p>
    <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
      {steps.map(({ icon: Icon, title, description }) => <div key={title} className="flex gap-2"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><span><b className="text-foreground">{title}</b><br />{description}</span></div>)}
    </div>
    <p className="mt-3 text-[11px] text-muted-foreground">{footer}</p>
  </section>;
}
