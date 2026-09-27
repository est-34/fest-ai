"use client";

import { CouponForm } from "@/features/coupon-form";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Receipt,
  ScanLine,
  Store,
  TrendingUp,
} from "lucide-react";
import {
  createMerchantCoupon,
  fetchMyBusinesses,
  fetchPerformance,
  recordBusinessEvent,
  redeemCoupon,
  reverseRedemption,
  updateMyBusiness,
  type MenuItem,
  type MerchantBusiness,
} from "@/features/merchant";
import {
  PARTICIPATION_LABEL,
  PARTICIPATION_TONE,
} from "@/features/business-admin";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { QueryState, queryErrorMessage } from "@/shared/ui/query-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { StatusPill } from "@/shared/ui/status-pill";
import { Switch } from "@/shared/ui/switch";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";


function PerformanceCard({ businessId }: { businessId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["merchant-performance", businessId],
    queryFn: () => fetchPerformance(businessId),
  });

  if (isLoading) return <Skeleton className="h-24 w-full rounded-xl" />;

  const sales = data?.events.find((event) => event.eventType === "SALE");
  const visits = data?.events.find((event) => event.eventType === "VISIT");

  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {[
        { label: "방문 이벤트", value: `${visits?.count ?? 0}건` },
        { label: "매출 건수", value: `${sales?.count ?? 0}건` },
        {
          label: "매출 합계",
          value: `${Number(sales?.salesAmount ?? 0).toLocaleString()}원`,
        },
        {
          label: "쿠폰 발급/사용",
          value: `${data?.coupons.issued ?? 0} / ${data?.coupons.redeemed ?? 0}`,
        },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-border p-3">
          <p className="text-[0.6875rem] text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-bold text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function BusinessPanel({ business }: { business: MerchantBusiness }) {
  const { form: profile, field: profileField } = useForm({
    name: business.name,
    category: business.category,
    description: business.description ?? "",
  });
  const [menu, setMenu] = useState<MenuItem[]>(business.menu ?? []);
  const [hours, setHours] = useState(business.operatingHours?.daily ?? "");
  const [wheelchair, setWheelchair] = useState(
    Boolean(business.accessibility?.wheelchair),
  );
  const {
    form: redeem,
    field: redeemField,
    reset: resetRedeem,
  } = useForm({ issueId: "", issueToken: "" });
  const {
    form: reverse,
    field: reverseField,
    reset: resetReverse,
  } = useForm({ redemptionId: "", reason: "" });
  const [sale, setSale] = useState("");
  const patchMenu = (index: number, values: Partial<MenuItem>) =>
    setMenu(
      menu.map((row, position) =>
        position === index ? { ...row, ...values } : row,
      ),
    );

  const invalidates = [
    "merchant-businesses",
    ["merchant-performance", business.id],
  ] as const;
  const save = useWrite(updateMyBusiness, { invalidates });
  const useCoupon = useWrite(redeemCoupon, {
    invalidates,
    onSuccess: resetRedeem,
  });
  const cancelUse = useWrite(reverseRedemption, {
    invalidates,
    onSuccess: resetReverse,
  });
  const event = useWrite(recordBusinessEvent, {
    invalidates,
    onSuccess: () => setSale(""),
  });

  const approved = business.participationStatus === "APPROVED";

  return (
    <article className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Store className="size-4 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">{business.name}</p>
        <StatusPill tone={PARTICIPATION_TONE[business.participationStatus]}>
          {PARTICIPATION_LABEL[business.participationStatus]}
        </StatusPill>
        {business.boothNo && (
          <Badge variant="outline" className="text-[0.625rem]">
            부스 {business.boothNo}
          </Badge>
        )}
      </div>
      {business.reviewComment && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          검토 의견: {business.reviewComment}
        </p>
      )}

      <PerformanceCard businessId={business.id} />

      <Form
        className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3"
        onSubmit={() =>
          save.mutate({
            businessId: business.id,
            version: business.version,
            ...profile,
            menu: menu.filter((item) => item.name.trim()),
            operatingHours: hours.trim() ? { daily: hours.trim() } : {},
            accessibility: { wheelchair },
          })
        }
      >
        <div className="space-y-1">
          <Label htmlFor={`name-${business.id}`}>업체명</Label>
          <Input
            id={`name-${business.id}`}
            {...profileField("name")}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`category-${business.id}`}>업종</Label>
          <Input
            id={`category-${business.id}`}
            {...profileField("category")}
            required
          />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor={`description-${business.id}`}>소개</Label>
          <Textarea
            id={`description-${business.id}`}
            rows={2}
            {...profileField("description")}
          />
        </div>

        {/* 메뉴·영업시간·접근성은 방문객 화면에 그대로 나가는데 편집란이 없어서, 등록 뒤에는
            운영자에게 부탁하지 않으면 한 글자도 고칠 수 없었다. */}
        <div className="space-y-1 sm:col-span-3">
          <Label>메뉴</Label>
          {menu.map((item, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={item.name}
                onChange={(event) =>
                  patchMenu(index, { name: event.target.value })
                }
                placeholder="메뉴명"
                aria-label={`${index + 1}번 메뉴 이름`}
              />
              <Input
                type="number"
                min={0}
                className="w-32"
                value={item.price}
                onChange={(event) =>
                  patchMenu(index, { price: Number(event.target.value) })
                }
                placeholder="가격"
                aria-label={`${index + 1}번 메뉴 가격`}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`${index + 1}번 메뉴 삭제`}
                onClick={() =>
                  setMenu(menu.filter((_, position) => position !== index))
                }
              >
                삭제
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMenu([...menu, { name: "", price: 0 }])}
          >
            메뉴 추가
          </Button>
        </div>

        <div className="space-y-1">
          <Label htmlFor={`hours-${business.id}`}>영업시간</Label>
          <Input
            id={`hours-${business.id}`}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            placeholder="예: 10:00-20:00"
          />
        </div>
        <label className="flex items-center gap-2 self-end text-xs text-foreground">
          <Switch checked={wheelchair} onCheckedChange={setWheelchair} />
          휠체어 접근 가능
        </label>

        <div className="sm:col-span-3 flex items-center justify-end gap-3">
          <p className="mr-auto text-[0.6875rem] text-muted-foreground">
            저장하면 재검수 대기 상태로 바뀝니다.
          </p>
          <ErrorText error={save.error} />
          <SubmitButton mutation={save} pending="저장 중...">
            정보 저장
          </SubmitButton>
        </div>
      </Form>

      {approved && (
        <>
          <CouponForm businessId={business.id} createCoupon={createMerchantCoupon}
            issueLimit={50} invalidates={invalidates} quantityPlaceholder="수량"
            className="border-t border-border pt-4"
            heading={<p className="sm:col-span-6 flex items-center gap-1.5 text-xs font-bold text-foreground"><BadgePercent className="size-3.5" /> 쿠폰 발행</p>} />

          <Form
            className="grid gap-2 border-t border-border pt-4 sm:grid-cols-4"
            onSubmit={() => useCoupon.mutate(redeem)}
          >
            <p className="sm:col-span-4 flex items-center gap-1.5 text-xs font-bold text-foreground">
              <ScanLine className="size-3.5" /> 쿠폰 사용 처리
            </p>
            <Input placeholder="발급 ID" {...redeemField("issueId")} required />
            <Input
              className="sm:col-span-2"
              placeholder="쿠폰 토큰 (cp_...)"
              {...redeemField("issueToken")}
              required
            />
            <SubmitButton mutation={useCoupon}>사용 처리</SubmitButton>
            <ErrorText error={useCoupon.error} className="sm:col-span-4" />
            {useCoupon.data && (
              <p className="sm:col-span-4 text-xs text-emerald-600">
                사용 처리 완료 · 취소용 ID {useCoupon.data.id}
              </p>
            )}
          </Form>

          <Form
            className="grid gap-2 sm:grid-cols-4"
            onSubmit={() => cancelUse.mutate(reverse)}
          >
            <Input
              placeholder="사용 내역 ID"
              {...reverseField("redemptionId")}
              required
            />
            <Input
              className="sm:col-span-2"
              placeholder="취소 사유"
              {...reverseField("reason")}
              required
            />
            <SubmitButton mutation={cancelUse} variant="outline">
              사용 취소
            </SubmitButton>
            <ErrorText error={cancelUse.error} className="sm:col-span-4" />
          </Form>

          <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-4">
            <p className="sm:col-span-4 flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Receipt className="size-3.5" /> 매출·방문 기록
            </p>
            <Input
              className="sm:col-span-2"
              type="number"
              min={0}
              placeholder="매출 금액(원)"
              value={sale}
              onChange={(input) => setSale(input.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!sale || event.isPending}
              onClick={() =>
                event.mutate({
                  businessId: business.id,
                  eventType: "SALE",
                  salesAmount: Number(sale),
                })
              }
            >
              <TrendingUp className="size-3.5" /> 매출 기록
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={event.isPending}
              onClick={() =>
                event.mutate({ businessId: business.id, eventType: "VISIT" })
              }
            >
              방문 기록
            </Button>
            <ErrorText error={event.error} className="sm:col-span-4" />
          </div>
        </>
      )}
    </article>
  );
}

export default function MerchantPage() {
  const businesses = useQuery({
    queryKey: ["merchant-businesses"],
    queryFn: fetchMyBusinesses,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        내 업체 정보와 쿠폰, 매출 성과를 관리해요. 정보를 수정하면 축제 담당자의
        재검수를 거칩니다.
      </p>

      <QueryState
        query={businesses}
        empty="연결된 업체가 없어요. 축제 담당자에게 업체 등록을 요청하세요."
        errorMessage={`업체 정보를 불러오지 못했어요. 참여업체(MERCHANT) 계정으로 로그인했는지 확인해 주세요. (${queryErrorMessage(businesses.error)})`}
        skeleton={<Skeleton className="h-64 w-full rounded-2xl" />}
      >
        {(rows) => (
          <div className="space-y-4">
            {rows.map((business) => (
              <BusinessPanel key={business.id} business={business} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
