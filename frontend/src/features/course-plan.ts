import { json, visitorApi } from "@/shared/lib/api";
import type { Locale } from "@/shared/lib/i18n";
import { translateEntries } from "@/shared/lib/i18n/translate-client";

export interface CoursePlanItem {
  id: string;
  sequenceNo: number;
  recommendationReason: string;
  // 서버는 선택된 program_sessions 행을 그대로 실어 보낸다(회차 id + 프로그램 제목).
  program: {
    id: string;
    programId: string;
    title: string;
    category: string;
    startsAt: string;
    endsAt: string;
    areaName: string;
  };
}

export interface CoursePlan {
  id: string;
  expectedDurationMin: number;
  items: CoursePlanItem[];
}

export interface CoursePlanRequest {
  interests: string[];
  durationMin: number;
  companionType?: string;
  areaId?: string;
}

export async function createCoursePlan(input: CoursePlanRequest, locale: Locale = "ko"): Promise<CoursePlan> {
  const plan = await visitorApi<CoursePlan>("/visitor/course-plans", json("POST", {
    // startsAt을 지금으로 고정해야 서버가 이미 지난 회차를 코스에 넣지 않는다.
    ...input, startsAt: new Date().toISOString(), accessibility: {}, excludedProgramIds: [],
  }));
  if (locale === "ko" || plan.items.length === 0) return plan;

  const entries: Record<string, string> = {};
  plan.items.forEach((item) => {
    entries[`${item.id}.reason`] = item.recommendationReason;
    entries[`${item.id}.title`] = item.program.title;
    entries[`${item.id}.areaName`] = item.program.areaName;
  });
  const translated = await translateEntries(entries, locale);
  return {
    ...plan,
    items: plan.items.map((item) => ({
      ...item,
      recommendationReason: translated[`${item.id}.reason`] ?? item.recommendationReason,
      program: {
        ...item.program,
        title: translated[`${item.id}.title`] ?? item.program.title,
        areaName: translated[`${item.id}.areaName`] ?? item.program.areaName,
      },
    })),
  };
}
