"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Star, CheckCircle2, Lock } from "lucide-react";
import {
  fetchSurveyQuestions,
  hasSurveyAnswer,
  submitSurvey,
  type SurveyAnswer,
  type SurveyQuestion,
} from "@/entities/visitor";
import { fetchStampSpots } from "@/entities/coupon";
import { useTranslation } from "@/shared/lib/i18n";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { SkeletonList } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useWrite } from "@/shared/lib/use-write";
import { VisitorPageTitle } from "@/widgets/visitor-nav/visitor-page-title";

export default function SurveyPage() {
  const { t, locale } = useTranslation();
  const survey = useQuery({
    queryKey: ["survey-questions", locale],
    queryFn: () => fetchSurveyQuestions(locale),
  });
  // 매장에 연결된 설문의 잠금 여부는 스탬프 완료로 결정된다. 대조는 원문(한국어)
  // 매장명 기준이라 화면 언어와 무관하게 "ko"로 따로 받아온다.
  const stampSpots = useQuery({
    queryKey: ["stamp-spots", "ko"],
    queryFn: () => fetchStampSpots("ko"),
  });
  const completedStores = new Set(
    (stampSpots.data ?? [])
      .filter((spot) => spot.collected)
      .map((spot) => spot.name),
  );
  const isUnlocked = (question: SurveyQuestion) =>
    question.linkedStoreName === null ||
    completedStores.has(question.linkedStoreName);

  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  // 오류는 제출 버튼 위에 그대로 그리므로 전역 토스트는 끈다.
  const submit = useWrite((questions: SurveyQuestion[]) => submitSurvey(questions, answers), { silent: true });

  if (submit.isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="text-base font-bold text-foreground">
          {t.survey.thanksTitle}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t.survey.thanksSubtitle}
        </p>
      </div>
    );
  }


  return (
    <>
      <VisitorPageTitle>{t.survey.title}</VisitorPageTitle>
      <div className="px-4 pt-0 pb-6">
        <p className="text-xs text-muted-foreground">{t.survey.subtitle}</p>

        {/* VIS-10·OPS-11: 익명 처리와 열람·삭제 요구 제외 범위를 수집 시점에 고지한다. */}
        <p className="mt-3 rounded-xl bg-muted/60 p-3 text-[0.6875rem] leading-5 text-muted-foreground">
          {t.survey.anonymousNotice}{" "}
          <Link
            href="/visitor/privacy"
            className="font-semibold text-primary underline"
          >
            {t.privacy.title}
          </Link>
        </p>

        <QueryState
          query={survey}
          className="mt-4"
          skeleton={
            <SkeletonList
              count={2}
              className="h-24 w-full rounded-xl"
              wrapperClassName="mt-4 space-y-3"
            />
          }
          errorMessage={t.common.loadFailed}
          retryLabel={t.common.retry}
          empty={t.common.empty}
        >
          {(allQuestions) => {
            const stampReady = stampSpots.isSuccess;
            const questions = allQuestions.filter(isUnlocked);
            const lockedStoreNames = stampReady
              ? Array.from(
                  new Set(
                    allQuestions
                      .filter((q) => !isUnlocked(q))
                      .map((q) => q.linkedStoreName!),
                  ),
                )
              : [];

            return (
              <>
                {stampSpots.isError && (
                  <p className="mt-4 rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                    {t.common.loadFailed}{" "}
                    <button
                      type="button"
                      onClick={() => stampSpots.refetch()}
                      className="font-semibold text-primary underline"
                    >
                      {t.common.retry}
                    </button>
                  </p>
                )}
                {questions.length > 0 && (
                  <Form
                    className="mt-4 space-y-5"
                    onSubmit={() => submit.mutate(questions)}
                  >
                    {questions.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <p className="text-sm font-semibold text-foreground">
                          {q.question}
                        </p>
                        {q.type === "rating" ? (
                          <div className="mt-3 flex gap-2">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() =>
                                  setAnswers((a) => ({ ...a, [q.id]: n }))
                                }
                                aria-label={t.survey.ratingAria(n)}
                              >
                                <Star
                                  className={cn(
                                    "size-7 transition-colors",
                                    (Number(answers[q.id]) || 0) >= n
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground",
                                  )}
                                />
                              </button>
                            ))}
                          </div>
                        ) : q.type === "single_choice" ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {q.options?.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() =>
                                  setAnswers((a) => ({
                                    ...a,
                                    [q.id]: opt.value,
                                  }))
                                }
                                aria-pressed={answers[q.id] === opt.value}
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                                  answers[q.id] === opt.value
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background text-foreground",
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        ) : q.type === "multiple_choice" ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {q.options?.map((opt) => {
                              const answer = answers[q.id];
                              const selected =
                                Array.isArray(answer) &&
                                answer.includes(opt.value);
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    setAnswers((current) => {
                                      const currentAnswer = current[q.id];
                                      const values = Array.isArray(
                                        currentAnswer,
                                      )
                                        ? currentAnswer
                                        : [];
                                      return {
                                        ...current,
                                        [q.id]: values.includes(opt.value)
                                          ? values.filter(
                                              (value) => value !== opt.value,
                                            )
                                          : [...values, opt.value],
                                      };
                                    })
                                  }
                                  aria-pressed={selected}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-semibold",
                                    selected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-background text-foreground",
                                  )}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <textarea
                            value={String(answers[q.id] ?? "")}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [q.id]: event.target.value,
                              }))
                            }
                            className="mt-3 min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                            placeholder={t.survey.textPlaceholder}
                          />
                        )}
                      </div>
                    ))}
                    <ErrorText
                      error={submit.error}
                      fallback={t.survey.submitError}
                      className="text-sm"
                    />
                    <SubmitButton
                      mutation={submit}
                      size="default"
                      className="w-full"
                      pending={t.survey.submitting}
                      disabled={questions.some(
                        (question) =>
                          question.required &&
                          !hasSurveyAnswer(answers[question.id]),
                      )}
                    >
                      {t.survey.submit}
                    </SubmitButton>
                  </Form>
                )}

                {questions.length === 0 && lockedStoreNames.length > 0 && (
                  <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    {t.survey.allLockedEmpty}
                  </p>
                )}

                {lockedStoreNames.length > 0 && (
                  <section className="mt-5 space-y-2">
                    <h2 className="text-sm font-bold text-foreground">
                      {t.survey.storeLockedTitle}
                    </h2>
                    {lockedStoreNames.map((storeName) => (
                      <div
                        key={storeName}
                        className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-3"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Lock className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {storeName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t.survey.storeLockedHint(storeName)}
                            </p>
                          </div>
                        </div>
                        <Link
                          href="/visitor/stamp-tour"
                          className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
                        >
                          {t.survey.storeLockedCta}
                        </Link>
                      </div>
                    ))}
                  </section>
                )}
              </>
            );
          }}
        </QueryState>
      </div>
    </>
  );
}
