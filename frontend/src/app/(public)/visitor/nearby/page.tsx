"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Megaphone, Navigation, Store } from "lucide-react";
import {
  currentPosition,
  fetchBusinessRecommendations,
  fetchFestivalBusinesses,
  type RecommendedBusiness,
} from "@/features/business-recommendation";
import { fetchPrivacyNotice } from "@/features/privacy/api/privacy";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { QueryState } from "@/shared/ui/query-state";
import { Skeleton, SkeletonList } from "@/shared/ui/skeleton";
import { WheelchairIcon } from "@/shared/ui/wheelchair-icon";
import { useTranslation } from "@/shared/lib/i18n";
import { VisitorPageTitle } from "@/widgets/visitor-nav/visitor-page-title";

const REGIONAL_ADS = [
  {
    src: "/ads/jeju-museum-of-art.png",
    alt: "제주도립미술관 전시와 프로그램 안내 광고",
    width: 1478,
    height: 405,
  },
  {
    src: "/ads/jeju-donation-festival.png",
    alt: "제주도 고향사랑기부제 참여 안내 광고",
    width: 2048,
    height: 696,
  },
] as const;

function BusinessCard({ item }: { item: RecommendedBusiness }) {
  return (
    <article className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {item.category}
            {item.areaName && ` · ${item.areaName}`}
            {item.distanceMeters !== null && ` · ${item.distanceMeters}m`}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[0.625rem]">{Math.round(item.score * 100)}점</Badge>
      </div>
      <ul className="mt-2 space-y-0.5">
        {item.reasons.map((reason) => (
          <li key={reason} className="flex items-start gap-1.5 text-[0.6875rem] leading-4 text-muted-foreground">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
            {reason}
          </li>
        ))}
      </ul>
    </article>
  );
}

function SponsoredAdsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % REGIONAL_ADS.length);
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div aria-label="지역상권 광고 슬라이드" aria-live="polite">
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {REGIONAL_ADS.map((ad) => (
            <div key={ad.src} className="aspect-[3/1] w-full shrink-0 bg-white">
              <Image
                src={ad.src}
                alt={ad.alt}
                width={ad.width}
                height={ad.height}
                sizes="(max-width: 448px) 100vw, 420px"
                className="block size-full object-contain"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-center gap-1.5" aria-label="광고 위치">
        {REGIONAL_ADS.map((ad, index) => (
          <button
            key={ad.src}
            type="button"
            onClick={() => setActiveIndex(index)}
            aria-label={`${index + 1}번째 광고 보기`}
            aria-current={activeIndex === index}
            className={`size-1.5 rounded-full transition-colors ${activeIndex === index ? "bg-primary" : "bg-muted-foreground/30"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function VisitorNearbyPage() {
  const { t, locale } = useTranslation();
  const [category, setCategory] = useState<string | undefined>();
  // 휠체어 접근 필요 여부는 이 화면의 필터다. 예전에는 "큰 글씨" 설정을 대신 읽어서,
  // 큰 글씨를 켠 방문객의 목록이 조용히 줄고 정작 휠체어 이용자에게는 걸리지 않았다.
  const [wheelchairOnly, setWheelchairOnly] = useState(false);

  // OPS-11: 위치 동의를 철회한 세션에는 좌표를 아예 요청하지 않는다.
  // 저장만 철회하고 계속 위치를 보내면 철회한 것이 아니다.
  const privacy = useQuery({ queryKey: ["privacy-notice"], queryFn: fetchPrivacyNotice, staleTime: 60_000, retry: false });
  const locationAllowed = privacy.data?.consents?.location !== false;

  // 위치도 외부 상태라 쿼리로 다룬다 — 거부해도 null로 확정돼 위치 없는 추천이 그대로 나온다.
  const location = useQuery({
    queryKey: ["visitor-position"], queryFn: currentPosition, staleTime: 60_000, retry: false,
    enabled: locationAllowed,
  });
  const position = locationAllowed ? location.data ?? null : null;
  const locating = locationAllowed && location.isLoading;

  const recommendations = useQuery({
    queryKey: ["business-recommendations", position, category, wheelchairOnly, locale] as const,
    queryFn: () => fetchBusinessRecommendations({ ...position, category, accessibilityRequired: wheelchairOnly }, locale),
    enabled: !locating,
  });
  const businesses = useQuery({
    queryKey: ["festival-businesses", locale] as const,
    queryFn: () => fetchFestivalBusinesses(undefined, locale),
  });

  const categories = [...new Set((businesses.data ?? []).map((item) => item.category))];


  return (
    <>
    <VisitorPageTitle>{t.nearby.title}</VisitorPageTitle>
    <div className="px-4 pt-0 pb-6">
      <p className="text-xs text-muted-foreground">{t.nearby.subtitle}</p>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Navigation className={`size-4 shrink-0 ${position ? "text-primary" : "text-muted-foreground"}`} />
        <p className="min-w-0 flex-1 text-[0.6875rem] text-muted-foreground">
          {locating ? t.nearby.locating : position ? t.nearby.locationOn : t.nearby.locationOff}
        </p>
        {!position && !locating && locationAllowed && (
          <Button size="sm" variant="outline" onClick={() => location.refetch()}>{t.nearby.retryLocation}</Button>
        )}
      </div>

      <button
        type="button"
        aria-pressed={wheelchairOnly}
        onClick={() => setWheelchairOnly((value) => !value)}
        className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
          wheelchairOnly ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"
        }`}
      >
        <WheelchairIcon className="size-3.5" /> {t.map.wheelchairLabel}
      </button>

      {categories.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            onClick={() => setCategory(undefined)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${category === undefined ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
          >
            {t.nearby.allCategories}
          </button>
          {categories.map((value) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${category === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground"}`}
            >
              {value}
            </button>
          ))}
        </div>
      )}

      <section className="mt-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Store className="size-4" /> {t.nearby.recommendedTitle}
        </h2>
        {/* 위치 확인 중에는 아직 요청 전이라 쿼리 상태로는 드러나지 않는다. */}
        {locating ? (
          <SkeletonList count={2} className="h-24 rounded-xl" />
        ) : (
          <QueryState
            query={recommendations}
            empty={t.nearby.empty}
            emptyWhen={recommendations.data?.items.length === 0}
            errorMessage={t.common.loadFailed}
            retryLabel={t.common.retry}
            skeleton={<SkeletonList count={2} className="h-24 rounded-xl" />}
          >
            {(result) => (
              <div className="space-y-2">
                {result.items.map((item) => (
                  <BusinessCard key={item.businessId} item={item} />
                ))}
              </div>
            )}
          </QueryState>
        )}
      </section>

      <section className="mt-6">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Megaphone className="size-4" /> {t.nearby.sponsoredTitle}
          </h2>
          <p className="mb-2 text-[0.6875rem] text-muted-foreground">{t.nearby.sponsoredNotice}</p>
          <SponsoredAdsCarousel />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground">
          <MapPin className="size-4" /> {t.nearby.allBusinessTitle}
        </h2>
        <QueryState
          query={businesses}
          empty={t.common.empty}
          errorMessage={t.common.loadFailed}
          retryLabel={t.common.retry}
          skeleton={<Skeleton className="h-24 rounded-xl" />}
        >
          {(rows) => (
            <div className="space-y-2">
              {rows.map((business) => (
                <div key={business.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{business.name}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      {business.accessibility?.wheelchair && <WheelchairIcon className="size-3.5 text-primary" />}
                      <Badge variant="outline" className="text-[0.625rem]">{business.category}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {business.areaName ?? t.nearby.noBooth}{business.boothNo && ` · ${business.boothNo}`}
                  </p>
                  {business.description && <p className="mt-1 text-xs text-muted-foreground">{business.description}</p>}
                </div>
              ))}
            </div>
          )}
        </QueryState>
      </section>
    </div>
    </>
  );
}
