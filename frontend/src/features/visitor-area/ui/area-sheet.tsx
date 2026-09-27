"use client";

import { useQuery } from "@tanstack/react-query";
import { MapPinned } from "lucide-react";
import { fetchPublicAreas, fetchVisitorArea, setVisitorArea } from "@/entities/area";
import { useTranslation } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";
import { useWrite } from "@/shared/lib/use-write";
import { Button } from "@/shared/ui/button";
import { iconTileClass, iconTileLabelClass } from "@/shared/ui/icon-tile";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

/**
 * VIS-12 구역 선택.
 *
 * 구역을 판정하면 그 구역을 대상으로 한 공지만 골라 받는다. 판정하지 못한 상태도 정상이라
 * 전체 대상 공지로 폴백하고, 안전 관련 긴급 공지는 판정 여부와 무관하게 도착한다.
 */
export function AreaSheet() {
  const { t, bcp47, locale } = useTranslation();
  const current = useQuery({ queryKey: ["visitor-area", locale], queryFn: () => fetchVisitorArea(locale) });
  const areas = useQuery({ queryKey: ["public-areas", locale], queryFn: () => fetchPublicAreas(locale) });
  // 구역이 바뀌면 받을 공지 대상도 바뀐다.
  const choose = useWrite((areaId: string | null) => setVisitorArea(areaId), {
    invalidates: ["visitor-area", "public-announcements"],
  });

  const selected = current.data?.areaId ?? null;

  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" className={iconTileClass} aria-label={t.area.ariaLabel} />}
      >
        <MapPinned className="size-5" />
        <span className={iconTileLabelClass}>{current.data?.areaName ?? t.area.shortLabel}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-h-[78dvh] max-w-md rounded-t-3xl">
        <SheetHeader className="border-b border-border pb-3">
          <SheetTitle className="text-lg font-bold">{t.area.title}</SheetTitle>
          <SheetDescription className="mt-1 text-xs">{t.area.description}</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <p className="mt-3 rounded-xl bg-muted/60 p-3 text-[0.6875rem] leading-5 text-muted-foreground">
            {t.area.privacyNotice}
            <br />
            {t.area.validity(current.data?.validHours ?? 2)}
          </p>

          {current.data?.areaAssignedAt && (
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">
              {current.data.areaSource === "QR" ? t.area.sourceQr : t.area.sourceManual} ·{" "}
              {new Date(current.data.areaAssignedAt).toLocaleString(bcp47)}
            </p>
          )}

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => choose.mutate(null)}
              className={cn(
                "w-full rounded-xl border p-3 text-left text-sm font-semibold",
                selected === null ? "border-primary bg-primary/5 text-primary" : "border-border",
              )}
            >
              {t.area.clear}
              <span className="mt-0.5 block text-[0.6875rem] font-normal text-muted-foreground">{t.area.clearHint}</span>
            </button>
            {(areas.data ?? []).map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => choose.mutate(area.id)}
                aria-pressed={selected === area.id}
                className={cn(
                  "w-full rounded-xl border p-3 text-left text-sm font-semibold",
                  selected === area.id ? "border-primary bg-primary/5 text-primary" : "border-border",
                )}
              >
                {area.name}
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
