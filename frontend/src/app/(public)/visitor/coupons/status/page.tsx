"use client";

import Link from "next/link";

import { CheckCircle2, Clock3, PackageCheck } from "lucide-react";
import { reusableContainerPoints, useReusableContainerRentals, useReusableVisitorCode } from "@/features/reusable-containers";
import { VisitorEsgHeader } from "@/features/esg/ui/visitor-esg-header";
import { useTranslation } from "@/shared/lib/i18n";
import { Badge } from "@/shared/ui/badge";

export default function EsgStatusPage() {
  const { t, bcp47 } = useTranslation();
  const rentals = useReusableContainerRentals();
  const visitorCode = useReusableVisitorCode();

  const visitorRentals = rentals.filter((rental) => rental.visitorCode === visitorCode);
  const activeRental = visitorRentals.find((rental) => rental.status === "RENTED");
  const returnedRentals = visitorRentals.filter((rental) => rental.status === "RETURNED");
  const earnedPoints = reusableContainerPoints(visitorRentals);

  return (
    <div className="px-4 pt-4 pb-6">
      <VisitorEsgHeader title={t.esg.status.title} description={t.esg.status.subtitle} />

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-esg/10 text-esg-text">
              <PackageCheck className="size-4" />
            </span>
            <h2 className="text-sm font-bold text-foreground">{t.esg.status.currentTitle}</h2>
          </div>
          <Badge variant={activeRental ? "default" : "outline"} className="text-[10px]">
            {activeRental ? t.esg.status.rentedBadge : t.esg.status.notRentedBadge}
          </Badge>
        </div>

        {activeRental ? (
          <div className="mt-4 rounded-xl bg-esg/5 p-3">
            <p className="text-sm font-bold text-foreground">{t.esg.containerType[activeRental.containerType]} {t.esg.itemCount(activeRental.quantity)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{activeRental.rentalCode} · {activeRental.station}</p>
            <Link href="/visitor/coupons/return" className="mt-3 inline-flex rounded-full bg-esg px-3 py-1.5 text-xs font-bold text-white">
              {t.esg.status.viewReturnQr}
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-muted/40 p-4 text-center">
            <Clock3 className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-semibold text-foreground">{t.esg.status.emptyTitle}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t.esg.status.emptyHint}</p>
            <Link href="/visitor/coupons/rent" className="mt-3 inline-flex rounded-full border border-esg/40 px-3 py-1.5 text-xs font-bold text-esg-text">
              {t.esg.status.viewRentQr}
            </Link>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-foreground">{t.esg.status.returnHistoryTitle}</h2>
        {returnedRentals.length > 0 ? (
          <div className="mt-3 space-y-2">
            {returnedRentals.map((rental) => (
              <div key={rental.id} className="flex items-center justify-between gap-3 rounded-xl bg-esg/5 p-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{t.esg.containerType[rental.containerType]} {t.esg.itemCount(rental.quantity)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{rental.station} · {rental.returnedAt ? new Date(rental.returnedAt).toLocaleString(bcp47) : t.esg.status.returnedAtFallback}</p>
                </div>
                <span className="shrink-0 text-xs font-extrabold text-esg-text">+{rental.stampPoints}P</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">{t.esg.status.returnHistoryEmpty}</p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-esg-text">
          <CheckCircle2 className="size-3.5" /> {t.esg.status.returnSummary(returnedRentals.length, earnedPoints)}
        </p>
      </section>
    </div>
  );
}
