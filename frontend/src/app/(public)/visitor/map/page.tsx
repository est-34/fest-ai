"use client";

import { usePublicFestivalLoader } from "@/shared/lib/use-public-festival";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { WheelchairIcon } from "@/shared/ui/wheelchair-icon";
import { Bike, Bus, Car, Footprints, TrainFront } from "lucide-react";
import {
  fetchFacilities,
  fetchTransport,
  type FacilityInfo,
} from "@/entities/festival";
import { operatingStatus } from "@/features/map/lib/operating-status";
import { useTranslation } from "@/shared/lib/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { StatusPill } from "@/shared/ui/status-pill";
import { Badge } from "@/shared/ui/badge";
import { EmptyState, ErrorState } from "@/shared/ui/query-state";
import { Skeleton } from "@/shared/ui/skeleton";
import { FestivalMap } from "@/features/map/ui/festival-map";
import { CrowdList } from "@/features/crowd/ui/crowd-list";

// mode·status는 번역되지 않은 원본 값으로 남으므로 아이콘·색상 키로 그대로 쓴다.
const TRANSPORT_ICON = {
  지하철: TrainFront,
  버스: Bus,
  셔틀: Bus,
  주차: Car,
  자전거: Bike,
  도보: Footprints,
} as const;

const STATUS_TONE = {
  원활: "success",
  보통: "warning",
  혼잡: "danger",
  지연: "danger",
} as const;

export default function VisitorMapPage() {
  const loadFestival = usePublicFestivalLoader();
  const { t, locale } = useTranslation();
  const [facilityType, setFacilityType] = useState<FacilityInfo["type"] | null>(
    null,
  );
  const {
    data: facilities,
    isLoading: fLoading,
    isError: fError,
    refetch: refetchFacilities,
  } = useQuery({
    queryKey: ["facilities", locale] as const,
    queryFn: () => fetchFacilities(locale),
  });
  // 서버 ?type= 대신 클라이언트에서 거른다 — 목록 전체가 이미 캐시에 있고,
  // 백엔드가 매긴 안전시설 우선 정렬 순서를 재요청 없이 그대로 유지한다.
  const facilityTypes = [...new Set(facilities?.map((f) => f.type) ?? [])];
  const visibleFacilities = facilities?.filter(
    (f) => !facilityType || f.type === facilityType,
  );
  const { data: transport, isLoading: tLoading } = useQuery({
    queryKey: ["transport", locale] as const,
    queryFn: () => fetchTransport(locale, loadFestival),
  });

  return (
    <div className="px-4 pt-4 pb-6">
      <h1 className="text-lg font-extrabold text-foreground">{t.map.title}</h1>
      <p className="text-xs text-muted-foreground">{t.map.subtitle}</p>

      <FestivalMap />

      <Tabs defaultValue="facility" className="mt-4">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="facility">{t.map.tabs.facility}</TabsTrigger>
          <TabsTrigger value="crowd">{t.map.tabs.crowd}</TabsTrigger>
          <TabsTrigger value="transport">{t.map.tabs.transport}</TabsTrigger>
        </TabsList>

        <TabsContent value="crowd" className="mt-3">
          <CrowdList />
        </TabsContent>

        <TabsContent value="facility" className="mt-3 space-y-2">
          {facilityTypes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {[null, ...facilityTypes].map((value) => (
                <button
                  key={value ?? "all"}
                  type="button"
                  onClick={() => setFacilityType(value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${facilityType === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
                >
                  {value === null
                    ? t.map.filterAll
                    : (t.festivalData.facilityType[value] ?? value)}
                </button>
              ))}
            </div>
          )}
          {fLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : fError || !visibleFacilities ? (
            <ErrorState
              message={t.common.loadFailed}
              retryLabel={t.common.retry}
              onRetry={() => refetchFacilities()}
            />
          ) : visibleFacilities.length === 0 ? (
            <EmptyState message={t.common.empty} />
          ) : (
            visibleFacilities.map((f) => {
              const { open, hours } = operatingStatus(f.operatingHours);
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <span className="truncate">{f.name}</span>
                      {f.accessibility?.wheelchair && (
                        <WheelchairIcon
                          className="size-3.5 shrink-0 text-primary"
                          aria-label={t.map.wheelchairLabel}
                        />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className="text-[0.625rem]">
                      {t.festivalData.facilityType[f.type] ?? f.type}
                    </Badge>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {open === null
                        ? (hours ?? t.map.facilityHoursUnknown)
                        : open
                          ? t.map.facilityOpen
                          : t.map.facilityClosed}
                    </span>
                    {open !== null && hours && (
                      <span className="text-[0.625rem] text-muted-foreground">
                        {hours}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="transport" className="mt-3 space-y-2">
          <p className="rounded-xl border border-dashed border-border p-2.5 text-center text-[0.6875rem] text-muted-foreground">
            {t.map.transportNotice}
          </p>
          {tLoading || !transport ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            transport.map((option) => {
              const Icon = TRANSPORT_ICON[option.mode];
              return (
                <div
                  key={option.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {option.detail}
                    </p>
                  </div>
                  <StatusPill
                    tone={STATUS_TONE[option.status]}
                    className="shrink-0"
                  >
                    {t.festivalData.transportStatus[option.status] ??
                      option.status}
                  </StatusPill>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
