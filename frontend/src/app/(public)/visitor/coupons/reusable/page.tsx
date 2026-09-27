"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, PackageCheck } from "lucide-react";
import { useReusableContainerRentals, useReusableVisitorCode } from "@/features/reusable-containers";
import { VisitorEsgHeader } from "@/features/esg/ui/visitor-esg-header";
import { useTranslation } from "@/shared/lib/i18n";
import { Badge } from "@/shared/ui/badge";

export default function ReusableContainerPage() {
  const { t } = useTranslation();
  const ACTIONS = [
    {
      href: "/visitor/coupons/rent",
      label: t.esg.reusable.rentAction.label,
      description: t.esg.reusable.rentAction.description,
      icon: ArrowUpRight,
    },
    {
      href: "/visitor/coupons/return",
      label: t.esg.reusable.returnAction.label,
      description: t.esg.reusable.returnAction.description,
      icon: ArrowDownLeft,
    },
  ] as const;
  const visitorCode = useReusableVisitorCode();
  const rentals = useReusableContainerRentals();

  const activeRental = rentals.find((rental) => rental.visitorCode === visitorCode && rental.status === "RENTED");

  return (
    <div className="px-4 pt-4 pb-6">
      <VisitorEsgHeader title={t.esg.reusable.title} description={t.esg.reusable.subtitle} />

      <section className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-32 flex-col justify-between rounded-2xl border border-esg/30 bg-esg/5 p-4 transition-colors hover:bg-esg/10">
            <span className="grid size-10 place-items-center rounded-full bg-esg text-white"><Icon className="size-5" /></span>
            <span>
              <span className="block text-sm font-bold text-foreground">{label}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{description}</span>
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-esg/10 text-esg-text"><PackageCheck className="size-4" /></span>
            <h2 className="text-sm font-bold text-foreground">{t.esg.reusable.statusTitle}</h2>
          </div>
          <Badge variant={activeRental ? "default" : "outline"} className="text-[10px]">{activeRental ? t.esg.reusable.rentedBadge : t.esg.reusable.notRentedBadge}</Badge>
        </div>
        {activeRental ? (
          <div className="mt-3 rounded-xl bg-esg/5 p-3">
            <p className="text-sm font-bold text-foreground">{t.esg.containerType[activeRental.containerType]} {t.esg.itemCount(activeRental.quantity)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{activeRental.rentalCode} · {activeRental.station}</p>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">{t.esg.reusable.emptyStatusNotice}</p>
        )}
        <Link href="/visitor/coupons/status" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-esg-text">
          {t.esg.reusable.viewDetail} <ArrowLeft className="size-3 rotate-180" />
        </Link>
      </section>
    </div>
  );
}
