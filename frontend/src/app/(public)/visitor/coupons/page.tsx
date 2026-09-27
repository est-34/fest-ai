"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Coins, History, Recycle, Stamp, Ticket, Trash2 } from "lucide-react";
import { fetchPoints } from "@/entities/coupon";
import { EsgPayDialog } from "@/features/esg/ui/esg-pay-dialog";
import { useTranslation } from "@/shared/lib/i18n";

export default function EsgPage() {
  const { t } = useTranslation();
  const ESG_ACTIONS = [
    {
      href: "/visitor/coupons/wallet",
      label: t.esg.home.actions.coupon.label,
      description: t.esg.home.actions.coupon.description,
      icon: Ticket,
    },
    {
      href: "/visitor/stamp-tour",
      label: t.esg.home.actions.stamp.label,
      description: t.esg.home.actions.stamp.description,
      icon: Stamp,
    },
    {
      href: "/visitor/coupons/reusable",
      label: t.esg.home.actions.reusable.label,
      description: t.esg.home.actions.reusable.description,
      icon: Recycle,
    },
    {
      href: "/visitor/coupons/plogging",
      label: t.esg.home.actions.plogging.label,
      description: t.esg.home.actions.plogging.description,
      icon: Trash2,
    },
  ] as const;
  const points = useQuery({
    queryKey: ["visitor-points"],
    queryFn: fetchPoints,
    refetchInterval: 10_000,
  });


  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-6">
      <div>
        <h1 className="text-lg font-extrabold text-foreground">{t.esg.home.title}</h1>
        <p className="text-xs text-muted-foreground">
          {t.esg.home.subtitle}
        </p>
      </div>

      <section className="overflow-hidden rounded-2xl bg-esg p-5 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white/80">
              {t.esg.home.pointsCardLabel}
            </p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight">
              {(
                points.data?.balance ?? 0
              ).toLocaleString()}
              P
            </p>
            <p className="mt-2 text-[11px] leading-4 text-white/80">
              {t.esg.home.pointsEmptyNotice}
            </p>
          </div>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15">
            <Coins className="size-5" />
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/visitor/coupons/points"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-esg-text"
          >
            <History className="size-3.5" /> {t.esg.home.historyLink}
          </Link>
          <EsgPayDialog />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-foreground">{t.esg.home.featuresTitle}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {ESG_ACTIONS.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-24 flex-col items-center justify-between rounded-2xl border border-border bg-card p-3 text-center transition-colors hover:border-esg hover:bg-esg/5"
            >
              <span className="grid size-9 place-items-center rounded-full bg-esg/10 text-esg-text">
                <Icon className="size-4.5" />
              </span>
              <span>
                <span className="block text-xs font-bold text-foreground">
                  {label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-3 text-muted-foreground">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
