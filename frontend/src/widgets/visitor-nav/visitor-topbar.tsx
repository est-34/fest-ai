"use client";

import Link from "next/link";
import { ComplaintSheet } from "@/features/complaint";
import { AccessibilitySheet } from "@/shared/ui/accessibility-sheet";
import { NotificationSheet } from "@/features/notification/ui/notification-sheet";
import { AreaSheet } from "@/features/visitor-area/ui/area-sheet";
import { Logo } from "@/shared/ui/logo";

export function VisitorTopbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-md items-center justify-between gap-1 px-3 py-1.5 pr-0">
        <div className="flex min-w-0 items-center gap-1">
          <Link href="/visitor" className="shrink-0">
            <Logo />
          </Link>
        </div>

        <div className="flex items-center">
          <AreaSheet />
          <AccessibilitySheet showLabel />
          <ComplaintSheet />
          <NotificationSheet />
        </div>
      </div>
    </header>
  );
}
