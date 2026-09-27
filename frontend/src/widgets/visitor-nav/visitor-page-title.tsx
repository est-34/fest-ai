"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/shared/lib/i18n";
import { NAV_ITEMS } from "./visitor-nav";

/**
 * 방문객 화면 제목줄.
 *
 * 하단 탭에 없는 화면(스탬프투어·설문·상권 등)은 돌아갈 길이 브라우저 뒤로가기뿐이라
 * 뒤로 버튼을 함께 그린다. 화면마다 같은 블록을 복사해 두면 한쪽만 고쳐져 어긋난다.
 */
export function VisitorPageTitle({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const showBack = !NAV_ITEMS.some((item) => item.href === pathname);

  return (
    <div className="flex mt-2 items-center">
      {showBack && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t.common.back}
          className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      <h1 className="text-lg font-extrabold text-foreground">{children}</h1>
    </div>
  );
}
