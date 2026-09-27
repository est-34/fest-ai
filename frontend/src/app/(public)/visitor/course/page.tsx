"use client";

import { useState } from "react";
import { Clock, MapPin, Route, Sparkles } from "lucide-react";
import { createCoursePlan } from "@/features/course-plan";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { queryErrorMessage } from "@/shared/ui/query-state";
import { useTranslation } from "@/shared/lib/i18n";
import { toggleValue } from "@/shared/lib/utils";
import { useWrite } from "@/shared/lib/use-write";
import { VisitorPageTitle } from "@/widgets/visitor-nav/visitor-page-title";

// 백엔드 programs.category 값과 맞춘다 — 다른 값을 보내면 결과가 비어 나온다.
const INTERESTS = [
  "performance",
  "experience",
  "exhibition",
  "food",
  "event",
] as const;
const DURATIONS = [60, 120, 180, 240];

export default function VisitorCoursePage() {
  const { t, bcp47, locale } = useTranslation();
  const [interests, setInterests] = useState<string[]>([]);
  const [durationMin, setDurationMin] = useState(120);
  const plan = useWrite((input: Parameters<typeof createCoursePlan>[0]) => createCoursePlan(input, locale));

  const time = (value: string) =>
    new Date(value).toLocaleTimeString(bcp47, {
      hour: "2-digit",
      minute: "2-digit",
    });


  return (
    <>
      <VisitorPageTitle>{t.course.title}</VisitorPageTitle>
      <div className="px-4 pt-0 pb-6">
        <p className="text-xs text-muted-foreground">{t.course.subtitle}</p>
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-bold text-foreground">
            {t.course.interestLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((value) => {
              const active = interests.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInterests(toggleValue(interests, value))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
                >
                  {t.course.interests[value]}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-sm font-bold text-foreground">
            {t.course.durationLabel}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDurationMin(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${durationMin === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
              >
                {t.course.durationOption(value)}
              </button>
            ))}
          </div>

          <Button
            className="mt-4 w-full"
            disabled={plan.isPending}
            onClick={() => plan.mutate({ interests, durationMin })}
          >
            <Sparkles className="size-4" />{" "}
            {plan.isPending ? t.course.generating : t.course.generate}
          </Button>
          {plan.error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {queryErrorMessage(plan.error)}
            </p>
          )}
        </section>

        {plan.isPending && <Skeleton className="mt-4 h-40 rounded-2xl" />}

        {plan.data && (
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Route className="size-4" /> {t.course.resultTitle}
              </h2>
              <Badge variant="outline" className="text-[0.625rem]">
                {t.course.resultCount(plan.data.items.length)}
              </Badge>
            </div>
            <ol className="space-y-2">
              {plan.data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[0.6875rem] font-bold text-primary-foreground">
                    {item.sequenceNo}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">
                      {item.program.title}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-3 text-[0.6875rem] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />{" "}
                        {time(item.program.startsAt)} -{" "}
                        {time(item.program.endsAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> {item.program.areaName}
                      </span>
                    </div>
                    <p className="mt-1 text-[0.6875rem] text-primary">
                      {item.recommendationReason}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}
