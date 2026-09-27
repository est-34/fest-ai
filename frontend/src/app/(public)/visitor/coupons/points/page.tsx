"use client";

import { useQuery } from "@tanstack/react-query";
import { Coins, History } from "lucide-react";
import { fetchPoints } from "@/entities/coupon";
import { VisitorEsgHeader } from "@/features/esg/ui/visitor-esg-header";
import { useTranslation } from "@/shared/lib/i18n";

export default function EsgPointsPage() {
  const { t, bcp47 } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ["visitor-points"], queryFn: fetchPoints, refetchInterval: 10_000 });

  const history = data?.ledger ?? [];

  return (
    <div className="px-4 pt-4 pb-6">
      <VisitorEsgHeader title={t.esg.points.title} description={t.esg.points.subtitle} />

      <section className="rounded-2xl bg-esg p-5 text-white">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-full bg-white/15"><Coins className="size-5" /></span>
          <div>
            <p className="text-xs font-bold text-white/80">{t.esg.points.myPointsLabel}</p>
            <p className="text-2xl font-extrabold">{(data?.balance ?? 0).toLocaleString()}P</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-esg-text" />
          <h2 className="text-sm font-bold text-foreground">{t.esg.points.historyTitle}</h2>
        </div>
        {isLoading ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">{t.esg.points.loading}</p>
        ) : history.length === 0 ? (
          <p className="mt-4 rounded-xl bg-muted/40 p-4 text-center text-xs text-muted-foreground">{t.esg.points.empty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{entry.reason}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString(bcp47)}</p>
                </div>
                <span className="shrink-0 text-xs font-extrabold text-esg-text">+{entry.pointsDelta}P</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
