"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, ShieldAlert } from "lucide-react";
import { acceptMerchantInvitation, lookupMerchantInvitation } from "@/shared/lib/api";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Logo } from "@/shared/ui/logo";
import { queryErrorMessage } from "@/shared/ui/query-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { seoulDateTime } from "@/shared/lib/utils";
import { useWrite } from "@/shared/lib/use-write";
import { useForm } from "@/shared/lib/use-form";

/**
 * BIZ-05 상인 계정 초대 수락.
 *
 * 자율 가입이 없으므로 이 화면은 운영자가 업체를 지정해 보낸 링크로만 열립니다.
 * 사업자 증빙은 BIZ-01 업체 승인에서 이미 확인했기 때문에 여기서는 다시 받지 않습니다.
 */
function InviteForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const { form, field } = useForm({ password: "", name: "" });

  const preview = useQuery({
    queryKey: ["merchant-invitation", token],
    queryFn: () => lookupMerchantInvitation(token),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useWrite(
    () =>
      acceptMerchantInvitation({
        token,
        password: preview.data?.hasAccount ? undefined : form.password,
        name: preview.data?.hasAccount ? undefined : form.name,
      }),
    {
      silent: true,
      onSuccess: () => router.replace("/merchant"),
    },
  );

  if (!token) {
    return (
      <Notice title="초대 링크가 올바르지 않아요">
        운영자가 보낸 링크를 그대로 열어 주세요. 링크는 발급 후 72시간 동안만 사용할 수 있어요.
      </Notice>
    );
  }
  if (preview.isLoading) return <Skeleton className="h-64 w-full max-w-sm rounded-2xl" />;
  if (preview.isError || !preview.data) {
    return (
      <Notice title="사용할 수 없는 초대예요">
        {queryErrorMessage(preview.error, "초대 링크가 만료되었거나 회수되었어요.")} 운영자에게 재발급을 요청해 주세요.
      </Notice>
    );
  }

  const needsPassword = !preview.data.hasAccount;

  return (
    <Form
      className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6"
      onSubmit={() => accept.mutate()}
    >
      <Logo />
      <div>
        <h1 className="flex items-center gap-1.5 text-lg font-bold text-foreground">
          <KeyRound className="size-4 text-primary" /> 참여업체 계정 만들기
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {preview.data.festivalName} · {preview.data.businessName}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {preview.data.email} · {seoulDateTime(preview.data.expiresAt)} 만료
        </p>
      </div>

      {needsPassword ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">담당자 이름</Label>
            <Input id="invite-name" {...field("name")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-password">비밀번호 (8자 이상)</Label>
            <Input
              id="invite-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              {...field("password")}
              required
            />
          </div>
        </>
      ) : (
        <p className="rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
          이미 이 이메일로 만든 참여업체 계정이 있어요. 수락하면 기존 계정에 이 업체가 추가돼요.
        </p>
      )}

      <ErrorText error={accept.error} fallback="초대를 수락하지 못했어요." className="text-sm" />
      <SubmitButton mutation={accept} size="default" pending="처리 중..." className="w-full">
        초대 수락하고 시작하기
      </SubmitButton>
    </Form>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm space-y-2 rounded-2xl border border-border bg-card p-6 text-center">
      <ShieldAlert className="mx-auto size-8 text-destructive" />
      <h1 className="text-base font-bold text-foreground">{title}</h1>
      <p className="text-xs leading-5 text-muted-foreground">{children}</p>
    </div>
  );
}

export default function MerchantInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-sm rounded-2xl" />}>
        <InviteForm />
      </Suspense>
    </main>
  );
}
