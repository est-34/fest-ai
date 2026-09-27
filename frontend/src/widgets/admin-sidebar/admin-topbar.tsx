"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/shared/ui/logo";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/shared/ui/sheet";
import { AdminLogoutButton, AdminNavLinks } from "./admin-sidebar";
import { useAdminSessionStore } from "@/shared/lib/admin-session-store";
import { findNavItem } from "@/shared/lib/permissions";

export function AdminTopbar() {
  const pathname = usePathname();
  const user = useAdminSessionStore((s) => s.user);
  const title = findNavItem(pathname)?.label ?? "FESTAI 관리자";
  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between print:hidden border-b border-border bg-card/95 px-4 py-3.5 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" />}>
            <Menu className="size-4" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader>
              <SheetTitle className="sr-only">메뉴</SheetTitle>
              <Logo tone="dark" />
            </SheetHeader>
            <nav className="space-y-1 overflow-y-auto px-3 py-2">
              <AdminNavLinks role={user?.role} />
              <AdminLogoutButton
                showLabel
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70"
              />
            </nav>
          </SheetContent>
        </Sheet>
        <div>
          <h1 className="text-base font-bold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
      </div>
    </header>
  );
}

