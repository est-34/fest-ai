import { festivalApi, json } from "@/shared/lib/api";

export interface NewRewardCampaign {
  name: string;
  startsAt: string;
  endsAt: string;
  dailyPointLimit: number;
}

export function createRewardCampaign(input: NewRewardCampaign) {
  return festivalApi<{ id: string; name: string }>(`/reward-campaigns`, json("POST", input));
}

export interface NewRewardAction {
  campaignId: string;
  actionType: string;
  verificationType: "SELF" | "QR" | "STAFF";
  points: number;
  perUserLimit: number;
  /** rule.name/location은 방문객 스탬프 화면에 그대로 노출된다. */
  name: string;
  location: string;
}

/**
 * 현장 QR·직원 확인에 쓰는 인증 값. 시드(`scripts/seed.py`)와 같은 규칙이라 인쇄물과
 * 방문객 스캐너가 그대로 맞물린다. 행동 코드는 캠페인 안에서 유일하다.
 */
export function verificationKeyFor(actionType: string) {
  return `stamp:${actionType.toLowerCase().replace(/_/g, "-")}`;
}

/** SELF가 아닌 인증 방식은 백엔드가 rule.verificationKeys를 요구한다 — 없으면 400으로 거절된다. */
export function rewardActionRule({ actionType, verificationType, name, location }: Omit<NewRewardAction, "campaignId">) {
  const rule: RewardAction["rule"] = { name, location };
  if (verificationType !== "SELF") rule.verificationKeys = [verificationKeyFor(actionType)];
  return rule;
}

export function createRewardAction({ campaignId, name, location, ...input }: NewRewardAction) {
  const rule = rewardActionRule({ ...input, name, location });
  return festivalApi(`/reward-campaigns/${campaignId}/actions`, json("POST", { ...input, rule }));
}

export interface RewardAction {
  id: string;
  actionType: string;
  verificationType: NewRewardAction["verificationType"];
  points: number;
  perUserLimit: number;
  rule: { name?: string; location?: string; verificationKeys?: string[] };
}

export interface RewardCampaign {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  dailyPointLimit: number;
  actions: RewardAction[];
}

export function fetchRewardCampaigns() {
  return festivalApi<RewardCampaign[]>(`/reward-campaigns`);
}
