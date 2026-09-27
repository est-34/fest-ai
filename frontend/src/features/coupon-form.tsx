"use client";

import type { ReactNode } from "react";
import { couponDefaults, BENEFIT_TYPES, type NewCoupon } from "@/features/business-admin";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { cn, toIso } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { SelectField } from "@/shared/ui/select-field";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";

export function CouponForm({ businessId, createCoupon, issueLimit = 100, invalidates, success, className, heading, quantityPlaceholder = "발급 수량" }: {
  businessId: string;
  createCoupon: (input: NewCoupon & { businessId: string }) => Promise<unknown>;
  issueLimit?: number;
  invalidates: readonly (string | readonly unknown[])[];
  success?: string;
  className?: string;
  heading?: ReactNode;
  quantityPlaceholder?: string;
}) {
  const { form, set, field, reset } = useForm<NewCoupon>(() => couponDefaults(issueLimit));
  const create = useWrite(createCoupon, { success, invalidates, onSuccess: reset });

  return (
    <Form className={cn("grid gap-2 sm:grid-cols-6", className)} onSubmit={() =>
      create.mutate({ ...form, businessId, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt) })
    }>
      {heading}
      <Input className="sm:col-span-2" placeholder="쿠폰명" {...field("name")} required />
      <SelectField value={form.benefitType} onValueChange={(value) => set("benefitType")(value as NewCoupon["benefitType"])} options={BENEFIT_TYPES} aria-label="혜택 유형" />
      <Input type="number" min={0} placeholder="혜택값" value={form.benefitValue} onChange={(event) => set("benefitValue")(Number(event.target.value))} required />
      <Input type="number" min={1} placeholder={quantityPlaceholder} value={form.issueLimit} onChange={(event) => set("issueLimit")(Number(event.target.value))} required />
      <Input type="number" min={1} placeholder="1인 한도" value={form.perVisitorLimit} onChange={(event) => set("perVisitorLimit")(Number(event.target.value))} required />
      <Input className="sm:col-span-3" type="datetime-local" {...field("startsAt")} required />
      <Input className="sm:col-span-3" type="datetime-local" {...field("endsAt")} required />
      <div className="sm:col-span-6 flex items-center justify-end gap-3">
        <ErrorText error={create.error} className="mr-auto text-[0.6875rem]" />
        <SubmitButton mutation={create} pending="발행 중...">쿠폰 발행</SubmitButton>
      </div>
    </Form>
  );
}
