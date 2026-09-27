"use client";

import { useEffect, useState } from "react";
import { Clock3, QrCode as QrCodeIcon, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { QrCode } from "@/shared/ui/qr-code";
import { useTranslation } from "@/shared/lib/i18n";

const PAYMENT_TTL_SECONDS = 30;

export function EsgPayDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [paymentToken, setPaymentToken] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const createPayment = () => {
    setPaymentToken(`ESG-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
    setSecondsLeft(PAYMENT_TTL_SECONDS);
  };

  useEffect(() => {
    if (!open || secondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, secondsLeft]);

  const expired = secondsLeft === 0;

  const close = () => {
    setOpen(false);
    setPaymentToken("");
    setSecondsLeft(0);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}>
      <DialogTrigger
        onClick={createPayment}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-esg-text px-3 text-xs font-bold text-white transition-colors hover:bg-esg-text/90"
      >
        <QrCodeIcon className="size-3.5" /> {t.esg.pay.trigger}
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-2rem)] overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="bg-esg px-5 py-5 text-white">
          <DialogTitle className="flex items-center gap-2 text-white">
            <span className="grid size-9 place-items-center rounded-full bg-white/15">
              <QrCodeIcon className="size-5" />
            </span>
            {t.esg.pay.title}
          </DialogTitle>
          <DialogDescription className="text-white/80">
            {t.esg.pay.description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-5">
          <div className="flex flex-col items-center rounded-2xl border border-esg/30 bg-esg/5 p-4">
            {expired ? (
              <div className="grid size-[190px] place-items-center rounded-xl border border-dashed border-esg/40 bg-muted/40 text-center">
                <div>
                  <p className="text-sm font-extrabold text-muted-foreground">{t.esg.pay.expiredTitle}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t.esg.pay.expiredHint}</p>
                </div>
              </div>
            ) : (
              <QrCode value={paymentToken} size={190} alt={t.esg.pay.qrAlt} />
            )}

            <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-esg-text" aria-live="polite">
              <Clock3 className="size-3.5" />
              {expired ? t.esg.pay.expiredStatus : t.esg.pay.activeStatus(secondsLeft)}
            </div>
            <p className="mt-2 break-all text-center font-mono text-[10px] text-muted-foreground">
              {expired ? t.esg.pay.expiredTokenNotice : paymentToken}
            </p>
          </div>

          <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">
            {t.esg.pay.disclaimer}
          </p>
        </div>

        <DialogFooter>
          {expired && (
            <Button type="button" onClick={createPayment} className="bg-esg text-white hover:bg-esg/90">
              <RefreshCw className="size-4" /> {t.esg.pay.regenerate}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={close}>{t.esg.pay.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
