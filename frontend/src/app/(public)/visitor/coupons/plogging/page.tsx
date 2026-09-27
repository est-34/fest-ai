"use client";

import { CheckCircle2, Trash2 } from "lucide-react";
import { useReusableVisitorCode } from "@/features/reusable-containers";
import { PLOGGING_POINTS_PER_BAG, ploggingPoints, usePloggingSubmissions } from "@/features/plogging";
import { VisitorEsgHeader } from "@/features/esg/ui/visitor-esg-header";
import { useTranslation } from "@/shared/lib/i18n";
import { VisitorCodeCard } from "@/features/esg/ui/visitor-code-card";

export default function EsgPloggingPage() {
  const { t, bcp47 } = useTranslation();
  const submissions = usePloggingSubmissions();
  const visitorCode = useReusableVisitorCode();

  const mySubmissions = submissions
    .filter((submission) => submission.visitorCode === visitorCode)
    .sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt));
  const earnedPoints = ploggingPoints(mySubmissions);

  return (
    <div className="px-4 pt-4 pb-6">
      <VisitorEsgHeader
        title={t.esg.plogging.title}
        description={t.esg.plogging.subtitle}
      />

      <VisitorCodeCard code={visitorCode} text={t.esg.plogging} helper={t.esg.plogging.helper(PLOGGING_POINTS_PER_BAG)} />

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-esg/10 text-esg-text">
              <Trash2 className="size-4" />
            </span>
            <h2 className="text-sm font-bold text-foreground">{t.esg.plogging.historyTitle}</h2>
          </div>
        </div>

        {mySubmissions.length > 0 ? (
          <div className="mt-3 space-y-2">
            {mySubmissions.map((submission) => (
              <div key={submission.id} className="flex items-center justify-between gap-3 rounded-xl bg-esg/5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{t.esg.plogging.submissionLine(submission.bagCount, submission.location)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(submission.verifiedAt).toLocaleString(bcp47)}</p>
                </div>
                <span className="shrink-0 text-xs font-extrabold text-esg-text">+{submission.points}P</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">{t.esg.plogging.historyEmpty}</p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-esg-text">
          <CheckCircle2 className="size-3.5" /> {t.esg.plogging.summary(mySubmissions.length, earnedPoints)}
        </p>
      </section>
    </div>
  );
}
