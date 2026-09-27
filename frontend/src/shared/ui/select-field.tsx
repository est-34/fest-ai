"use client";

import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { cn } from "@/shared/lib/utils";

/** 문자열 하나면 값과 라벨이 같은 보기다. */
export type SelectOption = string | { value: string; label: ReactNode };

/**
 * 옵션 배열을 받는 Select. 화면마다 반복되던
 * Trigger/Value/Content + `options.map(...)` 6줄을 한 줄로 줄인다.
 * 열고 닫는 구조를 직접 다뤄야 하는 곳(그룹·구분선 등)은 Select를 그대로 쓴다.
 */
export function SelectField({
  value,
  onValueChange,
  options,
  placeholder,
  size,
  className,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(String(next ?? ""))} disabled={disabled}>
      <SelectTrigger size={size} className={cn("w-full", className)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
