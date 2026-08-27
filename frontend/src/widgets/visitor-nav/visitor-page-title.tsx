"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/shared/lib/i18n";
import { NAV_ITEMS } from "./visitor-nav";

/**
 * 방문객 화면 제목줄.
 *
 * 하단 탭에 없는 화면(스탬프투어·설문·상권 등)은 돌아갈 길이 브라우저 뒤로가기뿐이라
 * 상위 화면 링크를 함께 그린다. 직접 진입해도 앱 안에서 돌아갈 수 있다. 화면마다 같은 블록을 복사해 두면 한쪽만 고쳐져 어긋난다.
 */
export function VisitorPageTitle({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const showBack = !NAV_ITEMS.some((item) => item.href === pathname);

  const parentHref = pathname.startsWith("/visitor/coupons/") || pathname === "/visitor/stamp-tour"
    ? "/visitor/coupons"
    : "/visitor";

  return (
    <div className="flex mt-2 items-center">
      {showBack && (
        <Link
          href={parentHref}
          aria-label={t.common.back}
          className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
      )}
      <h1 className="text-lg font-extrabold text-foreground">{children}</h1>
    </div>
  );
}
