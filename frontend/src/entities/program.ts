import { festivalApi, json } from "@/shared/lib/api";

// 서버 스키마(ProgramStatus)와 DB CHECK 제약이 받는 값 그대로다. 예전에는 여기에만 있던
// "ENDED"를 고르면 400이 났고, 실제 값인 "UNPUBLISHED"는 화면에서 고를 수 없었다.
export const PROGRAM_STATUSES = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;

export const PROGRAM_STATUS_LABEL: Record<string, string> = {
  DRAFT: "준비중", PUBLISHED: "게시", UNPUBLISHED: "게시 종료", ARCHIVED: "보관",
};

export interface Program {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  category: string;
  status: string;
  version: number;
}

export interface ProgramSession {
  id: string;
  areaId: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  status: string;
  version: number;
}

export interface NewProgram {
  slug: string;
  title: string;
  summary?: string;
  category: string;
  status: string;
}

export interface NewProgramSession {
  areaId: string;
  startsAt: string;
  endsAt: string;
  capacity?: number | null;
  status: string;
}

export function fetchPrograms() {
  return festivalApi<Program[]>(`/programs`);
}

export function fetchProgramSessions(programId: string) {
  return festivalApi<ProgramSession[]>(`/programs/${programId}/sessions`);
}

interface ContentItemRow {
  id: string;
  resourceType: string | null;
  resourceId: string | null;
}

/**
 * 프로그램을 방문객 채널에 올리기 위한 콘텐츠 초안을 만들고 검수를 요청한다.
 *
 * 공개 프로그램 목록은 게시된 콘텐츠 항목(content_items)을 조인해서 만든다. 그런데 콘텐츠
 * 항목을 만드는 화면이 공지뿐이라, 관리자가 등록한 프로그램은 상태를 PUBLISHED로 바꿔도
 * 방문객 앱·일정·예약 어디에도 나타나지 않았다(시드로 넣은 프로그램 하나만 보였다).
 *
 * 승인과 게시는 여기서 하지 않는다 — 작성자와 최종 승인자가 달라야 한다는 규칙이 있어서,
 * 검수·게시 관리 화면에서 검수자가 이어받는다.
 */
export async function submitProgramContent(program: Program) {
  const items = await festivalApi<ContentItemRow[]>(`/content-items`);
  const existing = items.find((item) => item.resourceType === "PROGRAM" && item.resourceId === program.id);
  const item = existing ?? (await festivalApi<ContentItemRow>(`/content-items`, json("POST", {
    contentType: "PROGRAM",
    resourceType: "PROGRAM",
    resourceId: program.id,
    slug: program.slug,
  })));
  const version = await festivalApi<{ id: string }>(`/content-items/${item.id}/versions`, json("POST", {
    language: "ko",
    body: { title: program.title, summary: program.summary ?? "" },
    changeNote: "운영관리 화면에서 검수 요청",
  }));
  await festivalApi(`/content-versions/${version.id}/submit`, { method: "POST" });
  return version;
}

export async function createProgram(input: NewProgram) {
  const program = await festivalApi<Program>(`/programs`, json("POST", input));
  // 등록과 동시에 콘텐츠 초안을 올려 둔다. 이 단계를 빼면 검수·게시 화면에 아무것도
  // 나타나지 않아 프로그램을 공개할 방법 자체가 없다.
  await submitProgramContent(program);
  return program;
}

export function updateProgram({ id, version, ...input }: Partial<NewProgram> & { id: string; version: number }) {
  return festivalApi(`/programs/${id}`, json("PATCH", { ...input, version }));
}

export function deleteProgram(id: string) {
  return festivalApi<void>(`/programs/${id}`, { method: "DELETE" });
}

export function createProgramSession({ programId, ...input }: NewProgramSession & { programId: string }) {
  return festivalApi(`/programs/${programId}/sessions`, json("POST", input));
}

export function deleteProgramSession(sessionId: string) {
  return festivalApi<void>(`/program-sessions/${sessionId}`, { method: "DELETE" });
}
