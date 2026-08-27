"use client";

import Link from "next/link";

import { QrCode as QrCodeIcon } from "lucide-react";
import { useReusableContainerRentals, useReusableVisitorCode } from "@/features/reusable-containers";
import { VisitorEsgHeader } from "@/features/esg/ui/visitor-esg-header";
import { useTranslation } from "@/shared/lib/i18n";
import { QrCode } from "@/shared/ui/qr-code";

export default function EsgReturnPage() {
  const { t } = useTranslation();
  const rentals = useReusableContainerRentals();
  const visitorCode = useReusableVisitorCode();

  const activeRental = rentals.find((rental) => rental.visitorCode === visitorCode && rental.status === "RENTED");

  return (
    <div className="px-4 pt-4 pb-6">
      <VisitorEsgHeader title={t.esg.return.title} description={t.esg.return.subtitle} />

      <section className="rounded-2xl border border-esg/30 bg-esg/5 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-esg-text">
          <QrCodeIcon className="size-4" /> {t.esg.return.codeLabel}
        </div>
        {activeRental ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-esg/40 bg-background p-5">
            <QrCode value={activeRental.rentalCode} size={190} alt={t.esg.return.qrAlt} />
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground">{t.esg.return.codeLabel}</p>
              <p className="mt-1 font-mono text-lg font-extrabold tracking-widest text-esg-text">{activeRental.rentalCode}</p>
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                {t.esg.containerType[activeRental.containerType]} {t.esg.itemCount(activeRental.quantity)} · {activeRental.station}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-5 text-center">
            <p className="text-sm font-semibold text-foreground">{t.esg.return.noRentalTitle}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t.esg.return.noRentalHint}</p>
            <Link href="/visitor/coupons/rent" className="mt-3 inline-flex rounded-full bg-esg px-3 py-1.5 text-xs font-bold text-white">
              {t.esg.return.viewRentQr}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
