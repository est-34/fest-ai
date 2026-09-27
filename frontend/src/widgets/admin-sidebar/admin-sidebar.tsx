"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Users2, MapPinned, FileCheck2, Ticket, TicketCheck, TicketPercent, Megaphone, Sparkles, Leaf, History, LogOut, Activity, UserCog, Store, Gift, FileSearch, Building2, KeyRound, ChevronDown, ClipboardList, Search, ShieldCheck, Recycle, Trash2, type LucideIcon } from "lucide-react";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/lib/utils";
import { logoutAdmin } from "@/shared/lib/api";
import { useAdminSessionStore } from "@/shared/lib/admin-session-store";
import { ChangePasswordDialog } from "@/features/admin-auth/ui/change-password-dialog";
import { ADMIN_ROLE_LABEL, mobileNavItems, visibleNavItems, type AdminNavItem } from "@/shared/lib/permissions";

// 권한 정의(shared/lib/permissions)는 아이콘을 모르므로 여기서 href로 이어붙입니다.
export const NAV_ICONS: Record<string, LucideIcon> = {
  "/admin": LayoutDashboard,
  "/admin/programs": Users2,
  "/admin/field": Activity,
  "/admin/reusable-containers": Recycle,
  "/admin/staff": UserCog,
  "/admin/businesses": Store,
  "/admin/rewards": Gift,
  "/admin/documents": FileSearch,
  "/admin/map-locations": MapPinned,
  "/admin/content": FileCheck2,
  "/admin/tickets": Ticket,
  "/admin/bookings": TicketCheck,
  "/admin/coupons": TicketPercent,
  "/admin/plogging": Trash2,
  "/admin/announcements": Megaphone,
  "/admin/ai-insights": Sparkles,
  "/admin/surveys": ClipboardList,
  "/admin/esg": Leaf,
  "/admin/audit-logs": History,
  "/admin/festival": Building2,
  "/admin/members": KeyRound,
  "/admin/privacy": ShieldCheck,
};

// ESG 기능 메뉴 — 아이콘만 ESG 색으로 둬서 일반 운영 메뉴와 한눈에 갈린다.
// 사이드바는 항상 검정이라 잉크용 --esg-tint 대신 원색(#1DCA5E, 9.7:1)을 쓴다.
const ESG_NAV = new Set(["/admin/esg", "/admin/rewards"]);

export function AdminLogoutButton({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function logout() {
    try {
      await logoutAdmin();
    } finally {
      queryClient.clear();
      router.push("/");
      router.refresh();
    }
  }

  return (
    <button onClick={() => void logout()} className={className} aria-label="로그아웃">
      <LogOut className="size-4" />
      {showLabel && <span>로그아웃</span>}
    </button>
  );
}

/**
 * 사이드바와 모바일 시트가 공유하는 메뉴 목록. 그룹은 <details>로 접고, 현재 보고 있는
 * 화면이 속한 그룹만 펼칩니다(open은 렌더마다 다시 계산 = 이동하면 해당 그룹이 열림).
 */
export function AdminNavLinks({ role }: { role: string | undefined }) {
  const pathname = usePathname();
  // 메뉴가 20개를 넘어 그룹을 접어 두다 보니 다른 그룹 항목은 늘 두 번 눌러야 닿는다.
  const [query, setQuery] = useState("");
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  const keyword = query.trim();
  const matched = visibleNavItems(role).filter(
    (item) => !keyword || item.label.includes(keyword) || (item.group ?? "").includes(keyword),
  );

  const groups = new Map<string | undefined, AdminNavItem[]>();
  for (const item of matched) {
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }

  const renderLink = ({ href, label }: AdminNavItem) => {
    // 아이콘을 등록하지 않은 새 항목이 있으면 렌더가 통째로 죽는다 — 기본 아이콘으로 받아둔다.
    const Icon = NAV_ICONS[href] ?? LayoutDashboard;
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive(href)
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <Icon className={cn("size-4.5", ESG_NAV.has(href) && "text-esg")} />
        {label}
      </Link>
    );
  };

  return (
    <>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/40" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="메뉴 검색"
          aria-label="메뉴 검색"
          className="h-10 w-full rounded-xl border border-sidebar-border bg-transparent pl-9 pr-3 text-sm text-sidebar-foreground outline-none placeholder:text-sidebar-foreground/40 focus-visible:border-sidebar-ring"
        />
      </div>
      {keyword && matched.length === 0 && (
        <p className="px-3 py-2 text-xs text-sidebar-foreground/50">일치하는 메뉴가 없어요.</p>
      )}
      {[...groups].map(([group, items]) =>
        group === undefined ? (
          items.map(renderLink)
        ) : (
          // 검색 중에는 결과가 접혀 있으면 안 보이므로 모두 펼친다.
          <details key={group} open={Boolean(keyword) || items.some((item) => isActive(item.href))} className="group">
            <summary className="mt-1 flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-sidebar-foreground/50 hover:text-sidebar-foreground [&::-webkit-details-marker]:hidden">
              {group}
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-1">{items.map(renderLink)}</div>
          </details>
        ),
      )}
    </>
  );
}

/**
 * 모바일 전용 하단 탭. 방문객 화면(widgets/visitor-nav)과 같은 패턴으로, 현장에서
 * 한 손으로 오가는 화면만 올립니다. 전체 메뉴는 상단바 햄버거 시트에 그대로 있습니다.
 */
export function AdminBottomNav() {
  const pathname = usePathname();
  const user = useAdminSessionStore((s) => s.user);
  const items = mobileNavItems(user?.role);

  if (items.length === 0) return null;

  return (
    // 아이폰 홈 인디케이터와 겹치지 않도록 안전 영역만큼 아래를 띄운다(viewportFit: cover와 한 쌍).
    <nav className="sticky bottom-0 z-30 border-t border-border bg-card/95 print:hidden pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="flex items-stretch justify-between px-2 py-1.5">
        {items.map(({ href, label }) => {
          const Icon = NAV_ICONS[href] ?? LayoutDashboard;
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-[0.6875rem] font-medium leading-tight transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "fill-primary/15")} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AdminSidebar() {
  const user = useAdminSessionStore((s) => s.user);


  return (
    <aside className="hidden w-64 shrink-0 print:hidden! flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <Logo tone="dark" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        <AdminNavLinks role={user?.role} />
      </nav>

      <div className="mx-3 mb-4 flex items-center gap-2.5 rounded-xl border border-sidebar-border p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/25 text-xs font-bold text-primary-tint">
          {user?.name?.slice(0, 1) ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">{user?.name ?? "알 수 없음"}</p>
          <p className="truncate text-[0.6875rem] text-sidebar-foreground/60">
            {user?.role ? (ADMIN_ROLE_LABEL[user.role] ?? user.role) : ""}
          </p>
        </div>
        <ChangePasswordDialog className="text-sidebar-foreground/50 hover:text-sidebar-foreground" />
        <AdminLogoutButton className="text-sidebar-foreground/50 hover:text-sidebar-foreground" />
      </div>
    </aside>
  );
}
