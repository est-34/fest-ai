"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/shared/ui/button";

/** 렌더 중 예외가 나면 Next 기본 화면 대신 되돌아갈 길이 있는 화면을 보여준다. */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-bold text-foreground">화면을 표시하지 못했어요</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        일시적인 문제일 수 있어요. 다시 시도해도 같으면 잠시 후 접속해 주세요.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RefreshCw className="size-4" /> 다시 시도
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          처음으로
        </Link>
      </div>
    </main>
  );
}
