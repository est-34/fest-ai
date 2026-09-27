"use client";

import { useState } from "react";
import { MessageSquareWarning, CheckCircle2 } from "lucide-react";
import { json, visitorApi } from "@/shared/lib/api";
import { useTranslation } from "@/shared/lib/i18n";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { cn } from "@/shared/lib/utils";
import { queryErrorMessage } from "@/shared/ui/query-state";
import { Button } from "@/shared/ui/button";
import { iconTileClass, iconTileLabelClass } from "@/shared/ui/icon-tile";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { SelectField } from "@/shared/ui/select-field";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetFooter,
} from "@/shared/ui/sheet";

const CATEGORIES = [
  "편의시설",
  "안전",
  "교통",
  "ESG운영",
  "일정",
  "기타",
] as const;

export function ComplaintSheet({
  triggerClassName,
}: { triggerClassName?: string } = {}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { form, field, set, reset } = useForm({
    title: "",
    category: "기타" as (typeof CATEGORIES)[number],
    description: "",
  });

  const canSubmit = form.title.trim().length > 0 && form.description.trim().length > 0;

  // 오류는 시트 안에 그대로 그리므로 전역 토스트는 끈다.
  const submit = useWrite(() => visitorApi("/visitor/complaints", json("POST", form)), { silent: true });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          submit.reset();
        }
      }}
    >
      <SheetTrigger
        render={<Button variant="ghost" className={cn(iconTileClass, triggerClassName)} aria-label={t.complaint.ariaLabel} />}
      >
        <MessageSquareWarning className="size-5" />
        <span className={iconTileLabelClass}>{t.complaint.shortLabel}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-3xl">
        {submit.isSuccess ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-foreground">
                {t.complaint.thanksTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.complaint.thanksDescription}
              </p>
            </div>
            <Button size="sm" onClick={() => setOpen(false)}>
              {t.complaint.closeButton}
            </Button>
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{t.complaint.sheetTitle}</SheetTitle>
              <SheetDescription>
                {t.complaint.sheetDescription}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-1.5">
                <Label
                  htmlFor="complaint-title"
                  className="text-sm font-semibold"
                >
                  {t.complaint.titleLabel}
                </Label>
                <Input
                  id="complaint-title"
                  placeholder={t.complaint.titlePlaceholder}
                  {...field("title")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">{t.complaint.categoryLabel}</Label>
                <SelectField
                  value={form.category}
                  onValueChange={(value) => set("category")(value as (typeof CATEGORIES)[number])}
                  options={CATEGORIES.map((c) => ({ value: c, label: t.complaint.categories[c] }))}
                  aria-label={t.complaint.categoryLabel}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="complaint-description"
                  className="text-sm font-semibold"
                >
                  {t.complaint.descriptionLabel}
                </Label>
                <Textarea
                  id="complaint-description"
                  placeholder={t.complaint.descriptionPlaceholder}
                  className="min-h-28"
                  {...field("description")}
                />
              </div>
            </div>
            <SheetFooter>
              {submit.error && (
                <p className="text-xs text-destructive" role="alert">
                  {queryErrorMessage(submit.error, "민원을 접수하지 못했어요.")}
                </p>
              )}
              <Button disabled={!canSubmit || submit.isPending} onClick={() => submit.mutate()}>
                {t.complaint.submitButton}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
