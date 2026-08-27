"use client";

import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import type { PrivacyConsentGate } from "@/features/privacy/model/use-privacy-consent-gate";

/** 개인정보 수집 항목을 항목별 체크박스로 보여준다. 필수/선택 배지는 withdrawable 여부로 갈린다. */
export function PrivacyConsentChecklist({
  gate,
}: {
  gate: PrivacyConsentGate;
}) {
  if (gate.isError) return null;

  return (
    <section className="mt-6 w-full bg-card p-5 sm:p-6 lg:w-fit lg:min-w-md">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ShieldCheck className="size-3.5 text-primary" />
        개인정보 수집·이용 동의
      </p>

      <label className="mt-5 flex items-center gap-2.5 rounded-xl bg-muted p-3">
        <Checkbox
          checked={gate.allChecked}
          onCheckedChange={(value) => gate.toggleAll(value)}
        />
        <span className="text-sm font-bold text-foreground">
          전체 동의하기
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">
            선택 동의 포함
          </span>
        </span>
      </label>

      <Accordion className="mt-2">
        {gate.items.map((item) => {
          const required = !item.withdrawable;
          return (
            <AccordionItem key={item.key} value={item.key}>
              <div className="flex items-center gap-2.5 py-1 px-3">
                <Checkbox
                  checked={gate.checked[item.key] ?? false}
                  onCheckedChange={(value) => gate.toggle(item.key, value)}
                />
                <AccordionTrigger className="py-2">
                  <span className="text-sm font-semibold text-foreground">
                    {`(${required ? "필수" : "선택"}) `}
                    {item.label}
                  </span>
                </AccordionTrigger>
              </div>
              <AccordionContent className="pl-8 text-xs leading-5 text-muted-foreground">
                {item.basis}
              </AccordionContent>
            </AccordionItem>
          );
        })}
        {gate.isLoading && (
          <p className="py-2 text-xs text-muted-foreground">
            수집 항목을 불러오는 중...
          </p>
        )}
      </Accordion>

      {!gate.canEnter && gate.requiredItems.length > 0 && (
        <p className="mt-3 text-[0.6875rem] text-muted-foreground">
          필수 항목에 모두 동의하면 위 방문객으로 둘러보기 버튼이 활성화돼요.
        </p>
      )}
    </section>
  );
}
