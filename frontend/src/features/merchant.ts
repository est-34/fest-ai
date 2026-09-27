import { adminApi, json } from "@/shared/lib/api";
import type { NewCoupon } from "@/features/business-admin";
import { uniqueById } from "@/shared/lib/utils";

export interface MenuItem {
  name: string;
  price: number;
}

export interface MerchantBusiness {
  id: string;
  festivalId: string;
  name: string;
  registrationNo: string;
  category: string;
  description: string | null;
  /** 방문객 업체 목록·상세에 그대로 나가는 값들. 화면에 편집란이 없어 등록 후 고칠 수 없었다. */
  menu: MenuItem[];
  operatingHours: Record<string, string>;
  accessibility: Record<string, boolean>;
  participationStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  reviewComment: string | null;
  boothNo: string | null;
  version: number;
}

export async function fetchMyBusinesses() {
  const rows = await adminApi<MerchantBusiness[]>("/merchant/businesses");
  // 부스가 여러 개면 업체가 부스 수만큼 중복돼 온다. 업체 단위 화면이라 대표 부스만 남긴다.
  return uniqueById(rows);
}

export interface BusinessUpdate {
  businessId: string;
  version: number;
  name?: string;
  category?: string;
  description?: string;
  menu?: MenuItem[];
  operatingHours?: Record<string, string>;
  accessibility?: Record<string, boolean>;
}

/** 수정하면 참여 상태가 SUBMITTED로 돌아가 재검수를 받는다. */
export function updateMyBusiness({ businessId, ...body }: BusinessUpdate) {
  return adminApi(`/merchant/businesses/${businessId}`, json("PATCH", body));
}

/** 상인 콘솔의 쿠폰 발행 입력. 운영자 콘솔과 본문이 같아 한 곳(business-admin)만 정의한다. */
export type MerchantCoupon = NewCoupon;

export function createMerchantCoupon({ businessId, ...body }: MerchantCoupon & { businessId: string }) {
  return adminApi(`/merchant/businesses/${businessId}/coupons`, json("POST", body));
}

/** 방문객이 보여준 쿠폰 발급 ID와 토큰을 대조해 사용 처리한다. */
export function redeemCoupon({ issueId, issueToken }: { issueId: string; issueToken: string }) {
  return adminApi<{ id: string; status: string }>(`/merchant/coupon-issues/${issueId}/redeem`, json("POST", { issueToken }));
}

export function reverseRedemption({ redemptionId, reason }: { redemptionId: string; reason: string }) {
  return adminApi(`/merchant/coupon-redemptions/${redemptionId}/reverse`, json("POST", { reason }));
}

export function recordBusinessEvent({ businessId, ...body }: { businessId: string; eventType: "VISIT" | "SALE"; salesAmount?: number }) {
  return adminApi(`/merchant/businesses/${businessId}/events`, json("POST", body));
}

export interface MerchantPerformance {
  events: Array<{ eventType: string; count: number; salesAmount: number }>;
  coupons: { issued: number; redeemed: number };
}

export function fetchPerformance(businessId: string) {
  return adminApi<MerchantPerformance>(`/merchant/businesses/${businessId}/performance`);
}
