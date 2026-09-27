"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, QrCode as QrCodeIcon, Store, Ticket } from "lucide-react";
import Link from "next/link";
import {
  fetchCouponOffers,
  fetchMyCoupons,
  isCouponUsable,
  issueCoupon,
  reissueCouponToken,
} from "@/entities/coupon";
import { useTranslation } from "@/shared/lib/i18n";
import { useNow } from "@/shared/lib/use-now";
import { useWrite } from "@/shared/lib/use-write";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { EmptyState, ErrorState, queryErrorMessage } from "@/shared/ui/query-state";
import { QrCode } from "@/shared/ui/qr-code";
import { Skeleton } from "@/shared/ui/skeleton";

export default function CouponWalletPage() {
  const { t, locale, bcp47 } = useTranslation();
  const now = useNow(60_000);
  const myCoupons = useQuery({ queryKey: ["my-coupons", locale] as const, queryFn: () => fetchMyCoupons(locale) });
  const offers = useQuery({ queryKey: ["coupon-offers", locale] as const, queryFn: () => fetchCouponOffers(locale) });
  const issue = useWrite(issueCoupon, { invalidates: ["my-coupons"] });
  const reissue = useWrite(reissueCouponToken, { invalidates: ["my-coupons"] });

  return (
    <div className="px-4 pt-4 pb-6">
      <Link href="/visitor/coupons" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-esg-text">
        <ArrowLeft className="size-3.5" /> {t.esg.backTitle}
      </Link>
      <h1 className="text-lg font-extrabold text-foreground">{t.coupon.title}</h1>
      <p className="text-xs text-muted-foreground">{t.coupon.subtitle}</p>

      <section className="mt-5">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground"><Ticket className="size-4" /> {t.coupon.myCouponsTitle}</h2>
        {myCoupons.isLoading && <Skeleton className="h-40 rounded-2xl" />}
        {myCoupons.isError && <ErrorState message={queryErrorMessage(myCoupons.error, t.common.loadFailed)} retryLabel={t.common.retry} onRetry={() => myCoupons.refetch()} />}
        {myCoupons.data?.length === 0 && <EmptyState message={t.coupon.emptyMyCoupons} />}
        <div className="space-y-3">
          {myCoupons.data?.map((coupon) => {
            const usable = isCouponUsable(coupon, now);
            return (
              <article key={coupon.id} className={`rounded-2xl border p-4 ${usable ? "border-esg/30 bg-esg/5" : "border-border bg-muted/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{coupon.businessName}</p>
                    <p className="mt-0.5 text-sm font-semibold text-esg-text">{coupon.couponName} · {t.coupon.benefitLabel(coupon.benefitType, coupon.benefitValue)}</p>
                  </div>
                  <Badge variant={usable ? "default" : "outline"} className="shrink-0 text-[10px]">{t.coupon.status[coupon.status]}</Badge>
                </div>
                {usable && coupon.issueToken && (
                  <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-3">
                    <QrCode value={coupon.issueToken} alt={t.coupon.qrAlt(coupon.businessName)} size={160} />
                    <p className="break-all text-center font-mono text-xs font-bold tracking-wider text-foreground">{coupon.issueToken}</p>
                    <p className="text-center text-[11px] leading-4 text-muted-foreground">{t.coupon.qrHelper}</p>
                  </div>
                )}
                {usable && !coupon.issueToken && (
                  <div className="mt-3 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                    <p className="flex items-start gap-1.5 text-[11px] leading-4 text-amber-900 dark:text-amber-100"><AlertTriangle className="mt-px size-3.5 shrink-0" />{t.coupon.tokenMissing}</p>
                    <Button size="sm" variant="outline" className="w-full" disabled={reissue.isPending} onClick={() => reissue.mutate(coupon.id)}><QrCodeIcon className="size-3.5" /> {t.coupon.reissueButton}</Button>
                  </div>
                )}
                {!usable && <p className="mt-2 text-[11px] text-muted-foreground">{coupon.status === "REDEEMED" ? t.coupon.usedLine : t.coupon.expiredLine}</p>}
                {coupon.expiresAt && <p className="mt-2 text-[11px] text-muted-foreground">{t.coupon.expiresLine(new Date(coupon.expiresAt).toLocaleDateString(bcp47))}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-foreground"><Store className="size-4" /> {t.coupon.offersTitle}</h2>
        {offers.isLoading && <Skeleton className="h-24 rounded-2xl" />}
        {offers.isError && <ErrorState message={queryErrorMessage(offers.error, t.common.loadFailed)} retryLabel={t.common.retry} onRetry={() => offers.refetch()} />}
        {offers.data?.length === 0 && <EmptyState message={t.coupon.emptyOffers} />}
        <div className="space-y-2">
          {offers.data?.map((offer) => {
            const owned = myCoupons.data?.some((coupon) => coupon.couponName === offer.couponName && coupon.businessName === offer.businessName) ?? false;
            const soldOut = offer.remaining <= 0;
            return (
              <div key={offer.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-foreground">{offer.businessName}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{t.coupon.remainingLabel(Math.max(0, offer.remaining))}</Badge>
                </div>
                <p className="mt-1 text-sm font-semibold text-esg-text">{offer.couponName} · {t.coupon.benefitLabel(offer.benefitType, offer.benefitValue)}</p>
                {offer.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{offer.description}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{t.coupon.expiresLine(new Date(offer.validUntil).toLocaleDateString(bcp47))}</p>
                <Button size="sm" className="mt-2 w-full bg-esg text-white hover:bg-esg/90" disabled={owned || soldOut || issue.isPending} onClick={() => issue.mutate(offer.id)}><QrCodeIcon className="size-3.5" /> {owned ? t.coupon.alreadyIssued : soldOut ? t.coupon.soldOut : t.coupon.issueAction}</Button>
              </div>
            );
          })}
        </div>
        {issue.isError && <p className="mt-2 text-xs text-destructive" role="alert">{queryErrorMessage(issue.error, t.coupon.issueFailed)}</p>}
      </section>
    </div>
  );
}
