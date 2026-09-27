"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardList, Plus, Store, Trash2 } from "lucide-react";
import {
  QUESTION_TYPE_LABEL,
  SURVEY_STATUS_LABEL,
  createSurvey,
  fetchSurveySummary,
  fetchSurveys,
  updateSurvey,
  type NewSurveyQuestion,
  type SurveyQuestionType,
} from "@/features/survey-admin";
import { fetchRewardCampaigns } from "@/features/rewards";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmButton } from "@/shared/ui/confirm-button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Meter } from "@/shared/ui/meter";
import { SelectField } from "@/shared/ui/select-field";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { SkeletonList } from "@/shared/ui/skeleton";
import { StatusPill, type Tone } from "@/shared/ui/status-pill";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { linkedStoreName, withLinkedStoreName } from "@/shared/lib/survey-store-link";

/** SelectField는 빈 문자열 value를 허용하지 않아 "매장 무관"에 별도 값을 쓴다. */
const NO_STORE = "__none__";

const QUESTION_TYPES: SurveyQuestionType[] = ["RATING", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT"];
const QUESTION_TYPE_OPTIONS = QUESTION_TYPES.map((type) => ({ value: type, label: QUESTION_TYPE_LABEL[type] }));

const STATUS_TONE: Record<string, Tone> = { DRAFT: "neutral", ACTIVE: "success", CLOSED: "muted" };

const CHOICE_TYPES: SurveyQuestionType[] = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"];

function emptyQuestion(): NewSurveyQuestion {
  return { prompt: "", questionType: "RATING", options: [], required: false };
}

/** 문항별 집계. 개별 응답은 서버가 내려주지 않으므로 여기서도 다루지 않는다. */
function SummaryPanel({ surveyId }: { surveyId: string }) {
  const summary = useQuery({ queryKey: ["survey-summary", surveyId], queryFn: () => fetchSurveySummary(surveyId) });

  return (
    <QueryState query={summary} skeleton={<SkeletonList count={2} className="h-16 rounded-xl" wrapperClassName="mt-3 space-y-2" />}>
      {(data) => (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-[0.6875rem] text-muted-foreground">
            응답 {data.responseCount}건 · 익명 저장{data.duplicatePrevention ? " · 1인 1회" : ""}
          </p>
          {data.questions.map((question) => {
            const total = Object.values(question.optionCounts).reduce((sum, count) => sum + count, 0);
            return (
              <div key={question.questionId} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">{question.prompt}</p>
                  <Badge variant="outline" className="text-[0.625rem]">{QUESTION_TYPE_LABEL[question.questionType]}</Badge>
                </div>
                {question.averageRating !== null && (
                  <p className="mt-1 text-sm font-bold text-foreground">평균 {question.averageRating}점</p>
                )}
                {Object.entries(question.optionCounts).map(([option, count]) => (
                  <div key={option} className="mt-1.5">
                    <div className="flex justify-between text-[0.6875rem] text-muted-foreground">
                      <span>{option}</span><span>{count}건</span>
                    </div>
                    <Meter percent={total ? Math.round((count / total) * 100) : 0} className="mt-0.5 h-1.5" />
                  </div>
                ))}
                {question.questionType === "TEXT" && (
                  <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                    주관식 응답 {question.responseCount}건 — 개별 내용은 익명 보장을 위해 표시하지 않아요.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </QueryState>
  );
}

export default function SurveysPage() {
  const surveys = useQuery({ queryKey: ["admin-surveys"], queryFn: fetchSurveys });
  // 매장 연결 설문은 스탬프 스팟(리워드 액션) 이름과 제목 접두어를 대조해 방문객 화면에서 잠긴다.
  const campaigns = useQuery({ queryKey: ["reward-campaigns"], queryFn: fetchRewardCampaigns });
  const storeOptions = useMemo(() => {
    const names = new Set<string>();
    (campaigns.data ?? []).forEach((campaign) =>
      campaign.actions.forEach((action) => { if (action.rule.name) names.add(action.rule.name); }));
    return Array.from(names);
  }, [campaigns.data]);

  const [creating, setCreating] = useState(false);
  const [openSummary, setOpenSummary] = useState<string | null>(null);
  const [questions, setQuestions] = useState<NewSurveyQuestion[]>([emptyQuestion()]);
  const [linkedStore, setLinkedStore] = useState(NO_STORE);
  const { form, field, reset } = useForm({ title: "", description: "", preventDuplicates: true });

  const create = useWrite(createSurvey, {
    success: "설문을 등록했어요.", invalidates: ["admin-surveys"],
    onSuccess: () => { reset(); setQuestions([emptyQuestion()]); setLinkedStore(NO_STORE); setCreating(false); },
  });
  const change = useWrite(updateSurvey, { success: "설문 상태를 변경했어요.", invalidates: ["admin-surveys"] });

  const updateQuestion = (index: number, patch: Partial<NewSurveyQuestion>) =>
    setQuestions((current) => current.map((question, position) => (position === index ? { ...question, ...patch } : question)));

  const incomplete = questions.some((question) =>
    !question.prompt.trim() || (CHOICE_TYPES.includes(question.questionType) && question.options.length === 0));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        방문객 설문을 만들고 결과를 집계해요. 응답은 익명으로 저장되고, 개별 응답 대신 문항별 집계만 볼 수 있어요.
      </p>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <ClipboardList className="size-4 text-primary" /> 설문 등록
          </h2>
          <Button size="sm" onClick={() => setCreating((value) => !value)}>
            <Plus className="size-3.5" /> 새 설문
          </Button>
        </div>

        {creating && (
          <Form
            className="mt-3 space-y-3"
            onSubmit={() =>
              create.mutate({
                title: withLinkedStoreName(form.title, linkedStore === NO_STORE ? null : linkedStore),
                description: form.description || undefined,
                preventDuplicates: form.preventDuplicates,
                // 등록 즉시 방문객에게 열어 준다. 닫아 두려면 목록에서 상태를 바꾼다.
                status: "ACTIVE",
                questions,
              })
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="survey-title">제목</Label>
                <Input id="survey-title" {...field("title")} required maxLength={200} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="survey-description">안내 문구</Label>
                <Input id="survey-description" {...field("description")} placeholder="민감정보는 입력하지 마세요." maxLength={1000} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="survey-linked-store">연결 매장 (선택)</Label>
              <SelectField
                value={linkedStore}
                onValueChange={setLinkedStore}
                options={[
                  { value: NO_STORE, label: "매장 무관 (공용 설문)" },
                  ...storeOptions.map((name) => ({ value: name, label: name })),
                ]}
                aria-label="연결 매장"
              />
              <p className="text-[0.6875rem] text-muted-foreground">
                매장을 선택하면 그 매장 스탬프를 적립한 방문객만 이 설문에 응답할 수 있어요.
              </p>
            </div>

            <div className="space-y-2">
              <Label>문항</Label>
              {questions.map((question, index) => (
                <div key={index} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_10rem_auto]">
                  <Input
                    value={question.prompt}
                    onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                    placeholder="질문을 입력하세요"
                    aria-label={`${index + 1}번 질문`}
                    required
                  />
                  <SelectField
                    value={question.questionType}
                    onValueChange={(value) => updateQuestion(index, { questionType: value as SurveyQuestionType, options: [] })}
                    options={QUESTION_TYPE_OPTIONS}
                    aria-label={`${index + 1}번 문항 유형`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`${index + 1}번 문항 삭제`}
                    disabled={questions.length === 1}
                    onClick={() => setQuestions((current) => current.filter((_, position) => position !== index))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                  {CHOICE_TYPES.includes(question.questionType) && (
                    <Input
                      className="sm:col-span-3"
                      value={question.options.join(", ")}
                      onChange={(event) => updateQuestion(index, {
                        options: event.target.value.split(",").map((option) => option.trim()).filter(Boolean),
                      })}
                      placeholder="보기를 쉼표로 구분해 입력하세요 (예: 메인 광장, 체험존)"
                      aria-label={`${index + 1}번 보기`}
                    />
                  )}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={() => setQuestions((current) => [...current, emptyQuestion()])}>
                <Plus className="size-3.5" /> 문항 추가
              </Button>
            </div>

            <div className="flex items-center justify-end gap-3">
              <ErrorText error={create.error} className="mr-auto" />
              {incomplete && <p className="mr-auto text-xs text-muted-foreground">질문과 선택형 보기를 모두 채워주세요.</p>}
              <Button type="button" variant="outline" size="sm" onClick={() => setCreating(false)}>취소</Button>
              <SubmitButton mutation={create} pending="등록 중..." disabled={incomplete}>등록</SubmitButton>
            </div>
          </Form>
        )}
      </section>

      <QueryState
        query={surveys}
        empty="등록된 설문이 없어요."
        skeleton={<SkeletonList count={2} className="h-28 rounded-2xl" wrapperClassName="space-y-3" />}
      >
        {(rows) => (
          <div className="space-y-3">
            {rows.map((survey) => {
              const storeName = linkedStoreName(survey.title);
              const displayTitle = withLinkedStoreName(survey.title, null);
              return (
                <article key={survey.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{displayTitle}</h3>
                        <StatusPill tone={STATUS_TONE[survey.status] ?? "neutral"}>
                          {SURVEY_STATUS_LABEL[survey.status] ?? survey.status}
                        </StatusPill>
                        {storeName && (
                          <Badge variant="outline" className="gap-1 text-[0.625rem]">
                            <Store className="size-3" /> {storeName}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                        문항 {survey.questions.length}개 · 응답 {survey.responseCount}건
                        {survey.preventDuplicates && " · 1인 1회"}
                        {storeName && " · 매장 스탬프 완료자만 참여"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOpenSummary(openSummary === survey.id ? null : survey.id)}
                      >
                        <BarChart3 className="size-3.5" /> 결과
                      </Button>
                      {survey.status === "DRAFT" && (
                        <Button size="sm" disabled={change.isPending} onClick={() => change.mutate({ surveyId: survey.id, version: survey.version, status: "ACTIVE" })}>
                          진행
                        </Button>
                      )}
                      {survey.status === "ACTIVE" && (
                        <ConfirmButton
                          size="sm"
                          variant="outline"
                          title="설문을 종료할까요?"
                          description={`"${displayTitle}"이(가) 방문객 화면에서 즉시 내려갑니다. 모인 응답은 그대로 남아요.`}
                          confirmLabel="종료"
                          onConfirm={() => change.mutate({ surveyId: survey.id, version: survey.version, status: "CLOSED" })}
                        >
                          종료
                        </ConfirmButton>
                      )}
                    </div>
                  </div>
                  {openSummary === survey.id && <SummaryPanel surveyId={survey.id} />}
                </article>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
  );
}
