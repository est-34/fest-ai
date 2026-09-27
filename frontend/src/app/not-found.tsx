import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/shared/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-bold text-foreground">찾는 화면이 없어요</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        주소가 바뀌었거나 종료된 안내일 수 있어요.
      </p>
      <div className="flex gap-2">
        {/* 링크는 실제 <a>로 둔다 — Button으로 감싸면 버튼 시맨틱이 사라진다. */}
        <Link href="/visitor" className={buttonVariants()}>방문객 화면</Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>처음으로</Link>
      </div>
    </main>
  );
}
