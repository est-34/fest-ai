import { festivalApi, json } from "@/shared/lib/api";

export type SurveyQuestionType = "RATING" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TEXT";

export const QUESTION_TYPE_LABEL: Record<SurveyQuestionType, string> = {
  RATING: "별점(1~5)",
  SINGLE_CHOICE: "단일 선택",
  MULTIPLE_CHOICE: "복수 선택",
  TEXT: "주관식",
};

export const SURVEY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "작성 중",
  ACTIVE: "진행 중",
  CLOSED: "종료",
};

export interface SurveyQuestion {
  id: string;
  prompt: string;
  questionType: SurveyQuestionType;
  options: string[];
  required: boolean;
  position: number;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  preventDuplicates: boolean;
  responseCount: number;
  questions: SurveyQuestion[];
  version: number;
}

export function fetchSurveys() {
  return festivalApi<Survey[]>(`/surveys`);
}

export interface NewSurveyQuestion {
  prompt: string;
  questionType: SurveyQuestionType;
  /** 선택형 질문의 보기. 쉼표로 구분해 입력받아 배열로 보낸다. */
  options: string[];
  required: boolean;
}

export interface NewSurvey {
  title: string;
  description?: string;
  status: "DRAFT" | "ACTIVE";
  preventDuplicates: boolean;
  questions: NewSurveyQuestion[];
}

export function createSurvey(input: NewSurvey) {
  return festivalApi<Survey>(`/surveys`, json("POST", input));
}

/** 상태 전환(진행/종료)만 쓰는 수정. 문항은 응답 집계가 뒤섞이므로 서버가 받지 않는다. */
export function updateSurvey({ surveyId, version, ...body }: { surveyId: string; version: number; status?: string; title?: string }) {
  return festivalApi<Survey>(`/surveys/${surveyId}`, json("PATCH", { ...body, version }));
}

export interface SurveySummaryQuestion {
  questionId: string;
  prompt: string;
  questionType: SurveyQuestionType;
  responseCount: number;
  averageRating: number | null;
  optionCounts: Record<string, number>;
}

export interface SurveySummary {
  surveyId: string;
  title: string;
  responseCount: number;
  anonymous: boolean;
  duplicatePrevention: boolean;
  questions: SurveySummaryQuestion[];
}

/** 문항별 집계. 개별 응답은 서버가 절대 내려주지 않는다(익명 보장). */
export function fetchSurveySummary(surveyId: string) {
  return festivalApi<SurveySummary>(`/surveys/${surveyId}/summary`);
}
