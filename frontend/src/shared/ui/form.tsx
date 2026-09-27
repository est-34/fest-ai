"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { queryErrorMessage } from "@/shared/ui/query-state";
import { cn } from "@/shared/lib/utils";

/**
 * 기본 제출 동작만 막는 form. 화면마다 반복되던
 * `onSubmit={(event) => { event.preventDefault(); ... }}` 래퍼를 없앤다.
 */
export function Form({ onSubmit, ...props }: Omit<ComponentProps<"form">, "onSubmit"> & { onSubmit: () => void }) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    />
  );
}

/**
 * 제출 버튼. 진행 중에는 스스로 잠기고 pending 문구로 바뀐다 —
 * `disabled={m.isPending}` + `{m.isPending ? "저장 중..." : "저장"}` 자리.
 */
export function SubmitButton({
  mutation,
  pending,
  disabled,
  type = "submit",
  size = "sm",
  children,
  ...props
}: ComponentProps<typeof Button> & {
  mutation: { isPending: boolean };
  /** 진행 중에 보여줄 문구. 없으면 children을 그대로 둔다. */
  pending?: string;
}) {
  return (
    <Button type={type} size={size} disabled={disabled || mutation.isPending} {...props}>
      {mutation.isPending && pending ? pending : children}
    </Button>
  );
}

/** 쓰기 실패 문구. 오류가 없으면 아무것도 그리지 않는다. */
export function ErrorText({
  error,
  fallback,
  className,
}: {
  error: unknown;
  fallback?: string;
  className?: string;
}): ReactNode {
  if (!error) return null;
  return <p className={cn("text-xs text-destructive", className)}>{queryErrorMessage(error, fallback)}</p>;
}
