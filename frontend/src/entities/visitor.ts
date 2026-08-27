import { FESTIVAL_CODE, json, publicApi, visitorApi } from "@/shared/lib/api";
import type { Locale } from "@/shared/lib/i18n";
import { translateEntries } from "@/shared/lib/i18n/translate-client";
import { linkedStoreName } from "@/shared/lib/survey-store-link";

export interface ChatMessage {
  id: string;
  backendMessageId?: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: string[];
  // 답변 근거 데이터의 기준 시각(ISO). 서버가 내려줄 때만 채워진다.
  freshnessAt?: string;
  // 검증된 근거가 부족해 사람이 응대하는 채널을 함께 안내해야 하는 답변인지.
  needsFallbackChannel?: boolean;
  // needsFallbackChannel일 때만 채워지는 서버 원문(한국어) 고정 문구.
  // 방문객이 대화 중간에 언어를 바꾸면 이 원문을 다시 번역해서 보여준다 — 실제 AI 답변은
  // 대화 생성 시점의 언어로 이미 고정돼 있어 재번역 대상이 아니다.
  rawContent?: string;
}

// 옵션 제출 값은 서버가 정의한 원문(한국어) 문자열이어야 한다 — value는 번역해도 그대로,
// label만 화면 표시용으로 번역한다.
export interface SurveyOption {
  value: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  surveyId: string;
  /** "[매장명] ..." 접두어에서 뽑은 매장명. 없으면 매장과 무관한 공용 설문. */
  linkedStoreName: string | null;
  question: string;
  type: "rating" | "single_choice" | "multiple_choice" | "text";
  options?: SurveyOption[];
  required: boolean;
}

export type SurveyAnswer = string | number | string[];

export function surveyQuestionType(type: string): SurveyQuestion["type"] {
  const types: Record<string, SurveyQuestion["type"]> = {
    RATING: "rating",
    SINGLE_CHOICE: "single_choice",
    MULTIPLE_CHOICE: "multiple_choice",
    TEXT: "text",
  };
  const mapped = types[type];
  if (!mapped) throw new Error(`지원하지 않는 설문 질문 형식입니다: ${type}`);
  return mapped;
}

export function hasSurveyAnswer(value: SurveyAnswer | undefined) {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "";
}

/**
 * 진행 중인 설문의 문항 전체.
 *
 * 예전에는 surveys[0]만 읽어서, 운영자가 설문을 두 개 이상 열면 뒤쪽 설문은 방문객에게
 * 존재하지 않는 것과 같았다. 모든 설문의 문항을 순서대로 이어 붙이고, 각 문항이 자기
 * surveyId를 들고 다닌다(제출은 설문 단위로 나눠 보낸다).
 */
export async function fetchSurveyQuestions(locale: Locale = "ko"): Promise<SurveyQuestion[]> {
  const surveys = await publicApi<Array<{
    id: string;
    title?: string;
    questions: Array<{ id: string; prompt: string; type: string; options?: string[]; required: boolean }>;
  }>>(`/public/festivals/${FESTIVAL_CODE}/surveys`);
  // 매장 연결은 제목 접두어로만 표현되므로, 번역으로 바뀌기 전 원문 제목에서 읽어야
  // 스탬프 스팟의 원문 이름과 그대로 대조할 수 있다.
  const questions = surveys.flatMap((survey) => {
    const storeName = linkedStoreName(survey.title ?? "");
    return survey.questions.map((question) => ({
      id: question.id,
      surveyId: survey.id,
      linkedStoreName: storeName,
      question: question.prompt,
      type: surveyQuestionType(question.type),
      options: question.options?.map((value) => ({ value, label: value })),
      required: question.required,
    } satisfies SurveyQuestion));
  });

  if (locale === "ko" || questions.length === 0) return questions;
  const entries: Record<string, string> = {};
  questions.forEach((q) => {
    entries[`${q.id}.question`] = q.question;
    q.options?.forEach((opt, index) => { entries[`${q.id}.option.${index}`] = opt.value; });
  });
  const translated = await translateEntries(entries, locale);
  return questions.map((q) => ({
    ...q,
    question: translated[`${q.id}.question`] ?? q.question,
    options: q.options?.map((opt, index) => ({
      value: opt.value,
      label: translated[`${q.id}.option.${index}`] ?? opt.label,
    })),
  }));
}

export async function submitSurvey(questions: SurveyQuestion[], answers: Record<string, SurveyAnswer>) {
  // 응답은 설문 단위로 저장된다 — 문항이 여러 설문에서 왔으면 설문마다 한 번씩 보낸다.
  const bySurvey = new Map<string, Array<{ questionId: string; value: SurveyAnswer }>>();
  for (const question of questions) {
    const value = answers[question.id];
    if (!hasSurveyAnswer(value)) continue;
    bySurvey.set(question.surveyId, [...(bySurvey.get(question.surveyId) ?? []), { questionId: question.id, value: value! }]);
  }
  if (bySurvey.size === 0) throw new Error("참여 가능한 설문이 없습니다.");
  // 한 설문이 실패해도 나머지 결과를 알 수 있도록 순차로 보내고 첫 오류를 그대로 올린다.
  for (const [surveyId, surveyAnswers] of bySurvey) {
    await visitorApi(`/visitor/surveys/${surveyId}/responses`, json("POST", { answers: surveyAnswers }));
  }
}
