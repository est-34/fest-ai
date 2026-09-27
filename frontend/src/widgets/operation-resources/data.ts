import { FESTIVAL_CODE, publicApi } from "@/shared/lib/api";
import { fetchAdminBusinesses, PARTICIPATION_LABEL } from "@/features/business-admin";
import { fetchStaffAssignments } from "@/features/staff";
import { fetchPrograms } from "@/entities/program";
import { seoulShort, seoulTime } from "@/shared/lib/utils";

export type OperationCategory = "프로그램" | "참여업체" | "부스" | "인력" | "자원봉사자";

export type OperationStatus = "준비중" | "운영중" | "완료" | "이슈";

export interface OperationResource {
  id: string;
  category: OperationCategory;
  name: string;
  manager: string;
  contact: string;
  location: string;
  time: string;
  status: OperationStatus;
  note: string;
}

const PROGRAM_STATUS: Record<string, OperationResource["status"]> = {
  DRAFT: "준비중", PUBLISHED: "운영중", UNPUBLISHED: "완료", ARCHIVED: "완료",
};

const timeRange = (from: string, to: string) =>
  `${seoulShort(from)} ~ ${seoulTime(to)}`;

/**
 * 통합 운영관리 표: 프로그램·참여업체·부스·인력을 한 목록으로 합친다.
 * 한 종류라도 권한이 없어 실패하면 그 줄만 비우고 나머지는 보여준다.
 */
export async function fetchOperationResources(): Promise<OperationResource[]> {
  const [programs, businesses, staff, published] = await Promise.all([
    fetchPrograms(),
    fetchAdminBusinesses().catch(() => []),
    fetchStaffAssignments().catch(() => []),
    // 회차 수는 관리자 목록에 없다. 게시된 프로그램은 공개 API가 회차까지 함께 내려준다.
    publicApi<Array<{ id: string; sessions: unknown[] }>>(`/public/festivals/${FESTIVAL_CODE}/programs`).catch(() => []),
  ]);
  const sessionCount = new Map(published.map((program) => [program.id, program.sessions.length]));

  const programRows = programs.map<OperationResource>((program) => ({
    id: program.id,
    category: "프로그램",
    name: program.title,
    manager: "-",
    contact: "-",
    location: "일정에서 확인",
    time: "회차별 상이",
    // 게시됐는데 회차가 하나도 없으면 방문객에게 빈 화면이 나간다 — 이슈로 잡는다.
    status: program.status === "PUBLISHED" && sessionCount.get(program.id) === 0 ? "이슈" : PROGRAM_STATUS[program.status] ?? "준비중",
    note: program.status === "PUBLISHED" && sessionCount.get(program.id) === 0 ? "게시됐지만 등록된 회차가 없습니다." : program.summary ?? "",
  }));

  const businessRows = businesses.flatMap<OperationResource>((business) => {
    const row: OperationResource = {
      id: business.id,
      category: "참여업체",
      name: business.name,
      manager: business.registrationNo,
      contact: "-",
      location: business.boothNo ? `부스 ${business.boothNo}` : "부스 미지정",
      time: "-",
      status: business.participationStatus === "APPROVED" ? "운영중" : business.participationStatus === "REJECTED" ? "이슈" : "준비중",
      note: business.reviewComment ?? PARTICIPATION_LABEL[business.participationStatus] ?? "",
    };
    if (!business.boothNo) return [row];
    return [row, {
      ...row,
      id: `${business.id}-booth`,
      category: "부스" as const,
      name: `${business.boothNo} (${business.name})`,
      note: business.category,
    }];
  });

  const staffRows = staff.map<OperationResource>((assignment) => ({
    id: assignment.id,
    category: assignment.role === "FIELD_OPERATOR" ? "인력" : "자원봉사자",
    name: assignment.staffName,
    manager: assignment.dutyRole,
    contact: "-",
    location: "배치 구역",
    time: timeRange(assignment.startsAt, assignment.endsAt),
    status: assignment.acknowledgedAt ? "운영중" : "이슈",
    note: assignment.acknowledgedAt ? (assignment.task ?? "") : "배정 확인 대기 중이에요.",
  }));

  return [...programRows, ...businessRows, ...staffRows];
}
