import { festivalApi, json } from "@/shared/lib/api";
import { datetimeLocal, uniqueById } from "@/shared/lib/utils";
import type { Tone } from "@/shared/ui/status-pill";

export type ParticipationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export const PARTICIPATION_LABEL: Record<string, string> = {
  DRAFT: "작성 중",
  SUBMITTED: "검토 대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

/** 운영자 화면과 상인 화면이 같은 심사 상태를 같은 색으로 보여주도록 한 곳에 둔다. */
export const PARTICIPATION_TONE: Record<string, Tone> = {
  DRAFT: "neutral",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export interface AdminBusiness {
  id: string;
  businessId: string;
  name: string;
  registrationNo: string;
  category: string;
  description: string | null;
  participationStatus: ParticipationStatus;
  reviewComment: string | null;
  isSponsored: boolean;
  esgParticipating: boolean;
  /** BIZ-04 매출 데이터 수집 동의. 끄면 파기 배치가 해당 업체 매출 이벤트를 즉시 지운다. */
  salesConsent: boolean;
  boothNo: string | null;
  areaId: string | null;
  ownerMembershipId: string | null;
  version: number;
}

export async function fetchAdminBusinesses(status?: ParticipationStatus) {
  const rows = await festivalApi<AdminBusiness[]>(`/businesses${status ? `?status=${status}` : ""}`);
  // 부스가 여러 개인 업체는 부스마다 한 줄로 온다. 업체 단위 화면이므로 대표 부스 하나만 남긴다.
  return uniqueById(rows);
}

/**
 * 운영자가 고치는 참여업체 속성.
 *
 * 광고 노출(isSponsored)과 ESG 참여(esgParticipating)는 방문객 추천 점수·광고 분리의
 * 입력값인데 설정할 화면도 API도 없어서, DB를 직접 고치지 않으면 켤 수 없었다.
 */
export function updateAdminBusiness({ businessId, version, ...body }: {
  businessId: string;
  version: number;
  category?: string;
  description?: string;
  isSponsored?: boolean;
  esgParticipating?: boolean;
  salesConsent?: boolean;
}) {
  return festivalApi<AdminBusiness>(`/businesses/${businessId}`, json("PATCH", { ...body, version }));
}

/** BIZ-05 상인 계정 초대. 계정은 업체를 지정한 이 링크로만 발급되고 자율 가입은 없다. */
export interface MerchantInvitation {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  expired: boolean;
  acceptedName: string | null;
}

export interface MerchantInvitationList {
  invitations: MerchantInvitation[];
  owner: { membershipId: string; status: string; name: string; email: string } | null;
}

export function fetchMerchantInvitations(businessId: string) {
  return festivalApi<MerchantInvitationList>(`/businesses/${businessId}/invitations`);
}

export function createMerchantInvitation({ businessId, email, name }: { businessId: string; email: string; name: string }) {
  return festivalApi<MerchantInvitation & { inviteToken: string; expiresInHours: number }>(
    `/businesses/${businessId}/invitations`,
    json("POST", { email, name }),
  );
}

export function revokeMerchantInvitation({ businessId, invitationId }: { businessId: string; invitationId: string }) {
  return festivalApi(`/businesses/${businessId}/invitations/${invitationId}/revoke`, { method: "POST" });
}

/** 축제 종료 후 정리. 계정을 지우지 않고 비활성화하고 업체 연결만 끊는다(보유기간은 OPS-11). */
export function deactivateBusinessMerchant(businessId: string) {
  return festivalApi<void>(`/businesses/${businessId}/merchant`, { method: "DELETE" });
}

export interface BusinessPerformanceRow {
  id: string;
  name: string;
  category: string;
  isSponsored: boolean;
  esgParticipating: boolean;
  salesConsent: boolean;
  impressions: number;
  visits: number;
  couponsIssued: number;
  couponsRedeemed: number;
  salesAmount: number | null;
  redemptionRate: number | null;
  visitRate: number | null;
}

export interface BusinessPerformance {
  items: BusinessPerformanceRow[];
  totals: { impressions: number; visits: number; couponsIssued: number; couponsRedeemed: number; businesses: number; salesConsented: number };
  comparison: { averageRedemptionRate: number | null; medianRedemptionRate: number | null; averageCouponsIssued: number } | null;
  comparisonSuppressed: boolean;
  minComparisonSample: number;
  salesNotice: string;
}

/** BIZ-04 운영자용 전체 참여 성과. 표본이 적으면 서버가 비교 통계를 내려주지 않는다. */
export function fetchBusinessPerformance() {
  return festivalApi<BusinessPerformance>(`/business-performance`);
}

export interface NewBusiness {
  registrationNo: string;
  name: string;
  category: string;
  description?: string;
  areaId?: string;
  boothNo?: string;
}

export function createBusiness(input: NewBusiness) {
  return festivalApi(`/businesses`, json("POST", input));
}

export function reviewBusiness({ businessId, decision, comment }: { businessId: string; decision: "APPROVED" | "REJECTED"; comment?: string }) {
  return festivalApi(`/businesses/${businessId}/review`, json("POST", { decision, comment }));
}

export interface AdminCoupon {
  id: string;
  name: string;
  description: string | null;
  benefitType: "FIXED" | "PERCENT" | "GIFT";
  benefitValue: number;
  issueLimit: number;
  perVisitorLimit: number;
  validFrom: string;
  validUntil: string;
  status: string;
  issuedCount: number;
}

export function fetchBusinessCoupons(businessId: string) {
  return festivalApi<AdminCoupon[]>(`/businesses/${businessId}/coupons`);
}

export interface NewCoupon {
  name: string;
  description?: string;
  benefitType: "FIXED" | "PERCENT" | "GIFT";
  benefitValue: number;
  issueLimit: number;
  perVisitorLimit: number;
  startsAt: string;
  endsAt: string;
}

export const BENEFIT_TYPES: { value: NewCoupon["benefitType"]; label: string }[] = [
  { value: "PERCENT", label: "% 할인" },
  { value: "FIXED", label: "정액 할인" },
  { value: "GIFT", label: "사은품" },
];

/** 쿠폰 발행 폼 초기값. 운영자·상인 콘솔이 같은 폼을 쓰고 기본 발행 수량만 다르다. */
export function couponDefaults(issueLimit = 100): NewCoupon {
  const now = new Date();
  return {
    name: "", description: "", benefitType: "PERCENT", benefitValue: 10,
    issueLimit, perVisitorLimit: 1,
    startsAt: datetimeLocal(now), endsAt: datetimeLocal(new Date(now.getTime() + 7 * 24 * 60 * 60_000)),
  };
}

export function createBusinessCoupon({ businessId, ...input }: NewCoupon & { businessId: string }) {
  return festivalApi(`/businesses/${businessId}/coupons`, json("POST", input));
}
