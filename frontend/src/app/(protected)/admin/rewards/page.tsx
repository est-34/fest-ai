"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Leaf, Plus, Printer, QrCode as QrCodeIcon, Sparkles } from "lucide-react";
import {
  createRewardAction,
  createRewardCampaign,
  fetchRewardCampaigns,
  type NewRewardAction,
  type NewRewardCampaign,
} from "@/features/rewards";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { QrCode } from "@/shared/ui/qr-code";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SelectField } from "@/shared/ui/select-field";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState } from "@/shared/ui/query-state";
import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { datetimeLocal, seoulShort, toIso } from "@/shared/lib/utils";

const VERIFICATION_LABEL: Record<string, string> = { SELF: "자가 인증", QR: "QR 인증", STAFF: "직원 확인" };

// 백엔드가 action_type을 자유 문자열로 받지만, 표기가 흔들리면 집계가 갈라진다 — 자주 쓰는 값을 제안한다.
const ACTION_TYPES = ["REUSABLE_CUP", "TUMBLER", "RECYCLE", "PUBLIC_TRANSPORT", "WALKING_TOUR", "TRASH_PICKUP"];

function defaultCampaign(): NewRewardCampaign {
  const now = new Date();
  return { name: "", startsAt: datetimeLocal(now), endsAt: datetimeLocal(new Date(now.getTime() + 7 * 24 * 60 * 60_000)), dailyPointLimit: 500 };
}

const VERIFICATION_OPTIONS = [
  { value: "SELF", label: "자가 인증 (방문객 화면 노출)" },
  { value: "QR", label: "QR 인증" },
  { value: "STAFF", label: "현장 직원 확인" },
];

const EMPTY_ACTION: Omit<NewRewardAction, "campaignId"> = {
  actionType: "", verificationType: "SELF", points: 50, perUserLimit: 1, name: "", location: "",
};

