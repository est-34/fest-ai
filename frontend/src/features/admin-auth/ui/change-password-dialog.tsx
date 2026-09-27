"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { changeAdminPassword } from "@/shared/lib/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { queryErrorMessage } from "@/shared/ui/query-state";
import { Form, SubmitButton } from "@/shared/ui/form";
import { useWrite } from "@/shared/lib/use-write";
import { useForm } from "@/shared/lib/use-form";

const MIN_LENGTH = 8;

/**
 * 본인 비밀번호 변경.
 *
 * 계정 화면은 "초기 비밀번호는 로그인한 뒤 변경하도록 안내해 주세요"라고 띄워 왔는데
 * 정작 변경할 방법이 없었다. 서버가 변경과 동시에 기존 리프레시 토큰을 모두 폐기하고
 * 새 토큰 쌍을 돌려주므로, 이 화면은 로그아웃되지 않고 그대로 이어진다.
 */
export function ChangePasswordDialog({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { form, field, reset } = useForm({ current: "", next: "", confirm: "" });
  const [localError, setLocalError] = useState("");

  const change = useWrite(() => changeAdminPassword(form.current, form.next), {
    onSuccess: () => {
      setOpen(false);
      reset();
    },
  });

  function submit() {
    setLocalError("");
    if (form.next !== form.confirm) return setLocalError("새 비밀번호가 서로 달라요.");
    if (form.next === form.current) return setLocalError("현재 비밀번호와 다른 값을 입력해 주세요.");
    change.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={className} aria-label="비밀번호 변경">
        <KeyRound className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>비밀번호 변경</DialogTitle>
          <DialogDescription>
            변경하면 다른 기기의 로그인 세션이 모두 끊겨요. 이 창은 그대로 유지돼요.
          </DialogDescription>
        </DialogHeader>
        <Form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">현재 비밀번호</Label>
            <Input id="current-password" type="password" autoComplete="current-password" required
                   {...field("current")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">새 비밀번호</Label>
            <Input id="new-password" type="password" autoComplete="new-password" required minLength={MIN_LENGTH}
                   {...field("next")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={MIN_LENGTH}
                   {...field("confirm")} />
          </div>
          {(localError || change.error) && (
            <p className="text-sm text-destructive" role="alert">{localError || queryErrorMessage(change.error)}</p>
          )}
          <SubmitButton mutation={change} size="default" pending="변경 중..." className="w-full">비밀번호 변경</SubmitButton>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
