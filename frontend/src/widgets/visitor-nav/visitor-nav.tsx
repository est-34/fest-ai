"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, MapPin, Ticket, Recycle } from "lucide-react";
import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { useVisitorMenus, type VisitorMenuKey } from "@/features/visitor-menu-settings";
import { useTranslation, type Dictionary } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

// 하단 탭과 방문객 하위 화면의 뒤로가기 판정이 함께 쓰는 단일 출처다.
export const NAV_ITEMS: {
  href: string;
  labelKey: keyof Dictionary["nav"];
  icon: typeof Home;
  kiosk: boolean;
  menuKey?: VisitorMenuKey;
}[] = [
  { href: "/visitor", labelKey: "home", icon: Home, kiosk: true },
  {
    href: "/visitor/coupons",
    labelKey: "coupons",
    icon: Recycle,
    kiosk: false,
    menuKey: "coupons",
  },
  {
    href: "/visitor/ai-guide",
    labelKey: "aiGuide",
    icon: Sparkles,
    kiosk: true,
  },
  {
    href: "/visitor/reservation",
    labelKey: "reservation",
    icon: Ticket,
    kiosk: false,
    menuKey: "reservation",
  },
  { href: "/visitor/map", labelKey: "map", icon: MapPin, kiosk: true },
];

export function VisitorNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const visitorMode = useAccessibilityStore((state) => state.visitorMode);
  const menuSettings = useVisitorMenus();
  const navItems = NAV_ITEMS.filter(
    (item) =>
      (visitorMode === "qr" || item.kiosk) &&
      (!item.menuKey || menuSettings[item.menuKey]),
  );

  return (
    // 아이폰 홈 인디케이터와 겹치지 않도록 안전 영역만큼 아래를 띄운다(viewportFit: cover와 한 쌍).
    <nav className="sticky bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
        {navItems.map(({ href, labelKey, icon: Icon }) => {
          const isAi = href === "/visitor/ai-guide";
          const isEsg = href === "/visitor/coupons";
          const active = isEsg
            ? pathname.startsWith("/visitor/coupons") ||
              pathname === "/visitor/stamp-tour"
            : href === "/visitor"
              ? pathname === href
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
                isAi && "gap-0 pt-0 justify-between",
                active
                  ? isEsg
                    ? "text-esg-tint"
                    : "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center",
                  isAi
                    ? cn(
                        "-mt-5 size-12 rounded-full shadow-md",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )
                    : "size-5",
                )}
              >
                <Icon
                  className={cn("size-5", isEsg && active && "text-esg")}
                  strokeWidth={active ? 2.4 : 2}
                />
              </span>
              {labelKey === "coupons" ? "ESG" : t.nav[labelKey]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
