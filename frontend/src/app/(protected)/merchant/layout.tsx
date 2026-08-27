import type { Metadata } from "next";
import Link from "next/link";
import { AdminAuthGate } from "@/features/admin-auth/ui/admin-auth-gate";
import { AdminLogoutButton } from "@/widgets/admin-sidebar/admin-sidebar";
import { Logo } from "@/shared/ui/logo";

export const metadata: Metadata = {
  title: "FESTAI | 참여업체 콘솔",
};

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGate>
    <div className="flex min-h-screen flex-1 flex-col bg-muted/30">
      <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:px-6">
        <Link href="/merchant" className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-bold text-foreground">참여업체 콘솔</span>
        </Link>
        <AdminLogoutButton showLabel className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium" />
      </header>
      <main className="flex-1 p-4 lg:p-6">{children}</main>
    </div>
  </AdminAuthGate>;
}
