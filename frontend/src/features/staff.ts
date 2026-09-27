import { adminApi, adminOrganizationId, festivalApi, json } from "@/shared/lib/api";

export interface StaffAssignment {
  id: string;
  membershipId: string;
  areaId: string;
  dutyRole: string;
  task: string | null;
  startsAt: string;
  endsAt: string;
  acknowledgedAt: string | null;
  staffName: string;
  role: string;
}

export function fetchStaffAssignments() {
  return festivalApi<StaffAssignment[]>(`/staff-assignments`);
}

export interface NewStaffAssignment {
  membershipId: string;
  areaId: string;
  dutyRole: string;
  task?: string;
  startsAt: string;
  endsAt: string;
}

export function createStaffAssignment(input: NewStaffAssignment) {
  return festivalApi(`/staff-assignments`, json("POST", input));
}

export function acknowledgeAssignment(assignmentId: string) {
  return festivalApi(`/staff-assignments/${assignmentId}/acknowledge`, { method: "POST" });
}

export interface Membership {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  festivalScope: string[];
  status: string;
  createdAt: string;
}

// 멤버십 API는 조직 단위다 — 조직 ID는 api.ts가 세션 단위로 캐시해 둔 값을 쓴다.

export async function fetchMemberships() {
  return adminApi<Membership[]>(`/admin/organizations/${await adminOrganizationId()}/memberships`);
}

export interface NewMembership {
  email: string;
  name: string;
  password: string;
  role: Membership["role"];
  festivalScope: string[];
}

export async function createMembership(input: NewMembership) {
  return adminApi(`/admin/organizations/${await adminOrganizationId()}/memberships`, json("POST", input));
}

export async function updateMembership({ membershipId, ...body }: { membershipId: string; role?: string; status?: string; festivalScope?: string[] }) {
  return adminApi(`/admin/organizations/${await adminOrganizationId()}/memberships/${membershipId}`, json("PATCH", body));
}

export async function deactivateMembership(membershipId: string) {
  return adminApi<void>(`/admin/organizations/${await adminOrganizationId()}/memberships/${membershipId}`, { method: "DELETE" });
}
