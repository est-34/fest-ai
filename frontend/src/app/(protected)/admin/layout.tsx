import type { Metadata } from "next";
import { AdminBottomNav, AdminSidebar } from "@/widgets/admin-sidebar/admin-sidebar";
import { AdminTopbar } from "@/widgets/admin-sidebar/admin-topbar";
import { AdminAuthGate } from "@/features/admin-auth/ui/admin-auth-gate";

export const metadata: Metadata = {
  title: "FESTAI | 운영자 관리 콘솔",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthGate>
    <div className="flex min-h-screen flex-1 bg-muted/30">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main id="main" className="flex-1 p-4 lg:p-6">{children}</main>
        <AdminBottomNav />
      </div>
    </div>
  </AdminAuthGate>;
}
