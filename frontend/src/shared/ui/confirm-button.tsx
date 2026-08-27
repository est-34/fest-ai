"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

/**
 * 되돌릴 수 없는 동작(삭제·비활성화·발행·반려)을 한 번 더 확인받는 버튼.
 * reason을 주면 사유 입력을 받아 onConfirm으로 넘깁니다 — 반려처럼 근거가 남아야 하는 곳에 씁니다.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "확인",
  reason,
  onConfirm,
  children,
  ...buttonProps
}: Omit<ComponentProps<typeof Button>, "onClick"> & {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  /** 사유 입력을 받을 때의 라벨. 입력이 비면 확인 버튼이 잠깁니다. */
  reason?: { label: string; placeholder?: string };
  onConfirm: (reason: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const blocked = Boolean(reason) && text.trim().length === 0;

  function confirm() {
    if (blocked) return;
    onConfirm(text.trim());
    setOpen(false);
    setText("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {reason && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-reason">{reason.label}</Label>
            <Textarea
              id="confirm-reason"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={reason.placeholder}
              rows={3}
            />
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>취소</DialogClose>
          <Button size="sm" variant={buttonProps.variant === "destructive" ? "destructive" : "default"} disabled={blocked} onClick={confirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
