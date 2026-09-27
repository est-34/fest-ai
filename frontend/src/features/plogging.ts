"use client";

import { festivalApi, idempotent } from "@/shared/lib/api";
import { useActivityHistory } from "@/features/activity-history";

export const PLOGGING_POINTS_PER_BAG = 30;

export interface PloggingSubmission {
  id: string;
  submissionCode: string;
  visitorCode: string;
  bagCount: number;
  location: string;
  verifiedAt: string;
  points: number;
  operatorEmail: string;
}

export interface NewPloggingSubmission {
  visitorCode: string;
  bagCount: number;
  location: string;
}


export function usePloggingSubmissions(admin = false) {
  return useActivityHistory<PloggingSubmission>("plogging", admin);
}

export function createPloggingSubmission(input: NewPloggingSubmission) {
  return festivalApi<PloggingSubmission>("/activities/plogging", idempotent("POST", input));
}

export function ploggingPoints(submissions: PloggingSubmission[]) {
  return submissions.reduce((total, submission) => total + submission.points, 0);
}