export default function RewardsPage() {
  const { form: campaignForm, set: campaignFormSet, field: campaignFormField, reset: resetCampaign } = useForm<NewRewardCampaign>(defaultCampaign);
  const { form: actionForm, set: actionFormSet, field: actionFormField, reset: resetAction } = useForm(EMPTY_ACTION);
  const [selectedCampaign, setSelectedCampaign] = useState("");

  const campaignsQuery = useQuery({ queryKey: ["reward-campaigns"], queryFn: fetchRewardCampaigns });
  const campaigns = campaignsQuery.data ?? [];
  const qrSheet = campaigns.flatMap((item) => item.actions.flatMap((row) => {
    const key = row.rule.verificationKeys?.[0];
    return key ? [{ campaign: item, action: row, key }] : [];
  }));
  const invalidates = ["reward-campaigns"];
  const campaign = useWrite(createRewardCampaign, {
    success: "캠페인을 만들었어요.", invalidates,
    onSuccess: (created) => { setSelectedCampaign(created.id); resetCampaign(); },
  });
  const action = useWrite(createRewardAction, {
    success: "리워드 활동을 추가했어요.", invalidates, onSuccess: resetAction,
  });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground print:hidden">
        ESG 행동 인증 캠페인과 적립 행동을 등록해요. 등록한 행동 중 자가 인증(SELF) 항목은 방문객 스탬프 투어 화면에 바로 노출돼요.
      </p>

      <section className="rounded-2xl border border-border bg-card p-5 print:hidden">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Leaf className="size-4 text-esg-tint" /> 리워드 캠페인</h2>
        <Form
          className="mt-3 grid gap-3 sm:grid-cols-4"
          onSubmit={() =>
            campaign.mutate({ ...campaignForm, startsAt: toIso(campaignForm.startsAt), endsAt: toIso(campaignForm.endsAt) })
          }
        >
          <div className="space-y-1">
            <Label htmlFor="campaign-name">캠페인명</Label>
            <Input id="campaign-name" {...campaignFormField("name")} required placeholder="예: 그린한강 ESG 챌린지" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="campaign-starts">시작</Label>
            <Input id="campaign-starts" type="datetime-local" {...campaignFormField("startsAt")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="campaign-ends">종료</Label>
            <Input id="campaign-ends" type="datetime-local" {...campaignFormField("endsAt")} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="daily-limit">1인 일일 포인트 한도</Label>
            <Input id="daily-limit" type="number" min={1} value={campaignForm.dailyPointLimit} onChange={(event) => campaignFormSet("dailyPointLimit")(Number(event.target.value))} required />
          </div>
          <div className="sm:col-span-4 flex items-center justify-end gap-3">
            <ErrorText error={campaign.error} className="mr-auto" />
            <SubmitButton mutation={campaign} pending="생성 중..."><Plus className="size-3.5" /> 캠페인 생성</SubmitButton>
          </div>
        </Form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 print:hidden">
        <h2 className="text-sm font-bold text-foreground">등록된 캠페인 {campaigns.length > 0 && `(${campaigns.length})`}</h2>
        <div className="mt-3">
          <QueryState query={campaignsQuery} empty="등록된 캠페인이 없어요." skeleton={<SkeletonList count={2} className="h-24 w-full rounded-xl" />}>
            {(rows) => (
              <div className="space-y-2">
                {rows.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {seoulShort(item.startsAt)} ~ {seoulShort(item.endsAt)} · 일일 {item.dailyPointLimit}P
                      </span>
                    </div>
                    {item.actions.length === 0 ? (
                      <p className="mt-2 text-[0.6875rem] text-muted-foreground">등록된 적립 행동이 없습니다.</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {item.actions.map((row) => (
                          <li key={row.id} className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                            <Badge variant="outline" className="text-[0.625rem]">{row.actionType}</Badge>
                            <span className="text-foreground">{row.rule.name ?? "-"}</span>
                            <span>{row.rule.location ?? ""}</span>
                            <span>· {VERIFICATION_LABEL[row.verificationType] ?? row.verificationType}</span>
                            <span>· {row.points}P · 1인 {row.perUserLimit}회</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 print:border-0 print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><QrCodeIcon className="size-4 text-esg-tint" /> 현장 인증 QR</h2>
          <Button type="button" variant="outline" size="sm" disabled={qrSheet.length === 0} onClick={() => window.print()}>
            <Printer className="size-3.5" /> 인쇄
          </Button>
        </div>
        {qrSheet.length === 0 ? (
          <p className="mt-2 text-[0.6875rem] text-muted-foreground print:hidden">QR·직원 확인으로 등록한 적립 행동이 없어요.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
            {qrSheet.map(({ campaign: owner, action: row, key }) => (
              <div key={row.id} className="flex flex-col items-center gap-1.5 rounded-xl border border-border p-4 text-center print:break-inside-avoid">
                <QrCode value={key} size={160} alt={`${row.rule.name ?? row.actionType} 인증 QR`} />
                <p className="text-sm font-semibold text-foreground">{row.rule.name ?? row.actionType}</p>
                <p className="text-[0.6875rem] text-muted-foreground">{row.rule.location} · {row.points}P · 1인 {row.perUserLimit}회</p>
                {/* 카메라가 안 잡힐 때 방문객이 직접 입력할 수 있도록 값도 함께 인쇄한다. */}
                <code className="text-[0.625rem] text-muted-foreground">{key}</code>
                <p className="text-[0.625rem] text-muted-foreground">{owner.name}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 print:hidden">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground"><Sparkles className="size-4 text-primary" /> 적립 행동</h2>
        <QueryState
          query={campaignsQuery}
          className="mt-2"
          empty="먼저 캠페인을 만들면 적립 행동을 추가할 수 있어요."
          emptyWhen={campaigns.length === 0}
          skeleton={<Skeleton className="mt-3 h-10 w-full rounded-lg" />}
        >
          {() => (
            <Form
              className="mt-3 grid gap-3 sm:grid-cols-3"
              onSubmit={() => action.mutate({ ...actionForm, campaignId: selectedCampaign })}
            >
              <div className="space-y-1">
                <Label>캠페인</Label>
                <SelectField
                  value={selectedCampaign}
                  onValueChange={setSelectedCampaign}
                  options={campaigns.map((item) => ({ value: item.id, label: item.name }))}
                  placeholder="캠페인 선택"
                  aria-label="캠페인"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="action-type">행동 코드</Label>
                <Input id="action-type" list="reward-action-types" value={actionForm.actionType} onChange={(event) => actionFormSet("actionType")(event.target.value.toUpperCase())} required placeholder="예: REUSABLE_CUP" />
                <datalist id="reward-action-types">
                  {ACTION_TYPES.map((type) => <option key={type} value={type} />)}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label>인증 방식</Label>
                <SelectField
                  value={actionForm.verificationType}
                  onValueChange={(value) => actionFormSet("verificationType")(value as NewRewardAction["verificationType"])}
                  options={VERIFICATION_OPTIONS}
                  aria-label="인증 방식"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="action-name">방문객 표시 이름</Label>
                <Input id="action-name" {...actionFormField("name")} required placeholder="예: 다회용기 사용" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="action-location">위치</Label>
                <Input id="action-location" {...actionFormField("location")} required placeholder="예: 푸드존 F-2" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="points">포인트</Label>
                  <Input id="points" type="number" min={1} value={actionForm.points} onChange={(event) => actionFormSet("points")(Number(event.target.value))} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="per-user">1인 한도</Label>
                  <Input id="per-user" type="number" min={1} value={actionForm.perUserLimit} onChange={(event) => actionFormSet("perUserLimit")(Number(event.target.value))} required />
                </div>
              </div>
              <div className="sm:col-span-3 flex items-center justify-end gap-3">
                <ErrorText error={action.error} className="mr-auto" />
                <SubmitButton mutation={action} pending="추가 중..." disabled={!selectedCampaign}>행동 추가</SubmitButton>
              </div>
            </Form>
          )}
        </QueryState>
      </section>
    </div>
  );
}
