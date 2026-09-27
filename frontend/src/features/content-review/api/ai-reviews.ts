import { festivalApi, json } from "@/shared/lib/api";

export interface AiReview {
  id: string;
  question: string;
  answer: string;
  reason: string;
  detail?: string;
  safetyStatus: string;
  modelVersion?: string;
  createdAt: string;
}

export function fetchAiReviews() {
  return festivalApi<AiReview[]>(`/ai/reviews?status=OPEN`);
}

export function decideAiReview({ id, decision }: { id: string; decision: string }) {
  return festivalApi(`/ai/reviews/${id}/decision`, json("POST", { decision }));
}

/** 탭 배지와 검수 큐가 같은 키를 쓰므로 두 곳에서 불러도 요청은 한 번이다. */
export const aiReviewsQuery = { queryKey: ["ai-reviews"], queryFn: fetchAiReviews };
