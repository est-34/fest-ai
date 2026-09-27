"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAccessibilityStore } from "@/shared/lib/accessibility-store";
import { KioskLargeTextPrompt } from "@/features/kiosk-age-assist/ui/kiosk-large-text-prompt";
import { setVisitorArea } from "@/entities/area";
import { EmergencyAnnouncementBanner } from "@/features/notification/ui/emergency-announcement-banner";
import { VisitorNotificationToast } from "@/features/notification/ui/visitor-notification-toast";
import { useTranslation } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { VisitorNav } from "@/widgets/visitor-nav/visitor-nav";
import { VisitorTopbar } from "@/widgets/visitor-nav/visitor-topbar";

const KIOSK_ROUTES = [
  "/visitor",
  "/visitor/ai-guide",
  "/visitor/map",
  "/visitor/schedule",
  "/visitor/nearby",
];

export function VisitorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const visitorMode = useAccessibilityStore((state) => state.visitorMode);
  const { bcp47 } = useTranslation();
  const isImmersiveAiGuide = pathname === "/visitor/ai-guide";
  const isKioskRoute = KIOSK_ROUTES.some((route) =>
    route === "/visitor" ? pathname === route : pathname.startsWith(route),
  );

  useEffect(() => {
    if (visitorMode === "kiosk" && !isKioskRoute) {
      router.replace("/visitor");
    }
  }, [isKioskRoute, router, visitorMode]);

  // VIS-12: 진입 QR에 실린 구역을 자동 설정한다. useSearchParams 대신 location을 읽어
  // 레이아웃 전체가 Suspense 경계를 요구하지 않게 한다(위치정보는 쓰지 않는다).
  useEffect(() => {
    const areaId = new URLSearchParams(window.location.search).get("area");
    if (!areaId) return;
    void setVisitorArea(areaId, "QR")
      .then(() => queryClient.invalidateQueries({ queryKey: ["visitor-area"] }))
      .catch(() => undefined);
  }, [pathname, queryClient]);

  useEffect(() => {
    document.documentElement.lang = bcp47;
    return () => {
      document.documentElement.lang = "ko";
    };
  }, [bcp47]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <EmergencyAnnouncementBanner />
      {!isImmersiveAiGuide && <VisitorTopbar />}
      <VisitorNotificationToast />
      <main
        id="main"
        className={cn(
          "mx-auto min-h-0 w-full max-w-md flex-1",
          isImmersiveAiGuide ? "overflow-hidden" : "overflow-y-auto pb-4",
        )}
      >
        {children}
      </main>
      {/* 키오스크 얼굴인식 결과가 필요한 경우에만 큰 글씨 제안 팝업을 띄운다. */}
      {visitorMode === "kiosk" && (
        <KioskLargeTextPrompt />
      )}
      <VisitorNav />
    </div>
  );
}
