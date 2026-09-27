"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { currentAdmin, loginAdmin } from "@/shared/lib/api";
import { useAdminSessionStore } from "@/shared/lib/admin-session-store";
import { ADMIN_ROLE_LABEL, canAccessPath } from "@/shared/lib/permissions";
import { useForm } from "@/shared/lib/use-form";
import { useWrite } from "@/shared/lib/use-write";
import { Input } from "@/shared/ui/input";
import { Logo } from "@/shared/ui/logo";
import { ErrorText, Form, SubmitButton } from "@/shared/ui/form";
import { Skeleton } from "@/shared/ui/skeleton";

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAdminSessionStore((s) => s.user);
  const setUser = useAdminSessionStore((s) => s.setUser);
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const { form, field } = useForm({ email: "", password: "" });

  useEffect(() => {
    currentAdmin()
      .then((admin) => {
        setUser(admin);
        setAuthenticated(true);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [setUser]);

  // 오류는 폼 바로 아래에 그리므로 전역 토스트는 끈다.
  const login = useWrite(() => loginAdmin(form.email, form.password), {
    silent: true,
    onSuccess: (admin) => {
      setUser(admin);
      setAuthenticated(true);
    },
  });

  if (checking) {
    return <div className="mx-auto mt-32 w-full max-w-sm space-y-3"><Skeleton className="h-12" /><Skeleton className="h-44" /></div>;
  }
  if (authenticated) {
    if (!canAccessPath(user?.role, pathname)) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
          <ShieldAlert className="size-10 text-destructive" />
          <div>
            <h1 className="text-lg font-bold text-foreground">접근 권한이 없어요</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 역할({user?.role ? (ADMIN_ROLE_LABEL[user.role] ?? user.role) : "알 수 없음"})로는 이 화면에 접근할 수 없어요.
            </p>
          </div>
          <a href="/admin" className="text-sm font-semibold text-primary hover:underline">
            대시보드로 돌아가기
          </a>
        </main>
      );
    }
    return children;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Form onSubmit={() => login.mutate()} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6">
        <Logo />
        <div>
          <h1 className="text-lg font-bold">운영자 로그인</h1>
          <p className="text-xs text-muted-foreground">백엔드 데모 계정으로 로그인하세요.</p>
        </div>
        <Input type="email" {...field("email")} aria-label="이메일" placeholder="이메일" autoComplete="username" required />
        <Input type="password" {...field("password")} aria-label="비밀번호" placeholder="비밀번호" autoComplete="current-password" required />
        <ErrorText error={login.error} fallback="로그인하지 못했어요." className="text-sm" />
        <SubmitButton mutation={login} size="default" pending="로그인 중..." className="w-full">로그인</SubmitButton>
      </Form>
    </main>
  );
}
