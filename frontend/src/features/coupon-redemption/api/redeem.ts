import { adminApi, adminFestivalId, json } from "@/shared/lib/api";

export interface CouponRedemption {
  id: string;
  couponIssueId: string;
  couponName: string;
  status: string;
  redeemedAt: string;
}

interface RedemptionRow {
  id: string;
  couponIssueId: string;
  status: string;
  redeemedAt: string;
  couponName?: string;
}

/**
 * 현장 사용 처리. 상인용 경로는 업체 소유자로 범위가 묶여 운영자가 쓸 수 없어서,
 * 축제 범위로 동작하는 운영자 전용 경로를 쓴다(스캔한 토큰 하나로 발급 건을 찾는다).
 */
export async function redeemCouponOnSite(issueToken: string): Promise<CouponRedemption> {
  const festivalId = await adminFestivalId();
  const row = await adminApi<RedemptionRow>(
    `/admin/festivals/${festivalId}/coupon-redemptions`,
    json("POST", { issueToken: issueToken.trim() }),
  );
  return {
    id: row.id,
    couponIssueId: row.couponIssueId,
    couponName: row.couponName ?? "쿠폰",
    status: row.status,
    redeemedAt: row.redeemedAt,
  };
}

// 서버가 토큰 형식을 cp_로 검증하므로, 잘못 스캔한 값은 요청 전에 걸러 안내한다.
export function isCouponToken(value: string) {
  return /^cp_[\w-]+$/.test(value.trim());
}
